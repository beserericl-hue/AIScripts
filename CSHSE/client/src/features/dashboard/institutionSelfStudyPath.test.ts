import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw-server';
import { institutionSelfStudyPath } from './institutionSelfStudyPath';

describe('admin dashboard deadlines "eye"', () => {
  it('POSITIVE: opens the institution\'s latest self-study', async () => {
    let asked: string | null = null;
    server.use(http.get(/\/api\/submissions$/, ({ request }) => {
      asked = new URL(request.url).searchParams.get('institutionId');
      return HttpResponse.json({ submissions: [{ _id: 'subA' }], total: 1 });
    }));
    expect(await institutionSelfStudyPath('instA')).toBe('/self-study/subA');
    expect(asked).toBe('instA');
  });
  it('NEGATIVE: no self-study yet → the institution list in Settings', async () => {
    server.use(http.get(/\/api\/submissions$/, () => HttpResponse.json({ submissions: [], total: 0 })));
    expect(await institutionSelfStudyPath('instB')).toBe('/admin/settings?section=institutions');
  });
  it('NEGATIVE: lookup fails → Settings, not a broken page', async () => {
    server.use(http.get(/\/api\/submissions$/, () => HttpResponse.json({ error: 'x' }, { status: 500 })));
    expect(await institutionSelfStudyPath('instC')).toBe('/admin/settings?section=institutions');
  });
});
