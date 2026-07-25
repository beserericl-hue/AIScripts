import mongoose, { Schema, Document } from 'mongoose';

/**
 * ParserRule — the realtime, learnable parser-rule store (CR-073 "Parser Train").
 *
 * The parser's shape-specific decisions are DATA, not code: each rule says WHEN a
 * document region matches a known shape (`match`) and HOW to extract it
 * (`extract`) + always emit the Compare `data-section-id` marker (`anchor`). The
 * generic engine reads active rules per import; the Parser Train agent writes
 * candidate rules and the superuser activates them by approving the spec they
 * parsed in the Review screen.
 *
 * FOUNDATION NOTE (2026-07-25): this is the store + the captured baseline. The
 * rule ENGINE that consumes these rows is a later phase — for now the proven
 * parser code (template_walker/format_detector/mcc pipeline) remains the
 * baseline engine, and these rows are the explicit, versioned record of the
 * rules that code already applies (seeded by scripts/seed_baseline_parser_rules).
 */

export type ParserRuleStatus = 'proposed' | 'active' | 'retired';
export type ParserRuleFormat = 'template' | 'self_study' | 'mcc_narrative' | 'any';
export type ParserRuleRegion = 'table' | 'paragraph' | 'cell' | 'document';

export interface IParserRuleScope {
  level: 'global' | 'institution';
  institutionId?: mongoose.Types.ObjectId;
  programLevel?: 'associate' | 'bachelors' | 'masters';
}

export interface IParserRule extends Document {
  ruleId: string;              // stable human/agent id, e.g. "tmpl.headerless-continuation"
  name: string;
  description?: string;
  version: number;
  supersedes?: string;         // ruleId this replaces
  scope: IParserRuleScope;
  status: ParserRuleStatus;
  createdBy: 'agent' | 'human';
  createdFromImportId?: mongoose.Types.ObjectId;

  // WHEN it fires — the match signature (the conditional edge)
  match: {
    format: ParserRuleFormat;
    region: ParserRuleRegion;
    signature: Record<string, any>; // firstCellRegex, columnCount, hasStandardHeader, letterMarkerRegex, responseMarkerRegex, ...
  };

  // HOW to extract — the directive the engine applies
  extract: {
    standardAssignment?: 'from-header' | 'sequential-next' | 'catalog-text-match' | 'explicit';
    specAssignment?: 'first-column-letter' | 'catalog-text-match' | 'explicit';
    contentCell?: 'last-non-marker' | 'column-N' | 'after-response-marker';
    promptResponseSplit?: 'response-marker' | 'first-paragraph' | 'none';
    classification?: 'narrative' | 'evidence-text' | 'appendix' | 'syllabus' | 'cv' | 'matrix' | 'intro';
    params?: Record<string, any>;
  };

  // Compare marker — ALWAYS emit the data-section-id tag
  anchor: { emit: boolean; wrap: string; idFrom: string };

  // learning + validation
  examples: Array<{ importId?: mongoose.Types.ObjectId; excerpt?: string; expectedOutput?: any }>;
  confidence?: number;
  contractChecks?: Record<string, any>; // last validation result (coverage/routing/kind/level/anchors/loss)
  metrics?: { appliedCount?: number; passRate?: number };

  createdAt: Date;
  updatedAt: Date;
}

const ParserRuleSchema = new Schema<IParserRule>(
  {
    ruleId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    version: { type: Number, default: 1 },
    supersedes: { type: String },
    scope: {
      level: { type: String, enum: ['global', 'institution'], default: 'global' },
      institutionId: { type: Schema.Types.ObjectId, ref: 'Institution' },
      programLevel: { type: String, enum: ['associate', 'bachelors', 'masters'] },
    },
    status: { type: String, enum: ['proposed', 'active', 'retired'], default: 'proposed', index: true },
    createdBy: { type: String, enum: ['agent', 'human'], default: 'human' },
    createdFromImportId: { type: Schema.Types.ObjectId, ref: 'SelfStudyImport' },
    match: {
      format: { type: String, enum: ['template', 'self_study', 'mcc_narrative', 'any'], default: 'any' },
      region: { type: String, enum: ['table', 'paragraph', 'cell', 'document'], default: 'document' },
      signature: { type: Schema.Types.Mixed, default: {} },
    },
    extract: { type: Schema.Types.Mixed, default: {} },
    anchor: {
      emit: { type: Boolean, default: true },
      wrap: { type: String, default: 'section' },
      idFrom: { type: String, default: 'sectionId' },
    },
    examples: { type: [Schema.Types.Mixed], default: [] },
    confidence: { type: Number },
    contractChecks: { type: Schema.Types.Mixed },
    metrics: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// A ruleId is unique per version (an update supersedes with a new version row).
ParserRuleSchema.index({ ruleId: 1, version: 1 }, { unique: true });

export const ParserRule = mongoose.model<IParserRule>('ParserRule', ParserRuleSchema);
