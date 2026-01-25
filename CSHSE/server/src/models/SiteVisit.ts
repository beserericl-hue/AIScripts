import mongoose, { Schema, Document } from 'mongoose';

export type SiteVisitStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'rescheduled';

export interface ISiteVisit extends Document {
  submissionId: mongoose.Types.ObjectId;
  institutionId: mongoose.Types.ObjectId;
  institutionName: string;

  scheduledDate: Date;
  scheduledTime?: string;
  duration?: string; // e.g., "2 days"

  leadReaderId: mongoose.Types.ObjectId;
  leadReaderName: string;
  readerIds: mongoose.Types.ObjectId[];
  readers: {
    id: mongoose.Types.ObjectId;
    name: string;
    confirmed: boolean;
    confirmedAt?: Date;
  }[];

  status: SiteVisitStatus;

  location?: {
    address: string;
    room?: string;
    buildingName?: string;
    specialInstructions?: string;
  };

  agenda?: {
    time: string;
    activity: string;
    participants?: string;
  }[];

  notes?: string;
  adminNotes?: string;

  // Notifications
  notificationsSent: {
    type: 'scheduled' | 'reminder' | 'change' | 'cancelled';
    sentAt: Date;
    recipients: string[];
  }[];

  scheduledBy: mongoose.Types.ObjectId;
  scheduledByName: string;

  // Change history
  changeHistory: {
    changedAt: Date;
    changedBy: mongoose.Types.ObjectId;
    changedByName: string;
    previousDate?: Date;
    newDate?: Date;
    reason?: string;
  }[];

  createdAt: Date;
  updatedAt: Date;
}

const SiteVisitSchema = new Schema<ISiteVisit>({
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

  scheduledDate: {
    type: Date,
    required: true
  },
  scheduledTime: String,
  duration: String,

  leadReaderId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  leadReaderName: {
    type: String,
    required: true
  },
  readerIds: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  readers: [{
    id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    confirmed: { type: Boolean, default: false },
    confirmedAt: Date
  }],

  status: {
    type: String,
    enum: ['scheduled', 'confirmed', 'completed', 'cancelled', 'rescheduled'],
    default: 'scheduled'
  },

  location: {
    address: String,
    room: String,
    buildingName: String,
    specialInstructions: String
  },

  agenda: [{
    time: { type: String, required: true },
    activity: { type: String, required: true },
    participants: String
  }],

  notes: String,
  adminNotes: String,

  notificationsSent: [{
    type: {
      type: String,
      enum: ['scheduled', 'reminder', 'change', 'cancelled'],
      required: true
    },
    sentAt: { type: Date, required: true },
    recipients: [String]
  }],

  scheduledBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  scheduledByName: {
    type: String,
    required: true
  },

  changeHistory: [{
    changedAt: { type: Date, required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    changedByName: { type: String, required: true },
    previousDate: Date,
    newDate: Date,
    reason: String
  }]
}, {
  timestamps: true
});

// Indexes
SiteVisitSchema.index({ submissionId: 1 });
SiteVisitSchema.index({ institutionId: 1 });
SiteVisitSchema.index({ leadReaderId: 1 });
SiteVisitSchema.index({ scheduledDate: 1 });
SiteVisitSchema.index({ status: 1 });

export const SiteVisit = mongoose.model<ISiteVisit>('SiteVisit', SiteVisitSchema);
