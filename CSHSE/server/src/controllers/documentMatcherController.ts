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
    if (payload.sectionIndex === 0 || !importRecord.n8nJobId) {
      importRecord.n8nJobId = payload.jobId;
      importRecord.n8nTotalSections = payload.totalSections;
      importRecord.n8nReceivedSections = 0;

      // Clear existing auto-mappings on first section (preserve manual mappings)
      importRecord.mappedSections = importRecord.mappedSections.filter(m => m.mappedBy === 'manual');
      importRecord.unmappedContent = [];

      debugLog('Initialized job tracking', {
        jobId: payload.jobId,
        totalSections: payload.totalSections
      });
    }

    // Process the section if present
    if (payload.section) {
      const section = payload.section;
      const sectionId = uuidv4(); // Generate unique ID for this section

      debugLog('Processing section', {
        sectionIndex: payload.sectionIndex,
        heading: section.heading,
        matchStatus: section.match?.status,
        standardCode: section.match?.standard?.code,
        specCode: section.match?.subspecification?.code,
        confidence: section.match?.confidence
      });

      // Create extracted section from the callback data
      const extractedSection = {
        id: sectionId,
        pageNumber: payload.sectionIndex + 1, // Use index as page approximation
        startPosition: 0,
        endPosition: section.richTextContent?.length || 0,
        sectionType: 'narrative' as const,
        content: section.richTextContent || '',
        confidence: (section.match?.confidence || 0) / 100, // Convert from 0-100 to 0-1
        suggestedStandard: section.match?.standard?.code
      };

      // Add section heading to content if provided
      if (section.heading && section.richTextContent) {
        extractedSection.content = `<h2>${section.heading}</h2>\n${section.richTextContent}`;
        extractedSection.endPosition = extractedSection.content.length;
      }

      // Add to extracted sections
      importRecord.extractedContent.sections.push(extractedSection);

      // Process based on match status
      if (section.match?.status === 'matched' &&
          section.match.standard?.code &&
          section.match.subspecification?.code) {

        const confidence = (section.match.confidence || 0) / 100; // Convert to 0-1 scale

        // Confidence threshold: 50% (0.5) since n8n uses 0-100 scale
        if (confidence >= 0.5) {
          importRecord.mappedSections.push({
            extractedSectionId: sectionId,
            standardCode: section.match.standard.code,
            specCode: section.match.subspecification.code,
            fieldType: 'narrative',
            mappedBy: 'auto',
            mappedAt: new Date()
          });

          debugLog('Section mapped', {
            sectionId,
            standardCode: section.match.standard.code,
            specCode: section.match.subspecification.code,
            confidence
          });
        } else {
          // Low confidence - add to unmapped for review
          importRecord.unmappedContent.push({
            extractedSectionId: sectionId,
            reason: section.match.rationale || `Low confidence match (${section.match.confidence}%)`,
            action: 'pending'
          });

          debugLog('Section added to unmapped (low confidence)', {
            sectionId,
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
  } catch (error) {
    console.error('[DocumentMatcherCallback] Error processing callback:', error);
    return res.status(500).json({ error: 'Failed to process callback' });
  }
};
