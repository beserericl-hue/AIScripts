/**
 * AI Import Wizard concurrency / load test (task #41).
 *
 * This is the SCALABILITY pin for the importer that actually runs for users:
 * the cshse-ai (FastAPI) AI Import Wizard. The flow is
 *
 *     POST /api/imports/:id/start-ai   →  cshse-ai parses the document
 *     POST /api/imports/:id/ai-event   ←  incremental progress SNAPSHOTS
 *                                          (status / queue / stage list),
 *                                          several per import, HMAC-signed
 *     POST /api/imports/:id/ai-callback ←  ONE terminal payload with the
 *                                          parsed buckets / tags / matrices,
 *                                          HMAC-signed
 *
 * Two invariants must hold when MULTIPLE USERS import at once (the live
 * scale-up goal is 5 concurrent users):
 *
 *   1. WITHIN a single import: a burst of ai-events that all land at once
 *      must NOT 500. The old findById → mutate → save() read-modify-write
 *      threw a Mongoose VersionError under that race (optimistic __v guard),
 *      dropping the event and corrupting the wizard's live progress strip.
 *      ai-events are progress snapshots, so the surviving state must be ONE
 *      of the posted snapshots (last-writer-wins) — never a 500, never a
 *      torn write.
 *
 *   2. ACROSS imports (5 users at once): imports are fully isolated. A bucket
 *      / tag from user A's terminal callback never lands in user B's import,
 *      every import ends in its own terminal status, and each Submission's
 *      aiReviewState reflects only its own import's content.
 *
 * We drive the real HMAC-verified webhook controllers + Mongo writes directly
 * (seeding SelfStudyImport rows rather than going through multipart upload +
 * S3 + the external FastAPI dispatch), which isolates the concurrency-critical
 * path and keeps the test deterministic and fast — exactly as ai-import.test.ts
 * does for the single-request cases.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import app from '../../src/index';
import { SelfStudyImport } from '../../src/models/SelfStudyImport';
import { Submission } from '../../src/models/Submission';
import { createUser } from '../helpers/factories';

const TEST_HMAC_SECRET = 'test-hmac-secret-must-be-non-empty';

// cshse-ai signs each webhook over `${ts}.${rawBody}` with the shared HMAC
// secret; the server's verifyIncoming re-derives and constant-time compares.
function signRequest(body: object): string {
  const ts = Math.floor(Date.now() / 1000).toString();
  const raw = JSON.stringify(body);
  const digest = crypto
    .createHmac('sha256', TEST_HMAC_SECRET)
    .update(`${ts}.${raw}`)
    .digest('hex');
  return `t=${ts},v1=${digest}`;
}

function postSigned(url: string, body: object) {
  return request(app)
    .post(url)
    .set('X-Service-Signature', signRequest(body))
    .send(body);
}

async function seedImport(userId: any) {
  const submission = await Submission.create({
    submissionId: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    institutionName: 'Load Test University',
    programName: 'Human Services',
    programLevel: 'bachelors',
    submitterId: userId,
    type: 'initial',
    status: 'draft',
    narratives: new Map(),
  } as any);

  // Seed the import the way it exists the instant before cshse-ai webhooks
  // begin: status 'processing', aiStatus 'queued' (start-ai already fired).
  const imp = await SelfStudyImport.create({
    submissionId: submission._id,
    originalFilename: 'load.docx',
    fileType: 'docx',
    uploadedBy: userId,
    status: 'processing',
    aiStatus: 'queued',
    aiProgramLevel: 'bachelors',
    extractedContent: { rawText: '', pageCount: 0, metadata: {}, sections: [] },
    mappedSections: [],
    unmappedContent: [],
  } as any);

  return { submissionId: submission._id, importId: String(imp._id) };
}

// A progress snapshot for the Nth ai-event of an import. Each event carries a
// full stage list (that is how cshse-ai posts them — cumulative snapshots),
// so under a race the persisted value must equal one of these snapshots whole.
function eventSnapshot(step: number, total: number) {
  const STAGES = ['mammoth', 'format_detector', 'template_walker', 'matcher', 'finalize'];
  const stages = STAGES.map((name, i) => ({
    name,
    state: i < step ? 'done' : i === step ? 'running' : 'pending',
    detail: `step ${step}`,
  }));
  return {
    status: step >= total - 1 ? 'parsing' : 'queued',
    queuePosition: Math.max(0, total - step - 1),
    queueDepth: total,
    stages,
    errors: [],
  };
}

// The terminal callback for an import, with buckets/tags uniquely tagged by a
// per-import marker so cross-contamination is detectable.
function terminalPayload(marker: string) {
  return {
    status: 'parsed' as const,
    buckets: {
      '1.a': {
        standardCode: '1',
        specCode: 'a',
        standardTitle: 'Test',
        specPrompt: 'test',
        narratives: [
          {
            sectionId: `sec-${marker}`,
            heading: `heading-${marker}`,
            snippet: `snippet-${marker}`,
            wordCount: 10,
            confidence: 0.9,
            acceptState: 'auto_accept',
            rationale: 'r',
          },
        ],
        evidenceText: [],
        evidenceFiles: [],
        matrixCells: [],
        coverageScore: 0.8,
        coverageCovered: false,
        coverageGaps: [],
        coverageStrengths: [],
      },
    },
    tags: [
      {
        tagId: `tag-${marker}`,
        sectionId: `sec2-${marker}`,
        summary: 'sum',
        fullText: 'full',
        suggestedStd: '1',
        suggestedSpec: 'b',
        confidence: 0.4,
        sourceHeading: 'src',
        acceptState: 'review_low_confidence',
        rationale: 'r2',
      },
    ],
    placeholderSections: [],
    matrices: [],
    format: { format: 'template', confidence: 0.95, signals: {}, reasoning: 'detected' },
    stages: [{ name: 'finalize', state: 'done', detail: '' }],
    errors: [],
  };
}

describe('AI Import concurrency — single import, ai-event burst', () => {
  beforeEach(() => {
    process.env.NODE_SERVICE_HMAC_SECRET = TEST_HMAC_SECRET;
  });

  it('survives a burst of concurrent ai-events with no 500 / VersionError, then a clean terminal callback', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const { importId } = await seedImport(user._id);

    const EVENTS = 10;
    // Fire every progress snapshot at once, fully interleaved.
    const eventResponses = await Promise.all(
      Array.from({ length: EVENTS }, (_, step) =>
        postSigned(`/api/imports/${importId}/ai-event`, eventSnapshot(step, EVENTS))
      )
    );
    // The integrity invariant: every event is cleanly applied — no
    // VersionError 500s, no dropped events.
    for (const r of eventResponses) {
      expect(r.status, `ai-event failed: ${r.status} ${JSON.stringify(r.body)}`).toBe(200);
      expect(r.body.ok).toBe(true);
    }

    // The persisted progress is a WHOLE snapshot (last-writer-wins), never a
    // torn merge of two events.
    const mid = await SelfStudyImport.findById(importId).lean();
    expect(mid).toBeTruthy();
    expect(mid!.aiStages).toHaveLength(5);
    expect(['queued', 'parsing']).toContain(mid!.aiStatus);

    // Terminal callback lands cleanly on top.
    const term = await postSigned(`/api/imports/${importId}/ai-callback`, terminalPayload('solo'));
    expect(term.status, `ai-callback failed: ${term.status} ${JSON.stringify(term.body)}`).toBe(200);

    const done = await SelfStudyImport.findById(importId).lean();
    expect(done!.aiStatus).toBe('parsed');
    expect(done!.aiTags).toHaveLength(1);
    expect(done!.aiTags?.[0].tagId).toBe('tag-solo');
    expect(done!.aiBuckets?.['1.a']?.narratives?.[0].sectionId).toBe('sec-solo');
  });
});

describe('AI Import concurrency — 5 users importing simultaneously', () => {
  beforeEach(() => {
    process.env.NODE_SERVICE_HMAC_SECRET = TEST_HMAC_SECRET;
  });

  it('isolates imports and merges each Submission.aiReviewState independently', async () => {
    const USERS = 5;
    const EVENTS_PER_IMPORT = 6;

    const seeds = await Promise.all(
      Array.from({ length: USERS }, async (_, u) => {
        const { user } = await createUser({ role: 'program_coordinator' });
        const s = await seedImport(user._id);
        return { ...s, marker: `u${u}` };
      })
    );

    // Interleave EVERY ai-event of EVERY import into one big concurrent burst
    // (5 × 6 = 30 events all in flight), then fire all 5 terminal callbacks
    // concurrently. Mirrors 5 users whose imports finish at the same instant.
    const eventCalls = seeds.flatMap((seed) =>
      Array.from({ length: EVENTS_PER_IMPORT }, (_, step) =>
        postSigned(`/api/imports/${seed.importId}/ai-event`, eventSnapshot(step, EVENTS_PER_IMPORT))
      )
    );
    const eventResponses = await Promise.all(eventCalls);
    for (const r of eventResponses) {
      expect(r.status, `ai-event failed: ${r.status} ${JSON.stringify(r.body)}`).toBe(200);
    }

    const termResponses = await Promise.all(
      seeds.map((seed) =>
        postSigned(`/api/imports/${seed.importId}/ai-callback`, terminalPayload(seed.marker))
      )
    );
    for (const r of termResponses) {
      expect(r.status, `ai-callback failed: ${r.status} ${JSON.stringify(r.body)}`).toBe(200);
    }

    // Each import must independently carry ONLY its own marker — no bucket /
    // tag leaked from another user's concurrent callback.
    for (const seed of seeds) {
      const imp = await SelfStudyImport.findById(seed.importId).lean();
      expect(imp, `import ${seed.importId} missing`).toBeTruthy();
      expect(imp!.aiStatus, `status for ${seed.marker}`).toBe('parsed');
      expect(imp!.aiTags, `tags for ${seed.marker}`).toHaveLength(1);
      expect(imp!.aiTags?.[0].tagId).toBe(`tag-${seed.marker}`);
      expect(imp!.aiBuckets?.['1.a']?.narratives?.[0].sectionId).toBe(`sec-${seed.marker}`);

      // CR-043 — the per-submission merge reflects only this import's content.
      const sub: any = await Submission.findById(seed.submissionId).lean();
      expect(sub, `submission for ${seed.marker} missing`).toBeTruthy();
      expect(sub.aiReviewState, `aiReviewState for ${seed.marker}`).toBeTruthy();
      const merged = JSON.stringify(sub.aiReviewState);
      // Its own marker is present; no OTHER user's marker leaked in.
      expect(merged).toContain(seed.marker);
      for (const other of seeds) {
        if (other.marker === seed.marker) continue;
        expect(
          merged.includes(`sec-${other.marker}`) || merged.includes(`tag-${other.marker}`),
          `cross-contamination: ${other.marker} leaked into ${seed.marker}`
        ).toBe(false);
      }
    }
  });
});
