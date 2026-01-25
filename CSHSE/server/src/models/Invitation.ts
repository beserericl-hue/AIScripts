import mongoose, { Schema, Document } from 'mongoose';
import crypto from 'crypto';

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface IInvitation extends Document {
  email: string;
  name: string;
  role: 'program_coordinator' | 'reader' | 'lead_reader';
  institutionId?: mongoose.Types.ObjectId;
  institutionName?: string;

  token: string;
  tokenHash: string;
  status: InvitationStatus;

  invitedBy: mongoose.Types.ObjectId;
  invitedByName: string;

  expiresAt: Date;
  acceptedAt?: Date;
  userId?: mongoose.Types.ObjectId; // Set when invitation is accepted

  emailSentAt?: Date;
  emailResendCount: number;

  metadata?: {
    customMessage?: string;
    permissions?: string[];
  };

  createdAt: Date;
  updatedAt: Date;

  // Methods
  isExpired(): boolean;
  generateToken(): string;
}

const InvitationSchema = new Schema<IInvitation>({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['program_coordinator', 'reader', 'lead_reader'],
    required: true
  },
  institutionId: {
    type: Schema.Types.ObjectId,
    ref: 'Institution'
  },
  institutionName: String,

  token: {
    type: String,
    required: true,
    unique: true
  },
  tokenHash: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'expired', 'revoked'],
    default: 'pending'
  },

  invitedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  invitedByName: {
    type: String,
    required: true
  },

  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  },
  acceptedAt: Date,
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },

  emailSentAt: Date,
  emailResendCount: {
    type: Number,
    default: 0
  },

  metadata: {
    customMessage: String,
    permissions: [String]
  }
}, {
  timestamps: true
});

// Indexes
InvitationSchema.index({ email: 1 });
InvitationSchema.index({ token: 1 });
InvitationSchema.index({ tokenHash: 1 });
InvitationSchema.index({ status: 1 });
InvitationSchema.index({ expiresAt: 1 });
InvitationSchema.index({ institutionId: 1 });

// Check if invitation is expired
InvitationSchema.methods.isExpired = function(): boolean {
  return this.expiresAt < new Date() || this.status === 'expired';
};

// Generate a secure token
InvitationSchema.methods.generateToken = function(): string {
  const token = crypto.randomBytes(32).toString('hex');
  this.token = token;
  this.tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return token;
};

// Static method to find by token
InvitationSchema.statics.findByToken = async function(token: string) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return this.findOne({ tokenHash, status: 'pending' });
};

// Pre-save hook to generate token if not exists
InvitationSchema.pre('save', function(next) {
  if (this.isNew && !this.token) {
    const token = crypto.randomBytes(32).toString('hex');
    this.token = token;
    this.tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  }
  next();
});

export const Invitation = mongoose.model<IInvitation>('Invitation', InvitationSchema);
