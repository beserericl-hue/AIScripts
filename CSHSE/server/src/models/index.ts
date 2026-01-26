// Core models
export { User, IUser, UserRole } from './User';
export {
  Submission,
  ISubmission,
  SubmissionStatus,
  StandardStatus,
  ValidationStatus,
  INarrativeContent,
  IStandardStatusInfo,
  ISelfStudyProgress,
  IDocumentRef,
  IDecision
} from './Submission';

// Self-study import models
export {
  SelfStudyImport,
  ISelfStudyImport,
  IExtractedSection,
  IMappedSection,
  IUnmappedContent
} from './SelfStudyImport';

// Curriculum matrix models
export {
  CurriculumMatrix,
  ICurriculumMatrix,
  ICourseEntry,
  ICourseAssessment,
  IStandardMapping,
  CoverageType,
  CoverageDepth
} from './CurriculumMatrix';

// Supporting evidence models
export {
  SupportingEvidence,
  ISupportingEvidence,
  IFileInfo,
  IUrlInfo,
  IImageMetadata
} from './SupportingEvidence';

// Validation models
export {
  ValidationResult,
  IValidationResult,
  IValidationResultData
} from './ValidationResult';

// Webhook settings models
export {
  WebhookSettings,
  IWebhookSettings,
  IWebhookAuthentication,
  IRetryConfig
} from './WebhookSettings';

// Review models
export {
  Review,
  IReview,
  ComplianceStatus,
  RecommendationType,
  ISpecificationAssessment,
  IStandardAssessment,
  IFinalAssessment,
  IReaderProgress
} from './Review';

// Lead reader compilation models
export {
  LeadReaderCompilation,
  ILeadReaderCompilation,
  IReaderComplianceVote,
  ISpecificationCompilation,
  IStandardCompilation,
  IReaderRecommendation,
  IFinalCompilation,
  ICommentThread
} from './LeadReaderCompilation';

// Spec models
export {
  Spec,
  ISpec,
  SpecStatus
} from './Spec';
