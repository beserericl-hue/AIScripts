/**
 * CR-040 follow-on (2026-05-27) — REAL Stevenson document TOC walker.
 *
 * User feedback: "your testing would have found this issue ... Please
 * build a test that navigates the TOC and lists out the numbers of CVs,
 * projects and syllabi in the document, and then slow walks the TOC to
 * the actual part of the document. Please stop guessing and actually
 * test this out."
 *
 * This test runs against the LIVE deployed dev system (cshse-develop +
 * cshse-ai-develop) and points at the user's actual Stevenson
 * submission (the one in the screenshot URL,
 * /self-study/6986239a6612bf17f04a3217). It does not seed a synthetic
 * fixture — it inspects what's already there.
 *
 * Flow:
 *   1. GET /api/test/imports-for-submission/{user's submission}
 *      → list the imports on the user's Stevenson submission
 *      → pick the one with an aiS3Key (only one ever should)
 *   2. GET /api/test/inspect-toc/{importId}
 *      → server fetches the import's aiS3Key
 *      → server POSTs /ai/debug/inspect-toc to cshse-ai with HMAC
 *      → cshse-ai pulls the DOCX from S3, runs mammoth + parse_toc +
 *        parse_sub_tocs + anchor_in_body, returns the full structure
 *   3. Pretty-print:
 *      - Main TOC entries with kind classification (cv / syllabus /
 *        paper / unknown), grouped by section_hint
 *      - Sub-TOC entries (the appendix listings my detector found)
 *      - Body-anchored detections: for each, label + kind +
 *        byte_offset_start + first 300 chars of the body text we
 *        sliced as that entry's content
 *      - Counts: how many CVs / syllabi / papers the detector
 *        ACTUALLY recovers from the user's real document
 *   4. Assert reality: ≥ N CVs (per the user's claim that the TOC
 *      lists more than the 4 the pattern detector found).
 *
 * This is intentionally a STORY test — when it runs, the console
 * output is the report the user asked for ("list out the numbers of
 * CVs, projects and syllabi ... slow walks the TOC to the actual part
 * of the document"). Set `playwright test --reporter=list` or look at
 * the HTML report to see the full dump.
 *
 * If the user's submissionId changes (different self-study under
 * review), update STEVENSON_SUBMISSION_ID below.
 */
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'https://cshse-develop.up.railway.app';
const TOKEN = process.env.E2E_SEED_TOKEN ?? '';

// The user's Stevenson submission, from the URL fragment in their
// 2026-05-27 screenshot: /self-study/6986239a6612bf17f04a3217#FacCVs
const STEVENSON_SUBMISSION_ID =
  process.env.STEVENSON_SUBMISSION_ID || '6986239a6612bf17f04a3217';

interface ImportInfo {
  id: string;
  originalFilename: string;
  aiStatus: string;
  aiS3Key: string | null;
  hasS3Key: boolean;
  createdAt: string;
}

interface TocEntry {
  label: string;
  kind: 'cv' | 'syllabus' | 'paper' | 'unknown';
  section_hint: string | null;
  raw: string;
}

interface AnchoredDetection {
  label: string;
  kind: 'cv' | 'syllabus' | 'paper';
  section_hint: string | null;
  course_code: string | null;
  byte_offset_start: number;
  body_text_preview: string;
}

interface PatternCv {
  facultyName: string;
  snippet: string;
  byte_offset_start: number;
  section_marker_count: number;
}

interface InspectionResult {
  ok: true;
  mainTocEntries: TocEntry[];
  subTocEntries: TocEntry[];
  anchoredDetections: AnchoredDetection[];
  patternCvs: PatternCv[];
  counts: {
    mainTocByKind: Record<string, number>;
    subTocByKind: Record<string, number>;
    anchoredByKind: Record<string, number>;
    totalTocEntries: number;
    totalAnchored: number;
    patternCvCount: number;
  };
  documentBytes: number;
}

test.describe('CR-040 — REAL Stevenson document TOC walker', () => {
  test.skip(!TOKEN, 'E2E_SEED_TOKEN not set — cannot hit the diagnostic endpoint.');

  test('walks the actual Stevenson TOC and reports CV / syllabi / paper counts', async () => {
    test.setTimeout(10 * 60 * 1000); // 10 minutes — TOC inspection on a 370MB doc

    // --- Step 1: find the import on the user's submission ---
    const listRes = await fetch(
      `${BASE_URL}/api/test/imports-for-submission/${STEVENSON_SUBMISSION_ID}`,
      { headers: { 'x-e2e-seed-token': TOKEN } }
    );
    expect(listRes.status, `list-imports HTTP ${listRes.status}: ${await listRes.text()}`).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.imports.length, 'no imports on submission').toBeGreaterThan(0);

    console.log('\n========================================');
    console.log(`Imports on submission ${STEVENSON_SUBMISSION_ID}:`);
    console.log('========================================');
    for (const i of listBody.imports as ImportInfo[]) {
      console.log(
        `  • ${i.id}  ${i.originalFilename}  aiStatus=${i.aiStatus}  hasS3Key=${i.hasS3Key}`
      );
    }

    const withKey = (listBody.imports as ImportInfo[]).find((i) => i.hasS3Key);
    expect(withKey, 'no import on this submission has an aiS3Key — cannot inspect TOC').toBeTruthy();
    const importId = withKey!.id;
    console.log(`\nPicked importId=${importId} (${withKey!.originalFilename})`);

    // --- Step 2: inspect the TOC ---
    console.log('\nRequesting TOC inspection (this can take 1-5 minutes for a 370MB doc)…');
    const inspectRes = await fetch(`${BASE_URL}/api/test/inspect-toc/${importId}`, {
      headers: { 'x-e2e-seed-token': TOKEN },
    });
    const inspectStatus = inspectRes.status;
    const inspectBodyText = await inspectRes.text();
    if (inspectStatus !== 200) {
      console.error(`\ninspect-toc HTTP ${inspectStatus}:`);
      console.error(inspectBodyText.slice(0, 2000));
    }
    expect(inspectStatus, `inspect-toc HTTP ${inspectStatus}`).toBe(200);
    const result: { ok: true; import: any; inspection: InspectionResult } = JSON.parse(inspectBodyText);
    const insp = result.inspection;

    console.log('\n========================================');
    console.log(`Document: ${result.import.originalFilename}`);
    console.log(`HTML size: ${(insp.documentBytes / 1024 / 1024).toFixed(2)} MB`);
    console.log('========================================');

    // --- Step 3a: main TOC entries ---
    console.log(`\nMAIN TOC — ${insp.mainTocEntries.length} entries`);
    console.log(
      `  counts: cv=${insp.counts.mainTocByKind.cv} ` +
        `syllabus=${insp.counts.mainTocByKind.syllabus} ` +
        `paper=${insp.counts.mainTocByKind.paper} ` +
        `unknown=${insp.counts.mainTocByKind.unknown}`
    );
    for (const e of insp.mainTocEntries) {
      console.log(
        `  [${e.kind.padEnd(9)}] hint=${(e.section_hint || '-').padEnd(8)}  ${e.label}`
      );
    }

    // --- Step 3b: sub-TOC entries ---
    console.log(`\nSUB-TOC — ${insp.subTocEntries.length} entries`);
    console.log(
      `  counts: cv=${insp.counts.subTocByKind.cv} ` +
        `syllabus=${insp.counts.subTocByKind.syllabus} ` +
        `paper=${insp.counts.subTocByKind.paper} ` +
        `unknown=${insp.counts.subTocByKind.unknown}`
    );
    for (const e of insp.subTocEntries) {
      console.log(
        `  [${e.kind.padEnd(9)}] hint=${(e.section_hint || '-').padEnd(8)}  ${e.label}`
      );
    }

    // --- Step 3c: body-anchored detections (TOC-pass recoveries) ---
    console.log(`\nBODY-ANCHORED DETECTIONS (from TOC) — ${insp.anchoredDetections.length} total`);
    console.log(
      `  counts: cv=${insp.counts.anchoredByKind.cv} ` +
        `syllabus=${insp.counts.anchoredByKind.syllabus} ` +
        `paper=${insp.counts.anchoredByKind.paper}`
    );
    for (const d of insp.anchoredDetections) {
      console.log(
        `\n  [${d.kind.padEnd(9)}] @${String(d.byte_offset_start).padStart(5)}  ${d.label}`
      );
      if (d.course_code) console.log(`    course: ${d.course_code}`);
      if (d.body_text_preview) {
        const preview = d.body_text_preview.replace(/\n+/g, ' ⏎ ').slice(0, 200);
        console.log(`    body: ${preview}…`);
      }
    }

    // --- Step 3d: pattern-detector CV findings ---
    console.log(`\nPATTERN-DETECTED CVs (cv_detector) — ${insp.patternCvs.length} total`);
    for (const cv of insp.patternCvs) {
      console.log(
        `  [cv] @${String(cv.byte_offset_start).padStart(5)} ` +
          `(${cv.section_marker_count} markers)  ${cv.facultyName}`
      );
    }

    // --- Step 4: combined reality check ---
    const tocCvNames = new Set(
      insp.anchoredDetections.filter((d) => d.kind === 'cv').map((d) => d.label.toLowerCase())
    );
    const patternCvNames = new Set(
      insp.patternCvs.map((c) => c.facultyName.toLowerCase())
    );
    const allCvNames = new Set([...tocCvNames, ...patternCvNames]);

    console.log('\n========================================');
    console.log('RECAP — what the detector finds in the real document:');
    console.log(`  TOC entries total:        ${insp.counts.totalTocEntries}`);
    console.log(`  TOC-anchored CVs:         ${insp.counts.anchoredByKind.cv ?? 0}`);
    console.log(`  Pattern-detected CVs:     ${insp.counts.patternCvCount}`);
    console.log(`  Union (after dedupe):     ${allCvNames.size}`);
    console.log(`  Syllabi anchored (TOC):   ${insp.counts.anchoredByKind.syllabus ?? 0}`);
    console.log(`  Papers anchored (TOC):    ${insp.counts.anchoredByKind.paper ?? 0}`);
    console.log('========================================');

    // The user reported "4 faculty CVs detected" — the legacy pattern
    // detector's count. With my credentials-suffix + ALL-CAPS fixes
    // the pattern detector should now find more (Thomas K. Swisher,
    // LAURI A. WEINER, etc. that the user's screenshot showed in the
    // body but the old detector missed). Assert union > 4 to pin
    // the recovery.
    expect(
      allCvNames.size,
      `Expected the combined TOC + pattern detector to recover more ` +
        `than 4 CVs from the real Stevenson document; got ${allCvNames.size}. ` +
        `If this is 4 (same as legacy), the credentials-suffix + ` +
        `ALL-CAPS-with-initial fixes didn't fire on this doc — ` +
        `inspect the patternCvs[] list above to see which anchors ` +
        `the detector did find, and which are still missing.`
    ).toBeGreaterThan(4);
  });
});
