import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcrypt';

export type UserRole = 'program_coordinator' | 'reader' | 'lead_reader' | 'admin';
export type UserStatus = 'pending' | 'active' | 'disabled';
export type Permission =
  | 'edit_self_study'
  | 'view_comments'
  | 'add_comments'
  | 'manage_users'
  | 'manage_institutions'
  | 'assign_readers'
  | 'schedule_site_visits'
  | 'approve_changes';

export interface IUser extends Document {
  email: string;
  passwordHash?: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  institutionId?: mongoose.Types.ObjectId;
  institutionName?: string;
  status: UserStatus;
  permissions: Permission[];
  assignedSubmissions: mongoose.Types.ObjectId[];
  isActive: boolean;
  lastLogin?: Date;
  invitedAt?: Date;
  invitedBy?: mongoose.Types.ObjectId;
  accountCreatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;

  // Methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  fullName(): string;
}

const UserSchema = new Schema<IUser>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(v: string) {
        return /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(v);
      },
      message: 'Please enter a valid email address'
    }
  },
  passwordHash: {
    type: String
    // Not required initially - set when user accepts invitation
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['program_coordinator', 'reader', 'lead_reader', 'admin'],
    required: true,
    default: 'program_coordinator'
  },
  institutionId: {
    type: Schema.Types.ObjectId,
    ref: 'Institution'
  },
  institutionName: String,
  status: {
    type: String,
    enum: ['pending', 'active', 'disabled'],
    default: 'pending'
  },
  permissions: [{
    type: String,
    enum: [
      'edit_self_study',
      'view_comments',
      'add_comments',
      'manage_users',
      'manage_institutions',
      'assign_readers',
      'schedule_site_visits',
      'approve_changes'
    ]
  }],
  assignedSubmissions: [{
    type: Schema.Types.ObjectId,
    ref: 'Submission'
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: Date,
  invitedAt: Date,
  invitedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  accountCreatedAt: Date
}, {
  timestamps: true
});

// Indexes
UserSchema.index({ email: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ isActive: 1 });
UserSchema.index({ institutionId: 1 });

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('passwordHash')) {
    return next();
  }

  // Only hash if the passwordHash looks like a plain password (not already hashed)
  if (!this.passwordHash.startsWith('$2b$') && !this.passwordHash.startsWith('$2a$')) {
    const salt = await bcrypt.genSalt(10);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
  }
  next();
});

// Compare password method
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Get full name
UserSchema.methods.fullName = function(): string {
  return `${this.firstName} ${this.lastName}`;
};

// Static method to find by email
UserSchema.statics.findByEmail = function(email: string) {
  return this.findOne({ email: email.toLowerCase() });
};

// Remove sensitive data when converting to JSON
UserSchema.set('toJSON', {
  transform: function(_doc, ret) {
    delete ret.passwordHash;
    return ret;
  }
});

export const User = mongoose.model<IUser>('User', UserSchema);
