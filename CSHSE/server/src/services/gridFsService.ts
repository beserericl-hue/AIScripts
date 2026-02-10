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

/**
 * Extract plain text from HTML using the same walker logic as insertHtmlMarker.
 * Skips tags, comments, and counts HTML entities as single characters.
 * The returned text's character indices are compatible with insertHtmlMarker's textStartOffset.
 */
export function extractTextFromHtml(html: string): string {
  let text = '';
  let inTag = false;

  for (let i = 0; i < html.length; i++) {
    const ch = html[i];

    if (ch === '<') {
      if (html.substring(i, i + 4) === '<!--') {
        const commentEnd = html.indexOf('-->', i + 4);
        if (commentEnd !== -1) { i = commentEnd + 2; continue; }
      }
      inTag = true;
      continue;
    }
    if (ch === '>' && inTag) { inTag = false; continue; }
    if (inTag) continue;

    if (ch === '&') {
      const semiIdx = html.indexOf(';', i + 1);
      if (semiIdx !== -1 && semiIdx - i <= 10) {
        const entity = html.substring(i, semiIdx + 1).toLowerCase();
        // Decode common entities for better matching
        const decoded: Record<string, string> = {
          '&amp;': '&', '&lt;': '<', '&gt;': '>', '&nbsp;': ' ',
          '&quot;': '"', '&apos;': "'", '&#39;': "'",
        };
        text += decoded[entity] || ' ';
        i = semiIdx;
        continue;
      }
    }

    text += ch;
  }

  return text;
}

/**
 * Find a section's text content position in an HTML document by content matching.
 * Searches for the section's text in the document, returning the text offset
 * compatible with insertHtmlMarker.
 *
 * @param html - The full HTML document
 * @param sectionHtml - The section's HTML content (from range.cloneContents)
 * @param sectionFullContent - The section's plain text (fallback)
 * @returns textOffset and textLength, or null if not found
 */
export function findSectionTextOffset(
  html: string,
  sectionHtml: string | undefined,
  sectionFullContent: string | undefined
): { textOffset: number; textLength: number } | null {
  const docText = extractTextFromHtml(html);

  // Extract text from section HTML (preferred — uses same walker as document)
  let sectionText = sectionHtml ? extractTextFromHtml(sectionHtml) : '';
  // Fallback to fullContent if HTML extraction yields nothing useful
  if (!sectionText || sectionText.trim().length < 20) {
    sectionText = sectionFullContent || '';
  }
  if (!sectionText || sectionText.trim().length < 20) return null;

  // Normalize whitespace for matching
  const normalizedDoc = docText.replace(/\s+/g, ' ');
  const normalizedSection = sectionText.replace(/\s+/g, ' ').trim();

  // Use first 150 chars as search anchor
  const anchorLen = Math.min(150, normalizedSection.length);
  const anchor = normalizedSection.substring(0, anchorLen);

  // End anchor for verification (last 50 chars)
  const endAnchorLen = Math.min(50, normalizedSection.length);
  const endAnchor = normalizedSection.substring(normalizedSection.length - endAnchorLen);
  const hasDistinctEndAnchor = normalizedSection.length > 200;

  // Find ALL occurrences of the start anchor (avoids false positives in TOC/headers)
  const candidates: Array<{ normalizedIdx: number; endMatched: boolean }> = [];
  let searchFrom = 0;
  while (true) {
    const idx = normalizedDoc.indexOf(anchor, searchFrom);
    if (idx === -1) break;

    // Check end anchor match for this candidate
    let endMatched = false;
    if (hasDistinctEndAnchor) {
      const expectedEndIdx = idx + normalizedSection.length - endAnchorLen;
      const endFound = normalizedDoc.indexOf(endAnchor, Math.max(0, expectedEndIdx - 100));
      endMatched = endFound !== -1 && Math.abs(endFound - expectedEndIdx) <= 100;
    } else {
      endMatched = true; // Short section, can't verify end separately
    }

    candidates.push({ normalizedIdx: idx, endMatched });
    searchFrom = idx + 1;
  }

  if (candidates.length === 0) {
    console.log(`[GridFSService] findSectionTextOffset: anchor not found in document. Anchor: "${anchor.substring(0, 60)}..."`);
    return null;
  }

  // Pick the best candidate:
  // 1. Prefer candidates where end anchor also matches (full section present)
  // 2. Among those, prefer the LAST one (body content comes after TOC/headers)
  // 3. If no end-anchor match, use the last occurrence as best guess
  let bestCandidate: typeof candidates[0];
  const endMatchedCandidates = candidates.filter(c => c.endMatched);
  if (endMatchedCandidates.length > 0) {
    bestCandidate = endMatchedCandidates[endMatchedCandidates.length - 1];
    if (candidates.length > 1) {
      console.log(`[GridFSService] findSectionTextOffset: ${candidates.length} start-anchor match(es), ` +
        `${endMatchedCandidates.length} with end-anchor — using last verified at normalized pos ${bestCandidate.normalizedIdx}`);
    }
  } else {
    bestCandidate = candidates[candidates.length - 1];
    console.log(`[GridFSService] findSectionTextOffset: ${candidates.length} start-anchor match(es) but no end-anchor match — using last at ${bestCandidate.normalizedIdx}`);
  }

  const normalizedIdx = bestCandidate.normalizedIdx;

  // Map normalizedDoc position back to raw docText position
  let normPos = 0;
  let lastWasSpace = false;
  let rawStartOffset = -1;

  for (let i = 0; i < docText.length; i++) {
    const isSpace = /\s/.test(docText[i]);
    if (isSpace && lastWasSpace) continue;
    lastWasSpace = isSpace;

    if (normPos === normalizedIdx) {
      rawStartOffset = i;
      break;
    }
    normPos++;
  }

  if (rawStartOffset === -1) return null;

  // Determine text length: find where the section text ends in the raw docText
  const normalizedFromStart = docText.substring(rawStartOffset).replace(/\s+/g, ' ');
  const sectionEndInNormalized = normalizedFromStart.indexOf(endAnchor);

  let rawTextLength: number;
  if (sectionEndInNormalized !== -1) {
    // Map the normalized end position back to raw text length
    const normalizedEndPos = sectionEndInNormalized + endAnchorLen;
    let np = 0;
    let ls = false;
    let rawEnd = 0;
    const subText = docText.substring(rawStartOffset);
    for (let i = 0; i < subText.length; i++) {
      const isSp = /\s/.test(subText[i]);
      if (isSp && ls) continue;
      ls = isSp;
      if (np === normalizedEndPos) { rawEnd = i; break; }
      np++;
    }
    rawTextLength = rawEnd > 0 ? rawEnd : normalizedSection.length;
  } else {
    // Fallback: use the section's normalized text length
    rawTextLength = normalizedSection.length;
  }

  console.log(`[GridFSService] findSectionTextOffset: found at textOffset=${rawStartOffset}, textLength=${rawTextLength} (${candidates.length} candidate(s))`);
  return { textOffset: rawStartOffset, textLength: rawTextLength };
}

/**
 * Insert an HTML comment marker into the stored HTML at a specific text offset,
 * replacing the extracted text range. This allows large documents to have
 * placeholder positions embedded without transferring the full HTML over REST.
 *
 * @param importId - The import ID
 * @param marker - The HTML comment string to insert
 * @param textStartOffset - Character offset in the plain text
 * @param textLength - Length of text to replace
 * @returns true if successful
 */
export async function insertHtmlMarker(
  importId: string,
  marker: string,
  textStartOffset: number,
  textLength: number
): Promise<{ success: boolean; removedHtml?: string; htmlContextBefore?: string; htmlContextAfter?: string; wasTableExpanded?: boolean }> {
  // Read the current HTML
  console.log(`[GridFSService] insertHtmlMarker: reading HTML for import ${importId}...`);
  const readStart = Date.now();
  const html = await getHtmlContent(importId);
  console.log(`[GridFSService] insertHtmlMarker: read ${html.length} chars in ${Date.now() - readStart}ms. ` +
    `Looking for textOffset=${textStartOffset}, textLength=${textLength}`);

  // Walk the HTML to find the byte position corresponding to the text offset.
  // We need to map from "text character offset" to "HTML string position"
  // by counting only non-tag text characters.
  // HTML entities like &amp; count as 1 text character (browser renders them as single chars).
  let textPos = 0;
  let htmlStartPos = -1;
  let htmlEndPos = -1;
  let inTag = false;

  for (let i = 0; i < html.length; i++) {
    const ch = html[i];

    if (ch === '<') {
      // Check for HTML comment - skip entirely
      if (html.substring(i, i + 4) === '<!--') {
        const commentEnd = html.indexOf('-->', i + 4);
        if (commentEnd !== -1) {
          i = commentEnd + 2; // skip to end of -->
          continue;
        }
      }
      inTag = true;
      continue;
    }
    if (ch === '>' && inTag) {
      inTag = false;
      continue;
    }
    if (inTag) continue;

    // We're in text content
    if (textPos === textStartOffset) {
      htmlStartPos = i;
    }

    // Handle HTML entities (e.g., &amp; &lt; &#123;) — browser renders as 1 char
    if (ch === '&') {
      const semiIdx = html.indexOf(';', i + 1);
      if (semiIdx !== -1 && semiIdx - i <= 10) {
        // This is an entity — counts as 1 text character
        textPos++;
        if (textPos === textStartOffset + textLength) {
          htmlEndPos = semiIdx + 1;
          break;
        }
        i = semiIdx; // skip to end of entity
        continue;
      }
    }

    textPos++;
    if (textPos === textStartOffset + textLength) {
      htmlEndPos = i + 1;
      break;
    }
  }

  console.log(`[GridFSService] insertHtmlMarker: scanned ${textPos} text chars, htmlStartPos=${htmlStartPos}, htmlEndPos=${htmlEndPos}`);

  if (htmlStartPos === -1) {
    console.log(`[GridFSService] Could not find text offset ${textStartOffset} in HTML (total text chars: ${textPos})`);
    return { success: false };
  }

  // If we didn't find the exact end, use what we have
  if (htmlEndPos === -1) {
    htmlEndPos = html.length;
    console.log(`[GridFSService] End offset extends beyond document, clamping to end`);
  }

  // Check if the range is inside a table — if so, expand to full <table>...</table>
  // boundaries to ensure clean round-tripping with restoreMarker.
  const isInsideTable = (pos: number): boolean => {
    const before = html.substring(Math.max(0, pos - 50000), pos);
    const lastTableOpen = before.lastIndexOf('<table');
    const lastTableClose = before.lastIndexOf('</table');
    if (lastTableOpen === -1) return false;
    return lastTableOpen > lastTableClose;
  };

  const startInTable = isInsideTable(htmlStartPos);
  const endInTable = isInsideTable(htmlEndPos);

  let expandedStart: number;
  let expandedEnd: number;

  if (startInTable || endInTable) {
    // TABLE-AWARE: expand to full <table>...</table> boundaries.
    // We replace the ENTIRE table with the marker — this ensures symmetric
    // round-tripping: restoreMarker can do a simple 1:1 replacement.
    // Previous approach (removing rows, placing marker before table) created
    // an asymmetry that corrupted HTML on restore.
    console.log(`[GridFSService] Text range is inside a table — expanding to full table boundaries`);

    const tableStart = html.lastIndexOf('<table', htmlStartPos);
    const tableEndTag = html.indexOf('</table>', htmlEndPos);

    if (tableStart !== -1 && tableEndTag !== -1) {
      expandedStart = tableStart;
      expandedEnd = tableEndTag + 8; // "</table>".length
      console.log(`[GridFSService] Full table expansion: ${expandedStart}-${expandedEnd} ` +
        `(original text range was ${htmlStartPos}-${htmlEndPos})`);
    } else {
      // Fallback: couldn't find table boundaries, use text range
      expandedStart = htmlStartPos;
      expandedEnd = htmlEndPos;
      console.warn(`[GridFSService] Could not find table boundaries, using text range`);
    }
  } else {
    // NON-TABLE: simple tag boundary expansion
    expandedStart = htmlStartPos;
    let checkPos = htmlStartPos - 1;
    while (checkPos >= 0 && html[checkPos] !== '>' && html[checkPos] !== '<') {
      checkPos--;
    }
    if (checkPos >= 0 && html[checkPos] === '<') {
      expandedStart = checkPos;
    }

    expandedEnd = htmlEndPos;
    checkPos = htmlEndPos;
    while (checkPos < html.length && html[checkPos] !== '<' && html[checkPos] !== '>') {
      checkPos++;
    }
    if (checkPos < html.length && html[checkPos] === '>') {
      expandedEnd = checkPos + 1;
    }
  }

  // Capture the exact HTML being removed (for accurate restoration)
  const removedHtml = html.substring(expandedStart, expandedEnd);
  const wasTableExpanded = startInTable || endInTable;

  // Capture HTML context around the insertion point (for fuzzy repair matching)
  const htmlContextBefore = html.substring(Math.max(0, expandedStart - 300), expandedStart);
  const htmlContextAfter = html.substring(expandedEnd, Math.min(html.length, expandedEnd + 300));

  // Build new HTML — simple replacement in all cases
  const newHtml = html.substring(0, expandedStart) + marker + html.substring(expandedEnd);

  const removedChars = expandedEnd - expandedStart;
  const snippet = removedHtml.substring(0, 100);
  console.log(`[GridFSService] Inserting marker at text offset ${textStartOffset} (HTML pos ${expandedStart}-${expandedEnd}), ` +
    `removed ${removedChars} chars, tableExpanded=${wasTableExpanded}, snippet: "${snippet.replace(/\n/g, '\\n').substring(0, 80)}..."`);

  // Store back to GridFS
  const writeStart = Date.now();
  await storeHtmlContent(importId, newHtml);
  console.log(`[GridFSService] Stored updated HTML (${newHtml.length} chars) in ${Date.now() - writeStart}ms`);

  return { success: true, removedHtml, htmlContextBefore, htmlContextAfter, wasTableExpanded };
}

/**
 * Pure function: find the HTML byte range for a text offset.
 * No GridFS I/O — operates on the in-memory HTML string.
 * Used by repairDocument to find all marker positions in a single pass.
 *
 * @param options.skipTableExpansion - When true, uses precise text boundaries
 *   instead of expanding to full table. Use for repair (multiple sections in
 *   same table need separate ranges). Default false for insertHtmlMarker compat.
 */
export function findHtmlRange(
  html: string,
  textStartOffset: number,
  textLength: number,
  options?: { skipTableExpansion?: boolean }
): { expandedStart: number; expandedEnd: number; removedHtml: string; splitBefore?: string; splitAfter?: string } | null {
  let textPos = 0;
  let htmlStartPos = -1;
  let htmlEndPos = -1;
  let inTag = false;

  for (let i = 0; i < html.length; i++) {
    const ch = html[i];

    if (ch === '<') {
      if (html.substring(i, i + 4) === '<!--') {
        const commentEnd = html.indexOf('-->', i + 4);
        if (commentEnd !== -1) {
          i = commentEnd + 2;
          continue;
        }
      }
      inTag = true;
      continue;
    }
    if (ch === '>' && inTag) {
      inTag = false;
      continue;
    }
    if (inTag) continue;

    if (textPos === textStartOffset) {
      htmlStartPos = i;
    }

    if (ch === '&') {
      const semiIdx = html.indexOf(';', i + 1);
      if (semiIdx !== -1 && semiIdx - i <= 10) {
        textPos++;
        if (textPos === textStartOffset + textLength) {
          htmlEndPos = semiIdx + 1;
          break;
        }
        i = semiIdx;
        continue;
      }
    }

    textPos++;
    if (textPos === textStartOffset + textLength) {
      htmlEndPos = i + 1;
      break;
    }
  }

  if (htmlStartPos === -1) return null;
  if (htmlEndPos === -1) htmlEndPos = html.length;

  // Table expansion
  const isInsideTable = (pos: number): boolean => {
    const before = html.substring(Math.max(0, pos - 50000), pos);
    const lastTableOpen = before.lastIndexOf('<table');
    const lastTableClose = before.lastIndexOf('</table');
    if (lastTableOpen === -1) return false;
    return lastTableOpen > lastTableClose;
  };

  let expandedStart: number;
  let expandedEnd: number;
  let splitBeforeHtml = '';
  let splitAfterHtml = '';

  if (!options?.skipTableExpansion && (isInsideTable(htmlStartPos) || isInsideTable(htmlEndPos))) {
    const tableStart = html.lastIndexOf('<table', htmlStartPos);
    const tableEndTag = html.indexOf('</table>', htmlEndPos);

    if (tableStart !== -1 && tableEndTag !== -1) {
      expandedStart = tableStart;
      expandedEnd = tableEndTag + 8;
    } else {
      expandedStart = htmlStartPos;
      expandedEnd = htmlEndPos;
    }
  } else {
    // Check if content is inside a table — if so, expand to row boundaries
    const startInTable = isInsideTable(htmlStartPos);
    const endInTable = isInsideTable(htmlEndPos);

    if (startInTable || endInTable) {
      // Table-splitting: find the full table, extract rows before/after the section,
      // and place the marker BETWEEN two complete table fragments.
      // This keeps markers outside tables (like initial insertion) while handling
      // multiple sections per table.
      const lowerHtml = html.toLowerCase();

      // Find the full table boundaries
      const tableStart = lowerHtml.lastIndexOf('<table', htmlStartPos);
      const tableEndSearch = lowerHtml.indexOf('</table>', htmlEndPos);
      const tableEnd = tableEndSearch !== -1 ? tableEndSearch + 8 : -1;

      if (tableStart !== -1 && tableEnd !== -1) {
        // Find the <tr> row boundaries for the section content
        // Use validated <tr matching (not <track, <transition, etc.)
        let trStart = htmlStartPos;
        while (trStart >= tableStart) {
          trStart = lowerHtml.lastIndexOf('<tr', trStart);
          if (trStart === -1 || trStart < tableStart) { trStart = -1; break; }
          const nextChar = lowerHtml[trStart + 3];
          if (nextChar === '>' || nextChar === ' ' || nextChar === '\n' || nextChar === '\t' || nextChar === '\r') {
            break; // Valid <tr> tag
          }
          trStart--;
        }

        let trEnd = htmlEndPos;
        const trEndTag = lowerHtml.indexOf('</tr>', trEnd);
        trEnd = trEndTag !== -1 ? trEndTag + 5 : htmlEndPos;

        if (trStart === -1) trStart = htmlStartPos;

        // Extract the table's opening tag and structural header (<colgroup>, <col>, <thead>)
        const tableOpenEnd = html.indexOf('>', tableStart) + 1;
        const tableOpenTag = html.substring(tableStart, tableOpenEnd);

        // Find structural elements (colgroup, col, thead, tbody) between <table> and first <tr>
        // These need to be duplicated into both split fragments
        let firstTrPos = tableStart + 6;
        while (firstTrPos < tableEnd) {
          firstTrPos = lowerHtml.indexOf('<tr', firstTrPos);
          if (firstTrPos === -1 || firstTrPos >= tableEnd) { firstTrPos = tableOpenEnd; break; }
          const nc = lowerHtml[firstTrPos + 3];
          if (nc === '>' || nc === ' ' || nc === '\n' || nc === '\t' || nc === '\r') break;
          firstTrPos++;
        }
        const structuralHtml = firstTrPos > tableOpenEnd
          ? html.substring(tableOpenEnd, firstTrPos)
          : '';

        // rowsBefore: content between structural header and first removed row
        const rowsBefore = html.substring(firstTrPos, trStart);
        // rowsAfter: content between last removed row and </table>
        const rowsAfter = html.substring(trEnd, tableEnd - 8); // before </table>

        const hasRowsBefore = rowsBefore.trim().length > 0;
        const hasRowsAfter = rowsAfter.trim().length > 0;

        // Replace the entire table with: [beforeTable] + marker + [afterTable]
        expandedStart = tableStart;
        expandedEnd = tableEnd;

        // Each fragment gets the table open tag + structural header + its rows
        splitBeforeHtml = hasRowsBefore
          ? tableOpenTag + structuralHtml + rowsBefore + '</table>'
          : '';
        splitAfterHtml = hasRowsAfter
          ? tableOpenTag + structuralHtml + rowsAfter + '</table>'
          : '';
      } else {
        // Couldn't find table boundaries, fall back to text boundaries
        expandedStart = htmlStartPos;
        expandedEnd = htmlEndPos;
      }
    } else {
      // Not in a table — simple tag boundary expansion
      expandedStart = htmlStartPos;
      let checkPos = htmlStartPos - 1;
      while (checkPos >= 0 && html[checkPos] !== '>' && html[checkPos] !== '<') {
        checkPos--;
      }
      if (checkPos >= 0 && html[checkPos] === '<') {
        expandedStart = checkPos;
      }

      expandedEnd = htmlEndPos;
      checkPos = htmlEndPos;
      while (checkPos < html.length && html[checkPos] !== '<' && html[checkPos] !== '>') {
        checkPos++;
      }
      if (checkPos < html.length && html[checkPos] === '>') {
        expandedEnd = checkPos + 1;
      }
    }
  }

  return {
    expandedStart,
    expandedEnd,
    removedHtml: html.substring(expandedStart, expandedEnd),
    splitBefore: splitBeforeHtml,
    splitAfter: splitAfterHtml
  };
}

/**
 * Restore a tagged section by replacing its HTML comment marker with original content.
 * Uses a two-pass streaming approach to handle large documents (300MB+) without OOM:
 *   Pass 1: Stream through to find marker byte position (low memory)
 *   Pass 2: Stream copy to new file, substituting marker with restored content
 */
export async function restoreMarker(
  importId: string,
  sectionId: string,
  htmlContent: string
): Promise<boolean> {
  const bucket = getBucket();
  const files = await bucket.find({ filename: `${importId}.html` }).toArray();
  if (files.length === 0) {
    console.log(`[GridFSService] restoreMarker: no HTML file for import ${importId}`);
    return false;
  }

  const file = files[0];
  const markerPrefixStr = `<!-- EXTRACTED:${sectionId}:`;
  const markerPrefix = Buffer.from(markerPrefixStr, 'utf-8');
  const markerSuffix = Buffer.from('-->', 'utf-8');

  console.log(`[GridFSService] restoreMarker: scanning ${file.length} bytes for section ${sectionId}`);

  // === Pass 1: Find marker byte position ===
  let markerByteStart = -1;
  let markerByteEnd = -1;

  await new Promise<void>((resolve, reject) => {
    const stream = bucket.openDownloadStream(file._id);
    let byteOffset = 0;
    let carryOver = Buffer.alloc(0); // carry-over for markers spanning chunk boundaries

    stream.on('data', (chunk: Buffer) => {
      if (markerByteStart !== -1 && markerByteEnd !== -1) return; // already found

      // Combine carry-over with current chunk for boundary searching
      const searchBuf = Buffer.concat([carryOver, chunk]);

      // Search for marker prefix
      if (markerByteStart === -1) {
        const prefixIdx = searchBuf.indexOf(markerPrefix);
        if (prefixIdx !== -1) {
          markerByteStart = byteOffset - carryOver.length + prefixIdx;

          // Now find the closing --> after the prefix
          const suffixIdx = searchBuf.indexOf(markerSuffix, prefixIdx + markerPrefix.length);
          if (suffixIdx !== -1) {
            markerByteEnd = byteOffset - carryOver.length + suffixIdx + markerSuffix.length;
            console.log(`[GridFSService] restoreMarker: found marker at bytes ${markerByteStart}-${markerByteEnd}`);
          }
        }
      } else if (markerByteEnd === -1) {
        // We found the prefix in a previous chunk but not the suffix yet
        const suffixIdx = searchBuf.indexOf(markerSuffix);
        if (suffixIdx !== -1) {
          markerByteEnd = byteOffset - carryOver.length + suffixIdx + markerSuffix.length;
          console.log(`[GridFSService] restoreMarker: found marker end at byte ${markerByteEnd}`);
        }
      }

      byteOffset += chunk.length;

      // Keep last 512 bytes as carry-over for boundary spanning
      if (markerByteStart === -1) {
        const overlapSize = Math.min(512, searchBuf.length);
        carryOver = searchBuf.subarray(searchBuf.length - overlapSize);
      } else if (markerByteEnd === -1) {
        carryOver = searchBuf; // keep accumulating until we find the end
      } else {
        carryOver = Buffer.alloc(0);
      }
    });

    stream.on('error', reject);
    stream.on('end', resolve);
  });

  if (markerByteStart === -1 || markerByteEnd === -1) {
    console.log(`[GridFSService] restoreMarker: marker not found for section ${sectionId} in ${file.length} bytes`);
    return false;
  }

  // === Pass 2: Stream copy with replacement ===
  // Write new file FIRST, then delete old file. This prevents data loss:
  // if we deleted first, the read cursor might lose access to chunks.
  // GridFS allows multiple files with the same filename (keyed by _id).
  const fileId = file._id;
  const restoredBuffer = Buffer.from(htmlContent, 'utf-8');
  const expectedSize = file.length - (markerByteEnd - markerByteStart) + restoredBuffer.length;

  const readStream = bucket.openDownloadStream(fileId);

  const newFileId = await new Promise<any>((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(`${importId}.html`, {
      metadata: {
        importId,
        contentType: 'text/html',
        uploadedAt: new Date(),
        size: expectedSize
      }
    });

    let byteOffset = 0;
    let restoredWritten = false;
    let totalWritten = 0;

    readStream.on('data', (chunk: Buffer) => {
      const chunkStart = byteOffset;
      const chunkEnd = byteOffset + chunk.length;

      if (chunkEnd <= markerByteStart || chunkStart >= markerByteEnd) {
        // Chunk entirely before or after marker — pass through
        uploadStream.write(chunk);
        totalWritten += chunk.length;
      } else {
        // Chunk overlaps the marker region
        if (chunkStart < markerByteStart) {
          const before = chunk.subarray(0, markerByteStart - chunkStart);
          uploadStream.write(before);
          totalWritten += before.length;
        }

        if (!restoredWritten) {
          uploadStream.write(restoredBuffer);
          totalWritten += restoredBuffer.length;
          restoredWritten = true;
        }

        if (chunkEnd > markerByteEnd) {
          const after = chunk.subarray(markerByteEnd - chunkStart);
          uploadStream.write(after);
          totalWritten += after.length;
        }
      }

      byteOffset += chunk.length;
    });

    readStream.on('error', reject);

    readStream.on('end', () => {
      uploadStream.end();
    });

    uploadStream.on('finish', () => {
      // Validate: check that we wrote the expected amount of data
      if (Math.abs(totalWritten - expectedSize) > 1) {
        console.error(`[GridFSService] restoreMarker: size mismatch! expected=${expectedSize}, written=${totalWritten}`);
        // Don't delete old file — keep it as fallback
        reject(new Error(`Restoration size mismatch: expected ${expectedSize} bytes, wrote ${totalWritten}`));
        return;
      }
      resolve(uploadStream.id);
    });
    uploadStream.on('error', reject);
  });

  // New file written successfully — now safe to delete the old one
  await bucket.delete(fileId);

  console.log(`[GridFSService] restoreMarker: restored ${htmlContent.length} chars for section ${sectionId} (${expectedSize} total bytes, newFileId=${newFileId})`);
  return true;
}

export default {
  storeHtmlContent,
  getHtmlContent,
  getHtmlContentStream,
  htmlContentExists,
  getHtmlContentMetadata,
  deleteHtmlContent,
  getStorageStats,
  insertHtmlMarker,
  restoreMarker,
  // Image functions
  storeImage,
  getImage,
  imageExists,
  deleteImportImages,
  listImportImages,
  // Cleanup
  cleanupOrphanedFiles
};
