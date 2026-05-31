import mongoose, { Schema, Document } from 'mongoose';

// ---------------------------------------------------------------------------
// CR-016 / Sprint 7.2 — In-app bug report.
//
// One row per submitted report. Append-only at the controller level
// (no update endpoint). Sensitive fields filtered before persistence
// by the submitter — the server treats whatever lands here as the
// truth, so the client must scrub auth tokens / JWTs from
// `recentConsoleErrors` (defence-in-depth: a tiny server-side
// regex strip too).
// ---------------------------------------------------------------------------

export interface IBugReport extends Document {
  description: string;
  route: string;
  userAgent: string;
  buildSha?: string;
  // Snapshot identity at submit time (not a live ref) — the report
  // outlives user deletion, role changes, etc.
  reporterId?: mongoose.Types.ObjectId;
  reporterName?: string;
  reporterRole?: string;
  reporterEmail?: string;
  // Last ~10 console error lines, scrubbed of obvious secrets.
  recentConsoleErrors?: Array<{ message: string; ts?: Date }>;
  // Resolution-tracking is intentionally minimal; admins triage out-of-band.
  status: 'new' | 'triaged' | 'resolved' | 'dismissed';
  triageNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BugReportSchema = new Schema<IBugReport>(
  {
    description: { type: String, required: true, maxlength: 4096 },
    route: { type: String, required: true, maxlength: 1024 },
    userAgent: { type: String, required: true, maxlength: 512 },
    buildSha: { type: String, maxlength: 64 },
    reporterId: { type: Schema.Types.ObjectId, ref: 'User' },
    reporterName: { type: String, maxlength: 200 },
    reporterRole: { type: String, maxlength: 50 },
    reporterEmail: { type: String, maxlength: 200 },
    recentConsoleErrors: [
      {
        message: { type: String, required: true, maxlength: 1024 },
        ts: { type: Date }
      }
    ],
    status: { type: String, enum: ['new', 'triaged', 'resolved', 'dismissed'], default: 'new', index: true },
    triageNote: { type: String, maxlength: 2048 }
  },
  { timestamps: true }
);

BugReportSchema.index({ createdAt: -1 });

export const BugReport = mongoose.model<IBugReport>('BugReport', BugReportSchema);
