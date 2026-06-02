/**
 * Importer concurrency / load test (task #41).
 *
 * The document-matcher pipeline dispatches each section of a self-study to the
 * n8n "Document Matcher" webhook, which classifies it via OpenAI and POSTs the
 * result back to `/api/webhooks/document-matcher/callback` — ONE callback per
 * section. n8n executes those section jobs in parallel, so the callbacks for a
 * single import arrive CONCURRENTLY and interleaved, and when several users
 * import at once the server sees many independent jobs racing through the same
 * endpoint.
 *
 * This suite pins the two scalability invariants that must hold under that load:
 *
 *   1. WITHIN a single job: every section callback is accounted for — no lost
 *      updates. `n8nReceivedSections` and the persisted section arrays must
 *      reflect ALL sections even when every callback lands simultaneously.
 *      (Before the atomic-update fix this failed: the callback did a full
 *      findById → mutate → save() read-modify-write, so concurrent saves
 *      clobbered each other / threw VersionError.)
 *
 *   2. ACROSS jobs (multiple users importing at once): jobs are fully isolated —
 *      a section from user A's import never lands in user B's import, and each
 *      import completes with exactly its own section count. Target: 5 concurrent
 *      users (the live scale-up goal), driven here well past that per-section.
 *
 * We exercise the real callback controller + Mongo writes directly (seeding the
 * SelfStudyImport rows rather than going through multipart upload + S3 + GridFS
 * + background parsing), which isolates the concurrency-critical path and keeps
 * the test deterministic and fast.
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { SelfStudyImport } from '../../src/models/SelfStudyImport';
import { Submission } from '../../src/models/Submission';
import { createUser } from '../helpers/factories';

const CALLBACK_URL = '/api/webhooks/document-matcher/callback';

// A spread of standards so mapped/unmapped/low-confidence branches all exercise
// concurrently — mirrors a realistic mix of AI verdicts in one import.
function matchForIndex(i: number) {
  const mod = i % 3;
  if (mod === 0) {
    // High-confidence full match → mappedSections
    return {
      status: 'matched' as const,
      standard: { code: String((i % 21) + 1), title: `Standard ${(i % 21) + 1}` },
      subspecification: { code: 'a', title: 'Sub A' },
      confidence: 90,
      rationale: `confident match for section ${i}`,
    };
  }
  if (mod === 1) {
    // Low-confidence match → unmappedContent (pending review)
    return {
      status: 'matched' as const,
      standard: { code: String((i % 21) + 1), title: `Standard ${(i % 21) + 1}` },
      subspecification: { code: 'b', title: 'Sub B' },
      confidence: 20,
      rationale: `low-confidence match for section ${i}`,
    };
  }
  // Unmatched → unmappedContent
  return { status: 'unmatched' as const, rationale: `no match for section ${i}` };
}

function callbackBody(opts: {
  importId: string;
  jobId: string;
  sectionIndex: number;
  totalSections: number;
  moreData: boolean;
}) {
  return {
    type: 'section_result',
    jobId: opts.jobId,
    documentId: opts.importId,
    specName: 'CSHSE Standards',
    moreData: opts.moreData,
    sectionIndex: opts.sectionIndex,
    totalSections: opts.totalSections,
    section: {
      heading: `Section ${opts.sectionIndex}`,
      richTextContent: `<p>Body content for section ${opts.sectionIndex}.</p>`,
      match: matchForIndex(opts.sectionIndex),
    },
  };
}

async function seedImport(userId: any, _label: string) {
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

  // Seed the import the way it exists the instant before n8n callbacks begin:
  // status 'processing', no job tracking yet (the first callback initializes
  // n8nJobId / n8nTotalSections — exactly as in production).
  const imp = await SelfStudyImport.create({
    submissionId: submission._id,
    originalFilename: 'load.docx',
    fileType: 'docx',
    uploadedBy: userId,
    status: 'processing',
    extractedContent: { rawText: '', pageCount: 0, metadata: {}, sections: [] },
    mappedSections: [],
    unmappedContent: [],
  } as any);

  return { submissionId: submission._id, importId: String(imp._id) };
}

// Fire every section callback for a job at once, fully interleaved.
function fireAllSections(importId: string, jobId: string, total: number) {
  const order = shuffledIndices(total);
  return order.map((sectionIndex) =>
    request(app)
      .post(CALLBACK_URL)
      .send(
        callbackBody({
          importId,
          jobId,
          sectionIndex,
          totalSections: total,
          // The terminal callback (moreData:false) is the LAST section index;
          // shuffling means it can physically arrive in any position.
          moreData: sectionIndex !== total - 1,
        })
      )
  );
}

function shuffledIndices(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

describe('Importer concurrency — single job, all sections callback at once', () => {
  it('accounts for every section with no lost updates (12 concurrent callbacks)', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const TOTAL = 12;
    const { importId } = await seedImport(user._id, 'single');
    const jobId = `job-single-${importId}`;

    const responses = await Promise.all(fireAllSections(importId, jobId, TOTAL));

    // Every callback must succeed (no 409 VersionError / 500 race fallout).
    for (const r of responses) {
      expect(r.status, `callback failed: ${r.status} ${JSON.stringify(r.body)}`).toBe(200);
    }

    const imp = await SelfStudyImport.findById(importId).lean();
    expect(imp).toBeTruthy();
    // The integrity invariant: every section was persisted exactly once.
    expect(imp!.n8nReceivedSections).toBe(TOTAL);
    expect(imp!.extractedContent.sections).toHaveLength(TOTAL);
    expect(imp!.mappedSections.length + imp!.unmappedContent.length).toBe(TOTAL);
    expect(imp!.status).toBe('completed');

    // No duplicate / missing section indices (headings are unique per index).
    const headings = new Set(
      imp!.extractedContent.sections.map((s: any) => (s.content.match(/Section (\d+)/) || [])[1])
    );
    expect(headings.size).toBe(TOTAL);
  });
});

describe('Importer concurrency — 5 users importing simultaneously', () => {
  it('isolates jobs and accounts for every section across all imports', async () => {
    const USERS = 5;
    const PER_IMPORT = 8;

    const seeds = await Promise.all(
      Array.from({ length: USERS }, async (_, u) => {
        const { user } = await createUser({ role: 'program_coordinator' });
        const s = await seedImport(user._id, `u${u}`);
        return { ...s, jobId: `job-u${u}-${s.importId}` };
      })
    );

    // Interleave EVERY section of EVERY import into one big concurrent burst
    // (5 × 8 = 40 callbacks all in flight at once).
    const allCalls = seeds.flatMap((seed) =>
      fireAllSections(seed.importId, seed.jobId, PER_IMPORT)
    );
    const responses = await Promise.all(allCalls);
    for (const r of responses) {
      expect(r.status, `callback failed: ${r.status} ${JSON.stringify(r.body)}`).toBe(200);
    }

    // Each import must independently account for exactly its own sections.
    for (const seed of seeds) {
      const imp = await SelfStudyImport.findById(seed.importId).lean();
      expect(imp, `import ${seed.importId} missing`).toBeTruthy();
      expect(imp!.n8nReceivedSections, `received for ${seed.importId}`).toBe(PER_IMPORT);
      expect(imp!.extractedContent.sections, `sections for ${seed.importId}`).toHaveLength(PER_IMPORT);
      expect(imp!.mappedSections.length + imp!.unmappedContent.length).toBe(PER_IMPORT);
      expect(imp!.status).toBe('completed');
      expect(imp!.n8nJobId).toBe(seed.jobId);
    }

    // Cross-contamination guard: total persisted sections across all imports
    // equals the total fired — nothing leaked between jobs.
    let totalPersisted = 0;
    for (const seed of seeds) {
      const imp = await SelfStudyImport.findById(seed.importId).lean();
      totalPersisted += imp!.extractedContent.sections.length;
    }
    expect(totalPersisted).toBe(USERS * PER_IMPORT);
  });
});
