import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { AuditLogEntry } from '../models/AuditLogEntry';

// ---------------------------------------------------------------------------
// CR-020 / Sprint 7.3 — admin audit-trail surface.
//
// GET /api/admin/audit-log
//   - admin / superuser only
//   - filters: action (single or comma-list), actorId, targetId,
//     submissionId, since (ISO), until (ISO)
//   - newest-first; limit clamped to [1, 500]; offset for paging
//
// GET /api/admin/audit-log/export.csv
//   - same filters; streams CSV (sized by the limit; max 10k rows)
//
// Append-only invariant lives at the model layer (no update / delete
// endpoint here).
// ---------------------------------------------------------------------------

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    isSuperuser?: boolean;
  };
}

function _isElevated(req: AuthenticatedRequest): boolean {
  return req.user?.role === 'admin' || req.user?.isSuperuser === true;
}

function _buildFilter(req: AuthenticatedRequest): { ok: true; query: any } | { ok: false; error: string } {
  const q: any = {};
  const action = typeof req.query.action === 'string' ? req.query.action : undefined;
  if (action) {
    const list = action.split(',').map((s) => s.trim()).filter(Boolean);
    q.action = list.length === 1 ? list[0] : { $in: list };
  }
  const actorId = typeof req.query.actorId === 'string' ? req.query.actorId : undefined;
  if (actorId) {
    if (!mongoose.Types.ObjectId.isValid(actorId)) {
      return { ok: false, error: 'actorId is not a valid ObjectId' };
    }
    q.actorId = new mongoose.Types.ObjectId(actorId);
  }
  const targetId = typeof req.query.targetId === 'string' ? req.query.targetId : undefined;
  if (targetId) q.targetId = targetId;
  const submissionId = typeof req.query.submissionId === 'string' ? req.query.submissionId : undefined;
  if (submissionId) {
    if (!mongoose.Types.ObjectId.isValid(submissionId)) {
      return { ok: false, error: 'submissionId is not a valid ObjectId' };
    }
    q.submissionId = new mongoose.Types.ObjectId(submissionId);
  }
  const since = typeof req.query.since === 'string' ? new Date(req.query.since) : null;
  const until = typeof req.query.until === 'string' ? new Date(req.query.until) : null;
  if (since && !Number.isNaN(since.getTime())) {
    q.timestamp = q.timestamp || {};
    q.timestamp.$gte = since;
  }
  if (until && !Number.isNaN(until.getTime())) {
    q.timestamp = q.timestamp || {};
    q.timestamp.$lte = until;
  }
  return { ok: true, query: q };
}

export const listAuditEntries = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!_isElevated(req)) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const f = _buildFilter(req);
    if (!f.ok) return res.status(400).json({ error: f.error });

    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '100'), 10) || 100, 1), 500);
    const offset = Math.max(parseInt(String(req.query.offset || '0'), 10) || 0, 0);

    const [rows, total] = await Promise.all([
      AuditLogEntry.find(f.query)
        .sort({ timestamp: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      AuditLogEntry.countDocuments(f.query)
    ]);

    return res.json({
      entries: rows,
      total,
      limit,
      offset,
      hasMore: offset + rows.length < total
    });
  } catch (err) {
    console.error('listAuditEntries error:', err);
    return res.status(500).json({ error: 'Failed to load audit log' });
  }
};

function _csvEscape(v: unknown): string {
  if (v === undefined || v === null) return '';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export const exportAuditCsv = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!_isElevated(req)) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const f = _buildFilter(req);
    if (!f.ok) return res.status(400).json({ error: f.error });

    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '10000'), 10) || 10000, 1), 10000);
    const rows = await AuditLogEntry.find(f.query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    const header = [
      'timestamp',
      'action',
      'actorName',
      'actorRole',
      'targetType',
      'targetId',
      'submissionId',
      'reason',
      'payload'
    ].join(',');

    const body = rows.map((r: any) =>
      [
        r.timestamp ? new Date(r.timestamp).toISOString() : '',
        r.action,
        r.actorName,
        r.actorRole,
        r.targetType,
        r.targetId,
        r.submissionId || '',
        r.reason || '',
        r.payload ? JSON.stringify(r.payload) : ''
      ].map(_csvEscape).join(',')
    );

    const csv = [header, ...body].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.send(csv);
  } catch (err) {
    console.error('exportAuditCsv error:', err);
    return res.status(500).json({ error: 'Failed to export audit log' });
  }
};
