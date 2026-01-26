import mongoose, { Schema, Document } from 'mongoose';

export type InstitutionType = 'college' | 'university';
export type InstitutionStatus = 'active' | 'inactive' | 'archived';

export interface IAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  country?: string;
}

export interface IPrimaryContact {
  name: string;
  email: string;
  phone: string;
  title?: string;
}

export interface IInstitution extends Document {
  name: string;
  type: InstitutionType;
  address: IAddress;
  primaryContact: IPrimaryContact;
  website?: string;

  // Spec assignment
  specId?: mongoose.Types.ObjectId;
  specName?: string;

  // Accreditation info
  accreditationDeadline?: Date;
  currentSubmissionId?: mongoose.Types.ObjectId;
  previousSubmissions: mongoose.Types.ObjectId[];
  accreditationHistory: {
    date: Date;
    outcome: 'approved' | 'denied' | 'conditional' | 'pending';
    notes?: string;
  }[];

  // Assignments
  programCoordinatorId?: mongoose.Types.ObjectId;
  assignedLeadReaderId?: mongoose.Types.ObjectId;
  assignedReaderIds: mongoose.Types.ObjectId[];

  // Site visit
  scheduledSiteVisit?: Date;

  status: InstitutionStatus;
  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}

const AddressSchema = new Schema<IAddress>({
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zip: { type: String, required: true },
  country: { type: String, default: 'USA' }
}, { _id: false });

const PrimaryContactSchema = new Schema<IPrimaryContact>({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  title: String
}, { _id: false });

const InstitutionSchema = new Schema<IInstitution>({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['college', 'university'],
    required: true
  },
  address: {
    type: AddressSchema,
    required: true
  },
  primaryContact: {
    type: PrimaryContactSchema,
    required: true
  },
  website: String,

  // Spec assignment
  specId: {
    type: Schema.Types.ObjectId,
    ref: 'Spec'
  },
  specName: String,

  // Accreditation
  accreditationDeadline: Date,
  currentSubmissionId: {
    type: Schema.Types.ObjectId,
    ref: 'Submission'
  },
  previousSubmissions: [{
    type: Schema.Types.ObjectId,
    ref: 'Submission'
  }],
  accreditationHistory: [{
    date: { type: Date, required: true },
    outcome: {
      type: String,
      enum: ['approved', 'denied', 'conditional', 'pending'],
      required: true
    },
    notes: String
  }],

  // Assignments
  programCoordinatorId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  assignedLeadReaderId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  assignedReaderIds: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],

  // Site visit
  scheduledSiteVisit: Date,

  status: {
    type: String,
    enum: ['active', 'inactive', 'archived'],
    default: 'active'
  },
  notes: String
}, {
  timestamps: true
});

// Indexes
InstitutionSchema.index({ name: 1 });
InstitutionSchema.index({ type: 1 });
InstitutionSchema.index({ status: 1 });
InstitutionSchema.index({ specId: 1 });
InstitutionSchema.index({ programCoordinatorId: 1 });
InstitutionSchema.index({ assignedLeadReaderId: 1 });
InstitutionSchema.index({ accreditationDeadline: 1 });

export const Institution = mongoose.model<IInstitution>('Institution', InstitutionSchema);
