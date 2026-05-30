import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcrypt';

export type UserRole = 'program_coordinator' | 'reader' | 'lead_reader' | 'admin';
export type UserStatus = 'pending' | 'active' | 'disabled';

// CR-042: how the user came to exist. Drives the auto-derived SSO domain
// allowlist — only `invitation` and `manual` users contribute trusted domains.
export type ProvisionedByType = 'invitation' | 'manual' | 'sso-key';

export interface ProvisionedBy {
  type: ProvisionedByType;
  keyId?: mongoose.Types.ObjectId;
  at?: Date;
}
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
  isSuperuser: boolean; // Superuser has visibility to everything in the system
  lastLogin?: Date;
  invitedAt?: Date;
  invitedBy?: mongoose.Types.ObjectId;
  accountCreatedAt?: Date;
  // CR-042
  provisionedBy?: ProvisionedBy;
  // CR-045 — per-user UI preferences. Optional; absent == defaults apply.
  preferences?: IUserPreferences;
  createdAt: Date;
  updatedAt: Date;

  // Methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  fullName(): string;
}

// CR-045 — per-user UI preferences. `hideLegacyImporter` defaults true so
// every PC sees the clean single-importer toolbar; PCs who still want the
// legacy paste-and-tag flow uncheck it in the cogwheel → Preferences menu.
// CR-052 — per-user tour-completion state. Keyed by tour name (today only
// `welcome`); values are booleans (true == the user has finished or
// skipped the tour at least once). Absent map == nothing completed.
export interface IUserPreferences {
  hideLegacyImporter?: boolean;
  tours?: Map<string, boolean> | Record<string, boolean>;
}

const UserSchema = new Schema<IUser>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      // Allow '+' subaddressing (e.g., user+tag@institution.edu) — widely
      // used by SaaS subscribers and required by the E2E seed endpoint to
      // stamp a unique per-run suffix on the same base email. Also allow
      // TLDs longer than 4 chars (.museum, .academy, .education, etc.).
      validator: function(v: string) {
        return /^[\w.+\-]+@([\w-]+\.)+[\w-]{2,}$/.test(v);
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
  isSuperuser: {
    type: Boolean,
    default: false,
    index: true
  },
  lastLogin: Date,
  invitedAt: Date,
  invitedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  accountCreatedAt: Date,
  // CR-042
  provisionedBy: {
    type: {
      type: String,
      enum: ['invitation', 'manual', 'sso-key']
    },
    keyId: { type: Schema.Types.ObjectId, ref: 'APIKey' },
    at: Date
  },
  // CR-045 — per-user UI preferences. `default: undefined` keeps the
  // subdoc absent until first write; the API + client treat a missing
  // `hideLegacyImporter` as `true` (clean single-importer toolbar).
  // CR-052 — `tours` is a Mongoose Map keyed by tour name. Updates go
  // through PATCH /api/auth/me/preferences with merge-in-place semantics.
  preferences: {
    type: {
      hideLegacyImporter: { type: Boolean },
      tours: { type: Map, of: Boolean }
    },
    default: undefined
  }
}, {
  timestamps: true
});

// CR-042: the auto-derived SSO domain allowlist query filters on this.
UserSchema.index({ 'provisionedBy.type': 1 });

// Indexes
UserSchema.index({ email: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ isActive: 1 });
UserSchema.index({ institutionId: 1 });

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('passwordHash') || !this.passwordHash) {
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
