import { api } from '../../services/api';

/**
 * Where the admin dashboard's deadlines-table "eye" goes: the institution's
 * most recent self-study, or its Settings entry when it has none yet.
 */
export async function institutionSelfStudyPath(institutionId: string): Promise<string> {
  try {
    const r = await api.get('/api/submissions', { params: { institutionId, limit: 1 } });
    const list = r.data?.submissions || [];
    const sid = list[0]?._id;
    if (sid) return `/self-study/${sid}`;
  } catch {
    /* fall through to the institution's settings */
  }
  return '/admin/settings?section=institutions';
}
