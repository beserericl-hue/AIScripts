import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';

let s3Client: S3Client | null = null;

/**
 * Lazy-initialize and return the S3 client singleton.
 * Reads credentials from Railway-injected environment variables.
 */
function getS3Client(): S3Client {
  if (!s3Client) {
    const endpoint = process.env.AWS_ENDPOINT_URL;
    const region = process.env.AWS_DEFAULT_REGION || 'us-east-1';
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (!endpoint || !accessKeyId || !secretAccessKey) {
      throw new Error(
        'S3 credentials not configured. Required env vars: AWS_ENDPOINT_URL, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY'
      );
    }

    s3Client = new S3Client({
      endpoint,
      region,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true, // Required for Railway / non-AWS S3-compatible storage
    });

    console.log('[S3Service] Initialized S3 client', { endpoint, region });
  }
  return s3Client;
}

/**
 * Get the bucket name from environment.
 */
function getBucketName(): string {
  const bucket = process.env.AWS_S3_BUCKET_NAME;
  if (!bucket) {
    throw new Error('AWS_S3_BUCKET_NAME environment variable is required');
  }
  return bucket;
}

/**
 * Sanitize a filename for use in S3 keys.
 * Removes special characters but keeps the extension.
 */
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_');
}

/**
 * Generate the S3 object key for a file.
 * Structure: {institutionId}/{versionId}/{filename}
 *
 * S3 has no real directories — the "/" in the key implicitly
 * creates the folder structure when browsing.
 */
export function generateS3Key(
  institutionId: string,
  versionId: string,
  filename: string
): string {
  const safe = sanitizeFilename(filename);
  return `${institutionId}/${versionId}/${safe}`;
}

/**
 * Upload a file buffer to S3 (PutObject).
 */
export async function uploadFile(
  key: string,
  buffer: Buffer,
  mimeType: string
): Promise<{ key: string; bucket: string }> {
  const client = getS3Client();
  const bucket = getBucketName();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    })
  );

  console.log(`[S3Service] Uploaded: ${key} (${buffer.length} bytes)`);
  return { key, bucket };
}

/**
 * Download a file from S3 (GetObject).
 * Returns a readable stream and metadata.
 */
export async function downloadFile(
  key: string
): Promise<{ stream: Readable; contentType?: string; contentLength?: number }> {
  const client = getS3Client();
  const bucket = getBucketName();

  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );

  if (!response.Body) {
    throw new Error(`S3 returned empty body for key: ${key}`);
  }

  // AWS SDK v3 returns Body as a Readable stream (Node.js) or ReadableStream (browser)
  const stream = response.Body as Readable;

  return {
    stream,
    contentType: response.ContentType,
    contentLength: response.ContentLength,
  };
}

/**
 * Delete a file from S3 (DeleteObject).
 */
export async function deleteFile(key: string): Promise<void> {
  const client = getS3Client();
  const bucket = getBucketName();

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );

  console.log(`[S3Service] Deleted: ${key}`);
}

/**
 * List files under a prefix (ListObjectsV2).
 * Useful for browsing an institution's files or building a File Library.
 */
export async function listFiles(
  prefix: string,
  maxKeys: number = 1000
): Promise<{ key: string; size: number; lastModified?: Date }[]> {
  const client = getS3Client();
  const bucket = getBucketName();

  const response = await client.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      MaxKeys: maxKeys,
    })
  );

  return (response.Contents || []).map((obj) => ({
    key: obj.Key || '',
    size: obj.Size || 0,
    lastModified: obj.LastModified,
  }));
}

/**
 * Check if S3 is configured (env vars present).
 * Returns false if credentials are missing — callers can fall back to base64.
 */
export function isS3Configured(): boolean {
  return !!(
    process.env.AWS_ENDPOINT_URL &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_S3_BUCKET_NAME
  );
}
