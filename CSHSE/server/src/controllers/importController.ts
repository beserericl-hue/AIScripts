import { Request, Response } from 'express';
import mongoose from 'mongoose';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { SelfStudyImport, ISelfStudyImport, IDetectedSection } from '../models/SelfStudyImport';
import { Submission } from '../models/Submission';
import { Institution } from '../models/Institution';
import { WebhookSettings } from '../models/WebhookSettings';
import { CurriculumMatrix } from '../models/CurriculumMatrix';
import { documentParserService, TOCBasedSection, ParsedDocument } from '../services/documentParser';
import { sectionMapperService } from '../services/sectionMapper';
import { saveWithRetry, withRetry } from '../utils/dbRetry';
import * as tempFileService from '../services/tempFileService';
import * as gridFsService from '../services/gridFsService';
import { recordVersion } from '../services/documentVersionService';
import fs from 'fs/promises';
import { createReadStream } from 'fs';

// Always log for visibility in production
function debugLog(message: string, data?: any) {
  console.log(`[Import] ${message}`, data ? JSON.stringify(data) : '');
}

/**
 * Force a flat copy of a string, breaking V8 SlicedString references.
 * V8's substring() creates a SlicedString that retains a reference to the
 * full parent string. For 370MB documents, this prevents GC of old copies.
 */
function flattenString(s: string): string {
  if (!s || s.length === 0) return s;
  return Buffer.from(s, 'utf-8').toString('utf-8');
}

/**
 * Create HTML placeholder for extracted content
 * This replaces the extracted content in the stored HTML so it doesn't appear when reloaded
 */
function createPlaceholderHtml(sectionId: string, sectionType: string, title: string, contentLength: number): string {
  const typeColors: Record<string, { bg: string; border: string; text: string }> = {
    'standard': { bg: '#ccfbf1', border: '#2dd4bf', text: '#115e59' },
    'matrix': { bg: '#f3e8ff', border: '#a855f7', text: '#6b21a8' },
    'appendix': { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
    'skip': { bg: '#f3f4f6', border: '#9ca3af', text: '#4b5563' }
  };
  const colors = typeColors[sectionType] || typeColors['standard'];

  return `<div class="extracted-section-placeholder" data-section-id="${sectionId}" data-section-type="${sectionType}" style="background-color: ${colors.bg}; border-left: 4px solid ${colors.border}; color: ${colors.text}; padding: 8px 12px; margin: 8px 0; border-radius: 0 4px 4px 0; font-family: system-ui, -apple-system, sans-serif;">
    <span style="font-weight: 500; font-size: 14px;">✓ Extracted: ${title.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
    <span style="font-size: 12px; opacity: 0.75; margin-left: 8px;">(${contentLength.toLocaleString()} chars)</span>
  </div>`;
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

    // Preserve the ORIGINAL uploaded bytes as an immutable versioned record
    // in S3. The AI import wizard reads from this S3 location going forward
    // so it never depends on the mutated GridFS HTML. SHA-256 dedup means
    // re-uploading identical bytes returns the same DocumentVersion row.
    try {
      const docVersion = await recordVersion({
        ownerType: 'submission',
        ownerId: new mongoose.Types.ObjectId(submissionId),
        kind: 'original_import',
        buffer: file.buffer,
        fileName: file.originalname,
        mimeType: file.mimetype,
        uploadedBy: new mongoose.Types.ObjectId(req.user?.id),
        uploadedByName: req.user?.name || 'unknown',
        metadata: { importId: importRecord._id as mongoose.Types.ObjectId },
      });
      debugLog('Original file preserved in S3', {
        importId: importRecord._id,
        documentVersionId: String(docVersion._id),
        version: docVersion.version,
        s3Key: docVersion.s3Key,
      });
      // Atomically record the real s3Key on the import record so the AI
      // wizard's startAIImport controller can pass it to the cshse-ai
      // service. Without this, startAIImport falls back to a synthetic
      // 'imports/{importId}/source.docx' path that doesn't exist in S3
      // and the download_s3 stage 404s. findByIdAndUpdate avoids the
      // VersionError race with the parallel-running legacy pipeline.
      await SelfStudyImport.findByIdAndUpdate(importRecord._id, {
        $set: {
          aiS3Key: docVersion.s3Key,
          aiDocumentVersionId: docVersion._id,
        },
      });
    } catch (versionErr) {
      // Non-fatal: preserve-original failure should NOT block the import.
      // Legacy imports worked without this; we log and continue.
      console.warn('[Import] recordVersion failed (non-fatal):', versionErr);
    }

    // Construct callback URL for n8n
    const callbackUrl = getCallbackUrl(req, '/api/webhooks/document-matcher/callback');
    debugLog('Callback URL constructed', { callbackUrl });

    // Get specName from institution
    const institution = await Institution.findOne({ name: submission.institutionName });
    const specName = institution?.specName || 'CSHSE Standards';
    debugLog('Spec name resolved', { institutionName: submission.institutionName, specName });

    // Start processing for manual tagging workflow
    processDocumentForManualTagging(
      importRecord._id as mongoose.Types.ObjectId,
      file.buffer,
      file.originalname
    );

    return res.status(202).json({
      importId: importRecord._id,
      status: 'processing',
      message: 'Document upload started. Preparing for manual section tagging.'
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
    // Send up to 20 titles for better UI feedback
    const tocTitles = tocEntries.slice(0, 20).map(e => e.title.substring(0, 80));
    const sectionTitles = tocSections.slice(0, 20).map(s => s.tocEntry.title.substring(0, 80));

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

    // Log matrix entries specifically for debugging
    const matrixTocEntries = tocEntries.filter(e => e.isMatrix || e.title.toLowerCase().includes('matrix'));
    const matrixSections = tocSections.filter(s => s.tocEntry.isMatrix || s.tocEntry.title.toLowerCase().includes('matrix'));
    debugLog('MATRIX DEBUG', {
      matrixTocEntriesFound: matrixTocEntries.map(e => ({ title: e.title.substring(0, 50), page: e.pageNumber })),
      matrixSectionsExtracted: matrixSections.map(s => ({
        title: s.tocEntry.title.substring(0, 50),
        contentLength: s.content.length,
        isMatrix: s.tocEntry.isMatrix
      }))
    });

    // Store extracted content using TOC-based sections
    // NOTE: To avoid MongoDB's 16MB document limit:
    // - Don't store full rawText (not needed after parsing)
    // - Truncate section content to 50KB max each (enough for display and mapping)
    const MAX_SECTION_CONTENT_LENGTH = 50000; // 50KB per section
    const MAX_RAW_TEXT_LENGTH = 5000; // Keep just first 5KB for metadata/preview

    let truncatedSections = 0;
    importRecord.extractedContent = {
      rawText: parsed.rawText.substring(0, MAX_RAW_TEXT_LENGTH), // Only store preview
      pageCount: parsed.metadata.pageCount,
      metadata: {
        title: parsed.metadata.title,
        author: parsed.metadata.author,
        createdDate: parsed.metadata.createdDate
      },
      sections: tocSections.map(section => {
        const content = section.content;
        const needsTruncation = content.length > MAX_SECTION_CONTENT_LENGTH;
        if (needsTruncation) {
          truncatedSections++;
        }
        return {
          id: section.id,
          pageNumber: section.tocEntry.pageNumber || 1,
          startPosition: section.startPosition,
          endPosition: section.endPosition,
          sectionType: section.tocEntry.isMatrix ? 'matrix' :
                       section.tocEntry.isSupportingEvidence ? 'supporting_evidence' :
                       section.tocEntry.sectionType === 'standard' ? 'narrative' : 'general',
          content: needsTruncation
            ? content.substring(0, MAX_SECTION_CONTENT_LENGTH) + '\n\n[Content truncated for storage - full content sent to AI]'
            : content,
          confidence: section.tocEntry.standardCode ? 0.8 : 0.5,
          suggestedStandard: section.tocEntry.standardCode ?
            `${section.tocEntry.standardCode}${section.tocEntry.specCode ? '.' + section.tocEntry.specCode : ''}` :
            undefined
        };
      })
    };

    if (truncatedSections > 0) {
      debugLog('Content truncated for MongoDB storage', {
        truncatedSections,
        totalSections: tocSections.length,
        maxSectionLength: MAX_SECTION_CONTENT_LENGTH
      });
    }

    // Log matrix sections that will be stored
    const matrixStoredSections = importRecord.extractedContent.sections.filter(s => s.sectionType === 'matrix');
    debugLog('MATRIX STORED SECTIONS', {
      count: matrixStoredSections.length,
      sections: matrixStoredSections.map(s => ({
        id: s.id,
        contentLength: s.content.length,
        suggestedStandard: s.suggestedStandard
      }))
    });

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

    // Part 6: Detect structural headers for user selection
    console.log('[Import] === PART 6: Starting structural header detection ===');
    console.log('[Import] HTML content length:', parsed.htmlContent.length);
    console.log('[Import] Raw text length:', parsed.rawText.length);

    let detectedSections: any[] = [];
    let appendixSection: any = null;
    let totalSections = 0;

    try {
      const result = documentParserService.detectStructuralHeaders(parsed.htmlContent, parsed.rawText);
      detectedSections = result.sections;
      appendixSection = result.appendixSection;
      totalSections = result.totalSections;

      console.log('[Import] === Structural headers detected successfully ===');
      console.log('[Import] Top-level sections:', detectedSections.length);
      console.log('[Import] Total sections:', totalSections);
      console.log('[Import] Has appendix:', !!appendixSection);
      if (detectedSections.length > 0) {
        console.log('[Import] First few headers:', detectedSections.slice(0, 5).map(s => s.headerText?.substring(0, 50)));
      }
    } catch (headerError) {
      console.error('[Import] ERROR in detectStructuralHeaders:', headerError);
      // Fall back to using existing TOC sections
      console.log('[Import] Falling back to TOC-based sections');
    }

    // If no sections detected, fall back to existing flow
    if (detectedSections.length === 0) {
      console.log('[Import] No structural headers detected, falling back to existing n8n flow');
      // Continue with the legacy flow below instead of returning
    } else {
      // Store detected sections for user selection
      console.log('[Import] === Storing detected sections in MongoDB ===');

      // Limit content size to prevent MongoDB document size issues
      const MAX_CONTENT_PER_SECTION = 100000; // 100KB per section
      const limitedSections = detectedSections.map(section => ({
        ...section,
        fullContent: section.fullContent?.substring(0, MAX_CONTENT_PER_SECTION) || '',
        htmlContent: section.htmlContent?.substring(0, MAX_CONTENT_PER_SECTION) || '',
        children: (section.children || []).map((child: any) => ({
          ...child,
          fullContent: child.fullContent?.substring(0, MAX_CONTENT_PER_SECTION) || '',
          htmlContent: child.htmlContent?.substring(0, MAX_CONTENT_PER_SECTION) || ''
        }))
      }));

      importRecord.detectedSections = limitedSections;
      if (appendixSection) {
        importRecord.appendix = {
          htmlContent: appendixSection.htmlContent?.substring(0, MAX_CONTENT_PER_SECTION) || '',
          extractedAt: new Date()
        };
      }

      // Get ALL section titles (not just first 10)
      const getAllTitles = (sections: any[], titles: string[] = []): string[] => {
        for (const section of sections) {
          titles.push(section.headerText?.substring(0, 100) || 'Untitled');
          if (section.children?.length > 0) {
            getAllTitles(section.children, titles);
          }
        }
        return titles;
      };
      const allTitles = getAllTitles(limitedSections);
      console.log('[Import] All section titles count:', allTitles.length);

      // Update progress to section selection step
      importRecord.parsingProgress = {
        step: 'section_selection',
        stepDescription: `${totalSections} sections detected. Please review and select sections to process.`,
        sectionsCreated: totalSections,
        sectionTitles: allTitles // Show ALL titles, not just first 10
      };
      importRecord.status = 'awaiting_selection';
      importRecord.markModified('detectedSections');
      importRecord.markModified('appendix');
      importRecord.markModified('parsingProgress');

      try {
        console.log('[Import] === Saving import record with awaiting_selection status ===');
        await importRecord.save();
        console.log('[Import] === Import record saved successfully ===');
        console.log('[Import] Import ID:', importId.toString());
        console.log('[Import] Status:', importRecord.status);
        console.log('[Import] Sections for selection:', totalSections);
      } catch (saveError) {
        console.error('[Import] ERROR saving import record:', saveError);
        throw saveError; // Re-throw to trigger error handling
      }

      // Processing will continue when user confirms section selections
      // via POST /api/imports/:importId/confirm-selections
      return;
    }

    // Legacy code below - runs only if no structural headers detected
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
    await saveWithRetry(importRecord);
  } catch (error) {
    importRecord.status = 'failed';
    importRecord.error = error instanceof Error ? error.message : 'Unknown error';
    importRecord.processingCompletedAt = new Date();
    // Use regular save for error state - if this fails too, we can't do much
    try {
      await importRecord.save();
    } catch (saveError) {
      console.error('[ImportController] Failed to save error state:', saveError);
    }
  }
}

/**
 * Process document for manual tagging workflow
 * This replaces the automated section detection with a visual tagging approach.
 *
 * Flow:
 * 1. Parse document with mammoth (DOCX) or pdf-parse (PDF) to extract HTML with images
 * 2. Save HTML to temp file (/tmp/imports/{importId}/content.html)
 * 3. Save images to temp folder (/tmp/imports/{importId}/images/)
 * 4. Store only metadata in MongoDB (not full content)
 * 5. Set status to 'awaiting_selection' for manual tagging
 */
async function processDocumentForManualTagging(
  importId: mongoose.Types.ObjectId,
  buffer: Buffer,
  filename: string
) {
  debugLog('Starting manual tagging document processing', { importId: importId.toString(), filename });

  const importRecord = await SelfStudyImport.findById(importId);
  if (!importRecord) {
    console.error('[ImportController] Import record not found:', importId);
    return;
  }

  try {
    // Update status to processing
    importRecord.status = 'processing';
    importRecord.processingStartedAt = new Date();
    importRecord.parsingProgress = {
      step: 'extracting_text',
      stepDescription: 'Extracting document content and images...'
    };
    await importRecord.save();

    // Determine file type from filename
    const extension = filename.toLowerCase().split('.').pop();
    let result: { htmlContent: string; rawText: string; imageCount: number };

    if (extension === 'docx') {
      debugLog('Parsing DOCX for manual tagging');
      result = await documentParserService.parseDOCXForManualTagging(buffer, importId.toString());
    } else if (extension === 'pdf') {
      debugLog('Parsing PDF for manual tagging');
      result = await documentParserService.parsePDFForManualTagging(buffer, importId.toString());
    } else {
      throw new Error(`Unsupported file type: ${extension}. Please upload DOCX or PDF.`);
    }

    debugLog('Document parsed for manual tagging', {
      importId: importId.toString(),
      htmlLength: result.htmlContent.length,
      rawTextLength: result.rawText.length,
      imageCount: result.imageCount
    });

    // Update progress - storing in GridFS
    importRecord.parsingProgress = {
      step: 'storing_content',
      stepDescription: `Storing document content (${Math.round(result.htmlContent.length / 1024 / 1024)}MB)...`
    };
    await importRecord.save();

    // Store HTML content in GridFS (handles files larger than MongoDB's 16MB BSON limit)
    debugLog('Storing HTML in GridFS', { importId: importId.toString(), size: result.htmlContent.length });
    await gridFsService.storeHtmlContent(importId.toString(), result.htmlContent);
    debugLog('HTML stored in GridFS successfully', { importId: importId.toString() });

    // Store minimal metadata in MongoDB (not the full HTML)
    importRecord.extractedContent = {
      rawText: '', // HTML is now in GridFS, not here
      pageCount: 0,
      metadata: {
        title: filename,
        htmlStoredInGridFS: true, // Flag to indicate HTML is in GridFS
        htmlSize: result.htmlContent.length
      },
      sections: []
    };

    // Update progress to awaiting manual tagging
    importRecord.parsingProgress = {
      step: 'section_selection',
      stepDescription: `Document ready for manual section tagging. ${result.imageCount} images extracted.`
    };
    importRecord.status = 'awaiting_selection';
    importRecord.markModified('extractedContent');
    importRecord.markModified('parsingProgress');

    await importRecord.save();
    debugLog('Document ready for manual tagging', {
      importId: importId.toString(),
      status: importRecord.status
    });

  } catch (error) {
    console.error('[ImportController] Manual tagging processing error:', error);
    importRecord.status = 'failed';
    importRecord.error = error instanceof Error ? error.message : 'Unknown error during document processing';
    importRecord.processingCompletedAt = new Date();
    try {
      await importRecord.save();
    } catch (saveError) {
      console.error('[ImportController] Failed to save error state:', saveError);
    }
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

    // Check if this is a matrix section (should be lenient with these)
    const isMatrixSection = section.tocEntry.isMatrix || title.includes('matrix');

    // Exclude very short sections, but be lenient with matrix sections
    // (matrix tables can be short when converted to plain text)
    const minLength = isMatrixSection ? 20 : 100;
    if (section.content.length < minLength) {
      debugLog('Excluding short section from AI processing', {
        title: section.tocEntry.title,
        length: section.content.length,
        isMatrix: isMatrixSection,
        minLength
      });
      return false;
    }

    if (isMatrixSection) {
      debugLog('Including matrix section for AI processing', {
        title: section.tocEntry.title,
        length: section.content.length
      });
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
 * Check for existing in-progress import for a submission
 * Returns the import if found, allowing user to resume or discard
 */
export const checkExistingImport = async (req: Request, res: Response) => {
  try {
    const { submissionId } = req.params;

    // Find any in-progress imports for this submission
    // Status 'uploading', 'processing', or 'awaiting_selection' means work in progress
    const existingImport = await SelfStudyImport.findOne({
      submissionId,
      status: { $in: ['uploading', 'processing', 'awaiting_selection', 'mapping'] }
    }).sort({ uploadedAt: -1 }); // Get most recent

    if (!existingImport) {
      return res.json({
        hasExistingImport: false
      });
    }

    // Get count of tagged sections
    const taggedSectionsCount = existingImport.detectedSections?.length || 0;

    return res.json({
      hasExistingImport: true,
      import: {
        id: existingImport._id,
        status: existingImport.status,
        originalFilename: existingImport.originalFilename,
        uploadedAt: existingImport.uploadedAt,
        taggedSectionsCount,
        // Include progress info if available
        parsingProgress: existingImport.parsingProgress
      }
    });
  } catch (error: any) {
    console.error('Check existing import error:', error);
    return res.status(500).json({ error: 'Failed to check for existing import' });
  }
};

/**
 * Discard an in-progress import (allows user to start fresh)
 */
export const discardImport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { importId } = req.params;

    const importRecord = await SelfStudyImport.findById(importId);
    if (!importRecord) {
      return res.status(404).json({ error: 'Import not found' });
    }

    // Clean up GridFS content if it exists
    try {
      await gridFsService.deleteHtmlContent(importId);
    } catch (e) {
      // Ignore cleanup errors
    }

    // Delete the import record
    await SelfStudyImport.findByIdAndDelete(importId);

    console.log(`[Import] Discarded import ${importId}`);

    return res.json({
      success: true,
      message: 'Import discarded successfully'
    });
  } catch (error: any) {
    console.error('Discard import error:', error);
    return res.status(500).json({ error: 'Failed to discard import' });
  }
};

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
    } else if (importRecord.status === 'awaiting_selection') {
      // Part 6: New section selection step
      processingStep = 'section_selection';
      const pp = importRecord.parsingProgress;
      stepDescription = pp?.stepDescription || `${importRecord.detectedSections?.length || 0} sections detected. Please select sections to process.`;
      console.log('[Import] getImport: Status is awaiting_selection', {
        detectedSectionsCount: importRecord.detectedSections?.length,
        stepDescription
      });
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
 * Get full content for a specific section
 * Used when viewing section details in the modal
 */
export const getSectionContent = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { importId, sectionId } = req.params;

    const importRecord = await SelfStudyImport.findById(importId);
    if (!importRecord) {
      return res.status(404).json({ error: 'Import not found' });
    }

    const section = importRecord.extractedContent.sections.find(s => s.id === sectionId);
    if (!section) {
      return res.status(404).json({ error: 'Section not found' });
    }

    // Get mapping/unmapped info for this section
    const mapping = importRecord.mappedSections.find(m => m.extractedSectionId === sectionId);
    const unmapped = importRecord.unmappedContent.find(u => u.extractedSectionId === sectionId);

    return res.json({
      id: section.id,
      pageNumber: section.pageNumber,
      sectionType: section.sectionType,
      content: section.content, // Full content, not truncated
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
      suggestedStandardCode: unmapped?.suggestedStandardCode,
      suggestedSpecCode: unmapped?.suggestedSpecCode,
      suggestedConfidence: unmapped?.suggestedConfidence
    });
  } catch (error) {
    console.error('Get section content error:', error);
    return res.status(500).json({ error: 'Failed to get section content' });
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
/**
 * Data-integrity guard: a section the importer CLASSIFIED as a matrix must never
 * be silently dropped on apply — once the self-study is locked, the PC can't
 * recover it. applyMappings only persists sections the PC explicitly mapped, so
 * a matrix that wasn't hand-placed would vanish. This materializes EVERY
 * matrix-classified section of the import into the CurriculumMatrix.rawContent,
 * idempotently (deduped by content signature). Returns how many it added.
 */
async function materializeImportedMatrices(importRecord: any, userId?: string): Promise<number> {
  const sigOf = (html: string) => (html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 120).toLowerCase();
  const candidates: { content: string; title?: string; standardCode?: string }[] = [];
  for (const s of (importRecord.detectedSections || [])) {
    if (s?.isMatrix) candidates.push({ content: s.htmlContent || s.fullContent || '', title: s.headerText, standardCode: s.standardCode });
  }
  for (const s of (importRecord.extractedContent?.sections || [])) {
    if (s?.isMatrix || s?.sectionType === 'matrix') candidates.push({ content: s.content || (s as any).htmlContent || '', title: (s as any).title || (s as any).heading, standardCode: (s as any).standardCode });
  }
  const withContent = candidates.filter((c) => (c.content || '').trim().length > 0);
  if (!withContent.length) return 0;

  let matrix = await CurriculumMatrix.findOne({ submissionId: importRecord.submissionId });
  if (!matrix) {
    matrix = new CurriculumMatrix({
      submissionId: importRecord.submissionId,
      name: 'Curriculum Matrix',
      courses: [], standards: [], rawContent: [],
      lastModifiedBy: userId ? new mongoose.Types.ObjectId(userId) : new mongoose.Types.ObjectId(String(importRecord.submissionId)),
    });
  }
  if (!matrix.rawContent) matrix.rawContent = [];
  const seen = new Set((matrix.rawContent || []).map((rc: any) => sigOf(rc.content)));
  let added = 0;
  for (const c of withContent) {
    const sig = sigOf(c.content);
    if (!sig || seen.has(sig)) continue;
    seen.add(sig);
    matrix.rawContent.push({
      id: uuidv4(), content: c.content, title: c.title, standardCode: c.standardCode || undefined,
      sourceImportId: String(importRecord._id), addedAt: new Date(),
      addedBy: (userId ? new mongoose.Types.ObjectId(userId) : (matrix.lastModifiedBy as any)), processed: false,
    } as any);
    added++;
  }
  if (added > 0) { matrix.markModified('rawContent'); await saveWithRetry(matrix); }
  return added;
}

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
        // BUG-FIX: when a standard is brand new (no prior narrative under
        // it), the inner Map created via `new Map()` and then `.set()` on
        // that fresh Map is NOT tracked by Mongoose — the outer Map's
        // value reference is captured at .set() time and subsequent
        // mutations on the inner Map are lost. The legacy code worked
        // accidentally only when the standard already had an entry (a
        // mongoose-tracked Map was returned by .get()), so the first
        // narrative ever written to a fresh standard was silently dropped.
        //
        // Use submission.set() with a dotted path; mongoose handles the
        // creation of intermediate Maps and tracks the leaf write
        // correctly for both new and existing paths.
        let standardNarratives = submission.narratives.get(mapping.standardCode);
        const existingNarrative = standardNarratives?.get(mapping.specCode);

        // Append or set narrative content
        const newContent = existingNarrative?.content
          ? `${existingNarrative.content}\n\n${section.content}`
          : section.content;

        const narrativeValue = {
          content: newContent,
          lastModified: new Date(),
          isComplete: false,
          linkedDocuments: existingNarrative?.linkedDocuments || [],
          supportingEvidenceText: existingNarrative?.supportingEvidenceText || ''
        };

        // mongoose path-set handles both cases (new outer key, existing
        // outer key) without losing the leaf write.
        submission.set(
          `narratives.${mapping.standardCode}.${mapping.specCode}`,
          narrativeValue
        );

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

    await saveWithRetry(submission);

    // Never drop a matrix the importer classified — materialize every matrix
    // section, even ones the PC didn't hand-place (idempotent).
    let matricesMaterialized = 0;
    try {
      matricesMaterialized = await materializeImportedMatrices(importRecord, req.user?.id);
    } catch (mErr) {
      console.error('materializeImportedMatrices failed (non-fatal):', mErr);
    }

    debugLog('Submission saved successfully', {
      appliedCount,
      appliedMappings,
      matricesMaterialized
    });

    return res.json({
      success: true,
      appliedCount,
      appliedMappings,
      matricesMaterialized,
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
    const { action, standardCode, specCode, toSupportingEvidence, toCurriculumMatrix, matrixType } = req.body;

    debugLog('handleUnmapped called', { importId, sectionId, action, standardCode, specCode, toSupportingEvidence, toCurriculumMatrix, matrixType });

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

      // Mark narratives as modified and save with retry
      submission.markModified('narratives');
      await saveWithRetry(submission);

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

    } else if (action === 'move_to_matrix' || toCurriculumMatrix) {
      // Move content to curriculum matrix raw content
      const targetMatrixType = matrixType || 'non_human_services_courses';

      // Find or create curriculum matrix for this submission
      let matrix = await CurriculumMatrix.findOne({
        submissionId: importRecord.submissionId,
        matrixType: targetMatrixType
      });

      if (!matrix) {
        // Create new matrix if it doesn't exist
        matrix = new CurriculumMatrix({
          submissionId: importRecord.submissionId,
          matrixType: targetMatrixType,
          name: targetMatrixType === 'human_services_courses'
            ? 'Human Services Courses'
            : targetMatrixType === 'non_human_services_courses'
              ? 'Non-Human Services Courses'
              : 'Custom Matrix',
          lastModifiedBy: new mongoose.Types.ObjectId(req.user?.id),
          courses: [],
          standards: [],
          rawContent: []
        });
      }

      // Initialize rawContent array if not present
      if (!matrix.rawContent) {
        matrix.rawContent = [];
      }

      // Add the section content to raw content
      matrix.rawContent.push({
        id: uuidv4(),
        content: section?.content || '',
        sourceImportId: importId,
        addedAt: new Date(),
        addedBy: new mongoose.Types.ObjectId(req.user?.id),
        processed: false
      });

      matrix.markModified('rawContent');
      await saveWithRetry(matrix);

      // Update import record
      importRecord.unmappedContent[unmappedIndex].action = 'assigned';
      importRecord.unmappedContent[unmappedIndex].reviewedBy = new mongoose.Types.ObjectId(req.user?.id);
      importRecord.unmappedContent[unmappedIndex].reviewedAt = new Date();

      importRecord.mappedSections.push({
        extractedSectionId: sectionId,
        standardCode: 'MATRIX',
        specCode: targetMatrixType,
        fieldType: 'matrix',
        mappedBy: 'manual',
        mappedByUserId: new mongoose.Types.ObjectId(req.user?.id),
        mappedAt: new Date()
      });

      debugLog('Moved to curriculum matrix', {
        matrixType: targetMatrixType,
        matrixId: matrix._id,
        rawContentCount: matrix.rawContent.length
      });

    } else {
      return res.status(400).json({ error: 'Invalid action or missing parameters' });
    }

    importRecord.markModified('unmappedContent');
    importRecord.markModified('mappedSections');
    await saveWithRetry(importRecord);

    return res.json({
      success: true,
      message: toCurriculumMatrix || action === 'move_to_matrix'
        ? 'Content moved to curriculum matrix'
        : toSupportingEvidence
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

    // Only allow canceling if still processing, pending, or awaiting selection
    const cancellableStatuses = ['processing', 'pending', 'awaiting_selection'];
    if (!cancellableStatuses.includes(importRecord.status)) {
      debugLog('Import cannot be cancelled - not in cancellable state', {
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

    // Clean up temp files (images)
    try {
      await tempFileService.cleanupTempFiles(importId);
      debugLog('Temp files cleaned up', { importId });
    } catch (cleanupError) {
      console.warn('Failed to cleanup temp files:', cleanupError);
      // Continue with deletion even if temp cleanup fails
    }

    // Clean up GridFS content (HTML)
    try {
      await gridFsService.deleteHtmlContent(importId);
      debugLog('GridFS HTML content cleaned up', { importId });
    } catch (gridFsError) {
      console.warn('Failed to cleanup GridFS HTML:', gridFsError);
      // Continue with deletion even if GridFS cleanup fails
    }

    // Clean up GridFS images
    try {
      await gridFsService.deleteImportImages(importId);
      debugLog('GridFS images cleaned up', { importId });
    } catch (gridFsError) {
      console.warn('Failed to cleanup GridFS images:', gridFsError);
      // Continue with deletion even if GridFS cleanup fails
    }

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

/**
 * Get detected sections for user selection (Part 6)
 * Returns hierarchical sections detected from document structure
 */
export const getDetectedSections = async (req: Request, res: Response) => {
  try {
    const { importId } = req.params;
    console.log('[Import] getDetectedSections called for import:', importId);

    const importRecord = await SelfStudyImport.findById(importId)
      .select('detectedSections appendix status parsingProgress originalFilename');

    if (!importRecord) {
      console.log('[Import] getDetectedSections: Import not found');
      return res.status(404).json({ error: 'Import not found' });
    }

    console.log('[Import] getDetectedSections: Import found', {
      status: importRecord.status,
      detectedSectionsCount: importRecord.detectedSections?.length || 0,
      hasAppendix: !!importRecord.appendix
    });

    // If no detected sections yet, return current status
    if (!importRecord.detectedSections || importRecord.detectedSections.length === 0) {
      console.log('[Import] getDetectedSections: No detected sections yet');
      return res.json({
        status: importRecord.status,
        parsingProgress: importRecord.parsingProgress,
        sections: [],
        appendix: null,
        totalSections: 0
      });
    }

    const totalSections = countSectionsRecursive(importRecord.detectedSections);
    console.log('[Import] getDetectedSections: Returning sections', {
      topLevelSections: importRecord.detectedSections.length,
      totalSections
    });

    return res.json({
      status: importRecord.status,
      filename: importRecord.originalFilename,
      sections: importRecord.detectedSections,
      appendix: importRecord.appendix || null,
      totalSections
    });
  } catch (error) {
    console.error('[Import] getDetectedSections error:', error);
    return res.status(500).json({ error: 'Failed to get detected sections' });
  }
};

/**
 * Count sections recursively including children
 */
function countSectionsRecursive(sections: any[]): number {
  let count = 0;
  for (const section of sections) {
    count++;
    if (section.children && section.children.length > 0) {
      count += countSectionsRecursive(section.children);
    }
  }
  return count;
}

/**
 * Update section selections (Part 6)
 * User can select/deselect sections before sending to n8n
 */
export const updateSectionSelections = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { importId } = req.params;
    const { selections } = req.body; // Array of { id: string, isSelected: boolean }

    if (!selections || !Array.isArray(selections)) {
      return res.status(400).json({ error: 'Selections array is required' });
    }

    const importRecord = await SelfStudyImport.findById(importId);
    if (!importRecord) {
      return res.status(404).json({ error: 'Import not found' });
    }

    if (importRecord.status !== 'awaiting_selection') {
      return res.status(400).json({
        error: `Cannot update selections. Import status is ${importRecord.status}`
      });
    }

    // Update selections in detected sections
    const selectionMap = new Map(selections.map((s: any) => [s.id, s.isSelected]));

    const updateSectionsRecursive = (sections: any[]) => {
      for (const section of sections) {
        if (selectionMap.has(section.id)) {
          section.isSelected = selectionMap.get(section.id);
        }
        if (section.children && section.children.length > 0) {
          updateSectionsRecursive(section.children);
        }
      }
    };

    if (importRecord.detectedSections) {
      updateSectionsRecursive(importRecord.detectedSections);
      importRecord.markModified('detectedSections');
    }

    await importRecord.save();

    // Count selected sections
    const countSelected = (sections: any[]): number => {
      let count = 0;
      for (const section of sections) {
        if (section.isSelected && !section.isAppendix) count++;
        if (section.children) count += countSelected(section.children);
      }
      return count;
    };

    const selectedCount = countSelected(importRecord.detectedSections || []);

    debugLog('Section selections updated', {
      importId,
      totalSelections: selections.length,
      selectedSections: selectedCount
    });

    return res.json({
      success: true,
      selectedCount,
      message: `${selectedCount} sections selected for processing`
    });
  } catch (error) {
    console.error('Update section selections error:', error);
    return res.status(500).json({ error: 'Failed to update section selections' });
  }
};

/**
 * Confirm section selections and proceed to n8n processing (Part 6)
 */
export const confirmSectionSelections = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { importId } = req.params;

    const importRecord = await SelfStudyImport.findById(importId);
    if (!importRecord) {
      return res.status(404).json({ error: 'Import not found' });
    }

    if (importRecord.status !== 'awaiting_selection') {
      return res.status(400).json({
        error: `Cannot confirm selections. Import status is ${importRecord.status}`
      });
    }

    // Get selected sections (flat list)
    const getSelectedSections = (sections: any[]): any[] => {
      const selected: any[] = [];
      for (const section of sections) {
        if (section.isSelected && !section.isAppendix) {
          selected.push(section);
        }
        if (section.children && section.children.length > 0) {
          selected.push(...getSelectedSections(section.children));
        }
      }
      return selected;
    };

    const selectedSections = getSelectedSections(importRecord.detectedSections || []);

    if (selectedSections.length === 0) {
      return res.status(400).json({
        error: 'At least one section must be selected for processing'
      });
    }

    debugLog('Confirming section selections for n8n processing', {
      importId,
      selectedCount: selectedSections.length
    });

    // Update status to processing
    importRecord.status = 'processing';
    importRecord.parsingProgress = {
      step: 'preparing_ai',
      stepDescription: `Preparing ${selectedSections.length} selected sections for AI analysis...`,
      sectionsCreated: selectedSections.length,
      sectionTitles: selectedSections.slice(0, 10).map(s => s.headerText?.substring(0, 80) || 'Untitled')
    };
    await importRecord.save();

    // Convert DetectedSections to TOCBasedSections for n8n processing
    const tocSections: TOCBasedSection[] = selectedSections.map(section => ({
      id: section.id,
      tocEntry: {
        title: section.headerText,
        level: section.level,
        sectionType: section.isAppendix ? 'appendix' : 'standard',
        isMatrix: section.headerText?.toLowerCase().includes('matrix') || false,
        isSupportingEvidence: section.headerText?.toLowerCase().includes('evidence') || false
      },
      content: section.fullContent,
      htmlContent: section.htmlContent,
      startPosition: section.startPosition,
      endPosition: section.endPosition
    }));

    // Check if n8n Document Matcher webhook is configured
    const webhookSettings = await WebhookSettings.findOne({
      settingType: 'document_matcher',
      isActive: true
    });

    if (webhookSettings) {
      // Get callback URL from request
      const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      const host = req.get('host');
      const callbackUrl = `${protocol}://${host}/api/webhooks/document-matcher/callback`;

      debugLog('Sending selected sections to n8n Document Matcher', {
        webhookUrl: webhookSettings.webhookUrl,
        sectionCount: tocSections.length,
        specName: importRecord.specName
      });

      // Create a minimal ParsedDocument for the function
      const parsedDoc: ParsedDocument = {
        metadata: { pageCount: 0 },
        sections: [],
        tables: [],
        images: [],
        rawText: '',
        htmlContent: tocSections.map(s => s.htmlContent).join('\n')
      };

      // Use n8n Document Matcher for AI-powered mapping
      await sendToN8nDocumentMatcher(
        importRecord,
        parsedDoc,
        tocSections,
        callbackUrl,
        webhookSettings,
        importRecord.specName || 'CSHSE Standards'
      );

      return res.json({
        success: true,
        selectedCount: selectedSections.length,
        message: `Processing ${selectedSections.length} sections with AI`,
        status: 'processing'
      });
    }

    // Fallback: mark as completed without AI processing if no webhook configured
    debugLog('No n8n webhook configured, marking as completed without AI processing');
    importRecord.status = 'completed';
    importRecord.processingCompletedAt = new Date();
    await importRecord.save();

    return res.json({
      success: true,
      selectedCount: selectedSections.length,
      message: `${selectedSections.length} sections ready for manual mapping (no AI webhook configured)`,
      status: 'completed'
    });
  } catch (error) {
    console.error('Confirm section selections error:', error);
    return res.status(500).json({ error: 'Failed to confirm section selections' });
  }
};

/**
 * Get appendix content (Part 6)
 * Returns the extracted appendix HTML for viewing/copying
 */
export const getAppendix = async (req: Request, res: Response) => {
  try {
    const { importId } = req.params;

    const importRecord = await SelfStudyImport.findById(importId)
      .select('appendix');

    if (!importRecord) {
      return res.status(404).json({ error: 'Import not found' });
    }

    if (!importRecord.appendix) {
      return res.status(404).json({ error: 'No appendix found in this document' });
    }

    return res.json({
      appendix: importRecord.appendix
    });
  } catch (error) {
    console.error('Get appendix error:', error);
    return res.status(500).json({ error: 'Failed to get appendix' });
  }
};

/**
 * Get full section content by ID (Part 6)
 * For viewing complete section content in modal
 */
export const getFullSectionContent = async (req: Request, res: Response) => {
  try {
    const { importId, sectionId } = req.params;

    const importRecord = await SelfStudyImport.findById(importId)
      .select('detectedSections appendix');

    if (!importRecord) {
      return res.status(404).json({ error: 'Import not found' });
    }

    // Search for section in detected sections or appendix
    const findSection = (sections: any[], id: string): any | null => {
      for (const section of sections) {
        if (section.id === id) return section;
        if (section.children && section.children.length > 0) {
          const found = findSection(section.children, id);
          if (found) return found;
        }
      }
      return null;
    };

    let section = findSection(importRecord.detectedSections || [], sectionId);

    // Check appendix if not found in regular sections
    if (!section && importRecord.appendix && (importRecord as any).appendix.id === sectionId) {
      section = importRecord.appendix;
    }

    if (!section) {
      return res.status(404).json({ error: 'Section not found' });
    }

    return res.json({
      id: section.id,
      headerText: section.headerText,
      fullContent: section.fullContent,
      htmlContent: section.htmlContent,
      isAppendix: section.isAppendix || false
    });
  } catch (error) {
    console.error('Get full section content error:', error);
    return res.status(500).json({ error: 'Failed to get section content' });
  }
};

// ============================================
// MANUAL TAGGING WORKFLOW CONTROLLERS
// ============================================

/**
 * Get HTML document content for manual tagging
 * Content is stored in GridFS for large files
 */
export const getDocumentContent = async (req: Request, res: Response) => {
  try {
    const { importId } = req.params;
    debugLog('getDocumentContent called', { importId });

    // Content negotiation: when the caller asks for `text/html` we stream
    // the raw HTML straight from GridFS without buffering the whole 353 MB
    // Stevenson doc in memory first and without JSON-stringifying it.
    // Legacy callers (DocumentViewer + SectionTagger) don't send Accept:
    // text/html, so they get the existing JSON path untouched.
    const wantsHtml = req.accepts(['html', 'json']) === 'html';

    // Get import record to check if HTML is in GridFS
    const importRecord = await SelfStudyImport.findById(importId);
    if (!importRecord) {
      debugLog('Import not found', { importId });
      if (wantsHtml) return res.status(404).type('text/plain').send('Import not found');
      return res.status(404).json({ error: 'Import not found' });
    }

    // Check if HTML is stored in GridFS (new approach) or inline (legacy)
    const isGridFS = importRecord.extractedContent?.metadata?.htmlStoredInGridFS === true;

    // FAST PATH: stream raw HTML to the wire. The browser starts parsing
    // chunks as they arrive instead of waiting for the full ~353 MB JSON
    // string. Cuts perceived latency dramatically and eliminates the
    // server-side JSON.stringify cost (which doubles memory for the 353
    // MB string while escaping characters).
    if (wantsHtml) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'private, max-age=300');
      if (isGridFS) {
        try {
          const stream = await gridFsService.getHtmlContentStream(importId);
          stream.on('error', (err: any) => {
            console.error('[getDocumentContent] GridFS stream error:', err);
            if (!res.headersSent) res.status(500).end();
            else res.end();
          });
          stream.pipe(res);
          return;
        } catch (gridError: any) {
          debugLog('GridFS stream failed', { importId, error: gridError.message });
          return res.status(404).type('text/plain').send('Document content not found in storage. Please re-upload the document.');
        }
      }
      // Legacy non-GridFS — small enough to send in one go.
      return res.send(importRecord.extractedContent?.rawText || '');
    }

    // SLOW (LEGACY) PATH: buffer + JSON. Kept for SectionTagger / DocumentViewer
    // which expect `{ htmlContent, taggedSectionsCount }`.
    let htmlContent: string;
    if (isGridFS) {
      debugLog('Retrieving HTML from GridFS', { importId });
      try {
        htmlContent = await gridFsService.getHtmlContent(importId);
        debugLog('HTML retrieved from GridFS', { importId, contentLength: htmlContent.length });
      } catch (gridError: any) {
        debugLog('GridFS retrieval failed', { importId, error: gridError.message });
        return res.status(404).json({ error: 'Document content not found in storage. Please re-upload the document.' });
      }
    } else {
      htmlContent = importRecord.extractedContent?.rawText || '';
      debugLog('HTML retrieved from MongoDB (legacy)', { importId, contentLength: htmlContent.length });
    }

    if (!htmlContent) {
      return res.status(404).json({ error: 'Document content not found. Please re-upload the document.' });
    }

    const taggedSectionsCount = (importRecord.detectedSections || []).length;
    return res.json({ htmlContent, taggedSectionsCount });
  } catch (error: any) {
    console.error('Get document content error:', error);
    debugLog('getDocumentContent error', { error: error.message });
    return res.status(500).json({ error: error.message || 'Failed to get document content' });
  }
};

/**
 * Serve an image from GridFS (or temp folder for legacy)
 */
export const getDocumentImage = async (req: Request, res: Response) => {
  try {
    const { importId, filename } = req.params;

    // Security: Validate filename
    if (!filename || filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    // Try GridFS first (new approach), fall back to temp files (legacy)
    try {
      const { buffer, contentType } = await gridFsService.getImage(importId, filename);

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

      return res.send(buffer);
    } catch (gridFsError: any) {
      // Fall back to temp file if not in GridFS (legacy imports)
      debugLog('Image not in GridFS, trying temp file', { importId, filename });

      const imagePath = await tempFileService.getImagePath(importId, filename);

      // Determine content type from extension
      const ext = path.extname(filename).toLowerCase();
      const contentTypes: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml'
      };

      res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=3600');

      return res.sendFile(imagePath);
    }
  } catch (error: any) {
    console.error('Get document image error:', error);
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: 'Image not found' });
    }
    return res.status(500).json({ error: 'Failed to get image' });
  }
};

/**
 * Sync updated document HTML (with placeholders) to GridFS
 * Called after the frontend inserts placeholders for extracted content
 */
export const syncDocumentHtml = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { importId } = req.params;
    const { html } = req.body;

    if (!html || typeof html !== 'string') {
      return res.status(400).json({ error: 'html is required' });
    }

    // Verify import exists
    const importRecord = await SelfStudyImport.findById(importId);
    if (!importRecord) {
      return res.status(404).json({ error: 'Import not found' });
    }

    // Store the updated HTML to GridFS
    await gridFsService.storeHtmlContent(importId, html);

    console.log(`[Import] Synced document HTML with placeholders (${html.length.toLocaleString()} chars)`);

    return res.json({
      success: true,
      message: 'Document HTML synced successfully',
      htmlLength: html.length
    });
  } catch (error: any) {
    console.error('Sync document HTML error:', error);
    return res.status(500).json({ error: error.message || 'Failed to sync document HTML' });
  }
};

/**
 * Extract a section from the document and save to MongoDB
 */
export const extractSection = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { importId } = req.params;
    const { htmlContent: providedHtml, sectionType, standardCode, specCode, title, appliedDirectly, textStartOffset, textLength } = req.body;

    // Validate input
    if (!sectionType || !['standard', 'matrix', 'appendix', 'skip'].includes(sectionType)) {
      return res.status(400).json({ error: 'sectionType must be standard, matrix, appendix, or skip' });
    }
    if (!title && sectionType !== 'skip') {
      return res.status(400).json({ error: 'title is required for non-skip sections' });
    }
    if (!providedHtml || typeof providedHtml !== 'string') {
      return res.status(400).json({ error: 'htmlContent is required' });
    }
    if (!providedHtml.trim()) {
      return res.status(400).json({ error: 'htmlContent cannot be empty' });
    }

    // Verify import exists
    const importRecord = await SelfStudyImport.findById(importId);
    if (!importRecord) {
      return res.status(404).json({ error: 'Import not found' });
    }

    // Use the HTML content provided by the frontend (extracted via Range API)
    const extractedHtml = providedHtml;
    const extractedText = extractedHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

    // Create section object (skip sections are not saved)
    let sectionId: string | null = null;

    if (sectionType !== 'skip') {
      sectionId = uuidv4();
      const newSection: IDetectedSection = {
        id: sectionId,
        level: 1,
        headerType: sectionType === 'standard' ? 'standard' :
                    sectionType === 'matrix' ? 'heading' : 'appendix',
        headerText: title,
        previewText: extractedText.substring(0, 200) + (extractedText.length > 200 ? '...' : ''),
        fullContent: extractedText,
        htmlContent: extractedHtml,
        startPosition: 0,
        endPosition: extractedHtml.length,
        isAppendix: sectionType === 'appendix',
        isSelected: true,
        children: [],
        standardCode: sectionType === 'standard' ? standardCode : undefined,
        specCode: sectionType === 'standard' ? specCode : undefined,
        appliedDirectly: sectionType === 'standard' && appliedDirectly ? true : false,
        isMatrix: sectionType === 'matrix',
        textStartOffset: typeof textStartOffset === 'number' && textStartOffset >= 0 ? textStartOffset : undefined,
        textLength: typeof textLength === 'number' && textLength > 0 ? textLength : undefined
      };

      // Initialize detectedSections array if needed
      if (!importRecord.detectedSections) {
        importRecord.detectedSections = [];
      }

      // Add the new section
      importRecord.detectedSections.push(newSection);
      importRecord.markModified('detectedSections');
    }

    // Save import record
    await importRecord.save();

    console.log(`[Import] Section saved: ${sectionType} - "${title}" (${extractedText.length} chars)`);

    // NOTE: We intentionally DO NOT update the GridFS HTML to remove extracted content.
    // Reasons:
    // 1. For large documents (300MB+), this operation consumes too much memory and crashes the server
    // 2. The client already shows placeholders in the DOM via DocumentViewer
    // 3. Tagged sections are tracked in MongoDB and shown in the Tagged Sections list
    // 4. When user reloads, content is visible but clearly tracked as "extracted" in the list
    // This is a deliberate trade-off: slight visual inconsistency on reload vs server stability

    return res.json({
      success: true,
      sectionId,
      sectionType,
      title,
      contentLength: extractedText.length
    });
  } catch (error: any) {
    console.error('Extract section error:', error);
    return res.status(500).json({ error: error.message || 'Failed to extract section' });
  }
};

/**
 * Insert an HTML comment marker into the GridFS document at the extracted section's position.
 * This replaces the extracted text with a comment marker so on resume the document
 * already has markers embedded — no client-side text offset traversal needed.
 */
export const insertPlaceholderMarker = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { importId } = req.params;
    const { sectionId, title, sectionType, contentLength, textStartOffset, textLength } = req.body;

    console.log(`[Import] insert-marker request: sectionId=${sectionId}, title="${title}", type=${sectionType}, offset=${textStartOffset}, length=${textLength}`);

    if (!sectionId || typeof textStartOffset !== 'number' || typeof textLength !== 'number') {
      console.log(`[Import] insert-marker REJECTED: missing required fields`);
      return res.status(400).json({ error: 'sectionId, textStartOffset, and textLength are required' });
    }

    // Build the HTML comment marker
    // Encode title to avoid breaking the comment syntax
    const safeTitle = (title || 'Untitled').replace(/-->/g, '—>').replace(/--/g, '—');
    const marker = `<!-- EXTRACTED:${sectionId}:${sectionType || 'standard'}:${safeTitle}:${contentLength || 0} -->`;

    console.log(`[Import] Calling insertHtmlMarker for "${title}" — marker: ${marker}`);
    const startTime = Date.now();
    const result = await gridFsService.insertHtmlMarker(importId, marker, textStartOffset, textLength);
    const elapsed = Date.now() - startTime;

    if (!result.success) {
      console.log(`[Import] insert-marker FAILED: could not find text at offset ${textStartOffset} (took ${elapsed}ms)`);
      return res.status(422).json({ error: 'Could not find text at specified offset in document' });
    }

    // Store the exact removed HTML and context on the section record for accurate repair.
    // removedHtml may differ from htmlContent (client's selection) due to table boundary expansion.
    if (result.removedHtml && sectionId) {
      const importRecord = await SelfStudyImport.findById(importId);
      if (importRecord?.detectedSections) {
        const section = importRecord.detectedSections.find((s: any) => s.id === sectionId);
        if (section) {
          (section as any).removedHtml = result.removedHtml;
          (section as any).htmlContextBefore = result.htmlContextBefore || '';
          (section as any).htmlContextAfter = result.htmlContextAfter || '';
          (section as any).wasTableExpanded = result.wasTableExpanded || false;
          importRecord.markModified('detectedSections');
          await importRecord.save();
          console.log(`[Import] Stored removedHtml (${result.removedHtml.length} chars), ` +
            `contextBefore=${result.htmlContextBefore?.length || 0}, contextAfter=${result.htmlContextAfter?.length || 0}, ` +
            `tableExpanded=${result.wasTableExpanded} on section ${sectionId}`);
        }
      }
    }

    console.log(`[Import] insert-marker SUCCESS for "${title}" at offset ${textStartOffset} (${result.removedHtml?.length || 0} chars removed, took ${elapsed}ms)`);

    return res.json({ success: true, marker });
  } catch (error: any) {
    console.error('Insert placeholder marker error:', error);
    return res.status(500).json({ error: error.message || 'Failed to insert marker' });
  }
};

/**
 * Get list of manually tagged sections
 */
export const getTaggedSections = async (req: Request, res: Response) => {
  try {
    const { importId } = req.params;

    const importRecord = await SelfStudyImport.findById(importId)
      .select('detectedSections status originalFilename');

    if (!importRecord) {
      return res.status(404).json({ error: 'Import not found' });
    }

    const sections = (importRecord.detectedSections || []).map((s: any) => {
      // Get the full content for calculating end preview
      const fullText = s.fullContent || '';
      // End preview is last 100 chars (helps frontend find where extraction ends)
      const endPreviewText = fullText.length > 100
        ? fullText.substring(fullText.length - 100)
        : fullText;

      return {
        id: s.id,
        title: s.headerText, // Map headerText to title for frontend
        sectionType: s.isMatrix ? 'matrix' :
                     s.isAppendix ? 'appendix' :
                     s.standardCode ? 'standard' : 'standard',
        previewText: s.previewText,
        endPreviewText, // Last 100 chars to help find where extraction ends in document
        contentLength: s.fullContent?.length || 0,
        standardCode: s.standardCode,
        specCode: s.specCode,
        appliedDirectly: s.appliedDirectly || false, // Whether already applied to submission
        // Text position offsets for reliable placeholder re-insertion on resume
        textStartOffset: s.textStartOffset ?? null,
        textLength: s.textLength ?? null
      };
    });

    return res.json({
      sections,
      totalSections: sections.length,
      status: importRecord.status,
      filename: importRecord.originalFilename
    });
  } catch (error) {
    console.error('Get tagged sections error:', error);
    return res.status(500).json({ error: 'Failed to get tagged sections' });
  }
};

/**
 * Get full content of a single tagged section
 */
export const getTaggedSectionContent = async (req: Request, res: Response) => {
  try {
    const { importId, sectionId } = req.params;

    const importRecord = await SelfStudyImport.findById(importId)
      .select('detectedSections');

    if (!importRecord) {
      return res.status(404).json({ error: 'Import not found' });
    }

    if (!importRecord.detectedSections || importRecord.detectedSections.length === 0) {
      return res.status(404).json({ error: 'No sections found' });
    }

    const section = importRecord.detectedSections.find((s: any) => s.id === sectionId);

    if (!section) {
      return res.status(404).json({ error: 'Section not found' });
    }

    return res.json({
      id: section.id,
      title: section.headerText,
      sectionType: section.isMatrix ? 'matrix' :
                   section.isAppendix ? 'appendix' :
                   section.standardCode ? 'standard' : 'standard',
      // Return HTML content to preserve formatting (tables, lists, etc.)
      htmlContent: section.htmlContent || null,
      fullContent: section.fullContent || section.previewText || 'No content available',
      contentLength: section.fullContent?.length || 0,
      standardCode: section.standardCode,
      specCode: section.specCode
    });
  } catch (error) {
    console.error('Get tagged section content error:', error);
    return res.status(500).json({ error: 'Failed to get section content' });
  }
};

/**
 * Update a tagged section (e.g., mark as applied)
 */
export const updateTaggedSection = async (req: Request, res: Response) => {
  try {
    const { importId, sectionId } = req.params;
    const { appliedDirectly } = req.body;

    const importRecord = await SelfStudyImport.findById(importId);
    if (!importRecord) {
      return res.status(404).json({ error: 'Import not found' });
    }

    const section = (importRecord.detectedSections || []).find((s: any) => s.id === sectionId);
    if (!section) {
      return res.status(404).json({ error: 'Section not found' });
    }

    if (appliedDirectly !== undefined) {
      (section as any).appliedDirectly = appliedDirectly;
    }

    importRecord.markModified('detectedSections');
    await importRecord.save();

    return res.json({ success: true });
  } catch (error) {
    console.error('Update tagged section error:', error);
    return res.status(500).json({ error: 'Failed to update tagged section' });
  }
};

/**
 * Delete a tagged section
 */
export const deleteTaggedSection = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { importId, sectionId } = req.params;

    const importRecord = await SelfStudyImport.findById(importId);
    if (!importRecord) {
      return res.status(404).json({ error: 'Import not found' });
    }

    if (!importRecord.detectedSections) {
      return res.status(404).json({ error: 'No sections found' });
    }

    const sectionIndex = importRecord.detectedSections.findIndex(
      (s: any) => s.id === sectionId
    );

    if (sectionIndex === -1) {
      return res.status(404).json({ error: 'Section not found' });
    }

    const section = importRecord.detectedSections[sectionIndex] as any;

    // Restore: replace the HTML comment marker in GridFS with the original content.
    // Use removedHtml (exact HTML removed by insertHtmlMarker) when available,
    // falling back to htmlContent (client's selection) for backward compatibility.
    const restoreContent = section.removedHtml || section.htmlContent;
    let restored = false;
    if (restoreContent) {
      try {
        restored = await gridFsService.restoreMarker(importId, sectionId, restoreContent);
        if (restored) {
          const source = section.removedHtml ? 'removedHtml' : 'htmlContent';
          console.log(`[Import] Restored content for section "${section.headerText}" (${restoreContent.length} chars via ${source})`);
        } else {
          // No marker found — section was tagged before marker system, or marker was already restored.
          // Safe to proceed with deletion (original content is still in the document).
          console.log(`[Import] No marker found in document for section "${section.headerText}" — content not restored`);
        }
      } catch (err: any) {
        // restoreMarker failed (e.g., OOM on large doc). Do NOT delete the section —
        // we'd lose the htmlContent needed for future restore attempts.
        // The marker stays in GridFS; the client will show a warning placeholder.
        console.error(`[Import] Failed to restore marker for section ${sectionId}:`, err.message);
        return res.status(500).json({
          error: 'Content restoration failed — section not deleted to preserve original content. Try again or contact support.',
          contentRestored: false
        });
      }
    }

    // Remove the section
    const removedSection = importRecord.detectedSections.splice(sectionIndex, 1)[0];
    importRecord.markModified('detectedSections');
    await importRecord.save();

    console.log(`[Import] Section deleted: ${removedSection.headerText}`);

    return res.json({
      success: true,
      deletedSectionId: sectionId,
      remainingSections: importRecord.detectedSections.length,
      contentRestored: restored
    });
  } catch (error) {
    console.error('Delete tagged section error:', error);
    return res.status(500).json({ error: 'Failed to delete section' });
  }
};

/**
 * Debug endpoint: return section metadata from MongoDB for diagnostic inspection.
 * Lightweight read — no GridFS load, no HTML processing.
 * Usage: curl -H "Authorization: Bearer $TOKEN" /api/imports/:importId/debug
 */
export const debugImport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { importId } = req.params;

    const importRecord = await SelfStudyImport.findById(importId);
    if (!importRecord) {
      return res.status(404).json({ error: 'Import not found' });
    }

    const sections = (importRecord.detectedSections || []).map((section: any) => ({
      sectionId: section.id,
      headerText: section.headerText,
      sectionType: section.isMatrix ? 'matrix' : (section.isAppendix ? 'appendix' : 'standard'),
      standardCode: section.standardCode || null,
      specCode: section.specCode || null,
      textStartOffset: section.textStartOffset ?? null,
      textLength: section.textLength ?? null,
      hasRemovedHtml: !!(section.removedHtml && section.removedHtml.length > 0),
      removedHtmlLength: section.removedHtml?.length || 0,
      removedHtmlPreview: section.removedHtml ? section.removedHtml.substring(0, 200) : null,
      htmlContentLength: section.htmlContent?.length || 0,
      htmlContentPreview: section.htmlContent ? section.htmlContent.substring(0, 200) : null,
      fullContentLength: section.fullContent?.length || 0,
      hasContextBefore: !!(section.htmlContextBefore && section.htmlContextBefore.length > 0),
      hasContextAfter: !!(section.htmlContextAfter && section.htmlContextAfter.length > 0),
      wasTableExpanded: section.wasTableExpanded ?? null
    }));

    return res.json({
      importId,
      status: importRecord.status,
      sectionCount: sections.length,
      sections
    });
  } catch (error: any) {
    console.error('Debug import error:', error);
    return res.status(500).json({ error: error.message || 'Failed to get debug info' });
  }
};

/**
 * Repair document: re-upload the original document file to replace corrupted GridFS HTML.
 * Keeps existing tagged sections intact in MongoDB. Re-inserts markers for each tagged section.
 */
export const repairDocument = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { importId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const importRecord = await SelfStudyImport.findById(importId);
    if (!importRecord) {
      return res.status(404).json({ error: 'Import not found' });
    }

    console.log(`[Import] Repair document: re-processing ${file.originalname} for import ${importId}`);

    // Convert document to HTML (same as initial upload)
    const extension = file.originalname.toLowerCase().split('.').pop();
    let result: { htmlContent: string; rawText: string; imageCount: number };

    if (extension === 'docx') {
      result = await documentParserService.parseDOCXForManualTagging(file.buffer, importId.toString());
    } else if (extension === 'pdf') {
      result = await documentParserService.parsePDFForManualTagging(file.buffer, importId.toString());
    } else {
      return res.status(400).json({ error: `Unsupported file type: ${extension}` });
    }

    console.log(`[Import] Repair: converted to HTML (${result.htmlContent.length} chars)`);

    // Free the upload buffer — no longer needed after conversion
    (file as any).buffer = null;

    // Re-insert markers using tiered matching strategy:
    // Tier 1: Direct removedHtml match (exact byte match, most reliable)
    // Tier 2: Text-offset matching with table-splitting (for sections without removedHtml)
    // Tier 3: Sequential full-table expansion (last resort)
    const sections = importRecord.detectedSections || [];
    let markersInserted = 0;
    let markersFailed = 0;
    let tier1Count = 0;
    let tier2Count = 0;
    let tier3Count = 0;

    interface Replacement {
      section: any;
      marker: string;
      expandedStart: number;
      expandedEnd: number;
      removedHtml: string;
      sectionHtml: string; // Section-specific HTML (not full table) for future T1
      splitBefore: string;
      splitAfter: string;
      tier: number;
    }

    const replacements: Replacement[] = [];
    const tier3Queue: Array<{ section: any; marker: string }> = [];

    for (const section of sections) {
      const s = section as any;
      const safeTitle = (s.headerText || 'Untitled').replace(/-->/g, '—>').replace(/--/g, '—');
      const sectionType = s.isMatrix ? 'matrix' : (s.isAppendix ? 'appendix' : 'standard');
      const marker = `<!-- EXTRACTED:${s.id}:${sectionType}:${safeTitle}:${s.fullContent?.length || 0} -->`;

      // Tier 1: Direct removedHtml match (non-table content only)
      // Skip T1 for table-based removedHtml: previous repairs stored the FULL table as removedHtml.
      // Replacing the full table with just a marker destroys other sections in the same table.
      // T2 with table-splitting handles table sections correctly.
      if (s.removedHtml && typeof s.removedHtml === 'string' && s.removedHtml.length > 0) {
        const isTableRemoval = s.removedHtml.trimStart().toLowerCase().startsWith('<table');
        if (isTableRemoval) {
          console.log(`[Import] Repair T1: skipping "${s.headerText}" — removedHtml is full table (${s.removedHtml.length} chars), using T2`);
        } else {
          const directIdx = result.htmlContent.indexOf(s.removedHtml);
          if (directIdx !== -1) {
            replacements.push({
              section: s, marker,
              expandedStart: directIdx,
              expandedEnd: directIdx + s.removedHtml.length,
              removedHtml: s.removedHtml,
              sectionHtml: s.removedHtml, // Non-table T1: removedHtml IS the section content
              splitBefore: '', splitAfter: '',
              tier: 1
            });
            console.log(`[Import] Repair T1: direct match "${s.headerText}" at ${directIdx}-${directIdx + s.removedHtml.length}`);
            continue;
          }
          console.log(`[Import] Repair T1: removedHtml not found for "${s.headerText}", trying T2`);
        }
      }

      // Tier 2: Text-offset matching with table-splitting
      const match = gridFsService.findSectionTextOffset(
        result.htmlContent, s.htmlContent, s.fullContent
      );

      if (match) {
        const range = gridFsService.findHtmlRange(
          result.htmlContent, match.textOffset, match.textLength, { skipTableExpansion: true }
        );
        if (range) {
          replacements.push({
            section: s, marker, tier: 2,
            expandedStart: range.expandedStart,
            expandedEnd: range.expandedEnd,
            removedHtml: flattenString(range.removedHtml),
            sectionHtml: flattenString(result.htmlContent.substring(range.sectionStart, range.sectionEnd)),
            splitBefore: range.splitBefore ? flattenString(range.splitBefore) : '',
            splitAfter: range.splitAfter ? flattenString(range.splitAfter) : ''
          });
          const removedSnippet = range.removedHtml.substring(0, 120).replace(/\n/g, '\\n');
          console.log(`[Import] Repair T2: "${s.headerText}" range ${range.expandedStart}-${range.expandedEnd} (${range.expandedEnd - range.expandedStart} chars)` +
            (range.splitBefore ? ` splitBefore=${range.splitBefore.length}ch` : '') +
            (range.splitAfter ? ` splitAfter=${range.splitAfter.length}ch` : '') +
            ` removed: "${removedSnippet}..."`);
          continue;
        }
      }

      // Queue for Tier 3
      tier3Queue.push({ section: s, marker });
      console.log(`[Import] Repair: "${s.headerText}" queued for T3 sequential`);
    }

    // Sort replacements by expandedStart for single-pass build
    replacements.sort((a, b) => a.expandedStart - b.expandedStart);

    // Remove overlapping replacements
    const validReplacements: Replacement[] = [];
    let prevEnd = 0;
    for (const r of replacements) {
      if (r.expandedStart >= prevEnd) {
        validReplacements.push(r);
        prevEnd = r.expandedEnd;
      } else {
        // Overlapping — queue for T3 sequential instead of dropping
        tier3Queue.push({ section: r.section, marker: r.marker });
        console.warn(`[Import] Repair: overlap for "${r.section.headerText}" ` +
          `(${r.expandedStart}-${r.expandedEnd} vs prevEnd ${prevEnd}), moving to T3`);
      }
    }

    // Build the final HTML using array-join (single allocation)
    let html: string | null = result.htmlContent;
    (result as any).htmlContent = ''; // Free reference
    (result as any).rawText = ''; // Free rawText reference too

    const parts: string[] = [];
    let lastEnd = 0;

    for (const r of validReplacements) {
      parts.push(html!.substring(lastEnd, r.expandedStart));

      if (r.splitBefore || r.splitAfter) {
        // Table-split: [beforeTable] + marker + [afterTable]
        if (r.splitBefore) parts.push(r.splitBefore + '\n');
        parts.push(r.marker);
        if (r.splitAfter) parts.push('\n' + r.splitAfter);
        tier2Count++;
      } else {
        // Direct replacement (Tier 1 or non-table Tier 2)
        parts.push(r.marker);
        if (r.tier === 1) tier1Count++;
        else tier2Count++;
      }

      lastEnd = r.expandedEnd;
      // Store section-specific HTML (not full table) so future T1 matches
      // don't replace content belonging to other sections in the same table.
      r.section.removedHtml = r.sectionHtml;
      markersInserted++;
    }
    parts.push(html!.substring(lastEnd));

    // Join parts and immediately flatten to break all SlicedString references
    // to the original 370MB html string. Without this, the joined string retains
    // internal references that prevent GC of the original.
    let finalHtml = Buffer.from(parts.join(''), 'utf-8').toString('utf-8');

    // Free original HTML and parts array before T3 to reduce peak memory
    html = null;
    parts.length = 0;
    replacements.length = 0;
    validReplacements.length = 0;

    // Tier 3: Sequential table-splitting on already-modified HTML
    // Uses table-splitting (not full table expansion) so multiple sections
    // in the same table each take only their rows, leaving the rest for the next section.
    for (const { section: s, marker } of tier3Queue) {
      const match = gridFsService.findSectionTextOffset(finalHtml, s.htmlContent, s.fullContent);
      if (!match) {
        markersFailed++;
        console.warn(`[Import] Repair T3: could not find "${s.headerText}" in modified HTML`);
        continue;
      }

      const range = gridFsService.findHtmlRange(finalHtml, match.textOffset, match.textLength, { skipTableExpansion: true });
      if (!range) {
        markersFailed++;
        console.warn(`[Import] Repair T3: could not map HTML range for "${s.headerText}"`);
        continue;
      }

      // Store section-specific HTML before modifying finalHtml (positions become invalid after)
      // flattenString breaks SlicedString references — without this, each substring retains
      // a reference to the full 370MB finalHtml, preventing GC of old copies.
      const sectionSpecificHtml = flattenString(finalHtml.substring(range.sectionStart, range.sectionEnd));

      // Build replacement with table-split fragments (same as Tier 2)
      let replacement = '';
      if (range.splitBefore) replacement += range.splitBefore + '\n';
      replacement += marker;
      if (range.splitAfter) replacement += '\n' + range.splitAfter;

      finalHtml = finalHtml.substring(0, range.expandedStart) + replacement + finalHtml.substring(range.expandedEnd);
      // Break V8 ConsString reference chain: the concatenation above creates a ConsString
      // whose SlicedString children keep the OLD 370MB finalHtml alive. Without flattening,
      // each T3 iteration accumulates another 370MB copy that can't be GC'd.
      finalHtml = Buffer.from(finalHtml, 'utf-8').toString('utf-8');
      s.removedHtml = sectionSpecificHtml || flattenString(range.removedHtml);
      markersInserted++;
      tier3Count++;
      const t3Snippet = flattenString(range.removedHtml.substring(0, 120)).replace(/\n/g, '\\n');
      console.log(`[Import] Repair T3: "${s.headerText}" at ${range.expandedStart}-${range.expandedEnd} (${range.expandedEnd - range.expandedStart} chars)` +
        (range.splitBefore ? ` splitBefore=${range.splitBefore.length}ch` : '') +
        (range.splitAfter ? ` splitAfter=${range.splitAfter.length}ch` : '') +
        ` removed: "${t3Snippet}..."`);
    }

    // Diagnostic: verify table balance (use indexOf loop instead of regex for large docs)
    let tableOpenCount = 0;
    let tableCloseCount = 0;
    let searchPos = 0;
    while ((searchPos = finalHtml.indexOf('<table', searchPos)) !== -1) {
      const nextChar = finalHtml[searchPos + 6];
      if (nextChar === ' ' || nextChar === '>' || nextChar === '\t' || nextChar === '\n') {
        tableOpenCount++;
      }
      searchPos += 6;
    }
    searchPos = 0;
    while ((searchPos = finalHtml.indexOf('</table>', searchPos)) !== -1) {
      tableCloseCount++;
      searchPos += 8;
    }
    if (tableOpenCount !== tableCloseCount) {
      console.warn(`[Import] Repair WARNING: unbalanced tables! <table>=${tableOpenCount} </table>=${tableCloseCount}`);
    }

    const memUsage = process.memoryUsage();
    console.log(`[Import] Repair: memory before GridFS store — RSS=${Math.round(memUsage.rss / 1024 / 1024)}MB, heap=${Math.round(memUsage.heapUsed / 1024 / 1024)}MB/${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`);

    // Write to temp file first, then free the string, then stream to GridFS.
    // This avoids holding ~370MB in memory during the GridFS upload.
    const htmlSize = finalHtml.length;
    const tempPaths = tempFileService.getTempPaths(importId.toString());
    const repairedHtmlPath = tempPaths.htmlPath; // /tmp/imports/{id}/content.html
    await fs.mkdir(path.dirname(repairedHtmlPath), { recursive: true });
    await fs.writeFile(repairedHtmlPath, finalHtml, 'utf-8');
    console.log(`[Import] Repair: wrote ${htmlSize} chars to temp file`);

    // Free the in-memory string BEFORE streaming to GridFS
    finalHtml = '';

    const memAfterFree = process.memoryUsage();
    console.log(`[Import] Repair: memory after free — RSS=${Math.round(memAfterFree.rss / 1024 / 1024)}MB, heap=${Math.round(memAfterFree.heapUsed / 1024 / 1024)}MB/${Math.round(memAfterFree.heapTotal / 1024 / 1024)}MB`);

    // Stream from temp file to GridFS (no large string in memory)
    await gridFsService.storeHtmlContentFromFile(importId.toString(), repairedHtmlPath);
    console.log(`[Import] Repair: stored final HTML (${htmlSize} chars) to GridFS via file stream`);

    // Save updated section records (with removedHtml persisted via schema fix)
    if (markersInserted > 0) {
      importRecord.markModified('detectedSections');
      await importRecord.save();
    }

    console.log(`[Import] Repair complete: ${markersInserted}/${sections.length} markers inserted ` +
      `(T1=${tier1Count}, T2=${tier2Count}, T3=${tier3Count}, failed=${markersFailed})`);

    return res.json({
      success: true,
      htmlSize,
      markersInserted,
      markersFailed,
      totalSections: sections.length,
      tiers: { direct: tier1Count, tableSplit: tier2Count, sequential: tier3Count },
      tableBalance: { open: tableOpenCount, close: tableCloseCount }
    });
  } catch (error: any) {
    console.error('Repair document error:', error);
    return res.status(500).json({ error: error.message || 'Failed to repair document' });
  }
};

/**
 * Finish manual tagging and proceed to processing
 */
export const finishTagging = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { importId } = req.params;
    const { processWithAI } = req.body;

    const importRecord = await SelfStudyImport.findById(importId);
    if (!importRecord) {
      return res.status(404).json({ error: 'Import not found' });
    }

    const sections = importRecord.detectedSections || [];
    if (sections.length === 0) {
      return res.status(400).json({ error: 'No sections have been tagged. Please tag at least one section.' });
    }

    console.log(`[Import] Finishing tagging for ${importId}: ${sections.length} sections`);

    // Clean up the remaining document content from GridFS
    // Only tagged sections are kept - unmarked content is discarded
    try {
      await gridFsService.deleteHtmlContent(importId);
      debugLog('Deleted remaining document HTML from GridFS (unmarked content discarded)', { importId });
    } catch (cleanupError) {
      console.warn('Failed to cleanup GridFS HTML:', cleanupError);
      // Continue even if cleanup fails
    }

    // Clean up temp images (they're now referenced in the tagged sections' HTML)
    try {
      await tempFileService.cleanupTempFiles(importId);
      debugLog('Cleaned up temp files', { importId });
    } catch (cleanupError) {
      console.warn('Failed to cleanup temp files:', cleanupError);
    }

    // Clear the metadata flag since HTML is no longer in GridFS
    if (importRecord.extractedContent?.metadata) {
      importRecord.extractedContent.metadata.htmlStoredInGridFS = false;
      importRecord.markModified('extractedContent');
    }

    if (processWithAI) {
      // Update status and send to n8n for AI processing
      importRecord.status = 'processing';
      importRecord.parsingProgress = {
        step: 'sending_to_ai',
        stepDescription: `Sending ${sections.length} tagged sections to AI for mapping...`,
        sectionsCreated: sections.length
      };
      importRecord.markModified('parsingProgress');
      await importRecord.save();

      // TODO: Send sections to n8n for processing
      // For now, mark as completed
      importRecord.status = 'completed';
      await importRecord.save();
    } else {
      // Skip AI processing, mark as completed
      importRecord.status = 'completed';
      await importRecord.save();
    }

    return res.json({
      success: true,
      status: importRecord.status,
      sectionsCount: sections.length,
      message: processWithAI
        ? 'Sections sent to AI for processing'
        : 'Tagging completed - unmarked content discarded'
    });
  } catch (error) {
    console.error('Finish tagging error:', error);
    return res.status(500).json({ error: 'Failed to finish tagging' });
  }
};
