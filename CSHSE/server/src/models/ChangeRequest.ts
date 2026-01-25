import mongoose, { Schema, Document } from 'mongoose';

export type ChangeRequestType = 'deadline' | 'site_visit';
export type ChangeRequestStatus = 'pending' | 'approved' | 'denied' | 'withdrawn';

export interface IApproval {
  role: 'admin' | 'lead_reader';
  userId?: mongoose.Types.ObjectId;
  userName?: string;
  approved?: boolean;
  approvedAt?: Date;
  comments?: string;
}

export interface IChangeRequest extends Document {
  submissionId: mongoose.Types.ObjectId;
  institutionId: mongoose.Types.ObjectId;
  institutionName: string;

  type: ChangeRequestType;
  currentValue: string; // Current deadline or site visit date
  requestedValue: string; // Requested new value
  reason: string;

  requestedBy: mongoose.Types.ObjectId;
  requestedByName: string;
  requestedByRole: string;

  status: ChangeRequestStatus;

  // Both admin and lead reader must approve
  approvals: {
    admin: IApproval;
    leadReader: IApproval;
  };

  // Final outcome
  finalDecision?: {
    approved: boolean;
    decidedAt: Date;
    implementedAt?: Date;
    implementedBy?: mongoose.Types.ObjectId;
  };

  // Notification tracking
  notifications: {
    type: 'request_created' | 'approval_received' | 'fully_approved' | 'denied';
    sentAt: Date;
    recipients: string[];
  }[];

  // For site visit changes
  siteVisitId?: mongoose.Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;

  // Methods
  isFullyApproved(): boolean;
  isPendingApproval(): boolean;
}

const ApprovalSchema = new Schema<IApproval>({
  role: {
    type: String,
    enum: ['admin', 'lead_reader'],
    required: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  userName: String,
  approved: Boolean,
  approvedAt: Date,
  comments: String
}, { _id: false });

const ChangeRequestSchema = new Schema<IChangeRequest>({
  submissionId: {
    type: Schema.Types.ObjectId,
    ref: 'Submission',
    required: true
  },
  institutionId: {
    type: Schema.Types.ObjectId,
    ref: 'Institution',
    required: true
  },
  institutionName: {
    type: String,
    required: true
  },

  type: {
    type: String,
    enum: ['deadline', 'site_visit'],
    required: true
  },
  currentValue: {
    type: String,
    required: true
  },
  requestedValue: {
    type: String,
    required: true
  },
  reason: {
    type: String,
    required: true
  },

  requestedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  requestedByName: {
    type: String,
    required: true
  },
  requestedByRole: {
    type: String,
    required: true
  },

  status: {
    type: String,
    enum: ['pending', 'approved', 'denied', 'withdrawn'],
    default: 'pending'
  },

  approvals: {
    admin: {
      type: ApprovalSchema,
      default: { role: 'admin' }
    },
    leadReader: {
      type: ApprovalSchema,
      default: { role: 'lead_reader' }
    }
  },

  finalDecision: {
    approved: Boolean,
    decidedAt: Date,
    implementedAt: Date,
    implementedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  },

  notifications: [{
    type: {
      type: String,
      enum: ['request_created', 'approval_received', 'fully_approved', 'denied'],
      required: true
    },
    sentAt: { type: Date, required: true },
    recipients: [String]
  }],

  siteVisitId: {
    type: Schema.Types.ObjectId,
    ref: 'SiteVisit'
  }
}, {
  timestamps: true
});

// Indexes
ChangeRequestSchema.index({ submissionId: 1 });
ChangeRequestSchema.index({ institutionId: 1 });
ChangeRequestSchema.index({ type: 1 });
ChangeRequestSchema.index({ status: 1 });
ChangeRequestSchema.index({ requestedBy: 1 });

// Check if fully approved (both admin and lead reader)
ChangeRequestSchema.methods.isFullyApproved = function(): boolean {
  return (
    this.approvals.admin.approved === true &&
    this.approvals.leadReader.approved === true
  );
};

// Check if pending approval
ChangeRequestSchema.methods.isPendingApproval = function(): boolean {
  return (
    this.status === 'pending' &&
    (this.approvals.admin.approved !== false && this.approvals.leadReader.approved !== false)
  );
};

// Pre-save hook to update status based on approvals
ChangeRequestSchema.pre('save', function(next) {
  if (this.isModified('approvals')) {
    // If both approved
    if (this.approvals.admin.approved === true && this.approvals.leadReader.approved === true) {
      this.status = 'approved';
      this.finalDecision = {
        approved: true,
        decidedAt: new Date()
      };
    }
    // If either denied
    else if (this.approvals.admin.approved === false || this.approvals.leadReader.approved === false) {
      this.status = 'denied';
      this.finalDecision = {
        approved: false,
        decidedAt: new Date()
      };
    }
  }
  next();
});

export const ChangeRequest = mongoose.model<IChangeRequest>('ChangeRequest', ChangeRequestSchema);
