/**
 * Curriculum-matrix exclusion (CSHSE board decision, Nov 2026).
 *
 * The board eliminated the curriculum matrix from the self-study: it is now a
 * prep tool used OUTSIDE the self-study. Programs may still have the old matrix
 * document lying around and upload it, so a file identified as a curriculum
 * matrix is KEPT in the File Library (it is the institution's file) but it is
 * NOT part of the self-study:
 *   - never indexed into the evidence vector store,
 *   - never gathered as evidence for an AI evaluation or coverage check,
 *   - never auto-placed / cross-referenced / filed under a Standard,
 *   - never listed to readers, nor in the Reader / Lead Reader report outputs.
 *
 * This module is the ONE place that decides what a curriculum-matrix document
 * is. Every exclusion point calls into it.
 */

/** Tag stamped on an excluded file so the client can label it in the File Library. */
export const CURRICULUM_MATRIX_EXCLUDED_TAG = 'excluded:curriculum-matrix';

/** Official CSHSE form title printed at the top of the (retired) matrix form. */
const MATRIX_FORM_TITLE_RE =
  /matrix\s+illustrating\s+relationship\s+of\s+required\s+courses\s+to\s+curriculum\s+standards/i;

/**
 * "matrix" / "matrices" as a word in a file name. Letters may not touch it on
 * either side ("matrixed"/"dematrix" don't match) but separators such as `_`,
 * `-`, `.` and digits do count as a boundary ("Curriculum_Matrix_2025.docx").
 */
const MATRIX_NAME_RE = /(?<![a-z])matri(?:x|ces)(?![a-z])/i;

/** Mongo-side equivalent of MATRIX_NAME_RE (Mongo's PCRE supports look-behind). */
export const CURRICULUM_MATRIX_NAME_REGEX = MATRIX_NAME_RE;

export function isCurriculumMatrixFileName(name: unknown): boolean {
  return typeof name === 'string' && MATRIX_NAME_RE.test(name);
}

export function isCurriculumMatrixText(text: unknown): boolean {
  if (typeof text !== 'string' || !text) return false;
  // The title sits at the top of the form; a bounded prefix keeps this cheap on
  // large extracts while tolerating a cover line or two before it.
  return MATRIX_FORM_TITLE_RE.test(text.slice(0, 20000));
}

/** True when a SupportingEvidence-shaped record (lean or hydrated) is a curriculum matrix. */
export function isCurriculumMatrixDocument(ev: any, extraText?: string | null): boolean {
  if (!ev && !extraText) return false;
  const tags: unknown[] = Array.isArray(ev?.tags) ? ev.tags : [];
  if (tags.some((t) => String(t) === CURRICULUM_MATRIX_EXCLUDED_TAG)) return true;
  if (isCurriculumMatrixFileName(ev?.file?.originalName)) return true;
  if (isCurriculumMatrixFileName(ev?.file?.filename)) return true;
  if (isCurriculumMatrixFileName(ev?.title)) return true;
  if (isCurriculumMatrixFileName(ev?.name)) return true;
  if (isCurriculumMatrixText(ev?.extractedText)) return true;
  if (isCurriculumMatrixText(ev?.metadata?.description)) return true; // hidden extracted body
  if (isCurriculumMatrixText(extraText)) return true;
  return false;
}

/** Drop curriculum-matrix documents from a list of evidence records. */
export function withoutCurriculumMatrixDocuments<T>(list: T[] | null | undefined): T[] {
  return (list || []).filter((e) => !isCurriculumMatrixDocument(e));
}

/**
 * Mongo filter fragment that excludes curriculum-matrix documents at query
 * level (by tag or by file name). Combine with `$and` so it never clobbers an
 * existing `tags` / `file.originalName` condition. Text-only matches are caught
 * by the tag, which is stamped as soon as the text is extracted.
 */
export function notCurriculumMatrixFilter(): Record<string, unknown> {
  return {
    $and: [
      { tags: { $ne: CURRICULUM_MATRIX_EXCLUDED_TAG } },
      { 'file.originalName': { $not: CURRICULUM_MATRIX_NAME_REGEX } },
    ],
  };
}

/**
 * Apply the exclusion to a hydrated SupportingEvidence document in place:
 * tag it and un-assign it from any Standard / specification and from any
 * pending AI placement. Returns true when the document is a curriculum matrix.
 * Called from the model's pre-save hook, so EVERY create/save path is covered.
 */
export function applyCurriculumMatrixExclusion(doc: any): boolean {
  if (!isCurriculumMatrixDocument(doc)) return false;
  const tags: string[] = Array.isArray(doc.tags) ? doc.tags.map(String) : [];
  if (!tags.includes(CURRICULUM_MATRIX_EXCLUDED_TAG)) {
    doc.tags = [...tags, CURRICULUM_MATRIX_EXCLUDED_TAG];
  }
  if (doc.standardCode) doc.standardCode = undefined;
  if (doc.specCode) doc.specCode = undefined;
  if (doc.metadata?.aiPlacement) {
    doc.metadata.aiPlacement = undefined;
    if (typeof doc.markModified === 'function') doc.markModified('metadata');
  }
  return true;
}

/** The `$set`/`$unset`/`$addToSet` update that marks an already-stored file as excluded. */
export function curriculumMatrixExclusionUpdate(): Record<string, unknown> {
  return {
    $addToSet: { tags: CURRICULUM_MATRIX_EXCLUDED_TAG },
    $unset: { standardCode: '', specCode: '', 'metadata.aiPlacement': '' },
  };
}
