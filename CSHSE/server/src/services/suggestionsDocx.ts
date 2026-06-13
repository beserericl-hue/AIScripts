import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  PageBreak
} from 'docx';
import mongoose from 'mongoose';
import { Comment, IComment } from '../models/Comment';
import { ValidationResult } from '../models/ValidationResult';
import { Submission } from '../models/Submission';
import { Score } from '../models/Score';
import { brandedSectionChrome } from './docxBranding';

// CR-003 / S11.1 — 0-3 rubric labels for the reader-suggestions DOCX.
const SCORE_LABELS: Record<number, string> = {
  0: 'Non-compliant (0)',
  1: 'Partial (1)',
  2: 'Largely compliant (2)',
  3: 'Fully compliant (3)'
};

// ---------------------------------------------------------------------------
// CR-011 / Sprint 5.2 — consolidated reader-suggestions DOCX.
//
// Pulls everything that constitutes a "reader suggestion" for a submission:
//   - Each reader's comment on a (std, spec) (and their replies);
//   - Reader override notes from CR-049 (ValidationResult.readerOverrideNote);
//   - The AI evaluator's improvement suggestions (ValidationResult.suggestions
//     + criteriaCoverage[].note for unmet criteria) — included as context
//     for the reader's suggestions.
//
// Grouped by Standard → Specification.
//
// Two modes (server-side enforced):
//   - internal  : full reader names visible (for the board / VP).
//   - pc_facing : reader identity stripped — content uses Comment.relayedText
//                 if set (Julia's sanitized text), and attribution uses
//                 Comment.pcLabel ("Reader A") if set, else "Anonymous reader".
//                 Unrelayed comments are excluded entirely (the PC must not
//                 see reader comments that weren't cleared by Julia).
//                 Reader override notes are excluded from pc_facing mode
//                 (they carry identity-bearing reasoning).
// ---------------------------------------------------------------------------

export type SuggestionsMode = 'internal' | 'pc_facing';

export interface SuggestionsDocOptions {
  submissionId: string;
  mode: SuggestionsMode;
}

interface SpecBucket {
  standardCode: string;
  specCode: string;
  comments: IComment[];
  overrideNotes: Array<{ note: string; verdict?: string }>;
  aiSuggestions: string[];
  // CR-003 — captured 0-3 reader scores for this spec.
  scores: Array<{ reviewerName: string; reviewerRole: string; score: number }>;
}

function bucketKey(std: string, spec: string): string {
  return `${std}_${spec}`;
}

function compareBucketKeys(a: SpecBucket, b: SpecBucket): number {
  if (a.standardCode !== b.standardCode) {
    return a.standardCode.localeCompare(b.standardCode, undefined, { numeric: true });
  }
  return a.specCode.localeCompare(b.specCode, undefined, { numeric: true });
}

function commentText(c: IComment, mode: SuggestionsMode): string {
  if (mode === 'pc_facing') {
    return (c.relayedText && c.relayedText.trim()) || c.content;
  }
  return c.content;
}

function commentAttribution(c: IComment, mode: SuggestionsMode): string {
  if (mode === 'pc_facing') {
    return c.pcLabel || 'Anonymous reader';
  }
  return c.authorName;
}

function p(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun(text)] });
}

function bold(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun({ text, bold: true })] });
}

function heading(text: string, level: typeof HeadingLevel[keyof typeof HeadingLevel]): Paragraph {
  return new Paragraph({ text, heading: level });
}

async function loadBuckets(opts: SuggestionsDocOptions): Promise<SpecBucket[]> {
  const submissionObjectId = new mongoose.Types.ObjectId(opts.submissionId);

  // Comments — pc_facing drops unrelayed. Internal keeps everything.
  const commentFilter: any = { submissionId: submissionObjectId };
  if (opts.mode === 'pc_facing') commentFilter.relayed = true;
  const comments = await Comment.find(commentFilter).sort({ createdAt: 1 }).lean();

  // ValidationResults — internal includes reader override notes + AI
  // suggestions; pc_facing includes only AI suggestions (no reader notes).
  // For each (std, spec) keep the latest result by validatedAt.
  const validations = await ValidationResult.find({ submissionId: submissionObjectId })
    .sort({ validatedAt: -1 })
    .lean();

  const latestBySpec = new Map<string, typeof validations[number]>();
  for (const v of validations) {
    const key = bucketKey(v.standardCode, v.specCode);
    if (!latestBySpec.has(key)) latestBySpec.set(key, v);
  }

  const buckets = new Map<string, SpecBucket>();
  function getBucket(std: string, spec: string): SpecBucket {
    const key = bucketKey(std, spec);
    let b = buckets.get(key);
    if (!b) {
      b = { standardCode: std, specCode: spec, comments: [], overrideNotes: [], aiSuggestions: [], scores: [] };
      buckets.set(key, b);
    }
    return b;
  }

  for (const c of comments) {
    const std = c.standardCode;
    const spec = c.specCode || '_';
    getBucket(std, spec).comments.push(c as unknown as IComment);
  }

  for (const [, v] of latestBySpec) {
    const bucket = getBucket(v.standardCode, v.specCode);
    if (v.result.readerOverridden && v.result.readerOverrideNote && opts.mode === 'internal') {
      bucket.overrideNotes.push({
        note: v.result.readerOverrideNote,
        verdict: v.result.verdict
      });
    }
    if (Array.isArray(v.result.suggestions)) {
      for (const s of v.result.suggestions) {
        if (s && s.trim()) bucket.aiSuggestions.push(s.trim());
      }
    }
    if (Array.isArray(v.result.criteriaCoverage)) {
      for (const cc of v.result.criteriaCoverage) {
        if (!cc.met && cc.note && cc.note.trim()) {
          bucket.aiSuggestions.push(`[${cc.criterion}] ${cc.note.trim()}`);
        }
      }
    }
  }

  // CR-003 — 0-3 reader scores per spec. Included in both modes ("score yes,
  // names no": pc_facing keeps the numeric score but the rendering below
  // redacts the reviewer name).
  const scores = await Score.find({ submissionId: submissionObjectId })
    .sort({ standardCode: 1, specCode: 1 })
    .lean();
  for (const sc of scores) {
    getBucket(sc.standardCode, sc.specCode).scores.push({
      reviewerName: sc.reviewerName,
      reviewerRole: sc.reviewerRole,
      score: sc.score
    });
  }

  // Only return buckets that have *something* to say.
  return Array.from(buckets.values())
    .filter(
      (b) =>
        b.comments.length > 0 ||
        b.overrideNotes.length > 0 ||
        b.aiSuggestions.length > 0 ||
        b.scores.length > 0
    )
    .sort(compareBucketKeys);
}

function buildSpecParagraphs(bucket: SpecBucket, mode: SuggestionsMode): Paragraph[] {
  const out: Paragraph[] = [];
  out.push(heading(`Standard ${bucket.standardCode}.${bucket.specCode}`, HeadingLevel.HEADING_3));

  // CR-003 — compliance scores (0-3) lead the spec block. In pc_facing mode
  // reviewer names are redacted to anonymous "Reader N" labels (score yes,
  // names no).
  if (bucket.scores.length) {
    out.push(bold('Compliance score (0-3)'));
    bucket.scores.forEach((s, i) => {
      const label = SCORE_LABELS[s.score] ?? String(s.score);
      const who = mode === 'pc_facing' ? `Reader ${i + 1}` : s.reviewerName;
      out.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${who}: `, bold: true }),
            new TextRun(label)
          ]
        })
      );
    });
  }

  if (bucket.comments.length) {
    out.push(bold('Reader comments'));
    for (const c of bucket.comments) {
      const who = commentAttribution(c, mode);
      const text = commentText(c, mode);
      out.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${who}: `, bold: true }),
            new TextRun(text)
          ]
        })
      );
      // Replies — apply same redaction rules.
      for (const r of (c.replies || [])) {
        if (mode === 'pc_facing') {
          if (r.authorRole !== 'program_coordinator' && !r.relayed) continue;
        }
        const replyWho =
          mode === 'pc_facing'
            ? r.authorRole === 'program_coordinator'
              ? r.authorName
              : (c.pcLabel || 'Anonymous reader')
            : r.authorName;
        const replyText =
          mode === 'pc_facing' && r.authorRole !== 'program_coordinator' && r.relayedText
            ? r.relayedText
            : r.content;
        out.push(
          new Paragraph({
            children: [
              new TextRun({ text: `    ↳ ${replyWho}: `, italics: true }),
              new TextRun({ text: replyText, italics: true })
            ]
          })
        );
      }
    }
  }

  if (bucket.overrideNotes.length) {
    out.push(bold('Reader override notes'));
    for (const o of bucket.overrideNotes) {
      out.push(
        new Paragraph({
          children: [
            new TextRun({ text: `[${o.verdict || 'override'}] `, bold: true }),
            new TextRun(o.note)
          ]
        })
      );
    }
  }

  if (bucket.aiSuggestions.length) {
    out.push(bold('AI evaluator suggestions'));
    for (const s of bucket.aiSuggestions) {
      out.push(new Paragraph({ children: [new TextRun(`• ${s}`)] }));
    }
  }

  return out;
}

export async function generateSuggestionsDocx(opts: SuggestionsDocOptions): Promise<Buffer> {
  const submission = await Submission.findById(opts.submissionId).lean();
  if (!submission) {
    throw new Error('Submission not found');
  }

  const buckets = await loadBuckets(opts);
  const now = new Date();

  const cover: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: 'CSHSE Self-Study Suggestions',
          bold: true,
          size: 36
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: submission.institutionName, size: 28 })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `${submission.programName} (${String(submission.programLevel).toUpperCase()})`,
          size: 24
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Mode: ${opts.mode === 'pc_facing' ? 'PC-facing (reader identity redacted)' : 'Internal (board / VP)'}`,
          size: 20
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Generated ${now.toISOString().slice(0, 10)}`,
          size: 20
        })
      ]
    }),
    new Paragraph({ children: [new PageBreak()] })
  ];

  const bodyParas: Paragraph[] = [];
  if (buckets.length === 0) {
    bodyParas.push(p('No reader suggestions have been recorded for this submission.'));
  } else {
    let lastStd: string | null = null;
    for (const bucket of buckets) {
      if (lastStd !== bucket.standardCode) {
        if (lastStd != null) bodyParas.push(new Paragraph({ children: [new PageBreak()] }));
        bodyParas.push(heading(`Standard ${bucket.standardCode}`, HeadingLevel.HEADING_2));
        lastStd = bucket.standardCode;
      }
      bodyParas.push(...buildSpecParagraphs(bucket, opts.mode));
    }
  }

  const doc = new Document({
    creator: 'CSHSE Self-Study Portal',
    title: 'CSHSE Suggestions',
    description: `Suggestions consolidation for ${submission.institutionName}`,
    sections: [
      {
        properties: {},
        // CR-011 / S11.4 — CSHSE-branded header (logo + org) + footer
        // (confidentiality line + page numbers) on every page.
        ...brandedSectionChrome(),
        children: [...cover, ...bodyParas]
      }
    ]
  });

  return Packer.toBuffer(doc);
}
