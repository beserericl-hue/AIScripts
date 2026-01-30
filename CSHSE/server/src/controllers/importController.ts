import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { SelfStudyImport, ISelfStudyImport } from '../models/SelfStudyImport';
import { Submission } from '../models/Submission';
import { Institution } from '../models/Institution';
import { WebhookSettings } from '../models/WebhookSettings';
import { documentParserService, TOCBasedSection, ParsedDocument } from '../services/documentParser';
import { sectionMapperService } from '../services/sectionMapper';

// Always log for visibility in production
function debugLog(message: string, data?: any) {
  console.log(`[Import] ${message}`, data ? JSON.stringify(data) : '');
}

/**
 * Clean HTML content before sending to n8n
 * Removes:
 * - Base64 encoded images (data:image/...)
 * - Long encoded data strings (likely binary data)
 * - Excessive whitespace
 * - HTML comments
 * - Empty tags
 */
function cleanHtmlContent(html: string): string {
  let cleaned = html;

  // Remove base64 embedded images (common pattern: <img src="data:image/png;base64,...")
  cleaned = cleaned.replace(/<img[^>]*src=["']data:image\/[^;]+;base64,[^"']*["'][^>]*\/?>/gi, '[image]');

  // Remove any remaining base64 image data patterns
  cleaned = cleaned.replace(/data:image\/[^;]+;base64,[a-zA-Z0-9+\/=]+/gi, '[image-data-removed]');

  // Remove any other base64 encoded data (like fonts, etc.)
  cleaned = cleaned.replace(/data:[^;]+;base64,[a-zA-Z0-9+\/=]+/gi, '[encoded-data-removed]');

  // Remove very long strings of alphanumeric characters (likely encoded binary data or garbage)
  // This catches things like long hex strings, base64 without proper prefix, etc.
  cleaned = cleaned.replace(/[a-zA-Z0-9+\/=]{500,}/g, '[long-encoded-data-removed]');

  // Remove HTML comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

  // Remove empty tags (except br and hr)
  cleaned = cleaned.replace(/<(?!br|hr)[^>]+>\s*<\/[^>]+>/gi, '');

  // Remove Microsoft Office specific XML/markup that sometimes leaks into HTML
  cleaned = cleaned.replace(/<o:[^>]*>[\s\S]*?<\/o:[^>]*>/gi, '');
  cleaned = cleaned.replace(/<w:[^>]*>[\s\S]*?<\/w:[^>]*>/gi, '');
  cleaned = cleaned.replace(/<m:[^>]*>[\s\S]*?<\/m:[^>]*>/gi, '');

  // Remove style attributes with very long values (often contain encoded fonts/images)
  cleaned = cleaned.replace(/style="[^"]{500,}"/gi, '');

  // Remove script tags entirely
  cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

  // Remove style tags entirely
  cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Normalize whitespace - collapse multiple spaces/newlines
  cleaned = cleaned.replace(/\s+/g, ' ');

  // Remove leading/trailing whitespace from tag contents
  cleaned = cleaned.replace(/>\s+</g, '><');

  // Add back single spaces after block elements for readability
  cleaned = cleaned.replace(/(<\/(?:p|div|h[1-6]|li|tr|td|th)>)/gi, '$1 ');

  // Trim the final result
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Split HTML content into sections by h1 tags
 * Each section includes the h1 and all content until the next h1
 * Returns array of { heading: string, content: string }
 */
function splitHtmlBySections(html: string): { heading: string; content: string }[] {
  const sections: { heading: string; content: string }[] = [];

  // Regex to match h1 tags and capture the heading text
  const h1Regex = /<h1[^>]*>(.*?)<\/h1>/gi;
  const matches = [...html.matchAll(h1Regex)];

  if (matches.length === 0) {
    // No h1 tags found - return entire content as single section
    debugLog('No h1 tags found in HTML, treating as single section', {
      contentLength: html.length
    });
    return [{ heading: 'Document Content', content: html }];
  }

  debugLog('Found h1 sections in HTML', { count: matches.length });

  // Get content before first h1 (if any)
  const firstH1Index = matches[0].index!;
  if (firstH1Index > 0) {
    const preamble = html.substring(0, firstH1Index).trim();
    if (preamble.length > 100) { // Only include if substantial
      sections.push({
        heading: 'Preamble',
        content: preamble
      });
    }
  }

  // Split by h1 sections
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const heading = match[1].replace(/<[^>]*>/g, '').trim(); // Strip any inner tags
    const startIndex = match.index!;
    const endIndex = i < matches.length - 1 ? matches[i + 1].index! : html.length;

    const content = html.substring(startIndex, endIndex).trim();

    sections.push({ heading, content });
  }

  debugLog('Split HTML into sections', {
    totalSections: sections.length,
    sectionHeadings: sections.map(s => s.heading.substring(0, 50))
  });

  return sections;
}

/**
 * Construct callback URL from request headers
 */
function getCallbackUrl(req: Request, callbackPath: string): string {
  const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  const host = req.get('host');
  return `${protocol}://${host}${callbackPath}`;
}

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

/**
 * Upload and process a self-study document
 */
export const uploadDocument = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!submissionId) {
      return res.status(400).json({ error: 'Submission ID is required' });
    }

    // Verify submission exists
    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Determine file type
    const extension = file.originalname.toLowerCase().split('.').pop();
    if (!['pdf', 'docx', 'pptx'].includes(extension || '')) {
      return res.status(400).json({ error: 'Unsupported file type. Please upload PDF, DOCX, or PPTX.' });
    }

    // Create import record
    const importRecord = new SelfStudyImport({
      submissionId: new mongoose.Types.ObjectId(submissionId),
      originalFilename: file.originalname,
      fileType: extension as 'pdf' | 'docx' | 'pptx',
      uploadedBy: new mongoose.Types.ObjectId(req.user?.id),
      status: 'pending'
    });

    await importRecord.save();
    debugLog('Import record created', { importId: importRecord._id, submissionId });

    // Construct callback URL for n8n
    const callbackUrl = getCallbackUrl(req, '/api/webhooks/document-matcher/callback');
    debugLog('Callback URL constructed', { callbackUrl });

    // Get specName from institution
    const institution = await Institution.findOne({ name: submission.institutionName });
    const specName = institution?.specName || 'CSHSE Standards';
    debugLog('Spec name resolved', { institutionName: submission.institutionName, specName });

    // Start processing asynchronously
    processDocumentAsync(
      importRecord._id as mongoose.Types.ObjectId,
      file.buffer,
      file.originalname,
      submission.programLevel,
      callbackUrl,
      specName
    );

    return res.status(202).json({
      importId: importRecord._id,
      status: 'processing',
      message: 'Document upload started. Check status for progress.'
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: 'Failed to upload document' });
  }
};

/**
 * Process document asynchronously
 * If n8n Document Matcher webhook is configured, sends to n8n for AI-powered mapping.
 * Otherwise, falls back to local section mapping.
 */
async function processDocumentAsync(
  importId: mongoose.Types.ObjectId,
  buffer: Buffer,
  filename: string,
  programLevel: 'associate' | 'bachelors' | 'masters',
  callbackUrl: string,
  specName: string
) {
  debugLog('Starting async document processing', { importId: importId.toString(), filename, specName });

  const importRecord = await SelfStudyImport.findById(importId);
  if (!importRecord) {
    console.error('[ImportController] Import record not found:', importId);
    return;
  }

  try {
    // Update status to processing with initial progress
    importRecord.status = 'processing';
    importRecord.processingStartedAt = new Date();
    importRecord.specName = specName;
    importRecord.parsingProgress = {
      step: 'extracting_text',
      stepDescription: 'Extracting text from document...'
    };
    await importRecord.save();
    debugLog('Import record status updated to processing');

    // Update progress: extracting TOC
    importRecord.parsingProgress = {
      step: 'extracting_toc',
      stepDescription: 'Searching for Table of Contents...'
    };
    importRecord.markModified('parsingProgress');
    await importRecord.save();

    // Parse the document using TOC-based parsing for intelligent sectioning
    debugLog('Parsing document with TOC-based sectioning');
    const { document: parsed, tocEntries, sections: tocSections } = await documentParserService.parseWithTOC(buffer, filename);

    // Update progress with TOC/section discovery results
    const tocTitles = tocEntries.slice(0, 8).map(e => e.title.substring(0, 60));
    const sectionTitles = tocSections.slice(0, 10).map(s => s.tocEntry.title.substring(0, 60));

    importRecord.parsingProgress = {
      step: 'creating_sections',
      stepDescription: tocEntries.length > 0
        ? `Found Table of Contents with ${tocEntries.length} entries`
        : `Using header-based splitting (${tocSections.length} sections detected)`,
      tocEntriesFound: tocEntries.length,
      tocTitles,
      sectionsCreated: tocSections.length,
      sectionTitles
    };
    importRecord.markModified('parsingProgress');
    await importRecord.save();

    debugLog('TOC parsing complete', {
      tocEntriesFound: tocEntries.length,
      sectionsCreated: tocSections.length,
      sectionTypes: tocSections.reduce((acc, s) => {
        acc[s.tocEntry.sectionType] = (acc[s.tocEntry.sectionType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    });

    // Store extracted content using TOC-based sections
    importRecord.extractedContent = {
      rawText: parsed.rawText,
      pageCount: parsed.metadata.pageCount,
      metadata: {
        title: parsed.metadata.title,
        author: parsed.metadata.author,
        createdDate: parsed.metadata.createdDate
      },
      sections: tocSections.map(section => ({
        id: section.id,
        pageNumber: section.tocEntry.pageNumber || 1,
        startPosition: section.startPosition,
        endPosition: section.endPosition,
        sectionType: section.tocEntry.isMatrix ? 'matrix' :
                     section.tocEntry.isSupportingEvidence ? 'supporting_evidence' :
                     section.tocEntry.sectionType === 'standard' ? 'narrative' : 'general',
        content: section.content,
        confidence: section.tocEntry.standardCode ? 0.8 : 0.5,
        suggestedStandard: section.tocEntry.standardCode ?
          `${section.tocEntry.standardCode}${section.tocEntry.specCode ? '.' + section.tocEntry.specCode : ''}` :
          undefined
      }))
    };

    // Add tables as sections (in addition to TOC sections)
    for (const table of parsed.tables) {
      const tableContent = formatTableAsText(table);
      importRecord.extractedContent.sections.push({
        id: table.id,
        pageNumber: table.pageNumber,
        startPosition: 0,
        endPosition: tableContent.length,
        sectionType: table.tableType === 'curriculum_matrix' ? 'matrix' : 'table',
        content: tableContent,
        confidence: 0.7,
        suggestedStandard: table.tableType === 'curriculum_matrix' ? '11.matrix' : undefined
      });
    }

    // Check if n8n Document Matcher webhook is configured
    const webhookSettings = await WebhookSettings.findOne({
      settingType: 'document_matcher',
      isActive: true
    });

    if (webhookSettings) {
      // Update progress: preparing to send to AI
      importRecord.parsingProgress = {
        ...importRecord.parsingProgress,
        step: 'preparing_ai',
        stepDescription: `Preparing ${tocSections.length} sections for AI analysis...`
      };
      importRecord.markModified('parsingProgress');
      await importRecord.save();

      // Use n8n Document Matcher for AI-powered mapping
      debugLog('n8n Document Matcher webhook found, sending to n8n', {
        webhookUrl: webhookSettings.webhookUrl,
        specName,
        totalTocSections: tocSections.length
      });
      await sendToN8nDocumentMatcher(importRecord, parsed, tocSections, callbackUrl, webhookSettings, specName);
      // Processing will be completed when callback is received
      return;
    }
    debugLog('No n8n webhook configured, using local mapper');

    // Fallback to local section mapping if n8n is not configured
    await processWithLocalMapper(importRecord, parsed, programLevel);

    importRecord.status = 'completed';
    importRecord.processingCompletedAt = new Date();
    await importRecord.save();
  } catch (error) {
    importRecord.status = 'failed';
    importRecord.error = error instanceof Error ? error.message : 'Unknown error';
    importRecord.processingCompletedAt = new Date();
    await importRecord.save();
  }
}

/**
 * Wait for callback to be received for a specific section
 * Polls the import record to check if n8nReceivedSections has incremented
 *
 * @param importId - The import record ID to poll
 * @param expectedSections - The number of sections that should have been received
 * @param timeoutMs - Maximum time to wait (default 120 seconds)
 * @param pollIntervalMs - How often to check (default 2 seconds)
 * @returns true if callback received, false if timeout
 */
async function waitForCallback(
  importId: mongoose.Types.ObjectId,
  expectedSections: number,
  timeoutMs: number = 120000,
  pollIntervalMs: number = 2000
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    // Fetch fresh import record
    const importRecord = await SelfStudyImport.findById(importId);
    if (!importRecord) {
      debugLog('Import record not found while waiting for callback', { importId: importId.toString() });
      return false;
    }

    const receivedSections = importRecord.n8nReceivedSections || 0;
    debugLog(`Waiting for callback: received ${receivedSections}/${expectedSections}`, {
      importId: importId.toString(),
      elapsed: Date.now() - startTime
    });

    if (receivedSections >= expectedSections) {
      debugLog(`Callback received for section ${expectedSections}`, { importId: importId.toString() });
      return true;
    }

    // Check if import failed
    if (importRecord.status === 'failed') {
      debugLog('Import failed while waiting for callback', {
        importId: importId.toString(),
        error: importRecord.error
      });
      return false;
    }

    // Wait before polling again
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  debugLog('Timeout waiting for callback', {
    importId: importId.toString(),
    expectedSections,
    timeoutMs
  });
  return false;
}

/**
 * Send document to n8n Document Matcher for AI-powered mapping
 *
 * Large documents are split by h1 tags and sent as multiple smaller requests
 * to avoid 413 Payload Too Large errors.
 *
 * IMPORTANT: This function waits for each section's callback before sending
 * the next section to avoid overwhelming n8n.
 *
 * ==================== REQUEST PAYLOAD (per section) ====================
 * POST {webhookUrl}
 * Content-Type: application/json
 *
 * {
 *   "callbackUrl": "https://your-app.com/api/webhooks/document-matcher/callback",
 *   "specName": "CSHSE Standards 2024",
 *   "documentId": "mongo-import-id",
 *   "sectionIndex": 0,
 *   "totalSections": 15,
 *   "sectionHeading": "STANDARD 1: Program Identity",
 *   "htmlContent": "BASE64_ENCODED_HTML_STRING",
 *   "htmlContentEncoding": "base64",
 *   "moreData": true,
 *   "options": {
 *     "confidenceThreshold": 50
 *   }
 * }
 *
 * Note: htmlContent is proper HTML with header tags (h1, h2, h3, etc.) for this section.
 * The HTML is base64 encoded for safe transport.
 * Decode in n8n using: Buffer.from(htmlContent, 'base64').toString('utf8')
 *
 * ==================== EXPECTED RESPONSE ====================
 * n8n should return immediately with:
 * {
 *   "jobId": "uuid-generated-by-n8n",
 *   "status": "accepted",
 *   "sectionIndex": 0
 * }
 *
 * ==================== CALLBACK PAYLOAD ====================
 * n8n sends callbacks to callbackUrl for each section:
 * {
 *   "type": "section_result",
 *   "jobId": "uuid-from-response",
 *   "documentId": "mongo-import-id",
 *   "specName": "CSHSE Standards 2024",
 *   "moreData": true,
 *   "sectionIndex": 0,
 *   "totalSections": 15,
 *   "section": {
 *     "heading": "Program Overview",
 *     "richTextContent": "<p>Our program is regionally accredited...</p>",
 *     "match": {
 *       "status": "matched",
 *       "standard": { "code": "1", "title": "Program Identity" },
 *       "subspecification": { "code": "a", "title": "Regional Accreditation" },
 *       "confidence": 92,
 *       "rationale": "This section describes regional accreditation status."
 *     }
 *   }
 * }
 *
 * Final callback should have moreData: false
 */
async function sendToN8nDocumentMatcher(
  importRecord: ISelfStudyImport,
  parsed: ParsedDocument,
  tocSections: TOCBasedSection[],
  callbackUrl: string,
  webhookSettings: any,
  specName: string
) {
  debugLog('Preparing n8n Document Matcher request with TOC-based sections', {
    importId: importRecord._id.toString(),
    specName,
    callbackUrl,
    totalTocSections: tocSections.length
  });

  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (webhookSettings.authentication?.type === 'api_key' && webhookSettings.authentication.apiKey) {
    headers['X-API-Key'] = webhookSettings.authentication.apiKey;
    debugLog('Using API key authentication');
  } else if (webhookSettings.authentication?.type === 'bearer' && webhookSettings.authentication.bearerToken) {
    headers['Authorization'] = `Bearer ${webhookSettings.authentication.bearerToken}`;
    debugLog('Using Bearer token authentication');
  }

  // Filter sections to send to AI:
  // - Exclude TOC itself (title contains "table of contents")
  // - Exclude very short sections
  // - Exclude supporting evidence sections (they don't need AI matching)
  const sectionsToSend = tocSections.filter(section => {
    const title = section.tocEntry.title.toLowerCase();

    // Exclude Table of Contents
    if (title.includes('table of contents') || title === 'contents') {
      debugLog('Excluding TOC section from AI processing', { title: section.tocEntry.title });
      return false;
    }

    // Exclude very short sections (less than 100 chars)
    if (section.content.length < 100) {
      debugLog('Excluding short section from AI processing', {
        title: section.tocEntry.title,
        length: section.content.length
      });
      return false;
    }

    // Include all other sections (even supporting evidence - AI can help categorize)
    return true;
  });

  const totalSections = sectionsToSend.length;

  debugLog('TOC sections prepared for n8n', {
    totalSections,
    originalTocSections: tocSections.length,
    sectionTypes: sectionsToSend.map(s => s.tocEntry.sectionType),
    sectionTitles: sectionsToSend.map(s => s.tocEntry.title.substring(0, 50))
  });

  // Generate a job ID for tracking all sections of this document
  const jobId = uuidv4();

  // Mark that we're sending to n8n BEFORE the request (so we track it even if response parsing fails)
  importRecord.n8nSentAt = new Date();
  importRecord.n8nJobId = jobId;
  importRecord.n8nTotalSections = totalSections;
  importRecord.n8nReceivedSections = 0;
  await importRecord.save();
  debugLog('Marked n8nSentAt timestamp and initialized section tracking', {
    jobId,
    totalSections
  });

  // Timeout per section (2 minutes default, can be overridden)
  const callbackTimeoutMs = webhookSettings.callbackTimeoutMs || 120000;

  // Send each TOC section separately, waiting for callback before sending next
  for (let sectionIndex = 0; sectionIndex < sectionsToSend.length; sectionIndex++) {
    const tocSection = sectionsToSend[sectionIndex];
    const isLastSection = sectionIndex === sectionsToSend.length - 1;

    // Update progress: sending current section to AI
    importRecord.parsingProgress = {
      step: 'sending_to_ai',
      stepDescription: `Sending section ${sectionIndex + 1}/${totalSections} to AI...`,
      tocEntriesFound: importRecord.parsingProgress?.tocEntriesFound,
      tocTitles: importRecord.parsingProgress?.tocTitles,
      sectionsCreated: importRecord.parsingProgress?.sectionsCreated,
      sectionTitles: importRecord.parsingProgress?.sectionTitles,
      currentSectionIndex: sectionIndex
    };
    importRecord.markModified('parsingProgress');
    await importRecord.save();

    // Clean the HTML content
    const cleanedSectionContent = cleanHtmlContent(tocSection.htmlContent);

    // Format content with standard hints for AI
    // Add hints at the beginning to help AI understand the context
    let contentWithHints = '';
    if (tocSection.standardHint) {
      contentWithHints += `<!-- STANDARD HINT: ${tocSection.standardHint} -->\n`;
      if (tocSection.specHint) {
        contentWithHints += `<!-- SPECIFICATION HINT: ${tocSection.specHint} -->\n`;
      }
    }
    if (tocSection.tocEntry.isMatrix) {
      contentWithHints += `<!-- SECTION TYPE: CURRICULUM MATRIX -->\n`;
    }
    if (tocSection.tocEntry.isSupportingEvidence) {
      contentWithHints += `<!-- SECTION TYPE: SUPPORTING EVIDENCE -->\n`;
    }
    contentWithHints += cleanedSectionContent;

    const sectionContentBase64 = Buffer.from(contentWithHints, 'utf8').toString('base64');

    // Prepare payload for this section
    const payload = {
      callbackUrl,
      specName,
      documentId: importRecord._id.toString(),
      jobId, // Same job ID for all sections of this document
      sectionIndex,
      totalSections,
      sectionHeading: tocSection.tocEntry.title,
      htmlContent: sectionContentBase64,
      htmlContentEncoding: 'base64',
      moreData: !isLastSection,
      // Include TOC metadata for better AI processing
      tocMetadata: {
        standardCode: tocSection.tocEntry.standardCode,
        specCode: tocSection.tocEntry.specCode,
        sectionType: tocSection.tocEntry.sectionType,
        isMatrix: tocSection.tocEntry.isMatrix,
        isSupportingEvidence: tocSection.tocEntry.isSupportingEvidence
      },
      options: {
        confidenceThreshold: 50
      }
    };

    const payloadSize = JSON.stringify(payload).length;
    debugLog(`Sending TOC section ${sectionIndex + 1}/${totalSections} to n8n`, {
      sectionIndex,
      heading: tocSection.tocEntry.title.substring(0, 50),
      standardHint: tocSection.standardHint,
      sectionType: tocSection.tocEntry.sectionType,
      payloadSize,
      originalContentLength: tocSection.htmlContent.length,
      cleanedContentLength: cleanedSectionContent.length,
      base64Length: sectionContentBase64.length,
      moreData: !isLastSection
    });

    // Send this section to n8n
    const response = await fetch(webhookSettings.webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(webhookSettings.timeoutMs || 30000)
    });

    debugLog(`n8n response for section ${sectionIndex}`, {
      status: response.status,
      statusText: response.statusText
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ImportController] n8n webhook error for section ${sectionIndex}:`, {
        status: response.status,
        error: errorText
      });
      throw new Error(`n8n returned ${response.status} for section ${sectionIndex}: ${errorText}`);
    }

    // Parse response to verify acceptance
    try {
      const responseData = await response.json() as { status?: string; sectionIndex?: number };
      debugLog(`n8n accepted section ${sectionIndex}`, responseData);
    } catch {
      // Response may not be JSON, which is fine
      debugLog(`n8n response for section ${sectionIndex} was not JSON (this is okay)`);
    }

    // CRITICAL: Wait for callback before sending next section
    // This prevents overwhelming n8n and ensures proper sequential processing
    if (!isLastSection) {
      debugLog(`Waiting for callback for section ${sectionIndex} before sending next...`);
      const callbackReceived = await waitForCallback(
        importRecord._id as mongoose.Types.ObjectId,
        sectionIndex + 1, // We expect (sectionIndex + 1) sections to be received after this one completes
        callbackTimeoutMs
      );

      if (!callbackReceived) {
        console.error(`[ImportController] Timeout waiting for callback for section ${sectionIndex}. Continuing anyway.`);
        // Continue anyway - the callback might still come, and we don't want to block forever
        // But log this as a warning
      }
    }
  }

  debugLog('All sections sent to n8n successfully', {
    documentId: importRecord._id.toString(),
    jobId,
    totalSections
  });
}

/**
 * Process document with local section mapper (fallback)
 */
async function processWithLocalMapper(
  importRecord: ISelfStudyImport,
  parsed: any,
  programLevel: 'associate' | 'bachelors' | 'masters'
) {
  // Auto-map sections using local mapper
  const suggestions = await sectionMapperService.autoMap(parsed.sections, programLevel);

  // Apply auto-mappings
  for (const suggestion of suggestions) {
    if (suggestion.confidence >= 0.6) {
      importRecord.mappedSections.push({
        extractedSectionId: suggestion.sectionId,
        standardCode: suggestion.suggestedStandardCode,
        specCode: suggestion.suggestedSpecCode,
        fieldType: 'narrative',
        mappedBy: 'auto',
        mappedAt: new Date()
      });
    } else {
      importRecord.unmappedContent.push({
        extractedSectionId: suggestion.sectionId,
        reason: `Low confidence mapping (${Math.round(suggestion.confidence * 100)}%)`,
        action: 'pending'
      });
    }
  }

  // Map tables
  for (const table of parsed.tables) {
    const tableMapping = sectionMapperService.mapTable(table);
    if (tableMapping && tableMapping.confidence >= 0.6) {
      importRecord.mappedSections.push({
        extractedSectionId: table.id,
        standardCode: tableMapping.suggestedStandardCode,
        specCode: tableMapping.suggestedSpecCode,
        fieldType: table.tableType === 'curriculum_matrix' ? 'matrix' : 'table',
        mappedBy: 'auto',
        mappedAt: new Date()
      });
    } else {
      importRecord.unmappedContent.push({
        extractedSectionId: table.id,
        reason: 'Table could not be auto-mapped',
        action: 'pending'
      });
    }
  }

  // Find sections not mapped or in unmapped
  const allMappedIds = new Set([
    ...importRecord.mappedSections.map(m => m.extractedSectionId),
    ...importRecord.unmappedContent.map(u => u.extractedSectionId)
  ]);

  for (const section of importRecord.extractedContent.sections) {
    if (!allMappedIds.has(section.id)) {
      importRecord.unmappedContent.push({
        extractedSectionId: section.id,
        reason: 'No matching standard pattern found',
        action: 'pending'
      });
    }
  }
}

/**
 * Detect section type from content
 */
function detectSectionType(content: string, tables: any[]): 'narrative' | 'table' | 'matrix' | 'syllabus' | 'cv' | 'form' | 'unknown' {
  const contentType = sectionMapperService.detectContentType(content);

  switch (contentType) {
    case 'syllabus': return 'syllabus';
    case 'cv': return 'cv';
    case 'evaluation_form': return 'form';
    case 'matrix': return 'matrix';
    default: return 'narrative';
  }
}

/**
 * Format table as text for storage
 */
function formatTableAsText(table: { headers: string[]; rows: string[][] }): string {
  const lines = [table.headers.join('\t')];
  for (const row of table.rows) {
    lines.push(row.join('\t'));
  }
  return lines.join('\n');
}

/**
 * Get import status and content with detailed progress
 */
export const getImport = async (req: Request, res: Response) => {
  try {
    const { importId } = req.params;

    const importRecord = await SelfStudyImport.findById(importId);
    if (!importRecord) {
      return res.status(404).json({ error: 'Import not found' });
    }

    // Calculate processing step and elapsed time
    let processingStep = 'initializing';
    let stepDescription = 'Initializing document processing...';
    let elapsedMs = 0;
    let elapsedDisplay = '';

    if (importRecord.processingStartedAt) {
      elapsedMs = Date.now() - importRecord.processingStartedAt.getTime();
      const elapsedSeconds = Math.floor(elapsedMs / 1000);
      const minutes = Math.floor(elapsedSeconds / 60);
      const seconds = elapsedSeconds % 60;
      elapsedDisplay = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
    }

    if (importRecord.status === 'processing') {
      // Use parsingProgress if available for detailed status
      const pp = importRecord.parsingProgress;

      if (pp && pp.step && !importRecord.n8nSentAt) {
        // Still in parsing phase - use parsingProgress
        processingStep = pp.step;
        stepDescription = pp.stepDescription || 'Processing...';
      } else if (!importRecord.n8nSentAt) {
        // Fallback if parsingProgress not set
        processingStep = 'parsing';
        stepDescription = 'Parsing document and extracting text...';
      } else if ((importRecord.n8nReceivedSections || 0) === 0) {
        processingStep = 'analyzing';
        // Calculate time waiting for n8n
        const n8nElapsedMs = Date.now() - importRecord.n8nSentAt.getTime();
        const n8nElapsedSeconds = Math.floor(n8nElapsedMs / 1000);
        const n8nMinutes = Math.floor(n8nElapsedSeconds / 60);

        const totalSections = importRecord.n8nTotalSections || 0;
        const currentSection = pp?.currentSectionIndex !== undefined ? pp.currentSectionIndex + 1 : 0;

        if (currentSection > 0 && currentSection <= totalSections) {
          stepDescription = `Sending section ${currentSection}/${totalSections} to AI for analysis...`;
        } else if (n8nMinutes >= 5) {
          stepDescription = `Waiting for AI analysis (${totalSections} sections)... (${n8nMinutes} minutes) - Large documents may take longer`;
        } else if (n8nMinutes >= 1) {
          stepDescription = `AI is analyzing document sections (${totalSections} sections)... (${n8nMinutes}m ${n8nElapsedSeconds % 60}s)`;
        } else {
          stepDescription = `Sent ${totalSections} sections to AI for analysis...`;
        }
      } else {
        processingStep = 'matching';
        stepDescription = `Receiving AI matches (${importRecord.n8nReceivedSections}/${importRecord.n8nTotalSections || '?'} sections)...`;
      }
    } else if (importRecord.status === 'completed') {
      processingStep = 'complete';
      stepDescription = 'Processing complete!';
    } else if (importRecord.status === 'failed') {
      processingStep = 'error';
      stepDescription = importRecord.error || 'An error occurred during processing';
    }

    // Get recent mappings for progress display (last 5)
    const recentMappings = importRecord.mappedSections
      .slice(-5)
      .reverse()
      .map(m => ({
        standardCode: m.standardCode,
        specCode: m.specCode,
        mappedBy: m.mappedBy
      }));

    // Build detailed progress info
    const pp = importRecord.parsingProgress;
    const progress = {
      step: processingStep,
      stepDescription,
      totalSections: importRecord.n8nTotalSections || 0,
      receivedSections: importRecord.n8nReceivedSections || 0,
      percentComplete: importRecord.n8nTotalSections
        ? Math.round((importRecord.n8nReceivedSections || 0) / importRecord.n8nTotalSections * 100)
        : 0,
      elapsedTime: elapsedDisplay,
      elapsedMs,
      n8nSentAt: importRecord.n8nSentAt,
      recentMappings,
      // Include parsing progress details for UI feedback
      parsingDetails: pp ? {
        tocEntriesFound: pp.tocEntriesFound,
        tocTitles: pp.tocTitles,
        sectionsCreated: pp.sectionsCreated,
        sectionTitles: pp.sectionTitles,
        currentSectionIndex: pp.currentSectionIndex
      } : null
    };

    debugLog('getImport response', {
      importId,
      status: importRecord.status,
      progress
    });

    return res.json({
      id: importRecord._id,
      status: importRecord.status,
      originalFilename: importRecord.originalFilename,
      fileType: importRecord.fileType,
      uploadedAt: importRecord.uploadedAt,
      processingStartedAt: importRecord.processingStartedAt,
      processingCompletedAt: importRecord.processingCompletedAt,
      error: importRecord.error,
      specName: importRecord.specName,
      progress,
      extractedContent: {
        pageCount: importRecord.extractedContent?.pageCount || 0,
        metadata: importRecord.extractedContent?.metadata || {},
        sectionCount: importRecord.extractedContent?.sections?.length || 0
      },
      mappedCount: importRecord.mappedSections.length,
      unmappedCount: importRecord.unmappedContent.filter(u => u.action === 'pending').length
    });
  } catch (error) {
    console.error('Get import error:', error);
    return res.status(500).json({ error: 'Failed to get import' });
  }
};

/**
 * Get extracted sections with mapping suggestions
 */
export const getExtractedSections = async (req: Request, res: Response) => {
  try {
    const { importId } = req.params;

    const importRecord = await SelfStudyImport.findById(importId);
    if (!importRecord) {
      return res.status(404).json({ error: 'Import not found' });
    }

    if (importRecord.status !== 'completed') {
      return res.status(400).json({ error: 'Import processing not complete' });
    }

    const sections = importRecord.extractedContent.sections.map(section => {
      const mapping = importRecord.mappedSections.find(m => m.extractedSectionId === section.id);
      const unmapped = importRecord.unmappedContent.find(u => u.extractedSectionId === section.id);

      return {
        id: section.id,
        pageNumber: section.pageNumber,
        sectionType: section.sectionType,
        content: section.content.substring(0, 500) + (section.content.length > 500 ? '...' : ''),
        fullContentLength: section.content.length,
        suggestedStandard: section.suggestedStandard,
        confidence: section.confidence,
        mapping: mapping ? {
          standardCode: mapping.standardCode,
          specCode: mapping.specCode,
          fieldType: mapping.fieldType,
          mappedBy: mapping.mappedBy
        } : null,
        unmappedReason: unmapped?.reason,
        status: mapping ? 'mapped' : (unmapped ? 'unmapped' : 'pending'),
        // Include AI suggestions for unmapped sections
        suggestedStandardCode: unmapped?.suggestedStandardCode,
        suggestedSpecCode: unmapped?.suggestedSpecCode,
        suggestedConfidence: unmapped?.suggestedConfidence
      };
    });

    return res.json({ sections });
  } catch (error) {
    console.error('Get sections error:', error);
    return res.status(500).json({ error: 'Failed to get sections' });
  }
};

/**
 * Map a section to a standard
 */
export const mapSection = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { importId } = req.params;
    const { extractedSectionId, standardCode, specCode, fieldType } = req.body;

    const importRecord = await SelfStudyImport.findById(importId);
    if (!importRecord) {
      return res.status(404).json({ error: 'Import not found' });
    }

    // Remove from unmapped if present
    importRecord.unmappedContent = importRecord.unmappedContent.filter(
      u => u.extractedSectionId !== extractedSectionId
    );

    // Remove existing mapping if present
    importRecord.mappedSections = importRecord.mappedSections.filter(
      m => m.extractedSectionId !== extractedSectionId
    );

    // Add new mapping
    importRecord.mappedSections.push({
      extractedSectionId,
      standardCode,
      specCode,
      fieldType: fieldType || 'narrative',
      mappedBy: 'manual',
      mappedByUserId: new mongoose.Types.ObjectId(req.user?.id),
      mappedAt: new Date()
    });

    await importRecord.save();

    return res.json({ success: true, message: 'Section mapped successfully' });
  } catch (error) {
    console.error('Map section error:', error);
    return res.status(500).json({ error: 'Failed to map section' });
  }
};

/**
 * Apply all mappings to the submission
 * Writes matched content to the narrative rich text editor for each spec
 */
export const applyMappings = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { importId } = req.params;

    debugLog('applyMappings called', { importId });

    const importRecord = await SelfStudyImport.findById(importId);
    if (!importRecord) {
      return res.status(404).json({ error: 'Import not found' });
    }

    debugLog('Found import record', {
      mappedSections: importRecord.mappedSections.length,
      extractedSections: importRecord.extractedContent?.sections?.length || 0
    });

    const submission = await Submission.findById(importRecord.submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    debugLog('Found submission', { submissionId: submission._id });

    // Initialize narratives map if not present
    if (!submission.narratives) {
      submission.narratives = new Map();
    }

    let appliedCount = 0;
    const appliedMappings: { standardCode: string; specCode: string; contentLength: number }[] = [];

    for (const mapping of importRecord.mappedSections) {
      const section = importRecord.extractedContent.sections.find(
        s => s.id === mapping.extractedSectionId
      );

      if (!section) {
        debugLog('Section not found for mapping', { extractedSectionId: mapping.extractedSectionId });
        continue;
      }

      debugLog('Processing mapping', {
        standardCode: mapping.standardCode,
        specCode: mapping.specCode,
        fieldType: mapping.fieldType,
        contentLength: section.content?.length || 0
      });

      if (mapping.fieldType === 'narrative') {
        // Get or create standard map
        let standardNarratives = submission.narratives.get(mapping.standardCode);
        if (!standardNarratives) {
          standardNarratives = new Map();
          submission.narratives.set(mapping.standardCode, standardNarratives);
        }

        // Get existing narrative or create new
        const existingNarrative = standardNarratives.get(mapping.specCode);

        // Append or set narrative content
        const newContent = existingNarrative?.content
          ? `${existingNarrative.content}\n\n${section.content}`
          : section.content;

        standardNarratives.set(mapping.specCode, {
          content: newContent,
          lastModified: new Date(),
          isComplete: false,
          linkedDocuments: existingNarrative?.linkedDocuments || [],
          supportingEvidenceText: existingNarrative?.supportingEvidenceText || ''
        });

        appliedCount++;
        appliedMappings.push({
          standardCode: mapping.standardCode,
          specCode: mapping.specCode,
          contentLength: newContent.length
        });

        debugLog('Applied narrative mapping', {
          standardCode: mapping.standardCode,
          specCode: mapping.specCode,
          newContentLength: newContent.length
        });
      }
    }

    // CRITICAL: Mark the nested map as modified for Mongoose to save it
    submission.markModified('narratives');

    // Add import reference to submission
    if (!submission.imports) {
      submission.imports = [];
    }
    if (!submission.imports.some(id => id.toString() === (importRecord._id as mongoose.Types.ObjectId).toString())) {
      submission.imports.push(importRecord._id as mongoose.Types.ObjectId);
    }

    await submission.save();

    debugLog('Submission saved successfully', {
      appliedCount,
      appliedMappings
    });

    return res.json({
      success: true,
      appliedCount,
      appliedMappings,
      message: `Applied ${appliedCount} mappings to submission`
    });
  } catch (error) {
    console.error('Apply mappings error:', error);
    return res.status(500).json({ error: 'Failed to apply mappings' });
  }
};

/**
 * Get unmapped content for review
 * Returns full content and any AI suggestions for each unmapped section
 */
export const getUnmappedContent = async (req: Request, res: Response) => {
  try {
    const { importId } = req.params;

    const importRecord = await SelfStudyImport.findById(importId);
    if (!importRecord) {
      return res.status(404).json({ error: 'Import not found' });
    }

    const unmapped = importRecord.unmappedContent
      .filter(u => u.action === 'pending')
      .map(u => {
        const section = importRecord.extractedContent.sections.find(
          s => s.id === u.extractedSectionId
        );

        return {
          extractedSectionId: u.extractedSectionId,
          reason: u.reason,
          // Return full content for display and moving
          content: section?.content || '',
          fullContentLength: section?.content?.length || 0,
          sectionType: section?.sectionType,
          pageNumber: section?.pageNumber,
          // Include AI suggestions if available
          suggestedStandardCode: (u as any).suggestedStandardCode,
          suggestedSpecCode: (u as any).suggestedSpecCode,
          suggestedConfidence: (u as any).suggestedConfidence
        };
      });

    return res.json({ unmapped });
  } catch (error) {
    console.error('Get unmapped error:', error);
    return res.status(500).json({ error: 'Failed to get unmapped content' });
  }
};

/**
 * Handle unmapped content - assign to narrative, supporting evidence, or discard
 *
 * Actions:
 * - 'assign': Move to narrative rich text for specified standard/spec
 * - 'assign_evidence': Move to supporting evidence text for specified standard/spec
 * - 'discard': Mark as discarded
 */
export const handleUnmapped = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { importId, sectionId } = req.params;
    const { action, standardCode, specCode, toSupportingEvidence } = req.body;

    debugLog('handleUnmapped called', { importId, sectionId, action, standardCode, specCode, toSupportingEvidence });

    const importRecord = await SelfStudyImport.findById(importId);
    if (!importRecord) {
      return res.status(404).json({ error: 'Import not found' });
    }

    const unmappedIndex = importRecord.unmappedContent.findIndex(
      u => u.extractedSectionId === sectionId
    );

    if (unmappedIndex === -1) {
      return res.status(404).json({ error: 'Unmapped content not found' });
    }

    // Get the section content
    const section = importRecord.extractedContent.sections.find(
      s => s.id === sectionId
    );

    if (action === 'assign' && standardCode && specCode) {
      // Get the submission to write content immediately
      const submission = await Submission.findById(importRecord.submissionId);
      if (!submission) {
        return res.status(404).json({ error: 'Submission not found' });
      }

      // Initialize narratives map if not present
      if (!submission.narratives) {
        submission.narratives = new Map();
      }

      // Get or create standard map
      let standardNarratives = submission.narratives.get(standardCode);
      if (!standardNarratives) {
        standardNarratives = new Map();
        submission.narratives.set(standardCode, standardNarratives);
      }

      // Get existing narrative
      const existingNarrative = standardNarratives.get(specCode);

      if (toSupportingEvidence) {
        // Move to supporting evidence text
        const existingEvidence = existingNarrative?.supportingEvidenceText || '';
        const newEvidence = existingEvidence
          ? `${existingEvidence}\n\n${section?.content || ''}`
          : section?.content || '';

        standardNarratives.set(specCode, {
          content: existingNarrative?.content || '',
          lastModified: new Date(),
          isComplete: existingNarrative?.isComplete || false,
          linkedDocuments: existingNarrative?.linkedDocuments || [],
          supportingEvidenceText: newEvidence
        });

        debugLog('Moved to supporting evidence', {
          standardCode,
          specCode,
          newEvidenceLength: newEvidence.length
        });
      } else {
        // Move to narrative content
        const newContent = existingNarrative?.content
          ? `${existingNarrative.content}\n\n${section?.content || ''}`
          : section?.content || '';

        standardNarratives.set(specCode, {
          content: newContent,
          lastModified: new Date(),
          isComplete: existingNarrative?.isComplete || false,
          linkedDocuments: existingNarrative?.linkedDocuments || [],
          supportingEvidenceText: existingNarrative?.supportingEvidenceText || ''
        });

        debugLog('Moved to narrative', {
          standardCode,
          specCode,
          newContentLength: newContent.length
        });
      }

      // Mark narratives as modified and save
      submission.markModified('narratives');
      await submission.save();

      // Update import record
      importRecord.unmappedContent[unmappedIndex].action = 'assigned';
      importRecord.unmappedContent[unmappedIndex].reviewedBy = new mongoose.Types.ObjectId(req.user?.id);
      importRecord.unmappedContent[unmappedIndex].reviewedAt = new Date();

      importRecord.mappedSections.push({
        extractedSectionId: sectionId,
        standardCode,
        specCode,
        fieldType: toSupportingEvidence ? 'evidence' : 'narrative',
        mappedBy: 'manual',
        mappedByUserId: new mongoose.Types.ObjectId(req.user?.id),
        mappedAt: new Date()
      });

    } else if (action === 'discard') {
      importRecord.unmappedContent[unmappedIndex].action = 'discarded';
      importRecord.unmappedContent[unmappedIndex].reviewedBy = new mongoose.Types.ObjectId(req.user?.id);
      importRecord.unmappedContent[unmappedIndex].reviewedAt = new Date();
    } else {
      return res.status(400).json({ error: 'Invalid action or missing parameters' });
    }

    importRecord.markModified('unmappedContent');
    importRecord.markModified('mappedSections');
    await importRecord.save();

    return res.json({
      success: true,
      message: toSupportingEvidence
        ? 'Content moved to supporting evidence'
        : `Content ${action}ed successfully`
    });
  } catch (error) {
    console.error('Handle unmapped error:', error);
    return res.status(500).json({ error: 'Failed to handle unmapped content' });
  }
};

/**
 * Cancel/abort an in-progress import
 * Deletes the import record and all associated data (extracted HTML, sections, mappings)
 * to free up space since the user will try again
 */
export const cancelImport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { importId } = req.params;

    debugLog('Cancel import requested', { importId, userId: req.user?.id });

    const importRecord = await SelfStudyImport.findById(importId);
    if (!importRecord) {
      return res.status(404).json({ error: 'Import not found' });
    }

    // Only allow canceling if still processing or pending
    if (importRecord.status !== 'processing' && importRecord.status !== 'pending') {
      debugLog('Import cannot be cancelled - not in processing state', {
        importId,
        currentStatus: importRecord.status
      });
      return res.status(400).json({
        error: `Import cannot be cancelled. Current status: ${importRecord.status}`
      });
    }

    // Log what we're about to delete for debugging
    debugLog('Deleting import record and all associated data', {
      importId,
      filename: importRecord.originalFilename,
      extractedContentSize: importRecord.extractedContent?.rawText?.length || 0,
      sectionsCount: importRecord.extractedContent?.sections?.length || 0,
      mappedCount: importRecord.mappedSections?.length || 0,
      unmappedCount: importRecord.unmappedContent?.length || 0
    });

    // Delete the entire import record to free up space
    // This removes: extracted HTML, sections, mappings, and all metadata
    await SelfStudyImport.findByIdAndDelete(importId);

    debugLog('Import record deleted successfully', { importId });

    return res.json({
      success: true,
      message: 'Import cancelled and data cleaned up',
      importId
    });
  } catch (error) {
    console.error('Cancel import error:', error);
    return res.status(500).json({ error: 'Failed to cancel import' });
  }
};
