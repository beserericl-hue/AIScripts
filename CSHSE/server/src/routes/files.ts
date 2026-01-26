import { Router } from 'express';
import multer from 'multer';
import {
  uploadFile,
  getFile,
  getFileMetadata,
  listFiles,
  deleteFile
} from '../controllers/fileController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * Configure multer for memory storage
 * Files are stored as binary (Buffer) in MongoDB
 */
const storage = multer.memoryStorage();

/**
 * File filter - allow common document and image types
 */
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = [
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    // Text
    'text/plain',
    'text/csv',
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${file.mimetype}`));
  }
};

/**
 * Multer upload configuration
 * - Uses memory storage for MongoDB binary storage
 * - 50MB file size limit
 * - Validates file types
 */
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max
  }
});

// ============================================
// FILE ROUTES
// ============================================

/**
 * @route   GET /api/files
 * @desc    List files with filters
 * @access  Private (filtered by user access)
 * @query   category - Filter by category (spec_document, self_study_import, evidence, other)
 * @query   institutionId - Filter by institution (admin/superuser only)
 * @query   relatedEntityId - Filter by related entity
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 20)
 */
router.get('/', listFiles);

/**
 * @route   GET /api/files/:id
 * @desc    Download file by ID
 * @access  Private (with access control)
 */
router.get('/:id', getFile);

/**
 * @route   GET /api/files/:id/metadata
 * @desc    Get file metadata without binary data
 * @access  Private (with access control)
 */
router.get('/:id/metadata', getFileMetadata);

/**
 * @route   POST /api/files
 * @desc    Upload a file
 * @access  Private (Admin, Program Coordinator, or users with institution)
 * @body    file - The file to upload (multipart/form-data)
 * @body    category - File category
 * @body    description - Optional description
 * @body    relatedEntityId - Optional related entity ID
 * @body    relatedEntityType - Optional related entity type
 * @body    institutionId - Optional target institution (admin/superuser only)
 */
router.post('/', upload.single('file'), uploadFile);

/**
 * @route   DELETE /api/files/:id
 * @desc    Delete a file
 * @access  Private (Admin, Superuser, or file owner)
 */
router.delete('/:id', deleteFile);

export default router;
