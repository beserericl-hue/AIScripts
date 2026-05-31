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
    // CR-013 Sprint 6.2 — co-edit itinerary additions. Each slot can
    // optionally carry a location override, an attendees list, the spec
    // codes the slot addresses, and links into the partial-compliance
    // checklist (CR-012) for the visit team to verify those items.
    location?: string;
    attendees?: string[];
    specCodes?: string[];
    checklistItemIds?: mongoose.Types.ObjectId[];
    notes?: string;
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
    participants: String,
    // CR-013 Sprint 6.2 — additive co-edit fields. All optional so the
    // existing scheduler controller keeps working with `{ time, activity,
    // participants }` shaped agenda inputs.
    location: { type: String, default: undefined },
    attendees: { type: [String], default: undefined },
    specCodes: { type: [String], default: undefined },
    checklistItemIds: { type: [Schema.Types.ObjectId], ref: 'SiteVisitChecklistItem', default: undefined },
    notes: { type: String, default: undefined }
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
