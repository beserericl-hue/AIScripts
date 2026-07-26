import mongoose, { Schema, Document } from 'mongoose';

/**
 * ParserTrainGuard — the automated golden guardrail marker (CR-073 #7).
 *
 * A GLOBAL parser rule (one that could affect the proven baseline / every
 * institution) may only be activated when the golden regression is CURRENTLY
 * green. The golden E2E suite (e2e/tests/73_parser_baseline_golden), on passing,
 * stamps this singleton with `goldensGreenAt = now`. `set-rule` refuses to
 * activate a global rule unless that stamp is fresh (< TTL). This turns "no rule
 * may regress a golden" from a manual flag into an automated, time-bounded gate
 * tied to a real, recent golden pass. Institution-scoped rules are structurally
 * safe (they can't touch the baseline) and don't consult this.
 */
export interface IParserTrainGuard extends Document {
  key: string; // always 'singleton'
  goldensGreenAt?: Date;
  detail?: string;
  updatedAt: Date;
}

const ParserTrainGuardSchema = new Schema<IParserTrainGuard>(
  {
    key: { type: String, required: true, unique: true, default: 'singleton' },
    goldensGreenAt: { type: Date },
    detail: { type: String },
  },
  { timestamps: true }
);

export const ParserTrainGuard = mongoose.model<IParserTrainGuard>('ParserTrainGuard', ParserTrainGuardSchema);

// How long a golden pass keeps global activation unlocked.
export const GOLDEN_GUARD_TTL_MS = 24 * 60 * 60 * 1000;
