/**
 * Program courses — list / create endpoints used by the Matrix step
 * (UI spec §6.4 + §20.4) for the course-column dropdowns.
 */
import { Response } from 'express';
import mongoose from 'mongoose';
import { ProgramCourse } from '../models/ProgramCourse';
import { Submission } from '../models/Submission';
import { AuthenticatedRequest } from '../middleware/auth';
import { requireSubmissionAccess } from '../services/submissionAccessGuard';

function normalizeCode(code: string): string {
  return code.trim().replace(/\s+/g, ' ').toUpperCase();
}

export async function listProgramCourses(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { submissionId } = req.params;
  if (!mongoose.isValidObjectId(submissionId)) {
    res.status(400).json({ error: 'Invalid submissionId' });
    return;
  }
  const _sub = await requireSubmissionAccess(req, res, req.params.submissionId);
  if (!_sub) return;
  const submission = await Submission.findById(submissionId).select('institutionId');
  if (!submission?.institutionId) {
    res.status(404).json({ error: 'Submission or institution not found' });
    return;
  }
  const courses = await ProgramCourse.find({
    institutionId: submission.institutionId,
    $or: [{ submissionId }, { submissionId: { $exists: false } }, { submissionId: null }]
  })
    .sort({ courseCode: 1 })
    .limit(500)
    .lean();
  res.json({ courses });
}

export async function createProgramCourse(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { submissionId } = req.params;
  const { courseCode, courseName, source = 'manual' } = req.body || {};

  if (!mongoose.isValidObjectId(submissionId)) {
    res.status(400).json({ error: 'Invalid submissionId' });
    return;
  }
  if (typeof courseCode !== 'string' || !courseCode.trim()) {
    res.status(400).json({ error: 'courseCode required' });
    return;
  }
  if (typeof courseName !== 'string' || !courseName.trim()) {
    res.status(400).json({ error: 'courseName required' });
    return;
  }

  const submission = await Submission.findById(submissionId).select('institutionId');
  if (!submission?.institutionId) {
    res.status(404).json({ error: 'Submission or institution not found' });
    return;
  }

  const code = normalizeCode(courseCode);
  try {
    const _sub = await requireSubmissionAccess(req, res, req.params.submissionId);
    if (!_sub) return;
    const course = await ProgramCourse.findOneAndUpdate(
      { institutionId: submission.institutionId, courseCode: code, submissionId },
      {
        $set: {
          courseName: courseName.trim(),
          source,
          lastUsedAt: new Date(),
          createdBy: req.user?.id
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.status(201).json({ course });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || String(err) });
  }
}
