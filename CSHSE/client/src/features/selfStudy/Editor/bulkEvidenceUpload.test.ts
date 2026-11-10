/**
 * Folder delivery (ETSU, Nov 2026): a whole evidence folder tree must upload —
 * batched under the server's 30-file cap, with each file's folder path, and
 * with OS junk (.DS_Store, ~$ lock files) skipped.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../../../services/api', () => ({ api: { post: vi.fn() } }));
import { api } from '../../../services/api';
import { entriesFromFileList, entriesFromDataTransfer, uploadEvidenceInBatches, isJunkFile, BULK_BATCH_SIZE } from './bulkEvidenceUpload';

const post = api.post as unknown as ReturnType<typeof vi.fn>;
const f = (name: string, rel?: string) => {
  const file = new File(['x'], name, { type: 'application/pdf' });
  if (rel) Object.defineProperty(file, 'webkitRelativePath', { value: rel });
  return file;
};
beforeEach(() => { post.mockReset(); });

describe('isJunkFile', () => {
  it('skips OS/editor junk only', () => {
    expect(isJunkFile('A/.DS_Store')).toBe(true);
    expect(isJunkFile('~$Draft.docx')).toBe(true);
    expect(isJunkFile('Thumbs.db')).toBe(true);
    expect(isJunkFile('Standard 13/BG4BN2.pdf')).toBe(false);
    expect(isJunkFile('HDAL 4011_Sp26_ Discussion Board Topics.pdf')).toBe(false);
  });
});

describe('entriesFromFileList (folder pick)', () => {
  it('keeps the relative path and drops junk', () => {
    const e = entriesFromFileList([f('x.pdf', 'ETSU/Standard 13/x.pdf'), f('.DS_Store', 'ETSU/.DS_Store'), f('y.pdf')]);
    expect(e.map((x) => x.path)).toEqual(['ETSU/Standard 13/x.pdf', 'y.pdf']);
  });
});

describe('entriesFromDataTransfer (dropped folder)', () => {
  it('walks a dropped directory recursively, reading every readEntries page', async () => {
    const fileEntry = (file: File) => ({ isFile: true, isDirectory: false, name: file.name, file: (ok: any) => ok(file) });
    const dirEntry = (name: string, pages: any[][]) => {
      let i = 0;
      return { isFile: false, isDirectory: true, name, createReader: () => ({ readEntries: (ok: any) => ok(pages[i++] || []) }) };
    };
    const std13 = dirEntry('Standard 13', [[fileEntry(f('a.pdf'))], [fileEntry(f('b.pdf'))]]);
    const root = dirEntry('ETSU', [[std13, fileEntry(f('.DS_Store')), fileEntry(f('Draft.docx'))]]);
    const dt: any = { items: [{ kind: 'file', webkitGetAsEntry: () => root }], files: [] };
    const e = await entriesFromDataTransfer(dt);
    expect(e.map((x) => x.path)).toEqual(['ETSU/Standard 13/a.pdf', 'ETSU/Standard 13/b.pdf', 'ETSU/Draft.docx']);
  });
});

describe('uploadEvidenceInBatches', () => {
  it(`splits 383 files into batches of ${BULK_BATCH_SIZE}, each with its paths, and merges results`, async () => {
    post.mockImplementation(async (_u: string, form: FormData) => {
      const names = (form.getAll('files') as File[]).map((x) => x.name);
      const paths = JSON.parse(String(form.get('paths')));
      expect(paths.length).toBe(names.length);
      expect(names.length).toBeLessThanOrEqual(30);
      return { data: { count: names.length, added: names.map((n) => ({ fileName: n, placedStd: '13' })), skipped: [] } };
    });
    const entries = Array.from({ length: 383 }, (_, i) => ({ file: f(`f${i}.pdf`), path: `Standard 13/f${i}.pdf` }));
    const progress: number[] = [];
    const out = await uploadEvidenceInBatches('sub1', entries, (done) => progress.push(done));
    expect(post).toHaveBeenCalledTimes(Math.ceil(383 / BULK_BATCH_SIZE));
    expect(out.count).toBe(383);
    expect(out.rows).toHaveLength(383);
    expect(progress[progress.length - 1]).toBe(383);
  });
  it('a failed batch does not stop the rest; its files are reported as not uploaded', async () => {
    let n = 0;
    post.mockImplementation(async (_u: string, form: FormData) => {
      n += 1;
      if (n === 1) throw Object.assign(new Error('timeout'), { response: { data: { error: 'Gateway timeout' } } });
      const names = (form.getAll('files') as File[]).map((x) => x.name);
      return { data: { count: names.length, added: names.map((x) => ({ fileName: x })), skipped: [] } };
    });
    const entries = Array.from({ length: 15 }, (_, i) => ({ file: f(`f${i}.pdf`), path: `D/f${i}.pdf` }));
    const out = await uploadEvidenceInBatches('sub1', entries);
    expect(out.failedBatches).toBe(1);
    expect(out.rows.filter((r) => r.error === 'Gateway timeout')).toHaveLength(BULK_BATCH_SIZE);
    expect(out.count).toBe(15 - BULK_BATCH_SIZE);
  });
  it('a batch the proxy cut off (524) is re-sent once; files the server already stored count as uploaded', async () => {
    let n = 0;
    post.mockImplementation(async (_u: string, form: FormData) => {
      n += 1;
      const names = (form.getAll('files') as File[]).map((x) => x.name);
      if (n === 1) throw Object.assign(new Error('524'), { response: { status: 524, data: {} } });
      // the re-send: the server finished the first attempt → duplicates
      return { data: { count: 0, added: names.map((x) => ({ fileName: x, duplicateOf: 'ev1', placedStd: '6', placedSpec: 'a' })), skipped: [] } };
    });
    const entries = Array.from({ length: 3 }, (_, i) => ({ file: f(`cv${i}.pdf`), path: `Faculty CVs/cv${i}.pdf` }));
    const out = await uploadEvidenceInBatches('sub1', entries);
    expect(post).toHaveBeenCalledTimes(2);
    expect(out.failedBatches).toBe(0);
    expect(out.count).toBe(3);
    expect(out.rows.every((r) => !r.duplicateOf && !r.error && r.placedStd === '6')).toBe(true);
  });
  it('a real rejection (400) is not re-sent', async () => {
    post.mockRejectedValue(Object.assign(new Error('bad'), { response: { status: 400, data: { error: 'None of the selected files can be uploaded.' } } }));
    const out = await uploadEvidenceInBatches('sub1', [{ file: f('a.exe'), path: 'a.exe' }]);
    expect(post).toHaveBeenCalledTimes(1);
    expect(out.failedBatches).toBe(1);
  });
});
