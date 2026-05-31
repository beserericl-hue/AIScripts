import { Request, Response } from 'express';
import { BugReport } from '../models/BugReport';

// ---------------------------------------------------------------------------
// CR-016 / Sprint 7.2 — In-app bug reports.
//
// POST  /api/bug-reports       — any authenticated user (incl. impersonating
//                                superuser) submits a report
// GET   /api/admin/bug-reports — admin / superuser only; paged list newest-first
// PATCH /api/admin/bug-reports/:id — admin/superuser updates status + triageNote
//
// Sensitive-token scrub: even though the client is supposed to filter,
// the server applies a tiny safety regex over the persisted text fields.
// ---------------------------------------------------------------------------

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    isSuperuser?: boolean;
  };
}

// Match Bearer tokens, JWT-ish triples, AWS-key shapes, basic-auth secrets.
const SECRET_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._\-]+/gi,
  /[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g, // JWT-ish
  /AKIA[0-9A-Z]{16}/g,
  /(?:password|secret|api[_-]?key)\s*[:=]\s*["']?[^"'\s]+/gi
];

function _scrub(s: string): string {
  let out = s;
  for (const re of SECRET_PATTERNS) {
    out = out.replace(re, '[REDACTED]');
  }
  return out;
}

function _isElevated(req: AuthenticatedRequest): boolean {
  return req.user?.role === 'admin' || req.user?.isSuperuser === true;
}

function _actorName(req: AuthenticatedRequest): string {
  if (req.user?.name) return req.user.name;
  const first = req.user?.firstName || '';
  const last = req.user?.lastName || '';
  const full = `${first} ${last}`.trim();
  return full || req.user?.email || 'unknown';
}

export const createBugReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const b = req.body || {};
    if (typeof b.description !== 'string' || !b.description.trim()) {
      return res.status(400).json({ error: 'description is required' });
    }
    if (typeof b.route !== 'string' || !b.route.trim()) {
      return res.status(400).json({ error: 'route is required' });
    }
    if (typeof b.userAgent !== 'string' || !b.userAgent.trim()) {
      return res.status(400).json({ error: 'userAgent is required' });
    }

    const errs = Array.isArray(b.recentConsoleErrors)
      ? b.recentConsoleErrors
          .slice(-10) // last 10 only
          .filter((e: any) => e && typeof e.message === 'string')
          .map((e: any) => ({
            message: _scrub(String(e.message)).slice(0, 1024),
            ts: e.ts ? new Date(e.ts) : undefined
          }))
      : undefined;

    const report = await BugReport.create({
      description: _scrub(b.description).slice(0, 4096),
      route: String(b.route).slice(0, 1024),
      userAgent: String(b.userAgent).slice(0, 512),
      buildSha: typeof b.buildSha === 'string' ? b.buildSha.slice(0, 64) : undefined,
      reporterId: req.user.id as any,
      reporterName: _actorName(req).slice(0, 200),
      reporterRole: req.user.role,
      reporterEmail: req.user.email,
      recentConsoleErrors: errs,
      status: 'new'
    });

    return res.status(201).json({
      reference: String(report._id),
      message: 'Thanks — the team will look at this.',
      createdAt: report.createdAt
    });
  } catch (err) {
    console.error('createBugReport error:', err);
    return res.status(500).json({ error: 'Failed to submit bug report' });
  }
};

export const listBugReports = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!_isElevated(req)) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const limitRaw = parseInt(String(req.query.limit || '50'), 10) || 50;
    const limit = Math.min(Math.max(limitRaw, 1), 200);
    const filter: any = {};
    if (status && ['new', 'triaged', 'resolved', 'dismissed'].includes(status)) {
      filter.status = status;
    }
    const rows = await BugReport.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
    return res.json({ reports: rows, count: rows.length });
  } catch (err) {
    console.error('listBugReports error:', err);
    return res.status(500).json({ error: 'Failed to list bug reports' });
  }
};

export const updateBugReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!_isElevated(req)) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const { id } = req.params;
    const b = req.body || {};
    const report = await BugReport.findById(id);
    if (!report) return res.status(404).json({ error: 'Bug report not found' });
    if (b.status !== undefined) {
      if (!['new', 'triaged', 'resolved', 'dismissed'].includes(b.status)) {
        return res.status(400).json({ error: 'invalid status' });
      }
      report.status = b.status;
    }
    if (typeof b.triageNote === 'string') {
      report.triageNote = b.triageNote.slice(0, 2048);
    }
    await report.save();
    return res.json({ report });
  } catch (err) {
    console.error('updateBugReport error:', err);
    return res.status(500).json({ error: 'Failed to update bug report' });
  }
};
