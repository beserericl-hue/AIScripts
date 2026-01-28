import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { SelfStudyImport, ISelfStudyImport } from '../models/SelfStudyImport';
import { Submission } from '../models/Submission';
import { Institution } from '../models/Institution';
import { WebhookSettings } from '../models/WebhookSettings';
import { documentParserService } from '../services/documentParser';
import { sectionMapperService } from '../services/sectionMapper';

// Always log for visibility in production
function debugLog(message: string, data?: any) {
  console.log(`[Import] ${message}`, data ? JSON.stringify(data) : '');
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
    // Update status to processing
    importRecord.status = 'processing';
    importRecord.processingStartedAt = new Date();
    importRecord.specName = specName;
    await importRecord.save();
    debugLog('Import record status updated to processing');

    // Parse the document
    const parsed = await documentParserService.parse(buffer, filename);

    // Store extracted content
    importRecord.extractedContent = {
      rawText: parsed.rawText,
      pageCount: parsed.metadata.pageCount,
      metadata: {
        title: parsed.metadata.title,
        author: parsed.metadata.author,
        createdDate: parsed.metadata.createdDate
      },
      sections: parsed.sections.map(section => ({
        id: section.id,
        pageNumber: section.pageNumber,
        startPosition: 0,
        endPosition: section.content.length,
        sectionType: detectSectionType(section.content, parsed.tables),
        content: section.content,
        confidence: section.suggestedStandard?.confidence || 0,
        suggestedStandard: section.suggestedStandard?.code
      }))
    };

    // Add tables as sections
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
      // Use n8n Document Matcher for AI-powered mapping
      debugLog('n8n Document Matcher webhook found, sending to n8n', {
        webhookUrl: webhookSettings.webhookUrl,
        specName
      });
      await sendToN8nDocumentMatcher(importRecord, parsed, callbackUrl, webhookSettings, specName);
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
 * Send document to n8n Document Matcher for AI-powered mapping
 *
 * Request payload format:
 * {
 *   "callbackUrl": "https://your-app.com/api/webhooks/document-matcher/callback",
 *   "specName": "CSHSE Standards 2024",
 *   "documentId": "doc-12345",
 *   "htmlContent": "<h1>Program Overview</h1>...",
 *   "options": {
 *     "batchSize": 10,
 *     "confidenceThreshold": 50
 *   }
 * }
 */
async function sendToN8nDocumentMatcher(
  importRecord: ISelfStudyImport,
  parsed: any,
  callbackUrl: string,
  webhookSettings: any,
  specName: string
) {
  debugLog('Preparing n8n Document Matcher request', {
    importId: importRecord._id.toString(),
    specName,
    callbackUrl
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

  // Prepare payload for n8n using the required format
  const payload = {
    callbackUrl,
    specName,
    documentId: importRecord._id.toString(),
    htmlContent: parsed.rawText, // The parsed document content as HTML
    options: {
      batchSize: 10,
      confidenceThreshold: 50
    }
  };

  debugLog('Sending request to n8n webhook', {
    webhookUrl: webhookSettings.webhookUrl,
    payloadSize: JSON.stringify(payload).length,
    htmlContentLength: parsed.rawText?.length || 0
  });

  // Send to n8n
  const response = await fetch(webhookSettings.webhookUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(webhookSettings.timeoutMs || 30000)
  });

  debugLog('n8n response received', {
    status: response.status,
    statusText: response.statusText
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[ImportController] n8n webhook error:', {
      status: response.status,
      error: errorText
    });
    throw new Error(`n8n returned ${response.status}: ${errorText}`);
  }

  // Parse response to get execution ID or job ID if provided
  try {
    const responseData = await response.json() as { executionId?: string; jobId?: string };
    debugLog('n8n response data', responseData);

    if (responseData.executionId) {
      importRecord.n8nExecutionId = responseData.executionId;
    }
    if (responseData.jobId) {
      importRecord.n8nJobId = responseData.jobId;
    }
    await importRecord.save();
    debugLog('Import record updated with n8n IDs', {
      executionId: importRecord.n8nExecutionId,
      jobId: importRecord.n8nJobId
    });
  } catch {
    // Response may not be JSON, which is fine
    debugLog('n8n response was not JSON (this is okay)');
  }
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
 * Get import status and content
 */
export const getImport = async (req: Request, res: Response) => {
  try {
    const { importId } = req.params;

    const importRecord = await SelfStudyImport.findById(importId);
    if (!importRecord) {
      return res.status(404).json({ error: 'Import not found' });
    }

    return res.json({
      id: importRecord._id,
      status: importRecord.status,
      originalFilename: importRecord.originalFilename,
      fileType: importRecord.fileType,
      uploadedAt: importRecord.uploadedAt,
      processingStartedAt: importRecord.processingStartedAt,
      processingCompletedAt: importRecord.processingCompletedAt,
      error: importRecord.error,
      extractedContent: importRecord.status === 'completed' ? {
        pageCount: importRecord.extractedContent.pageCount,
        metadata: importRecord.extractedContent.metadata,
        sectionCount: importRecord.extractedContent.sections.length
      } : null,
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
        status: mapping ? 'mapped' : (unmapped ? 'unmapped' : 'pending')
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
 */
export const applyMappings = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { importId } = req.params;

    const importRecord = await SelfStudyImport.findById(importId);
    if (!importRecord) {
      return res.status(404).json({ error: 'Import not found' });
    }

    const submission = await Submission.findById(importRecord.submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Apply each mapping
    const narratives = submission.narratives as Map<string, Map<string, any>>;
    let appliedCount = 0;

    for (const mapping of importRecord.mappedSections) {
      const section = importRecord.extractedContent.sections.find(
        s => s.id === mapping.extractedSectionId
      );

      if (!section) continue;

      // Get or create standard map
      if (!narratives.has(mapping.standardCode)) {
        narratives.set(mapping.standardCode, new Map());
      }

      const standardNarratives = narratives.get(mapping.standardCode)!;

      // Get or create spec
      const existingNarrative = standardNarratives.get(mapping.specCode);

      if (mapping.fieldType === 'narrative') {
        // Append or set narrative content
        const newContent = existingNarrative?.content
          ? `${existingNarrative.content}\n\n${section.content}`
          : section.content;

        standardNarratives.set(mapping.specCode, {
          content: newContent,
          lastModified: new Date(),
          isComplete: false,
          linkedDocuments: existingNarrative?.linkedDocuments || []
        });

        appliedCount++;
      }
    }

    // Add import reference to submission
    if (!submission.imports) {
      submission.imports = [];
    }
    submission.imports.push(importRecord._id as mongoose.Types.ObjectId);

    await submission.save();

    return res.json({
      success: true,
      appliedCount,
      message: `Applied ${appliedCount} mappings to submission`
    });
  } catch (error) {
    console.error('Apply mappings error:', error);
    return res.status(500).json({ error: 'Failed to apply mappings' });
  }
};

/**
 * Get unmapped content for review
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
          content: section?.content.substring(0, 500) || '',
          fullContentLength: section?.content.length || 0,
          sectionType: section?.sectionType,
          pageNumber: section?.pageNumber
        };
      });

    return res.json({ unmapped });
  } catch (error) {
    console.error('Get unmapped error:', error);
    return res.status(500).json({ error: 'Failed to get unmapped content' });
  }
};

/**
 * Handle unmapped content (assign or discard)
 */
export const handleUnmapped = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { importId, sectionId } = req.params;
    const { action, standardCode, specCode } = req.body;

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

    if (action === 'assign' && standardCode && specCode) {
      // Move to mapped
      importRecord.unmappedContent[unmappedIndex].action = 'assigned';
      importRecord.unmappedContent[unmappedIndex].reviewedBy = new mongoose.Types.ObjectId(req.user?.id);
      importRecord.unmappedContent[unmappedIndex].reviewedAt = new Date();

      importRecord.mappedSections.push({
        extractedSectionId: sectionId,
        standardCode,
        specCode,
        fieldType: 'narrative',
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

    await importRecord.save();

    return res.json({ success: true, message: `Content ${action}ed successfully` });
  } catch (error) {
    console.error('Handle unmapped error:', error);
    return res.status(500).json({ error: 'Failed to handle unmapped content' });
  }
};
