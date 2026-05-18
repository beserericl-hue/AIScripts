/**
 * ProgramCourse — per-institution / per-program course catalog.
 *
 * Sub-sprint 1.d (UI spec §20.4): the Matrix step's course-column
 * dropdowns are seeded from this collection. The deep walker's regex
 * hits (course-code-shaped strings) populate it on first use of a new
 * institution; the Coordinator can also create courses on the fly via
 * the matrix grid.
 *
 * Identity is `(institutionId, programId?, courseCode)` — `programId`
 * is optional because some institutions reuse the same course catalog
 * across programs. A unique index enforces the rule.
 */
import mongoose, { Schema, Document } from 'mongoose';

export interface IProgramCourse extends Document {
  institutionId: mongoose.Types.ObjectId;
  /**
   * Submission this course is tied to (acts as the program scope until
   * a true Program collection lands). Optional so institution-wide
   * catalogs can omit it.
   */
  submissionId?: mongoose.Types.ObjectId;
  courseCode: string;       // canonical short code: "FMST 240"
  courseName: string;       // human title: "Family Systems Theory"
  source: 'manual' | 'deep_walker' | 'matrix_inference';
  lastUsedAt: Date;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ProgramCourseSchema = new Schema<IProgramCourse>({
  institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
  submissionId: { type: Schema.Types.ObjectId, ref: 'Submission' },
  courseCode: { type: String, required: true, trim: true },
  courseName: { type: String, required: true, trim: true },
  source: {
    type: String,
    enum: ['manual', 'deep_walker', 'matrix_inference'],
    default: 'manual'
  },
  lastUsedAt: { type: Date, default: Date.now },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Unique per institution + course code (case-insensitive at the app
// layer; Mongo's default collation is case-sensitive).
ProgramCourseSchema.index(
  { institutionId: 1, courseCode: 1, submissionId: 1 },
  { unique: true }
);

export const ProgramCourse = mongoose.model<IProgramCourse>('ProgramCourse', ProgramCourseSchema);
