/**
 * Import corrections — the feedback loop that closes the gap when the AI
 * wizard misses a spec or routes a section to the wrong one.
 *
 * Coordinator behavior:
 *   - Sees an empty spec card in the wizard rail even though the source
 *     document plainly addresses that spec.
 *   - Clicks "+ Add from source", highlights the source passage, picks
 *     the correct (std, spec).
 *   - The wizard immediately fills that spec card AND fires this
 *     correction record so the matcher learns from the example.
 *
 * Server-side this row holds the truth. It is also forwarded over HMAC to
 * cshse-ai which embeds `sourceText` and stores it in Qdrant
 * (`cshse_corrections_{env}`). On future imports the matcher queries that
 * collection — scoped by `institutionId` + `programLevel` — and injects
 * the top-N hits as few-shot examples in the Haiku prompt. The matcher's
 * decision stays Haiku-driven (soft hint per user decision 2026-05-20),
 * so one bad correction can't permanently mis-route future sections.
 *
 * Scope: per-institution. Stevenson's corrections shape Stevenson's
 * future imports but never affect Kennesaw State's runs.
 */
import mongoose, { Schema, Document } from 'mongoose';

export type CorrectionType =
  | 'missed-by-matcher'   // section exists in the doc but matcher didn't bucket it
  | 'missed-by-walker'    // section was filtered out by the splitter (e.g. <8 words)
  | 'wrong-spec';         // matcher bucketed it but to the wrong (std, spec)

export type ExpectedSectionType =
  | 'narrative_response'
  | 'supporting_evidence'
  | 'curriculum_matrix';

export interface IImportCorrection extends Document {
  submissionId: mongoose.Types.ObjectId;
  importId: mongoose.Types.ObjectId;
  // Scoping key for the per-institution learning.
  institutionId: mongoose.Types.ObjectId;
  programLevel: 'associate' | 'bachelors' | 'masters';
  documentFormat: 'self_study' | 'template';

  // What the matcher SHOULD have returned.
  expectedStd: string;
  expectedSpec: string;
  expectedSectionType: ExpectedSectionType;

  // The source passage the coordinator highlighted — this is what gets
  // embedded for similarity search.
  sourceHeading: string;
  sourceText: string;
  // Optional anchor in the source GridFS HTML, useful for re-finding the
  // span on a future import of the same submission.
  sourceLocation?: {
    paragraphIndex?: number;
    byteOffsetStart?: number;
    byteOffsetEnd?: number;
  };

  correctionType: CorrectionType;
  correctedBy: mongoose.Types.ObjectId;
  correctedAt: Date;

  // Populated asynchronously after cshse-ai's /ai/corrections/ingest
  // succeeds. Not required by the route handler.
  qdrantPointId?: string;
  embeddingModel?: string;
}

const ImportCorrectionSchema = new Schema<IImportCorrection>(
  {
    submissionId: { type: Schema.Types.ObjectId, ref: 'Submission', required: true },
    importId: { type: Schema.Types.ObjectId, ref: 'SelfStudyImport', required: true },
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
    programLevel: {
      type: String,
      enum: ['associate', 'bachelors', 'masters'],
      required: true,
    },
    documentFormat: {
      type: String,
      enum: ['self_study', 'template'],
      default: 'self_study',
    },
    expectedStd: { type: String, required: true },
    expectedSpec: { type: String, required: true },
    expectedSectionType: {
      type: String,
      enum: ['narrative_response', 'supporting_evidence', 'curriculum_matrix'],
      required: true,
    },
    sourceHeading: { type: String, default: '' },
    sourceText: { type: String, required: true },
    sourceLocation: {
      paragraphIndex: Number,
      byteOffsetStart: Number,
      byteOffsetEnd: Number,
    },
    correctionType: {
      type: String,
      enum: ['missed-by-matcher', 'missed-by-walker', 'wrong-spec'],
      required: true,
    },
    correctedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    correctedAt: { type: Date, default: Date.now },
    qdrantPointId: String,
    embeddingModel: String,
  },
  { timestamps: true }
);

// Fast lookup for matcher's few-shot retrieval at runtime.
ImportCorrectionSchema.index({ institutionId: 1, programLevel: 1, expectedStd: 1, expectedSpec: 1 });
ImportCorrectionSchema.index({ submissionId: 1, createdAt: -1 });

export const ImportCorrection = mongoose.model<IImportCorrection>(
  'ImportCorrection',
  ImportCorrectionSchema
);
