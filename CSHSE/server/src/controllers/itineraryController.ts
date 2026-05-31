import { Request, Response } from 'express';
import mongoose from 'mongoose';
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  PageBreak
} from 'docx';
import { Submission } from '../models/Submission';
import { SiteVisit } from '../models/SiteVisit';
import { SiteVisitChecklistItem } from '../models/SiteVisitChecklistItem';
import { User } from '../models/User';
import { recordAuditEvent } from '../services/auditLog';

// ---------------------------------------------------------------------------
// CR-013 / Sprint 6.2 — Site-visit itinerary co-edit + DOCX export.
//
// Endpoints (under /api/submissions/:submissionId/itinerary):
//   GET   .                       — return the site visit + agenda
//   PUT   .                       — replace the agenda (co-edit: lead/PC/admin)
//   GET   /export.docx            — DOCX of the itinerary
//
// Co-edit rule (per CR spec): only the lead_reader assigned to the
// site visit AND the submission's PC (the submitter) can update.
// Other readers + board see read-only. Admin / superuser bypass.
// ---------------------------------------------------------------------------

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    isSuperuser?: boolean;
  };
}

function _actorName(req: AuthenticatedRequest): string {
  if (req.user?.name) return req.user.name;
  const first = req.user?.firstName || '';
  const last = req.user?.lastName || '';
  const full = `${first} ${last}`.trim();
  return full || req.user?.email || 'unknown';
}

function _isElevated(req: AuthenticatedRequest): boolean {
  return req.user?.role === 'admin' || req.user?.isSuperuser === true;
}

interface AgendaSlotInput {
  time?: unknown;
  activity?: unknown;
  participants?: unknown;
  location?: unknown;
  attendees?: unknown;
  specCodes?: unknown;
  checklistItemIds?: unknown;
  notes?: unknown;
}

function _validateAgenda(input: unknown): { ok: true; agenda: any[] } | { ok: false; error: string } {
  if (!Array.isArray(input)) return { ok: false, error: 'agenda must be an array' };
  const out: any[] = [];
  for (let i = 0; i < input.length; i++) {
    const raw = input[i] as AgendaSlotInput;
    if (!raw || typeof raw !== 'object') return { ok: false, error: `agenda[${i}] must be an object` };
    if (typeof raw.time !== 'string' || !raw.time.trim()) {
      return { ok: false, error: `agenda[${i}].time is required` };
    }
    if (typeof raw.activity !== 'string' || !raw.activity.trim()) {
      return { ok: false, error: `agenda[${i}].activity is required` };
    }
    const slot: any = { time: raw.time.trim(), activity: raw.activity.trim() };
    if (typeof raw.participants === 'string') slot.participants = raw.participants;
    if (typeof raw.location === 'string') slot.location = raw.location;
    if (typeof raw.notes === 'string') slot.notes = raw.notes;
    if (raw.attendees !== undefined) {
      if (!Array.isArray(raw.attendees) || raw.attendees.some((x) => typeof x !== 'string')) {
        return { ok: false, error: `agenda[${i}].attendees must be an array of strings` };
      }
      slot.attendees = raw.attendees;
    }
    if (raw.specCodes !== undefined) {
      if (!Array.isArray(raw.specCodes) || raw.specCodes.some((x) => typeof x !== 'string')) {
        return { ok: false, error: `agenda[${i}].specCodes must be an array of strings` };
      }
      slot.specCodes = raw.specCodes;
    }
    if (raw.checklistItemIds !== undefined) {
      if (!Array.isArray(raw.checklistItemIds)) {
        return { ok: false, error: `agenda[${i}].checklistItemIds must be an array` };
      }
      const ids: mongoose.Types.ObjectId[] = [];
      for (const id of raw.checklistItemIds) {
        if (typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
          return { ok: false, error: `agenda[${i}].checklistItemIds contains an invalid id` };
        }
        ids.push(new mongoose.Types.ObjectId(id));
      }
      slot.checklistItemIds = ids;
    }
    out.push(slot);
  }
  return { ok: true, agenda: out };
}

async function _findActiveSiteVisit(submissionId: string) {
  return SiteVisit.findOne({ submissionId: new mongoose.Types.ObjectId(submissionId) });
}

async function _canCoEdit(
  req: AuthenticatedRequest,
  submission: any,
  siteVisit: any
): Promise<boolean> {
  if (_isElevated(req)) return true;
  const role = req.user?.role;
  const uid = String(req.user?.id);
  if (role === 'lead_reader' && siteVisit && String(siteVisit.leadReaderId) === uid) return true;
  if (role === 'program_coordinator' && String(submission.submitterId) === uid) return true;
  return false;
}

function _canRead(req: AuthenticatedRequest, submission: any, siteVisit: any): boolean {
  if (_isElevated(req)) return true;
  const role = req.user?.role;
  const uid = String(req.user?.id);
  if (role === 'program_coordinator') {
    // PCs at the same institution as the submission can read.
    return String(submission.submitterId) === uid;
  }
  if (role === 'lead_reader' || role === 'reader') {
    if (siteVisit && String(siteVisit.leadReaderId) === uid) return true;
    if (siteVisit && Array.isArray(siteVisit.readerIds) && siteVisit.readerIds.some((r: any) => String(r) === uid)) return true;
    // Allow any reader to read once status >= submitted (board context).
    return ['submitted', 'under_review', 'readers_assigned', 'review_complete', 'compliant', 'non_compliant'].includes(submission.status);
  }
  return false;
}

export const getItinerary = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.params;
    const submission = await Submission.findById(submissionId).lean();
    if (!submission) return res.status(404).json({ error: 'Submission not found' });
    const siteVisit = await _findActiveSiteVisit(submissionId);
    if (!_canRead(req, submission, siteVisit)) {
      return res.status(403).json({ error: 'Not authorized to view this itinerary' });
    }
    return res.json({
      submissionId,
      siteVisit: siteVisit ? siteVisit.toObject() : null,
      canCoEdit: await _canCoEdit(req, submission, siteVisit)
    });
  } catch (err) {
    console.error('getItinerary error:', err);
    return res.status(500).json({ error: 'Failed to get itinerary' });
  }
};

/**
 * PUT — replace the agenda. Body: { agenda: AgendaSlot[] }.
 *
 * Co-edit gate: lead reader assigned to the visit OR the submission's PC.
 * Audit-logs the replace with a diff-friendly payload (priorAgendaLen +
 * newAgendaLen). No conflict detection beyond last-writer-wins per the
 * CR spec.
 */
export const replaceAgenda = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.params;
    const submission = await Submission.findById(submissionId).lean();
    if (!submission) return res.status(404).json({ error: 'Submission not found' });
    const siteVisit = await _findActiveSiteVisit(submissionId);
    if (!siteVisit) {
      return res.status(404).json({
        error: 'No site visit scheduled for this submission. Schedule it first via POST /api/site-visits.'
      });
    }
    if (!(await _canCoEdit(req, submission, siteVisit))) {
      return res.status(403).json({ error: 'Only the assigned lead reader and the program coordinator can edit the itinerary.' });
    }
    const valid = _validateAgenda(req.body?.agenda);
    if (!valid.ok) return res.status(400).json({ error: valid.error });

    const prior = siteVisit.agenda?.length ?? 0;
    siteVisit.agenda = valid.agenda as any;
    await siteVisit.save();

    void recordAuditEvent({
      action: 'itinerary.updated',
      actor: { id: req.user!.id, role: req.user!.role, name: _actorName(req) },
      targetType: 'submission',
      targetId: String(submissionId),
      submissionId: String(submissionId),
      payload: {
        siteVisitId: String(siteVisit._id),
        priorAgendaLen: prior,
        newAgendaLen: valid.agenda.length
      }
    });

    return res.json({ siteVisit: siteVisit.toObject() });
  } catch (err) {
    console.error('replaceAgenda error:', err);
    return res.status(500).json({ error: 'Failed to update itinerary' });
  }
};

/**
 * GET /api/submissions/:submissionId/itinerary/export.docx
 *
 * Returns a printable .docx of the itinerary. Same role gate as GET
 * (read access).
 */
export const exportItineraryDocx = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.params;
    const submission = await Submission.findById(submissionId).lean();
    if (!submission) return res.status(404).json({ error: 'Submission not found' });
    const siteVisit = await _findActiveSiteVisit(submissionId);
    if (!_canRead(req, submission, siteVisit)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Pull every linked checklist item up front so the DOCX renderer can
    // show each slot's verification list inline.
    const allIds = new Set<string>();
    for (const slot of siteVisit?.agenda || []) {
      for (const id of slot.checklistItemIds || []) allIds.add(String(id));
    }
    const items = allIds.size
      ? await SiteVisitChecklistItem.find({ _id: { $in: Array.from(allIds) } }).lean()
      : [];
    const byId = new Map(items.map((i: any) => [String(i._id), i]));

    const leadReader = siteVisit?.leadReaderId
      ? await User.findById(siteVisit.leadReaderId).select('firstName lastName').lean()
      : null;

    const now = new Date();

    const cover: Paragraph[] = [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'CSHSE Site-Visit Itinerary', bold: true, size: 36 })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: submission.institutionName, size: 28 })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: `${submission.programName} (${String(submission.programLevel).toUpperCase()})`,
            size: 24
          })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: siteVisit?.scheduledDate
              ? `Scheduled: ${new Date(siteVisit.scheduledDate).toISOString().slice(0, 10)}${siteVisit.scheduledTime ? ' at ' + siteVisit.scheduledTime : ''}`
              : 'Not scheduled yet',
            size: 20
          })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: `Lead reader: ${leadReader ? leadReader.firstName + ' ' + leadReader.lastName : '(unset)'}`,
            size: 20
          })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: `Generated ${now.toISOString().slice(0, 10)}`, size: 20 })]
      }),
      new Paragraph({ children: [new PageBreak()] })
    ];

    const body: Paragraph[] = [];
    if (!siteVisit?.agenda?.length) {
      body.push(new Paragraph({ children: [new TextRun('No agenda items yet.')] }));
    } else {
      body.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: 'Agenda', bold: true })] }));
      for (const slot of siteVisit.agenda) {
        body.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_3,
            children: [new TextRun({ text: `${slot.time} — ${slot.activity}`, bold: true })]
          })
        );
        if (slot.location) {
          body.push(new Paragraph({ children: [new TextRun({ text: `Location: ${slot.location}` })] }));
        }
        if (slot.attendees?.length) {
          body.push(new Paragraph({ children: [new TextRun({ text: `Attendees: ${slot.attendees.join(', ')}` })] }));
        }
        if (slot.participants) {
          body.push(new Paragraph({ children: [new TextRun({ text: `Participants: ${slot.participants}` })] }));
        }
        if (slot.specCodes?.length) {
          body.push(new Paragraph({ children: [new TextRun({ text: `Specs addressed: ${slot.specCodes.join(', ')}` })] }));
        }
        if (slot.notes) {
          body.push(new Paragraph({ children: [new TextRun({ text: slot.notes, italics: true })] }));
        }
        if (slot.checklistItemIds?.length) {
          body.push(new Paragraph({ children: [new TextRun({ text: 'Verify during this slot:', bold: true })] }));
          for (const id of slot.checklistItemIds) {
            const item = byId.get(String(id));
            if (item) {
              body.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `  • Standard ${item.standardCode}.${item.specCode} — ${item.inclusionReason}${item.verified ? ' (verified)' : ''}`
                    })
                  ]
                })
              );
            }
          }
        }
      }
    }

    const doc = new Document({
      creator: 'CSHSE Self-Study Portal',
      title: 'CSHSE Site-Visit Itinerary',
      description: `Site-visit itinerary for ${submission.institutionName}`,
      sections: [{ properties: {}, children: [...cover, ...body] }]
    });
    const buffer = await Packer.toBuffer(doc);

    const safeName = String(submission.institutionName || 'submission')
      .replace(/[^a-zA-Z0-9_.-]+/g, '_')
      .slice(0, 60);
    const filename = `site_visit_itinerary_${safeName}_${new Date().toISOString().slice(0, 10)}.docx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (err) {
    console.error('exportItineraryDocx error:', err);
    return res.status(500).json({ error: 'Failed to export itinerary' });
  }
};
