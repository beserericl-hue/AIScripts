import mongoose from 'mongoose';
import { GridFSBucket, ObjectId, GridFSBucketReadStream } from 'mongodb';
import { Readable } from 'stream';
import { SelfStudyImport } from '../models/SelfStudyImport';

/**
 * GridFS Service for storing large files (HTML content) that exceed MongoDB's 16MB BSON limit
 *
 * GridFS splits files into 255KB chunks and stores them across multiple documents.
 * This allows storing files of any size in MongoDB.
 */

let bucket: GridFSBucket | null = null;

/**
 * Initialize GridFS bucket
 */
function getBucket(): GridFSBucket {
  if (!bucket) {
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('MongoDB connection not established');
    }
    bucket = new GridFSBucket(db, { bucketName: 'htmlContent' });
    console.log('[GridFSService] Initialized GridFS bucket: htmlContent');
  }
  return bucket;
}

/**
 * Store HTML content in GridFS
 * @param importId - The import ID to associate with this file
 * @param htmlContent - The HTML string to store
 * @returns The GridFS file ID
 */
export async function storeHtmlContent(importId: string, htmlContent: string): Promise<string> {
  const bucket = getBucket();

  // Check if file already exists for this import and delete it
  const existingFiles = await bucket.find({ filename: `${importId}.html` }).toArray();
  for (const file of existingFiles) {
    await bucket.delete(file._id);
    console.log(`[GridFSService] Deleted existing file for import: ${importId}`);
  }

  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(`${importId}.html`, {
      metadata: {
        importId,
        contentType: 'text/html',
        uploadedAt: new Date(),
        size: htmlContent.length
      }
    });

    const readableStream = Readable.from([htmlContent]);

    readableStream.pipe(uploadStream)
      .on('error', (error) => {
        console.error(`[GridFSService] Error uploading HTML for import ${importId}:`, error);
        reject(error);
      })
      .on('finish', () => {
        console.log(`[GridFSService] Stored HTML for import ${importId}, fileId: ${uploadStream.id}, size: ${htmlContent.length} chars`);
        resolve(uploadStream.id.toString());
      });
  });
}

/**
 * Retrieve HTML content from GridFS
 * @param importId - The import ID to find
 * @returns The HTML content as a string
 */
export async function getHtmlContent(importId: string): Promise<string> {
  const bucket = getBucket();

  const files = await bucket.find({ filename: `${importId}.html` }).toArray();

  if (files.length === 0) {
    throw new Error(`HTML content not found for import: ${importId}`);
  }

  const file = files[0];
  console.log(`[GridFSService] Reading HTML for import ${importId}, size: ${file.length} bytes`);

  return new Promise((resolve, reject) => {
    const downloadStream = bucket.openDownloadStream(file._id);
    const chunks: Buffer[] = [];

    downloadStream
      .on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      })
      .on('error', (error) => {
        console.error(`[GridFSService] Error downloading HTML for import ${importId}:`, error);
        reject(error);
      })
      .on('end', () => {
        const content = Buffer.concat(chunks).toString('utf-8');
        console.log(`[GridFSService] Retrieved HTML for import ${importId}, ${content.length} chars`);
        resolve(content);
      });
  });
}

/**
 * Get a readable stream for HTML content (for streaming large responses)
 * @param importId - The import ID to find
 * @returns A readable stream
 */
export async function getHtmlContentStream(importId: string): Promise<GridFSBucketReadStream> {
  const bucket = getBucket();

  const files = await bucket.find({ filename: `${importId}.html` }).toArray();

  if (files.length === 0) {
    throw new Error(`HTML content not found for import: ${importId}`);
  }

  const file = files[0];
  console.log(`[GridFSService] Creating stream for import ${importId}, size: ${file.length} bytes`);

  return bucket.openDownloadStream(file._id);
}

/**
 * Check if HTML content exists for an import
 * @param importId - The import ID to check
 * @returns True if content exists
 */
export async function htmlContentExists(importId: string): Promise<boolean> {
  const bucket = getBucket();
  const files = await bucket.find({ filename: `${importId}.html` }).toArray();
  return files.length > 0;
}

/**
 * Get metadata about stored HTML content
 * @param importId - The import ID
 * @returns File metadata or null if not found
 */
export async function getHtmlContentMetadata(importId: string): Promise<{
  size: number;
  uploadedAt: Date;
  charCount: number;
} | null> {
  const bucket = getBucket();
  const files = await bucket.find({ filename: `${importId}.html` }).toArray();

  if (files.length === 0) {
    return null;
  }

  const file = files[0];
  return {
    size: file.length || 0,
    uploadedAt: file.uploadDate || new Date(),
    charCount: file.metadata?.size || 0
  };
}

/**
 * Delete HTML content for an import
 * @param importId - The import ID to delete
 */
export async function deleteHtmlContent(importId: string): Promise<void> {
  const bucket = getBucket();

  const files = await bucket.find({ filename: `${importId}.html` }).toArray();

  for (const file of files) {
    await bucket.delete(file._id);
    console.log(`[GridFSService] Deleted HTML content for import: ${importId}`);
  }
}

/**
 * Get storage statistics
 * @returns Total files and size
 */
export async function getStorageStats(): Promise<{
  fileCount: number;
  totalSize: number;
}> {
  const bucket = getBucket();
  const files = await bucket.find({}).toArray();

  const totalSize = files.reduce((acc, file) => acc + (file.length || 0), 0);

  return {
    fileCount: files.length,
    totalSize
  };
}

/**
 * Image Storage Functions
 * Images are stored in a separate bucket: 'images'
 */

let imageBucket: GridFSBucket | null = null;

function getImageBucket(): GridFSBucket {
  if (!imageBucket) {
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('MongoDB connection not established');
    }
    imageBucket = new GridFSBucket(db, { bucketName: 'images' });
    console.log('[GridFSService] Initialized GridFS bucket: images');
  }
  return imageBucket;
}

/**
 * Store an image in GridFS
 * @param importId - The import ID
 * @param imageBuffer - The image buffer
 * @param filename - The filename (e.g., image_uuid.png)
 * @param contentType - The MIME type
 * @returns The filename for later retrieval
 */
export async function storeImage(
  importId: string,
  imageBuffer: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  const bucket = getImageBucket();
  const gridFilename = `${importId}/${filename}`;

  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(gridFilename, {
      metadata: {
        importId,
        originalFilename: filename,
        contentType,
        uploadedAt: new Date(),
        size: imageBuffer.length
      },
      contentType
    });

    const readableStream = Readable.from([imageBuffer]);

    readableStream.pipe(uploadStream)
      .on('error', (error) => {
        console.error(`[GridFSService] Error uploading image ${filename}:`, error);
        reject(error);
      })
      .on('finish', () => {
        console.log(`[GridFSService] Stored image: ${gridFilename}, size: ${imageBuffer.length} bytes`);
        resolve(filename);
      });
  });
}

/**
 * Get an image from GridFS
 * @param importId - The import ID
 * @param filename - The filename
 * @returns Object with buffer and contentType
 */
export async function getImage(
  importId: string,
  filename: string
): Promise<{ buffer: Buffer; contentType: string }> {
  const bucket = getImageBucket();
  const gridFilename = `${importId}/${filename}`;

  const files = await bucket.find({ filename: gridFilename }).toArray();

  if (files.length === 0) {
    throw new Error(`Image not found: ${gridFilename}`);
  }

  const file = files[0];
  const contentType = file.contentType || file.metadata?.contentType || 'image/png';

  return new Promise((resolve, reject) => {
    const downloadStream = bucket.openDownloadStream(file._id);
    const chunks: Buffer[] = [];

    downloadStream
      .on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      })
      .on('error', (error) => {
        console.error(`[GridFSService] Error downloading image ${gridFilename}:`, error);
        reject(error);
      })
      .on('end', () => {
        const buffer = Buffer.concat(chunks);
        console.log(`[GridFSService] Retrieved image: ${gridFilename}, ${buffer.length} bytes`);
        resolve({ buffer, contentType });
      });
  });
}

/**
 * Check if an image exists in GridFS
 */
export async function imageExists(importId: string, filename: string): Promise<boolean> {
  const bucket = getImageBucket();
  const gridFilename = `${importId}/${filename}`;
  const files = await bucket.find({ filename: gridFilename }).toArray();
  return files.length > 0;
}

/**
 * Delete all images for an import
 */
export async function deleteImportImages(importId: string): Promise<void> {
  const bucket = getImageBucket();

  // Find all images for this import (files matching importId/*)
  const files = await bucket.find({ filename: { $regex: `^${importId}/` } }).toArray();

  for (const file of files) {
    await bucket.delete(file._id);
  }

  console.log(`[GridFSService] Deleted ${files.length} images for import: ${importId}`);
}

/**
 * List all images for an import
 */
export async function listImportImages(importId: string): Promise<string[]> {
  const bucket = getImageBucket();
  const files = await bucket.find({ filename: { $regex: `^${importId}/` } }).toArray();
  return files.map(f => f.filename.replace(`${importId}/`, ''));
}

/**
 * Clean up orphaned GridFS files
 * Finds and deletes GridFS files whose associated import no longer exists
 * @param dryRun - If true, only report what would be deleted without actually deleting
 * @returns Stats about cleaned up files
 */
export async function cleanupOrphanedFiles(dryRun = false): Promise<{
  orphanedHtmlFiles: number;
  orphanedImageFiles: number;
  totalBytesFreed: number;
  orphanedImportIds: string[];
}> {
  const htmlBucket = getBucket();
  const imgBucket = getImageBucket();

  // Get all HTML files
  const htmlFiles = await htmlBucket.find({}).toArray();

  // Get all image files
  const imageFiles = await imgBucket.find({}).toArray();

  // Extract unique import IDs from filenames
  const importIdsFromHtml = new Set<string>();
  const importIdsFromImages = new Set<string>();

  for (const file of htmlFiles) {
    // Filename format: {importId}.html
    const match = file.filename.match(/^([a-f0-9]{24})\.html$/);
    if (match) {
      importIdsFromHtml.add(match[1]);
    }
  }

  for (const file of imageFiles) {
    // Filename format: {importId}/{imageName}
    const match = file.filename.match(/^([a-f0-9]{24})\//);
    if (match) {
      importIdsFromImages.add(match[1]);
    }
  }

  // Combine all unique import IDs
  const allImportIds = new Set([...importIdsFromHtml, ...importIdsFromImages]);

  // Check which imports actually exist
  const existingImports = await SelfStudyImport.find({
    _id: { $in: Array.from(allImportIds) }
  }).select('_id');

  const existingImportIds = new Set(existingImports.map(i => i._id.toString()));

  // Find orphaned import IDs
  const orphanedImportIds = Array.from(allImportIds).filter(id => !existingImportIds.has(id));

  console.log(`[GridFSService] Found ${orphanedImportIds.length} orphaned import IDs out of ${allImportIds.size} total`);

  let orphanedHtmlFiles = 0;
  let orphanedImageFiles = 0;
  let totalBytesFreed = 0;

  if (!dryRun) {
    // Delete orphaned HTML files
    for (const file of htmlFiles) {
      const match = file.filename.match(/^([a-f0-9]{24})\.html$/);
      if (match && orphanedImportIds.includes(match[1])) {
        await htmlBucket.delete(file._id);
        orphanedHtmlFiles++;
        totalBytesFreed += file.length || 0;
        console.log(`[GridFSService] Deleted orphaned HTML: ${file.filename} (${(file.length / 1024 / 1024).toFixed(2)} MB)`);
      }
    }

    // Delete orphaned image files
    for (const file of imageFiles) {
      const match = file.filename.match(/^([a-f0-9]{24})\//);
      if (match && orphanedImportIds.includes(match[1])) {
        await imgBucket.delete(file._id);
        orphanedImageFiles++;
        totalBytesFreed += file.length || 0;
      }
    }

    console.log(`[GridFSService] Cleanup complete: ${orphanedHtmlFiles} HTML files, ${orphanedImageFiles} images, ${(totalBytesFreed / 1024 / 1024).toFixed(2)} MB freed`);
  } else {
    // Dry run - just count
    for (const file of htmlFiles) {
      const match = file.filename.match(/^([a-f0-9]{24})\.html$/);
      if (match && orphanedImportIds.includes(match[1])) {
        orphanedHtmlFiles++;
        totalBytesFreed += file.length || 0;
      }
    }

    for (const file of imageFiles) {
      const match = file.filename.match(/^([a-f0-9]{24})\//);
      if (match && orphanedImportIds.includes(match[1])) {
        orphanedImageFiles++;
        totalBytesFreed += file.length || 0;
      }
    }

    console.log(`[GridFSService] Dry run: Would delete ${orphanedHtmlFiles} HTML files, ${orphanedImageFiles} images, ${(totalBytesFreed / 1024 / 1024).toFixed(2)} MB`);
  }

  return {
    orphanedHtmlFiles,
    orphanedImageFiles,
    totalBytesFreed,
    orphanedImportIds
  };
}

export default {
  storeHtmlContent,
  getHtmlContent,
  getHtmlContentStream,
  htmlContentExists,
  getHtmlContentMetadata,
  deleteHtmlContent,
  getStorageStats,
  // Image functions
  storeImage,
  getImage,
  imageExists,
  deleteImportImages,
  listImportImages,
  // Cleanup
  cleanupOrphanedFiles
};
