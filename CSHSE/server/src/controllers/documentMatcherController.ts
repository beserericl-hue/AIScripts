import { Request, Response } from 'express';
import { SelfStudyImport } from '../models/SelfStudyImport';
import { v4 as uuidv4 } from 'uuid';

// Always log for visibility in production
function debugLog(message: string, data?: any) {
  console.log(`[DocumentMatcher] ${message}`, data ? JSON.stringify(data) : '');
}

/**
 * Callback payload from n8n Document Matcher
 * Sent incrementally, one section at a time
 *
 * {
 *   "type": "section_result",
 *   "jobId": "550e8400-e29b-41d4-a716-446655440000",
 *   "documentId": "doc-12345",
 *   "specName": "CSHSE Standards 2024",
 *   "moreData": true,
 *   "sectionIndex": 0,
 *   "totalSections": 15,
 *   "section": {
 *     "heading": "Program Overview",
 *     "richTextContent": "<p>Our program is regionally accredited...</p>",
 *     "match": {
 *       "status": "matched" | "unmatched" | "error",
 *       "standard": { "code": "1", "title": "Program Identity" },
 *       "subspecification": { "code": "a", "title": "Regional Accreditation" },
 *       "confidence": 92,
 *       "rationale": "This section describes regional accreditation status."
 *     }
 *   }
 * }
 */
interface SectionMatch {
  status: 'matched' | 'unmatched' | 'error';
  standard?: {
    code: string;
    title: string;
  };
  subspecification?: {
    code: string;
    title: string;
  };
  confidence?: number;
  rationale?: string;
  error?: string;
}

interface CallbackSection {
  heading: string;
  richTextContent: string;
  match: SectionMatch;
}

interface DocumentMatcherCallbackPayload {
  type: 'section_result' | 'error' | 'complete';
  jobId: string;
  documentId: string; // This is the importId
  specName?: string;
  moreData: boolean;
  sectionIndex: number;
  totalSections: number;
  section?: CallbackSection;
  error?: string;
}

/**
 * Receive incremental callback from n8n Document Matcher
 * Each callback contains one section; moreData=false indicates final callback
 */
export const receiveDocumentMatcherCallback = async (req: Request, res: Response) => {
  try {
    const payload = req.body as DocumentMatcherCallbackPayload;

    debugLog('Received callback', {
      type: payload.type,
      documentId: payload.documentId,
      jobId: payload.jobId,
      sectionIndex: payload.sectionIndex,
      totalSections: payload.totalSections,
      moreData: payload.moreData,
      hasSection: !!payload.section
    });

    // Validate required fields
    if (!payload.documentId) {
      console.error('[DocumentMatcherCallback] Missing documentId in callback');
      return res.status(400).json({ error: 'Missing documentId in callback' });
    }

    // Find the import record by documentId (which is our importId)
    const importRecord = await SelfStudyImport.findById(payload.documentId);
    if (!importRecord) {
      console.error('[DocumentMatcherCallback] Import not found:', payload.documentId);
      return res.status(404).json({ error: 'Import not found' });
    }

    debugLog('Found import record', {
      importId: importRecord._id,
      currentStatus: importRecord.status,
      currentReceivedSections: importRecord.n8nReceivedSections
    });

    // Handle error type
    if (payload.type === 'error' || payload.error) {
      console.error('[DocumentMatcherCallback] Error from n8n:', payload.error);
      importRecord.status = 'failed';
      importRecord.error = payload.error || 'Document matching failed';
      importRecord.processingCompletedAt = new Date();
      await importRecord.save();

      return res.json({
        success: true,
        documentId: importRecord._id,
        status: 'failed'
      });
    }

    // Update job tracking info on first callback
    // Only reset if this is truly a new job (different jobId or first callback for this document)
    const isNewJob = !importRecord.n8nJobId || importRecord.n8nJobId !== payload.jobId;
    if (payload.sectionIndex === 0 || isNewJob) {
      importRecord.n8nJobId = payload.jobId;
      importRecord.n8nTotalSections = payload.totalSections;
      importRecord.n8nReceivedSections = 0;

      // Clear existing auto-mappings on first section (preserve manual mappings)
      importRecord.mappedSections = importRecord.mappedSections.filter(m => m.mappedBy === 'manual');
      importRecord.unmappedContent = [];

      // Clear extracted sections since n8n provides the authoritative sections
      importRecord.extractedContent.sections = [];

      debugLog('Initialized job tracking (first callback)', {
        jobId: payload.jobId,
        totalSections: payload.totalSections,
        isNewJob
      });
    }

    // Process the section if present
    if (payload.section) {
      const section = payload.section;
      const sectionId = uuidv4(); // Generate unique ID for this section

      // IMPORTANT: Truncate content to avoid MongoDB document size limits
      // The richTextContent from n8n can be huge if the AI includes too much context
      const MAX_SECTION_CONTENT = 100000; // 100KB max per section
      let sectionContent = section.richTextContent || '';
      const originalContentLength = sectionContent.length;

      if (sectionContent.length > MAX_SECTION_CONTENT) {
        debugLog('WARNING: Section content truncated', {
          sectionIndex: payload.sectionIndex,
          heading: section.heading,
          originalLength: originalContentLength,
          truncatedTo: MAX_SECTION_CONTENT
        });
        sectionContent = sectionContent.substring(0, MAX_SECTION_CONTENT) + '\n\n[Content truncated - original was ' + originalContentLength + ' chars]';
      }

      debugLog('Processing section', {
        sectionIndex: payload.sectionIndex,
        heading: section.heading,
        matchStatus: section.match?.status,
        standardCode: section.match?.standard?.code,
        standardTitle: section.match?.standard?.title,
        specCode: section.match?.subspecification?.code,
        specTitle: section.match?.subspecification?.title,
        confidence: section.match?.confidence,
        rationale: section.match?.rationale?.substring(0, 100),
        contentLength: sectionContent.length,
        originalContentLength
      });

      // Create extracted section from the callback data
      const extractedSection = {
        id: sectionId,
        pageNumber: payload.sectionIndex + 1, // Use index as page approximation
        startPosition: 0,
        endPosition: sectionContent.length,
        sectionType: 'narrative' as const,
        content: sectionContent,
        confidence: (section.match?.confidence || 0) / 100, // Convert from 0-100 to 0-1
        suggestedStandard: section.match?.standard?.code
      };

      // Add section heading to content if provided
      if (section.heading && sectionContent) {
        extractedSection.content = `<h2>${section.heading}</h2>\n${sectionContent}`;
        extractedSection.endPosition = extractedSection.content.length;
      }

      // Add to extracted sections
      importRecord.extractedContent.sections.push(extractedSection);

      // Process based on match status
      // Get standard and subspecification codes, treating empty strings as missing
      const standardCode = section.match?.standard?.code?.trim() || null;
      const subspecificationCode = section.match?.subspecification?.code?.trim() || null;
      const confidence = (section.match?.confidence || 0) / 100; // Convert to 0-1 scale

      if (section.match?.status === 'matched' && standardCode) {
        // We have a matched standard

        if (subspecificationCode && confidence >= 0.5) {
          // Full match with sufficient confidence - add to mapped sections
          importRecord.mappedSections.push({
            extractedSectionId: sectionId,
            standardCode: standardCode,
            specCode: subspecificationCode,
            fieldType: 'narrative',
            mappedBy: 'auto',
            mappedAt: new Date()
          });

          debugLog('Section mapped', {
            sectionId,
            standardCode,
            specCode: subspecificationCode,
            confidence
          });
        } else if (subspecificationCode && confidence < 0.5) {
          // Has subspecification but low confidence - add to unmapped for review
          // Include suggested match info so user can approve it
          importRecord.unmappedContent.push({
            extractedSectionId: sectionId,
            reason: section.match.rationale || `Low confidence match (${section.match.confidence}%) to Standard ${standardCode}${subspecificationCode}`,
            suggestedStandardCode: standardCode,
            suggestedSpecCode: subspecificationCode,
            suggestedConfidence: section.match.confidence,
            action: 'pending'
          });

          debugLog('Section added to unmapped (low confidence)', {
            sectionId,
            standardCode,
            specCode: subspecificationCode,
            confidence,
            rationale: section.match.rationale
          });
        } else {
          // Has standard but no subspecification - add to unmapped with partial match info
          importRecord.unmappedContent.push({
            extractedSectionId: sectionId,
            reason: section.match.rationale || `Matched to Standard ${standardCode} but no subspecification identified`,
            suggestedStandardCode: standardCode,
            suggestedConfidence: section.match.confidence,
            action: 'pending'
          });

          debugLog('Section added to unmapped (no subspecification)', {
            sectionId,
            standardCode,
            confidence,
            rationale: section.match.rationale
          });
        }
      } else if (section.match?.status === 'unmatched') {
        // Unmatched section - add to unmapped
        importRecord.unmappedContent.push({
          extractedSectionId: sectionId,
          reason: section.match.rationale || 'No matching standard found',
          action: 'pending'
        });

        debugLog('Section unmatched', {
          sectionId,
          rationale: section.match.rationale
        });
      } else if (section.match?.status === 'error') {
        // Error processing section
        importRecord.unmappedContent.push({
          extractedSectionId: sectionId,
          reason: section.match.error || 'Error processing section',
          action: 'pending'
        });

        debugLog('Section had error', {
          sectionId,
          error: section.match.error
        });
      }

      // Update received sections count
      importRecord.n8nReceivedSections = (importRecord.n8nReceivedSections || 0) + 1;
    }

    // Check if this is the final callback
    if (!payload.moreData) {
      importRecord.status = 'completed';
      importRecord.processingCompletedAt = new Date();

      debugLog('Processing complete', {
        totalSectionsReceived: importRecord.n8nReceivedSections,
        mappedCount: importRecord.mappedSections.length,
        unmappedCount: importRecord.unmappedContent.filter(u => u.action === 'pending').length
      });

      console.log(`[DocumentMatcherCallback] Import ${importRecord._id} completed: ${importRecord.mappedSections.length} mapped, ${importRecord.unmappedContent.filter(u => u.action === 'pending').length} unmapped`);
    }

    // Save the updated import record
    importRecord.markModified('extractedContent');
    importRecord.markModified('mappedSections');
    importRecord.markModified('unmappedContent');
    await importRecord.save();

    // Return response
    return res.json({
      success: true,
      documentId: importRecord._id,
      jobId: payload.jobId,
      status: importRecord.status,
      sectionIndex: payload.sectionIndex,
      totalSections: payload.totalSections,
      receivedSections: importRecord.n8nReceivedSections,
      mappedCount: importRecord.mappedSections.length,
      unmappedCount: importRecord.unmappedContent.filter(u => u.action === 'pending').length,
      moreExpected: payload.moreData
    });
  } catch (error: any) {
    // Enhanced error logging
    console.error('[DocumentMatcherCallback] Error processing callback:', {
      errorMessage: error?.message,
      errorName: error?.name,
      errorCode: error?.code,
      documentId: req.body?.documentId,
      sectionIndex: req.body?.sectionIndex,
      stack: error?.stack?.substring(0, 500)
    });

    // Check for specific MongoDB errors
    if (error?.code === 11000) {
      return res.status(409).json({ error: 'Duplicate key error' });
    }
    if (error?.message?.includes('document is larger than')) {
      return res.status(413).json({ error: 'Document too large to save' });
    }

    return res.status(500).json({ error: 'Failed to process callback', details: error?.message });
  }
};
