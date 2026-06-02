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

    // Find the import record by documentId (which is our importId). Read-only
    // (.lean()) — every mutation below goes through atomic operators so the
    // concurrent section callbacks n8n fires for one import never clobber one
    // another (the old findById→mutate→save path threw VersionError / lost
    // sections under that load).
    const importRecord = await SelfStudyImport.findById(payload.documentId).lean();
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
      await SelfStudyImport.findByIdAndUpdate(payload.documentId, {
        $set: {
          status: 'failed',
          error: payload.error || 'Document matching failed',
          processingCompletedAt: new Date()
        }
      });

      return res.json({
        success: true,
        documentId: payload.documentId,
        status: 'failed'
      });
    }

    // Concurrency-safe job initialization — runs exactly ONCE per job even when
    // every section callback arrives at the same instant. The guard
    // `n8nJobId != payload.jobId` (which also matches a missing/null field) means
    // only the first callback to reach this updateOne claims the job and performs
    // the reset; concurrent siblings see the now-claimed jobId and no-op. Because
    // each request awaits this init before its own $inc below, the received=0
    // reset always lands before any increment, so no section count is ever lost.
    const isNewJob = !importRecord.n8nJobId || importRecord.n8nJobId !== payload.jobId;
    if (isNewJob) {
      await SelfStudyImport.updateOne(
        { _id: payload.documentId, n8nJobId: { $ne: payload.jobId } },
        [
          {
            $set: {
              n8nJobId: payload.jobId,
              n8nTotalSections: payload.totalSections,
              n8nReceivedSections: 0,
              // Preserve manual mappings; n8n is authoritative for auto ones.
              mappedSections: {
                $filter: {
                  input: { $ifNull: ['$mappedSections', []] },
                  as: 'm',
                  cond: { $eq: ['$$m.mappedBy', 'manual'] }
                }
              },
              unmappedContent: [],
              'extractedContent.sections': []
            }
          }
        ]
      );

      debugLog('Initialized job tracking (atomic, set-once)', {
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
      const extractedSection: any = {
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

      // Determine the mapped / unmapped entry for this section (built in memory,
      // then persisted atomically below — no read-modify-write of the array).
      let mappedEntry: any = null;
      let unmappedEntry: any = null;

      // Process based on match status
      // Get standard and subspecification codes, treating empty strings as missing
      const standardCode = section.match?.standard?.code?.trim() || null;
      const subspecificationCode = section.match?.subspecification?.code?.trim() || null;
      const confidence = (section.match?.confidence || 0) / 100; // Convert to 0-1 scale

      if (section.match?.status === 'matched' && standardCode) {
        // We have a matched standard

        if (subspecificationCode && confidence >= 0.5) {
          // Full match with sufficient confidence - add to mapped sections
          mappedEntry = {
            extractedSectionId: sectionId,
            standardCode: standardCode,
            specCode: subspecificationCode,
            fieldType: 'narrative',
            mappedBy: 'auto',
            mappedAt: new Date()
          };

          debugLog('Section mapped', {
            sectionId,
            standardCode,
            specCode: subspecificationCode,
            confidence
          });
        } else if (subspecificationCode && confidence < 0.5) {
          // Has subspecification but low confidence - add to unmapped for review
          // Include suggested match info so user can approve it
          unmappedEntry = {
            extractedSectionId: sectionId,
            reason: section.match.rationale || `Low confidence match (${section.match.confidence}%) to Standard ${standardCode}${subspecificationCode}`,
            suggestedStandardCode: standardCode,
            suggestedSpecCode: subspecificationCode,
            suggestedConfidence: section.match.confidence,
            action: 'pending'
          };

          debugLog('Section added to unmapped (low confidence)', {
            sectionId,
            standardCode,
            specCode: subspecificationCode,
            confidence,
            rationale: section.match.rationale
          });
        } else {
          // Has standard but no subspecification - add to unmapped with partial match info
          unmappedEntry = {
            extractedSectionId: sectionId,
            reason: section.match.rationale || `Matched to Standard ${standardCode} but no subspecification identified`,
            suggestedStandardCode: standardCode,
            suggestedConfidence: section.match.confidence,
            action: 'pending'
          };

          debugLog('Section added to unmapped (no subspecification)', {
            sectionId,
            standardCode,
            confidence,
            rationale: section.match.rationale
          });
        }
      } else if (section.match?.status === 'unmatched') {
        // Unmatched section - add to unmapped
        unmappedEntry = {
          extractedSectionId: sectionId,
          reason: section.match.rationale || 'No matching standard found',
          action: 'pending'
        };

        debugLog('Section unmatched', {
          sectionId,
          rationale: section.match.rationale
        });
      } else if (section.match?.status === 'error') {
        // Error processing section
        unmappedEntry = {
          extractedSectionId: sectionId,
          reason: section.match.error || 'Error processing section',
          action: 'pending'
        };

        debugLog('Section had error', {
          sectionId,
          error: section.match.error
        });
      }

      // Persist this section ATOMICALLY: $push appends to each array and $inc
      // bumps the received counter in a single document update, so concurrent
      // callbacks for the same import never overwrite one another. The terminal
      // callback (moreData=false) also flips status to completed in the same op.
      const pushOps: any = { 'extractedContent.sections': extractedSection };
      if (mappedEntry) pushOps.mappedSections = mappedEntry;
      if (unmappedEntry) pushOps.unmappedContent = unmappedEntry;

      const update: any = {
        $push: pushOps,
        $inc: { n8nReceivedSections: 1 }
      };
      if (!payload.moreData) {
        update.$set = { status: 'completed', processingCompletedAt: new Date() };
      }

      const updated = await SelfStudyImport.findByIdAndUpdate(payload.documentId, update, { new: true });
      const unmappedPending = updated?.unmappedContent.filter(u => u.action === 'pending').length ?? 0;

      if (!payload.moreData) {
        console.log(`[DocumentMatcherCallback] Import ${payload.documentId} completed: ${updated?.mappedSections.length ?? 0} mapped, ${unmappedPending} unmapped`);
      }

      // Return response
      return res.json({
        success: true,
        documentId: payload.documentId,
        jobId: payload.jobId,
        status: updated?.status,
        sectionIndex: payload.sectionIndex,
        totalSections: payload.totalSections,
        receivedSections: updated?.n8nReceivedSections,
        mappedCount: updated?.mappedSections.length ?? 0,
        unmappedCount: unmappedPending,
        moreExpected: payload.moreData
      });
    }

    // No section payload. If this is the terminal callback, flip to completed.
    if (!payload.moreData) {
      const updated = await SelfStudyImport.findByIdAndUpdate(
        payload.documentId,
        { $set: { status: 'completed', processingCompletedAt: new Date() } },
        { new: true }
      );
      return res.json({
        success: true,
        documentId: payload.documentId,
        jobId: payload.jobId,
        status: updated?.status,
        sectionIndex: payload.sectionIndex,
        totalSections: payload.totalSections,
        receivedSections: updated?.n8nReceivedSections,
        mappedCount: updated?.mappedSections.length ?? 0,
        unmappedCount: updated?.unmappedContent.filter(u => u.action === 'pending').length ?? 0,
        moreExpected: payload.moreData
      });
    }

    // Non-terminal callback with no section to process — acknowledge.
    return res.json({
      success: true,
      documentId: payload.documentId,
      jobId: payload.jobId,
      status: importRecord.status,
      sectionIndex: payload.sectionIndex,
      totalSections: payload.totalSections,
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
