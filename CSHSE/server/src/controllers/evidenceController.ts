import { Request, Response } from 'express';
import { SupportingEvidence } from '../models/SupportingEvidence';
import { Submission } from '../models/Submission';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
  file?: Express.Multer.File;
}

// Ensure upload directory exists
const uploadDir = process.env.UPLOAD_DIR || 'uploads/evidence';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * List evidence for a submission
 */
export const listEvidence = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.params;
    const { standardCode, specCode, evidenceType } = req.query;

    const filter: any = { submissionId };

    if (standardCode) {
      filter.standardCode = standardCode;
    }
    if (specCode) {
      filter.specCode = specCode;
    }
    if (evidenceType) {
      filter.evidenceType = evidenceType;
    }

    const evidence = await SupportingEvidence.find(filter)
      .sort({ createdAt: -1 });

    return res.json(evidence);
  } catch (error) {
    console.error('List evidence error:', error);
    return res.status(500).json({ error: 'Failed to list evidence' });
  }
};

/**
 * Get a single evidence item
 */
export const getEvidence = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { evidenceId } = req.params;

    const evidence = await SupportingEvidence.findById(evidenceId);
    if (!evidence) {
      return res.status(404).json({ error: 'Evidence not found' });
    }

    return res.json(evidence);
  } catch (error) {
    console.error('Get evidence error:', error);
    return res.status(500).json({ error: 'Failed to get evidence' });
  }
};

/**
 * Upload document evidence (Word, PDF, PPT, images)
 */
export const uploadEvidence = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.params;
    const { standardCode, specCode, description } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Determine evidence type based on mime type
    let evidenceType: 'document' | 'image' = 'document';
    if (file.mimetype.startsWith('image/')) {
      evidenceType = 'image';
    }

    // Create evidence record
    const evidence = await SupportingEvidence.create({
      submissionId,
      standardCode: standardCode || null,
      specCode: specCode || null,
      evidenceType,
      file: {
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storagePath: file.path
      },
      uploadedBy: req.user?.id,
      metadata: {
        description: description || ''
      }
    });

    return res.status(201).json({
      message: 'Evidence uploaded successfully',
      evidence
    });
  } catch (error) {
    console.error('Upload evidence error:', error);
    return res.status(500).json({ error: 'Failed to upload evidence' });
  }
};

/**
 * Add URL evidence
 */
export const addUrlEvidence = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.params;
    const { standardCode, specCode, url, title, description } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    const evidence = await SupportingEvidence.create({
      submissionId,
      standardCode: standardCode || null,
      specCode: specCode || null,
      evidenceType: 'url',
      url: {
        href: url,
        title: title || url,
        description: description || ''
      },
      uploadedBy: req.user?.id
    });

    return res.status(201).json({
      message: 'URL evidence added successfully',
      evidence
    });
  } catch (error) {
    console.error('Add URL evidence error:', error);
    return res.status(500).json({ error: 'Failed to add URL evidence' });
  }
};

/**
 * Update evidence metadata
 */
export const updateEvidence = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { evidenceId } = req.params;
    const { standardCode, specCode, description, title } = req.body;

    const evidence = await SupportingEvidence.findById(evidenceId);
    if (!evidence) {
      return res.status(404).json({ error: 'Evidence not found' });
    }

    // Update fields
    if (standardCode !== undefined) evidence.standardCode = standardCode;
    if (specCode !== undefined) evidence.specCode = specCode;

    if (evidence.evidenceType === 'url' && evidence.url) {
      if (title) evidence.url.title = title;
      if (description) evidence.url.description = description;
    }

    if (evidence.imageMetadata) {
      if (description) evidence.imageMetadata.description = description;
    }

    await evidence.save();

    return res.json({
      message: 'Evidence updated successfully',
      evidence
    });
  } catch (error) {
    console.error('Update evidence error:', error);
    return res.status(500).json({ error: 'Failed to update evidence' });
  }
};

/**
 * Delete evidence
 */
export const deleteEvidence = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { evidenceId } = req.params;

    const evidence = await SupportingEvidence.findById(evidenceId);
    if (!evidence) {
      return res.status(404).json({ error: 'Evidence not found' });
    }

    // Delete file from storage if it exists
    if (evidence.file?.storagePath) {
      try {
        fs.unlinkSync(evidence.file.storagePath);
      } catch (err) {
        console.error('Error deleting file:', err);
        // Continue even if file deletion fails
      }
    }

    await SupportingEvidence.deleteOne({ _id: evidenceId });

    return res.json({ message: 'Evidence deleted successfully' });
  } catch (error) {
    console.error('Delete evidence error:', error);
    return res.status(500).json({ error: 'Failed to delete evidence' });
  }
};

/**
 * Download evidence file
 */
export const downloadEvidence = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { evidenceId } = req.params;

    const evidence = await SupportingEvidence.findById(evidenceId);
    if (!evidence) {
      return res.status(404).json({ error: 'Evidence not found' });
    }

    if (evidence.evidenceType === 'url') {
      return res.status(400).json({ error: 'Cannot download URL evidence' });
    }

    if (!evidence.file?.storagePath) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filePath = evidence.file.storagePath;
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    res.download(filePath, evidence.file.originalName);
  } catch (error) {
    console.error('Download evidence error:', error);
    return res.status(500).json({ error: 'Failed to download evidence' });
  }
};

/**
 * Link evidence to a specification
 */
export const linkEvidence = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { evidenceId } = req.params;
    const { standardCode, specCode } = req.body;

    if (!standardCode || !specCode) {
      return res.status(400).json({ error: 'standardCode and specCode are required' });
    }

    const evidence = await SupportingEvidence.findById(evidenceId);
    if (!evidence) {
      return res.status(404).json({ error: 'Evidence not found' });
    }

    evidence.standardCode = standardCode;
    evidence.specCode = specCode;
    await evidence.save();

    return res.json({
      message: 'Evidence linked successfully',
      evidence
    });
  } catch (error) {
    console.error('Link evidence error:', error);
    return res.status(500).json({ error: 'Failed to link evidence' });
  }
};

/**
 * Unlink evidence from a specification
 */
export const unlinkEvidence = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { evidenceId } = req.params;

    const evidence = await SupportingEvidence.findById(evidenceId);
    if (!evidence) {
      return res.status(404).json({ error: 'Evidence not found' });
    }

    evidence.standardCode = undefined as any;
    evidence.specCode = undefined as any;
    await evidence.save();

    return res.json({
      message: 'Evidence unlinked successfully',
      evidence
    });
  } catch (error) {
    console.error('Unlink evidence error:', error);
    return res.status(500).json({ error: 'Failed to unlink evidence' });
  }
};

/**
 * Get evidence statistics for a submission
 */
export const getEvidenceStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.params;

    const stats = await SupportingEvidence.aggregate([
      { $match: { submissionId: submissionId } },
      {
        $group: {
          _id: '$evidenceType',
          count: { $sum: 1 },
          totalSize: { $sum: '$file.size' }
        }
      }
    ]);

    const linkedCount = await SupportingEvidence.countDocuments({
      submissionId,
      standardCode: { $ne: null }
    });

    const unlinkedCount = await SupportingEvidence.countDocuments({
      submissionId,
      standardCode: null
    });

    return res.json({
      byType: stats.reduce((acc, s) => {
        acc[s._id] = { count: s.count, totalSize: s.totalSize || 0 };
        return acc;
      }, {} as Record<string, any>),
      linkedCount,
      unlinkedCount,
      total: linkedCount + unlinkedCount
    });
  } catch (error) {
    console.error('Get evidence stats error:', error);
    return res.status(500).json({ error: 'Failed to get evidence statistics' });
  }
};
