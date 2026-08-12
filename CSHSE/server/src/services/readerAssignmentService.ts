import mongoose from 'mongoose';
import { Assignment } from '../models/Assignment';
import { Institution } from '../models/Institution';
import { User } from '../models/User';

/**
 * CR-074 — reader access is gated on an ACTIVE `Assignment` doc (see
 * listSubmissions / getSubmission / evidenceController: a reader/lead only sees
 * a submission when `Assignment.find({ userId, status: 'active' })` matches).
 *
 * Historically an Assignment was created ONLY by the explicit
 * `POST /reviews/submissions/:id/assign` flow. So when a PC submitted a
 * self-study, the institution's lead reader — who is assigned at the
 * INSTITUTION level (`institution.assignedLeadReaderId`), not per-submission —
 * received no Assignment and the submitted self-study never appeared on their
 * dashboard/queue (the AACC/Lauri bug).
 *
 * This helper reconciles Assignment docs for a submission from the
 * institution's standing lead-reader + reader roster. It is idempotent
 * (re-running refreshes, never duplicates) and used at submit time so the
 * assigned readers see the study the moment it lands. Explicit re-assignment
 * via assignReaders still owns status transitions (readers_assigned); this
 * helper only guarantees visibility and does NOT change submission.status.
 *
 * Returns the User docs that now have an active assignment (for notification).
 */
export async function ensureInstitutionReaderAssignments(
  submission: any,
  actor: { id?: string; name?: string; role?: string }
): Promise<{ lead: any | null; readers: any[]; assignedUsers: any[] }> {
  const inst: any = await Institution.findById(submission.institutionId)
    .select('assignedLeadReaderId assignedReaderIds')
    .lean();

  const leadId = inst?.assignedLeadReaderId ? String(inst.assignedLeadReaderId) : null;
  const readerIds: string[] = Array.isArray(inst?.assignedReaderIds)
    ? inst.assignedReaderIds.map((r: any) => String(r))
    : [];

  // Union of everyone who should be able to read this submission. Lead first.
  const wantedIds = Array.from(new Set([leadId, ...readerIds].filter(Boolean))) as string[];
  if (wantedIds.length === 0) {
    return { lead: null, readers: [], assignedUsers: [] };
  }

  const users = await User.find({ _id: { $in: wantedIds } });
  const leadUser = leadId ? users.find((u) => String(u._id) === leadId) || null : null;
  const readerUsers = users.filter((u) => String(u._id) !== leadId);

  const assignerName =
    actor.name || `${actor.role || 'system'}`;
  const assignedBy = actor.id
    ? new mongoose.Types.ObjectId(String(actor.id))
    : (submission.submitterId as mongoose.Types.ObjectId | undefined);
  const leadName = leadUser
    ? `${leadUser.firstName || ''} ${leadUser.lastName || ''}`.trim()
    : undefined;

  const assignedUsers: any[] = [];
  for (const u of users) {
    const assignmentType = leadId && String(u._id) === leadId ? 'lead_reader' : 'reader';
    const userName = `${u.firstName || ''} ${u.lastName || ''}`.trim();
    const existing = await Assignment.findOne({
      submissionId: submission._id,
      userId: u._id,
      status: 'active'
    });
    if (existing) {
      existing.assignmentType = assignmentType as any;
      if (leadUser) {
        existing.leadReaderId = leadUser._id as mongoose.Types.ObjectId;
        existing.leadReaderName = leadName;
      }
      await existing.save();
      assignedUsers.push(u);
      continue;
    }
    await Assignment.create({
      submissionId: submission._id,
      institutionId: submission.institutionId,
      institutionName: submission.institutionName,
      userId: u._id,
      userName,
      userEmail: u.email,
      assignmentType,
      assignedBy,
      assignedByName: assignerName,
      assignedByRole: actor.role || 'system',
      status: 'active',
      leadReaderId: leadUser ? (leadUser._id as mongoose.Types.ObjectId) : undefined,
      leadReaderName: leadName
    });
    assignedUsers.push(u);
  }

  // Mirror onto the submission so the other access guards that read
  // submission.assignedReaders / submission.leadReader (evidenceController,
  // commentController, readerLockController, siteVisitController) also pass.
  submission.assignedReaders = readerUsers.map((u) => u._id as mongoose.Types.ObjectId);
  if (leadUser) submission.leadReader = leadUser._id as mongoose.Types.ObjectId;

  return { lead: leadUser, readers: readerUsers, assignedUsers };
}
