import { Request, Response } from 'express';
import { SelfStudyImport } from '../models/SelfStudyImport';

interface DocumentMatcherSection {
  sectionId: string;
  content: string;
  suggestedStandardCode: string;
  suggestedSpecCode: string;
  confidence: number;
  reasoning?: string;
}

interface DocumentMatcherCallbackPayload {
  importId: string;
  status: 'success' | 'error';
  error?: string;
  sections?: DocumentMatcherSection[];
}

/**
 * Receive callback from n8n Document Matcher with section mappings
 */
export const receiveDocumentMatcherCallback = async (req: Request, res: Response) => {
  try {
    const payload = req.body as DocumentMatcherCallbackPayload;

    if (!payload.importId) {
      return res.status(400).json({ error: 'Missing importId in callback' });
    }

    const importRecord = await SelfStudyImport.findById(payload.importId);
    if (!importRecord) {
      return res.status(404).json({ error: 'Import not found' });
    }

    if (payload.status === 'error') {
      importRecord.status = 'failed';
      importRecord.error = payload.error || 'Document matching failed';
      importRecord.processingCompletedAt = new Date();
      await importRecord.save();

      return res.json({
        success: true,
        importId: importRecord._id,
        status: 'failed'
      });
    }

    // Process successful section mappings from n8n
    if (payload.sections && Array.isArray(payload.sections)) {
      // Clear existing auto-mappings to apply new ones from n8n
      importRecord.mappedSections = importRecord.mappedSections.filter(m => m.mappedBy === 'manual');
      importRecord.unmappedContent = [];

      for (const section of payload.sections) {
        // Find or create the extracted section
        let extractedSection = importRecord.extractedContent.sections.find(
          s => s.id === section.sectionId
        );

        // If section doesn't exist, create it from the n8n response
        if (!extractedSection && section.content) {
          const newSection = {
            id: section.sectionId,
            pageNumber: 0,
            startPosition: 0,
            endPosition: section.content.length,
            sectionType: 'narrative' as const,
            content: section.content,
            confidence: section.confidence,
            suggestedStandard: section.suggestedStandardCode
          };
          importRecord.extractedContent.sections.push(newSection);
          extractedSection = newSection;
        }

        // Apply mapping based on confidence threshold
        if (section.confidence >= 0.6 && section.suggestedStandardCode && section.suggestedSpecCode) {
          importRecord.mappedSections.push({
            extractedSectionId: section.sectionId,
            standardCode: section.suggestedStandardCode,
            specCode: section.suggestedSpecCode,
            fieldType: 'narrative',
            mappedBy: 'auto',
            mappedAt: new Date()
          });
        } else {
          // Add to unmapped for user review
          importRecord.unmappedContent.push({
            extractedSectionId: section.sectionId,
            reason: section.reasoning || `Low confidence mapping (${Math.round(section.confidence * 100)}%)`,
            action: 'pending'
          });
        }
      }
    }

    importRecord.status = 'completed';
    importRecord.processingCompletedAt = new Date();
    await importRecord.save();

    return res.json({
      success: true,
      importId: importRecord._id,
      status: 'completed',
      mappedCount: importRecord.mappedSections.length,
      unmappedCount: importRecord.unmappedContent.filter(u => u.action === 'pending').length
    });
  } catch (error) {
    console.error('Document matcher callback error:', error);
    return res.status(500).json({ error: 'Failed to process callback' });
  }
};
