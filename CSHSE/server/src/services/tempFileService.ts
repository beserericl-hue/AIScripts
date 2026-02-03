import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service for managing temporary files during document import
 * Temp files are stored in /tmp/imports/{importId}/
 * - content.html: The extracted HTML from the document
 * - images/: Folder containing extracted images
 *
 * Temp files persist until the self-study is submitted to lead reader
 */

const TEMP_BASE_DIR = process.env.TEMP_DIR || '/tmp/imports';

// Log the temp directory on startup
console.log(`[TempFileService] Using temp directory: ${TEMP_BASE_DIR}`);

export interface TempFileInfo {
  importId: string;
  basePath: string;
  htmlPath: string;
  imagesPath: string;
}

/**
 * Initialize temp directory structure for an import
 */
export async function initTempDirectory(importId: string): Promise<TempFileInfo> {
  const basePath = path.join(TEMP_BASE_DIR, importId);
  const imagesPath = path.join(basePath, 'images');
  const htmlPath = path.join(basePath, 'content.html');

  // Create directories
  await fs.mkdir(basePath, { recursive: true });
  await fs.mkdir(imagesPath, { recursive: true });

  console.log(`[TempFileService] Created temp directory: ${basePath}`);

  return {
    importId,
    basePath,
    htmlPath,
    imagesPath
  };
}

/**
 * Save HTML content to temp file
 */
export async function saveHtmlContent(importId: string, htmlContent: string): Promise<string> {
  const htmlPath = path.join(TEMP_BASE_DIR, importId, 'content.html');

  console.log(`[TempFileService] Saving HTML content to: ${htmlPath}`);

  // Ensure directory exists
  await fs.mkdir(path.dirname(htmlPath), { recursive: true });

  await fs.writeFile(htmlPath, htmlContent, 'utf-8');
  console.log(`[TempFileService] Saved HTML content: ${htmlPath} (${htmlContent.length} chars)`);

  // Verify file was written
  try {
    const stats = await fs.stat(htmlPath);
    console.log(`[TempFileService] File verified: ${stats.size} bytes`);
  } catch (err) {
    console.error(`[TempFileService] Failed to verify file:`, err);
  }

  return htmlPath;
}

/**
 * Save an image to temp folder
 * Returns the filename (not full path) for URL construction
 */
export async function saveImage(
  importId: string,
  imageBuffer: Buffer,
  contentType: string
): Promise<string> {
  const extension = contentType.split('/')[1] || 'png';
  const filename = `image_${uuidv4()}.${extension}`;
  const imagesPath = path.join(TEMP_BASE_DIR, importId, 'images');
  const fullPath = path.join(imagesPath, filename);

  // Ensure directory exists
  await fs.mkdir(imagesPath, { recursive: true });

  await fs.writeFile(fullPath, imageBuffer);
  console.log(`[TempFileService] Saved image: ${filename}`);

  return filename;
}

/**
 * Read HTML content from temp file
 */
export async function readHtmlContent(importId: string): Promise<string> {
  const htmlPath = path.join(TEMP_BASE_DIR, importId, 'content.html');
  console.log(`[TempFileService] Reading HTML from: ${htmlPath}`);

  try {
    const content = await fs.readFile(htmlPath, 'utf-8');
    console.log(`[TempFileService] Read ${content.length} chars from ${htmlPath}`);
    return content;
  } catch (error: any) {
    console.error(`[TempFileService] Error reading HTML:`, error.code, error.message);
    if (error.code === 'ENOENT') {
      throw new Error(`HTML content not found for import ${importId}. Path: ${htmlPath}`);
    }
    throw error;
  }
}

/**
 * Update HTML content (after section extraction)
 */
export async function updateHtmlContent(importId: string, htmlContent: string): Promise<void> {
  const htmlPath = path.join(TEMP_BASE_DIR, importId, 'content.html');
  await fs.writeFile(htmlPath, htmlContent, 'utf-8');
  console.log(`[TempFileService] Updated HTML content: ${htmlPath} (${htmlContent.length} chars)`);
}

/**
 * Get image file path for serving
 */
export async function getImagePath(importId: string, filename: string): Promise<string> {
  const imagePath = path.join(TEMP_BASE_DIR, importId, 'images', filename);

  // Security: Ensure filename doesn't contain path traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new Error('Invalid image filename');
  }

  try {
    await fs.access(imagePath);
    return imagePath;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`Image not found: ${filename}`);
    }
    throw error;
  }
}

/**
 * Check if temp directory exists for an import
 */
export async function tempDirectoryExists(importId: string): Promise<boolean> {
  const basePath = path.join(TEMP_BASE_DIR, importId);
  try {
    await fs.access(basePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get temp directory info
 */
export function getTempPaths(importId: string): TempFileInfo {
  const basePath = path.join(TEMP_BASE_DIR, importId);
  return {
    importId,
    basePath,
    htmlPath: path.join(basePath, 'content.html'),
    imagesPath: path.join(basePath, 'images')
  };
}

/**
 * Clean up temp files for an import
 * Called when self-study is submitted to lead reader
 */
export async function cleanupTempFiles(importId: string): Promise<void> {
  const basePath = path.join(TEMP_BASE_DIR, importId);

  try {
    await fs.rm(basePath, { recursive: true, force: true });
    console.log(`[TempFileService] Cleaned up temp files for import: ${importId}`);
  } catch (error: any) {
    // Ignore if directory doesn't exist
    if (error.code !== 'ENOENT') {
      console.error(`[TempFileService] Error cleaning up temp files:`, error);
      throw error;
    }
  }
}

/**
 * List all images in temp folder
 */
export async function listImages(importId: string): Promise<string[]> {
  const imagesPath = path.join(TEMP_BASE_DIR, importId, 'images');

  try {
    const files = await fs.readdir(imagesPath);
    return files.filter(f => /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(f));
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * Get stats about temp storage
 */
export async function getTempStats(importId: string): Promise<{
  htmlSize: number;
  imageCount: number;
  totalSize: number;
}> {
  const paths = getTempPaths(importId);

  let htmlSize = 0;
  let imageCount = 0;
  let totalSize = 0;

  try {
    const htmlStat = await fs.stat(paths.htmlPath);
    htmlSize = htmlStat.size;
    totalSize += htmlSize;
  } catch {
    // HTML file doesn't exist yet
  }

  try {
    const images = await listImages(importId);
    imageCount = images.length;

    for (const img of images) {
      const imgPath = path.join(paths.imagesPath, img);
      const imgStat = await fs.stat(imgPath);
      totalSize += imgStat.size;
    }
  } catch {
    // Images folder doesn't exist yet
  }

  return { htmlSize, imageCount, totalSize };
}

export default {
  initTempDirectory,
  saveHtmlContent,
  saveImage,
  readHtmlContent,
  updateHtmlContent,
  getImagePath,
  tempDirectoryExists,
  getTempPaths,
  cleanupTempFiles,
  listImages,
  getTempStats
};
