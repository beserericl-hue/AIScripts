import mongoose, { Schema, Document } from 'mongoose';

/**
 * Error severity levels
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Error categories for classification
 */
export type ErrorCategory =
  | 'database'
  | 'authentication'
  | 'authorization'
  | 'validation'
  | 'file_operation'
  | 'external_service'
  | 'internal'
  | 'unknown';

/**
 * Request context for debugging
 */
export interface IRequestContext {
  method: string;
  path: string;
  query?: Record<string, any>;
  params?: Record<string, any>;
  body?: Record<string, any>;
  headers?: Record<string, any>;
  ip?: string;
  userAgent?: string;
}

/**
 * User context for debugging
 */
export interface IUserContext {
  userId?: string;
  role?: string;
  institutionId?: string;
  submissionId?: string;
}

/**
 * Error log document interface
 */
export interface IErrorLog extends Document {
  // Error identification
  errorId: string;
  timestamp: Date;

  // Error details
  message: string;
  stack?: string;
  code?: string;
  name: string;

  // Classification
  severity: ErrorSeverity;
  category: ErrorCategory;

  // Context
  request?: IRequestContext;
  user?: IUserContext;

  // Additional debugging info
  metadata?: Record<string, any>;

  // Resolution tracking
  isResolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: mongoose.Types.ObjectId;
  resolution?: string;

  // Indexing
  fingerprint: string; // Hash of error signature for grouping similar errors
  occurrenceCount: number;
  firstOccurrence: Date;
  lastOccurrence: Date;
}

const RequestContextSchema = new Schema<IRequestContext>({
  method: { type: String, required: true },
  path: { type: String, required: true },
  query: { type: Schema.Types.Mixed },
  params: { type: Schema.Types.Mixed },
  body: { type: Schema.Types.Mixed },
  headers: { type: Schema.Types.Mixed },
  ip: String,
  userAgent: String
}, { _id: false });

const UserContextSchema = new Schema<IUserContext>({
  userId: String,
  role: String,
  institutionId: String,
  submissionId: String
}, { _id: false });

const ErrorLogSchema = new Schema<IErrorLog>({
  errorId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },

  // Error details
  message: { type: String, required: true },
  stack: String,
  code: String,
  name: { type: String, required: true },

  // Classification
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true,
    default: 'medium',
    index: true
  },
  category: {
    type: String,
    enum: ['database', 'authentication', 'authorization', 'validation', 'file_operation', 'external_service', 'internal', 'unknown'],
    required: true,
    default: 'unknown',
    index: true
  },

  // Context
  request: RequestContextSchema,
  user: UserContextSchema,

  // Additional debugging info
  metadata: { type: Schema.Types.Mixed },

  // Resolution tracking
  isResolved: { type: Boolean, default: false, index: true },
  resolvedAt: Date,
  resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  resolution: String,

  // Grouping similar errors
  fingerprint: { type: String, required: true, index: true },
  occurrenceCount: { type: Number, default: 1 },
  firstOccurrence: { type: Date, required: true, default: Date.now },
  lastOccurrence: { type: Date, required: true, default: Date.now }
}, {
  timestamps: true
});

// Compound indexes for efficient querying
ErrorLogSchema.index({ timestamp: -1, severity: 1 });
ErrorLogSchema.index({ category: 1, timestamp: -1 });
ErrorLogSchema.index({ fingerprint: 1, lastOccurrence: -1 });
ErrorLogSchema.index({ 'user.userId': 1, timestamp: -1 });
ErrorLogSchema.index({ 'user.institutionId': 1, timestamp: -1 });
ErrorLogSchema.index({ isResolved: 1, severity: 1, timestamp: -1 });

// TTL index to automatically delete old resolved errors after 90 days
ErrorLogSchema.index(
  { resolvedAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60, partialFilterExpression: { isResolved: true } }
);

export const ErrorLog = mongoose.model<IErrorLog>('ErrorLog', ErrorLogSchema);
