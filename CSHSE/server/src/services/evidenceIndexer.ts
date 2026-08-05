import { SupportingEvidence } from '../models/SupportingEvidence';
import { extractEvidence, extractFileText } from './cshseAiClient';
import { isS3Configured } from './s3Service';

/**
 * Index ONE evidence file's CONTENT into the per-institution Qdrant evidence
 * collection (cshse_evidence_{env}) via cshse-ai: chunk + embed + upsert, keyed
 * by institutionId + submissionId + documentId. Best-effort; returns chunks
 * upserted (0 on skip/failure). PDFs are extracted full-text ai-service-side;
 * other types use the cached/extracted text.
 */
export async function indexEvidenceFile(institutionId: string, submissionId: string, ev: any): Promise<number> {
  const s3Key = ev?.file?.s3Key;
  const mime = ev?.file?.mimeType || '';
  const name = ev?.file?.originalName || ev?.title || 'file';
  const base = {
    institutionId: String(institutionId),
    submissionId: String(submissionId),
    documentId: String(ev._id),
    sourceFilename: name,
  };
  try {
    if (s3Key && mime === 'application/pdf' && isS3Configured()) {
      const out = await extractEvidence({ ...base, documentS3Key: s3Key, documentMimeType: 'application/pdf' });
      return out?.ready ? out.data.chunksUpserted || 0 : 0;
    }
    let text: string = typeof ev.extractedText === 'string' ? ev.extractedText : '';
    if (!text && s3Key && isS3Configured()) {
      try {
        const ex = await extractFileText({ s3Key, s3Bucket: process.env.AWS_S3_BUCKET_NAME || '', mimeType: mime, filename: name });
        text = ex?.text || '';
        if (text) await SupportingEvidence.updateOne({ _id: ev._id }, { $set: { extractedText: text.slice(0, 6000) } }).catch(() => undefined);
      } catch { /* best-effort */ }
    }
    if (!text.trim()) return 0;
    const out = await extractEvidence({ ...base, markdown: text });
    return out?.ready ? out.data.chunksUpserted || 0 : 0;
  } catch (e) {
    console.warn('[evidenceIndexer] index failed for', name, ':', (e as any)?.message);
    return 0;
  }
}

/** Index ALL of a submission's non-deleted files (backfill), bounded concurrency. */
export async function indexAllForSubmission(institutionId: string, submissionId: string): Promise<{ files: number; chunks: number }> {
  const files: any[] = await SupportingEvidence.find({
    submissionId, isDeleted: { $ne: true }, 'file.s3Key': { $exists: true, $ne: null },
  }).lean();
  let chunks = 0, done = 0;
  const CONC = 4;
  for (let i = 0; i < files.length; i += CONC) {
    const batch = files.slice(i, i + CONC);
    const res = await Promise.all(batch.map((f) => indexEvidenceFile(String(institutionId), String(submissionId), f)));
    chunks += res.reduce((a, b) => a + (b || 0), 0);
    done += batch.length;
  }
  console.log(`[evidenceIndexer] indexed submission ${submissionId}: ${done} files, ${chunks} chunks`);
  return { files: done, chunks };
}
