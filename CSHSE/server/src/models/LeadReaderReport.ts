import mongoose, { Schema, Document } from 'mongoose';

/**
 * Lead Reader Report to VPA to Request Board Action.
 *
 * Distinct from the combined reader report (readerReportGenerator.ts). One per
 * submission. Stores ONLY the lead-reader-authored fields; the system-generated
 * sections (program metadata, required-courses list, compiled non-compliance)
 * are assembled fresh on read from the submission / matrices / reader comments,
 * so they always reflect current data. Editable fields default from the system
 * where sensible (e.g. accreditationStatus from submission.type) but the lead
 * reader can override.
 */
export type LeadReaderRecommendation =
  | 'accredit_no_conditions'
  | 'conditional'
  | 'deny'
  | 'hold';

export interface ILeadReaderReport extends Document {
  submissionId: mongoose.Types.ObjectId;

  // --- Program Information (editable; several pre-fill from the submission) ---
  vpaRecipients: string;              // names + titles from the Certificate Page
  contactInfo: string;                // contact person email + mailing address
  accreditationStatus: 'initial' | 'reaccreditation' | 'interim';
  initialAccreditationDate: string;   // free text / date — not stored on submission
  lastReaccreditationDate: string;
  siteVisitDate: string;              // override of the SiteVisit.scheduledDate
  noSiteVisitRequired: boolean;
  programDescription: string;         // brief description of the program

  // --- Strengths ---
  strengthsFromSelfStudy: string;
  strengthsFromSiteVisit: string;

  // --- Non-compliance (pre-compiled from reader verdicts+comments, editable) ---
  nonComplianceText: string;

  // --- Required courses override (auto-generated from the matrix by default) ---
  requiredCoursesOverride: string;    // when non-empty, replaces the auto list

  // --- Recommendations (lead-reader decision) ---
  recommendation: LeadReaderRecommendation | '';
  conditionalRequirements: string;    // shown when recommendation === 'conditional'
  holdExplanation: string;            // shown when recommendation === 'hold'
  additionalRecommendations: string;  // not required by the Standards
  nextSelfStudySuggestions: string;

  // --- Submission block ---
  submittedByName: string;
  submissionDate: string;

  updatedAt: Date;
  updatedBy?: mongoose.Types.ObjectId;
}

const LeadReaderReportSchema = new Schema<ILeadReaderReport>(
  {
    submissionId: {
      type: Schema.Types.ObjectId,
      ref: 'Submission',
      required: true,
      unique: true,
      index: true,
    },
    vpaRecipients: { type: String, default: '' },
    contactInfo: { type: String, default: '' },
    accreditationStatus: {
      type: String,
      enum: ['initial', 'reaccreditation', 'interim'],
      default: 'initial',
    },
    initialAccreditationDate: { type: String, default: '' },
    lastReaccreditationDate: { type: String, default: '' },
    siteVisitDate: { type: String, default: '' },
    noSiteVisitRequired: { type: Boolean, default: false },
    programDescription: { type: String, default: '' },
    strengthsFromSelfStudy: { type: String, default: '' },
    strengthsFromSiteVisit: { type: String, default: '' },
    nonComplianceText: { type: String, default: '' },
    requiredCoursesOverride: { type: String, default: '' },
    recommendation: {
      type: String,
      enum: ['accredit_no_conditions', 'conditional', 'deny', 'hold', ''],
      default: '',
    },
    conditionalRequirements: { type: String, default: '' },
    holdExplanation: { type: String, default: '' },
    additionalRecommendations: { type: String, default: '' },
    nextSelfStudySuggestions: { type: String, default: '' },
    submittedByName: { type: String, default: '' },
    submissionDate: { type: String, default: '' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: false, updatedAt: 'updatedAt' } }
);

export const LeadReaderReport = mongoose.model<ILeadReaderReport>(
  'LeadReaderReport',
  LeadReaderReportSchema
);
