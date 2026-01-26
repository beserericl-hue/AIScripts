import { Request, Response } from 'express';
import { File, FileAccessScope, FileCategory } from '../models/File';
import { Institution } from '../models/Institution';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    _id?: string;
    name: string;
    role: string;
    institutionId?: string;
    isSuperuser?: boolean;
  };
  file?: Express.Multer.File;
}

/**
 * Upload a file
 */
export const uploadFile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { category, description, relatedEntityId, relatedEntityType, institutionId: targetInstitutionId } = req.body;
    const userRole = req.user?.role || '';
    const userId = req.user?.id || req.user?._id;
    const userInstitutionId = req.user?.institutionId;
    const isSuperuser = req.user?.isSuperuser;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Determine access scope and institution ID
    let accessScope: FileAccessScope;
    let fileInstitutionId: mongoose.Types.ObjectId | undefined;

    if (userRole === 'admin' || isSuperuser) {
      // Admin/Superuser uploads are global by default unless they specify an institution
      if (targetInstitutionId) {
        accessScope = 'institution';
        fileInstitutionId = new mongoose.Types.ObjectId(targetInstitutionId);
      } else {
        accessScope = 'global';
      }
    } else if (userRole === 'program_coordinator') {
      // Program Coordinator uploads are institution-scoped
      if (!userInstitutionId) {
        return res.status(400).json({ error: 'Program coordinator must be assigned to an institution' });
      }
      accessScope = 'institution';
      fileInstitutionId = new mongoose.Types.ObjectId(userInstitutionId);
    } else {
      // Other roles - default to institution scope if they have one
      if (userInstitutionId) {
        accessScope = 'institution';
        fileInstitutionId = new mongoose.Types.ObjectId(userInstitutionId);
      } else {
        return res.status(403).json({ error: 'You do not have permission to upload files' });
      }
    }

    // Generate unique filename
    const ext = req.file.originalname.split('.').pop();
    const filename = `${uuidv4()}.${ext}`;

    // Create file document
    const file = new File({
      filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      data: req.file.buffer,
      accessScope,
      uploadedBy: new mongoose.Types.ObjectId(userId),
      uploadedByRole: userRole,
      institutionId: fileInstitutionId,
      category: category || 'other',
      relatedEntityId: relatedEntityId ? new mongoose.Types.ObjectId(relatedEntityId) : undefined,
      relatedEntityType,
      description
    });

    await file.save();

    // Return file metadata (without the binary data)
    return res.status(201).json({
      file: {
        _id: file._id,
        filename: file.filename,
        originalName: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
        accessScope: file.accessScope,
        category: file.category,
        institutionId: file.institutionId,
        createdAt: file.createdAt
      }
    });
  } catch (error) {
    console.error('Upload file error:', error);
    return res.status(500).json({ error: 'Failed to upload file' });
  }
};

/**
 * Get file by ID (download)
 */
export const getFile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?._id;
    const userRole = req.user?.role || '';
    const userInstitutionId = req.user?.institutionId;
    const isSuperuser = req.user?.isSuperuser;

    const file = await File.findById(id);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Check access permissions
    const canAccess = await checkFileAccess(
      file,
      userId as string,
      userRole,
      userInstitutionId,
      isSuperuser
    );

    if (!canAccess) {
      return res.status(403).json({ error: 'You do not have permission to access this file' });
    }

    // Set response headers for file download
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
    res.setHeader('Content-Length', file.size);

    return res.send(file.data);
  } catch (error) {
    console.error('Get file error:', error);
    return res.status(500).json({ error: 'Failed to retrieve file' });
  }
};

/**
 * Get file metadata (without binary data)
 */
export const getFileMetadata = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?._id;
    const userRole = req.user?.role || '';
    const userInstitutionId = req.user?.institutionId;
    const isSuperuser = req.user?.isSuperuser;

    const file = await File.findById(id)
      .select('-data')
      .populate('uploadedBy', 'firstName lastName email')
      .populate('institutionId', 'name');

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Check access permissions
    const canAccess = await checkFileAccess(
      file,
      userId as string,
      userRole,
      userInstitutionId,
      isSuperuser
    );

    if (!canAccess) {
      return res.status(403).json({ error: 'You do not have permission to access this file' });
    }

    return res.json({ file });
  } catch (error) {
    console.error('Get file metadata error:', error);
    return res.status(500).json({ error: 'Failed to retrieve file metadata' });
  }
};

/**
 * List files with filters
 */
export const listFiles = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { category, institutionId, relatedEntityId, page = '1', limit = '20' } = req.query;
    const userId = req.user?.id || req.user?._id;
    const userRole = req.user?.role || '';
    const userInstitutionId = req.user?.institutionId;
    const isSuperuser = req.user?.isSuperuser;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build query based on user permissions
    const query: any = {};

    if (category) {
      query.category = category;
    }

    if (relatedEntityId) {
      query.relatedEntityId = new mongoose.Types.ObjectId(relatedEntityId as string);
    }

    // Access control for listing
    if (isSuperuser || userRole === 'admin') {
      // Admin/Superuser can see all files
      if (institutionId) {
        query.institutionId = new mongoose.Types.ObjectId(institutionId as string);
      }
    } else {
      // Other users can only see global files or files for their institution
      query.$or = [
        { accessScope: 'global' },
        { institutionId: userInstitutionId ? new mongoose.Types.ObjectId(userInstitutionId) : null }
      ];
    }

    const [files, total] = await Promise.all([
      File.find(query)
        .select('-data')
        .populate('uploadedBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      File.countDocuments(query)
    ]);

    return res.json({
      files,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('List files error:', error);
    return res.status(500).json({ error: 'Failed to list files' });
  }
};

/**
 * Delete file
 */
export const deleteFile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?._id;
    const userRole = req.user?.role || '';
    const isSuperuser = req.user?.isSuperuser;

    const file = await File.findById(id);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Only admin, superuser, or the uploader can delete
    if (!isSuperuser && userRole !== 'admin' && file.uploadedBy.toString() !== userId) {
      return res.status(403).json({ error: 'You do not have permission to delete this file' });
    }

    await File.findByIdAndDelete(id);

    return res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete file error:', error);
    return res.status(500).json({ error: 'Failed to delete file' });
  }
};

/**
 * Helper function to check file access
 */
async function checkFileAccess(
  file: any,
  userId: string,
  userRole: string,
  userInstitutionId?: string,
  isSuperuser?: boolean
): Promise<boolean> {
  // Superuser and admin can access all files
  if (isSuperuser || userRole === 'admin') {
    return true;
  }

  // Global files can be accessed by anyone authenticated
  if (file.accessScope === 'global') {
    return true;
  }

  // Owner can always access their own files
  if (file.uploadedBy.toString() === userId) {
    return true;
  }

  // Institution-scoped files
  if (file.accessScope === 'institution' && file.institutionId) {
    const fileInstitutionId = file.institutionId.toString();

    // User belongs to the same institution
    if (userInstitutionId && fileInstitutionId === userInstitutionId) {
      return true;
    }

    // Check if lead reader or reader is assigned to this institution
    if (userRole === 'lead_reader' || userRole === 'reader') {
      const institution = await Institution.findById(file.institutionId);
      if (institution) {
        // Check if user is assigned as lead reader
        if (institution.assignedLeadReaderId?.toString() === userId) {
          return true;
        }
        // Check if user is in assigned readers
        if (institution.assignedReaderIds?.some((id: any) => id.toString() === userId)) {
          return true;
        }
      }
    }
  }

  return false;
}
