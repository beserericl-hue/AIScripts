import mongoose, { Schema, Document } from 'mongoose';

export type CoverageType = 'I' | 'T' | 'K' | 'S'; // Introduction, Theory, Knowledge, Skills
export type CoverageDepth = 'L' | 'M' | 'H'; // Low, Medium, High

export interface ICourseEntry {
  id: string;
  coursePrefix: string;
  courseNumber: string;
  courseName: string;
  credits?: number;
  order: number;
}

export interface ICourseAssessment {
  courseId: string;
  type: CoverageType[];
  depth: CoverageDepth;
  notes?: string;
}

export interface IStandardMapping {
  standardCode: string;
  specCode: string;
  specText: string;
  rowIndex: number; // 0 = base row, 1+ = duplicates for same standard/spec
  courseAssessments: ICourseAssessment[];
}

export interface IRawMatrixContent {
  id: string;
  content: string;
  title?: string;
  standardCode?: string;
  sourceImportId?: string;
  addedAt: Date;
  addedBy: mongoose.Types.ObjectId;
  processed: boolean;
  processedAt?: Date;
}

export interface ICurriculumMatrix extends Document {
  submissionId: mongoose.Types.ObjectId;
  matrixType: 'human_services_courses' | 'non_human_services_courses' | 'custom';
  name: string;
  version: number;
  lastModified: Date;
  lastModifiedBy: mongoose.Types.ObjectId;
  courses: ICourseEntry[];
  standards: IStandardMapping[];
  // Raw imported content pending processing into structured data
  rawContent?: IRawMatrixContent[];
}

const CourseEntrySchema = new Schema<ICourseEntry>({
  id: { type: String, required: true },
  coursePrefix: { type: String, required: true },
  courseNumber: { type: String, required: true },
  courseName: { type: String, required: true },
  credits: Number,
  order: { type: Number, required: true }
}, { _id: false });

const CourseAssessmentSchema = new Schema<ICourseAssessment>({
  courseId: { type: String, required: true },
  type: [{
    type: String,
    enum: ['I', 'T', 'K', 'S']
  }],
  depth: {
    type: String,
    enum: ['L', 'M', 'H'],
    required: true
  },
  notes: String
}, { _id: false });

const StandardMappingSchema = new Schema<IStandardMapping>({
  standardCode: { type: String, required: true },
  specCode: { type: String, required: true },
  specText: { type: String, required: true },
  rowIndex: { type: Number, default: 0 },
  courseAssessments: [CourseAssessmentSchema]
}, { _id: false });

const RawMatrixContentSchema = new Schema<IRawMatrixContent>({
  id: { type: String, required: true },
  content: { type: String, required: true },
  title: String,
  standardCode: String,
  sourceImportId: String,
  addedAt: { type: Date, default: Date.now },
  addedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  processed: { type: Boolean, default: false },
  processedAt: Date
}, { _id: false });

const CurriculumMatrixSchema = new Schema<ICurriculumMatrix>({
  submissionId: {
    type: Schema.Types.ObjectId,
    ref: 'Submission',
    required: true
  },
  matrixType: {
    type: String,
    enum: ['human_services_courses', 'non_human_services_courses', 'custom'],
    default: 'human_services_courses'
  },
  name: { type: String, required: true },
  version: { type: Number, default: 1 },
  lastModified: { type: Date, default: Date.now },
  lastModifiedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  courses: [CourseEntrySchema],
  standards: [StandardMappingSchema],
  rawContent: [RawMatrixContentSchema]
}, {
  timestamps: true
});

// Index for efficient queries
CurriculumMatrixSchema.index({ submissionId: 1 });
CurriculumMatrixSchema.index({ matrixType: 1 });

// Pre-save hook to update version and lastModified
CurriculumMatrixSchema.pre('save', function(next) {
  if (this.isModified('courses') || this.isModified('standards')) {
    this.version += 1;
    this.lastModified = new Date();
  }
  next();
});

export const CurriculumMatrix = mongoose.model<ICurriculumMatrix>('CurriculumMatrix', CurriculumMatrixSchema);
