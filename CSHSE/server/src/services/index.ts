export { documentParserService, DocumentParserService } from './documentParser';
export { sectionMapperService, SectionMapperService } from './sectionMapper';
export { validationService, ValidationService } from './validationService';

export type {
  ParsedDocument,
  ParsedSection,
  ParsedTable,
  ParsedImage,
  ParsedMetadata,
  StandardPattern
} from './documentParser';

export type {
  MappingSuggestion
} from './sectionMapper';

// CR-054 — the n8n validation request/response/webhook-call shapes were
// removed with the legacy triggerValidation path.
