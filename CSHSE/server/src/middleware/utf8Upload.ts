/**
 * Multer with correct non-ASCII file names.
 *
 * Browsers send multipart file names as UTF-8 bytes, but multer 1.x lets
 * busboy decode them as latin1, so "Program Differentiators – ETSU.pdf"
 * arrived as "Program Differentiators â\u0080\u0093 ETSU.pdf" and
 * "MASTER’S" as "MASTERâ\u0080\u0099S". utf8Upload() is a drop-in for multer()
 * whose .single/.array/.fields/.any/.none repair req.file(s).originalname
 * right after multer has parsed the request — so every upload path stores
 * the name the user actually chose.
 */
import multer from 'multer';
import type { RequestHandler } from 'express';

/**
 * Re-decode a name that was decoded as latin1 but is really UTF-8. A name is
 * only changed when its latin1 bytes form valid UTF-8, so a genuine latin1
 * name (or an already-correct one) is returned unchanged.
 */
export function fixUploadFilename(name: string): string {
  const s = String(name ?? '');
  // Only characters U+0080..U+00FF can be mis-decoded UTF-8 bytes; anything
  // above U+00FF means the string was already decoded as Unicode.
  if (!/[\u0080-ÿ]/.test(s) || /[^\u0000-ÿ]/.test(s)) return s;
  const fixed = Buffer.from(s, 'latin1').toString('utf8');
  if (fixed.includes('�')) return s;
  return fixed.normalize('NFC');
}

function fixFiles(req: any): void {
  if (req.file && typeof req.file.originalname === 'string') req.file.originalname = fixUploadFilename(req.file.originalname);
  const files = req.files;
  const list: any[] = Array.isArray(files) ? files : files && typeof files === 'object' ? Object.values(files).flat() : [];
  for (const f of list) if (f && typeof f.originalname === 'string') f.originalname = fixUploadFilename(f.originalname);
}

function wrap(mw: RequestHandler): RequestHandler {
  return (req, res, next) =>
    mw(req, res, (err?: any) => {
      if (!err) fixFiles(req);
      next(err);
    });
}

export function utf8Upload(options?: multer.Options): multer.Multer {
  const m = multer(options);
  return {
    single: (name: string) => wrap(m.single(name)),
    array: (name: string, max?: number) => wrap(m.array(name, max)),
    fields: (fields: readonly multer.Field[]) => wrap(m.fields(fields)),
    any: () => wrap(m.any()),
    none: () => wrap(m.none()),
  } as multer.Multer;
}
