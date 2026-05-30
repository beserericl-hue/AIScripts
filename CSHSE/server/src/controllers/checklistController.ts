import { Request, Response } from 'express';
import mongoose from 'mongoose';
import {
  SiteVisitChecklistItem,
  ChecklistInclusionReason
} from '../models/SiteVisitChecklistItem';
import { Submission } from '../models/Submission';
import { recordAuditEvent } from '../services/auditLog';
import { generateChecklistDocx } from '../services/siteVisitChecklistDocx';

// ---------------------------------------------------------------------------
// CR-012 / Sprint 6.1 — site-visit partial-compliance checklist.
//
// Endpoints:
//   GET    /api/submissions/:submissionId/checklist
//   POST   /api/submissions/:submissionId/checklist (manual add)
//   PATCH  /api/submissions/:submissionId/checklist/:itemId/verify
//   DELETE /api/submissions/:submissionId/checklist/:itemId
//   GET    /api/submissions/:submissionId/checklist/export.docx
//
// Role gates:
//   - read + verify + export: lead_reader / reader (assigned visit team) /
//     admin / superuser. PCs 403 — the partial-compliance list is a
//     reviewer-internal worksheet, not surface they should see.
//   - manual add + delete: lead_reader / admin / superuser only.
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

function _denyIfPC(req: AuthenticatedRequest, res: Response): boolean {
  if (req.user?.role === 'program_coordinator') {
    res.status(403).json({ error: 'Program coordinators cannot access the site-visit checklist' });
    return true;
  }
  return false;
}

function _canRead(role: string): boolean {
  return role === 'reader' || role === 'lead_reader' || role === 'admin';
}

function _canWrite(role: string, isSuperuser?: boolean): boolean {
  return role === 'lead_reader' || role === 'admin' || isSuperuser === true;
}

function _actorName(req: AuthenticatedRequest): string {
  if (req.user?.name) return req.user.name;
  const first = req.user?.firstName || '';
  const last = req.user?.lastName || '';
  const full = `${first} ${last}`.trim();
  return full || req.user?.email || 'unknown';
}

export const listChecklist = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (_denyIfPC(req, res)) return;
    if (!_canRead(req.user?.role || '') && !req.user?.isSuperuser) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const { submissionId } = req.params;
    const submission = await Submission.findById(submissionId).lean();
    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    const items = await SiteVisitChecklistItem.find({ submissionId }).lean();
    items.sort((a, b) => {
      if (a.standardCode !== b.standardCode) {
        return a.standardCode.localeCompare(b.standardCode, undefined, { numeric: true });
      }
      return a.specCode.localeCompare(b.specCode, undefined, { numeric: true });
    });

    const counts = {
      total: items.length,
      partial: items.filter((i) => i.inclusionReason === 'partial').length,
      non_compliant: items.filter((i) => i.inclusionReason === 'non_compliant').length,
      follow_up: items.filter((i) => i.inclusionReason === 'follow_up').length,
      manual: items.filter((i) => i.inclusionReason === 'manual').length,
      verified: items.filter((i) => i.verified).length
    };

    return res.json({
      submissionId: String(submission._id),
      institutionName: submission.institutionName,
      programName: submission.programName,
      programLevel: submission.programLevel,
      items,
      counts
    });
  } catch (err) {
    console.error('listChecklist error:', err);
    return res.status(500).json({ error: 'Failed to load checklist' });
  }
};

export const addManualChecklistItem = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (_denyIfPC(req, res)) return;
    if (!_canWrite(req.user?.role || '', req.user?.isSuperuser)) {
      return res.status(403).json({ error: 'Only lead readers and admins can add manual items' });
    }
    const { submissionId } = req.params;
    const { standardCode, specCode, inclusionReason = 'manual', note } = req.body || {};
    if (!standardCode || !specCode) {
      return res.status(400).json({ error: 'standardCode and specCode are required' });
    }
    const allowed: ChecklistInclusionReason[] = ['manual', 'follow_up'];
    if (!allowed.includes(inclusionReason)) {
      return res.status(400).json({ error: 'inclusionReason must be "manual" or "follow_up" for manual adds' });
    }

    // Upsert so the same (sub, std, spec) can't carry both a manual and an
    // auto row at the same time — manual wins (it carries the lead reader's
    // intent + any note already).
    const result = await SiteVisitChecklistItem.findOneAndUpdate(
      { submissionId: new mongoose.Types.ObjectId(submissionId), standardCode, specCode },
      {
        $set: {
          inclusionReason,
          source: 'manual',
          finalScoreAtInclusion: 0,
          addedByName: _actorName(req),
          ...(note ? { verificationNote: note } : {})
        },
        $setOnInsert: {
          submissionId: new mongoose.Types.ObjectId(submissionId),
          standardCode,
          specCode,
          verified: false
        }
      },
      { upsert: true, new: true, runValidators: true }
    );

    return res.status(201).json({ item: result });
  } catch (err) {
    console.error('addManualChecklistItem error:', err);
    return res.status(500).json({ error: 'Failed to add checklist item' });
  }
};

export const verifyChecklistItem = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (_denyIfPC(req, res)) return;
    if (!_canRead(req.user?.role || '') && !req.user?.isSuperuser) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const { submissionId, itemId } = req.params;
    const { verified, note } = req.body || {};
    if (typeof verified !== 'boolean') {
      return res.status(400).json({ error: 'verified (boolean) is required' });
    }

    const item = await SiteVisitChecklistItem.findOne({ _id: itemId, submissionId });
    if (!item) return res.status(404).json({ error: 'Checklist item not found' });

    const priorVerified = item.verified;
    item.verified = verified;
    if (typeof note === 'string') item.verificationNote = note;

    if (verified) {
      item.verifiedBy = new mongoose.Types.ObjectId(req.user!.id);
      item.verifiedByName = _actorName(req);
      item.verifiedAt = new Date();
    } else {
      item.verifiedBy = undefined;
      item.verifiedByName = undefined;
      item.verifiedAt = undefined;
    }

    await item.save();

    void recordAuditEvent({
      action: verified ? 'checklist.item_verified' : 'checklist.item_unverified',
      actor: { id: req.user!.id, role: req.user!.role, name: _actorName(req) },
      targetType: 'submission',
      targetId: String(submissionId),
      submissionId: String(submissionId),
      payload: {
        itemId: String(item._id),
        standardCode: item.standardCode,
        specCode: item.specCode,
        priorVerified,
        inclusionReason: item.inclusionReason
      },
      reason: typeof note === 'string' ? note : undefined
    });

    return res.json({ item });
  } catch (err) {
    console.error('verifyChecklistItem error:', err);
    return res.status(500).json({ error: 'Failed to verify checklist item' });
  }
};

export const deleteChecklistItem = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (_denyIfPC(req, res)) return;
    if (!_canWrite(req.user?.role || '', req.user?.isSuperuser)) {
      return res.status(403).json({ error: 'Only lead readers and admins can delete checklist items' });
    }
    const { submissionId, itemId } = req.params;
    const item = await SiteVisitChecklistItem.findOne({ _id: itemId, submissionId });
    if (!item) return res.status(404).json({ error: 'Checklist item not found' });
    await item.deleteOne();
    return res.json({ message: 'Checklist item deleted' });
  } catch (err) {
    console.error('deleteChecklistItem error:', err);
    return res.status(500).json({ error: 'Failed to delete checklist item' });
  }
};

export const exportChecklistDocx = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (_denyIfPC(req, res)) return;
    if (!_canRead(req.user?.role || '') && !req.user?.isSuperuser) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const { submissionId } = req.params;
    const submission = await Submission.findById(submissionId).lean();
    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    const buffer = await generateChecklistDocx(submissionId);
    const safeName = String(submission.institutionName || 'submission')
      .replace(/[^a-zA-Z0-9_.-]+/g, '_')
      .slice(0, 60);
    const filename = `site_visit_checklist_${safeName}_${new Date().toISOString().slice(0, 10)}.docx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (err) {
    console.error('exportChecklistDocx error:', err);
    return res.status(500).json({ error: 'Failed to export checklist' });
  }
};
