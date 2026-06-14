import { Request, Response } from 'express';
import { Submission, ISubmission } from '../models/Submission';
import { Institution } from '../models/Institution';
// CR-060 — multi-role access: role-by-institution resolution.
import { hasRoleAt, isGlobalAdmin, institutionIdsWithRole } from '../services/roleResolver';
import { ValidationResult } from '../models/ValidationResult';
import { ValidationService } from '../services/validationService';
import { emailService } from '../services/emailService';
import { recordAuditEvent } from '../services/auditLog';
import { User } from '../models/User';
import { SelfStudyImport } from '../models/SelfStudyImport';
import { CurriculumMatrix } from '../models/CurriculumMatrix';
import { SupportingEvidence } from '../models/SupportingEvidence';
import { Assignment } from '../models/Assignment';
import { JointVenture } from '../models/JointVenture';
import { getAllStandards } from '../data/standards';
import { ingestCorrection } from '../services/cshseAiClient';
import mongoose from 'mongoose';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    email: string;
    name?: string;
    isSuperuser?: boolean;
    realIsSuperuser?: boolean;
    institutionId?: string;
    // Set when a superuser is impersonating; scoping uses impersonatedUserId.
    impersonation?: { impersonatedUserId?: string; impersonatedRole?: string };
  };
}

const validationService = new ValidationService();

/**
 * Convert narratives Map to array format for client
 */
function narrativesMapToArray(narratives: Map<string, Map<string, any>> | undefined): Array<{
  standardCode: string;
  specCode: string;
  content: string;
  lastModified?: Date;
  supportingEvidenceText?: string;
}> {
  if (!narratives) return [];

  const result: Array<any> = [];
  narratives.forEach((specMap, standardCode) => {
    if (specMap instanceof Map) {
      specMap.forEach((narrativeContent, specCode) => {
        result.push({
          standardCode,
          specCode,
          content: narrativeContent.content || '',
          lastModified: narrativeContent.lastModified,
          supportingEvidenceText: narrativeContent.supportingEvidenceText || ''
        });
      });
    }
  });
  return result;
}

/**
 * Get submission by ID
 */
/**
 * CR-060 — a caller may WRITE a submission's self-study iff they are a global
 * admin/superuser, a Program Coordinator AT the submission's institution, or
 * (for an institution-less dev submission) its original submitter. Replaces the
 * old `submitterId === req.user.id` ownership checks AND closes the write routes
 * that previously had NO authorization gate (only submissionLockout).
 */
function pcCanWrite(reqUser: any, submission: any): boolean {
  if (isGlobalAdmin(reqUser)) return true;
  if (submission?.institutionId) {
    return hasRoleAt(reqUser, 'program_coordinator', submission.institutionId.toString());
  }
  return String(submission?.submitterId || '') === String(reqUser?.id || '');
}

export const getSubmission = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.params;

    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // CR-017 Gap 1 — Program coordinators may only read submissions from
    // their own institution. Without this, any logged-in PC could fetch
    // any submission by id (regression caught by the new
    // tests/integration/isolation.test.ts negative-case suite).
    // CR-060 — role-by-institution visibility. A user may read a submission if
    // they are: a global admin/superuser; a Program Coordinator AT THIS
    // submission's institution (or, for an institution-less dev submission, its
    // submitter); OR an assigned reviewer on a SUBMITTED study. This replaces the
    // single-role CR-017 cross-institution guard + CR-007 reader gate, so a user
    // who is PC at A and Reader at B is scoped correctly at each.
    const isElevated = isGlobalAdmin(req.user);
    const instId = submission.institutionId ? submission.institutionId.toString() : null;
    const isSubmitter = String(submission.submitterId || '') === String(req.user?.id || '');
    const isPCHere = instId
      ? hasRoleAt(req.user, 'program_coordinator', instId)
      : isSubmitter; // institution-less dev data → fall back to ownership

    if (!isElevated && !isPCHere) {
      // Not admin and not a PC at this institution. The only remaining way in is
      // an ACTIVE assignment on a SUBMITTED study (CR-007 assigned-only;
      // Assignment is the source of truth for WHICH submissions a reviewer sees,
      // roleAssignments governs eligibility at assignment time).
      const draftStates = ['draft', 'in_progress'];
      if (draftStates.includes(submission.status)) {
        return res.status(403).json({
          error: 'This self-study has not yet been submitted for review',
          status: submission.status
        });
      }
      const effectiveReaderId = req.user?.impersonation?.impersonatedUserId || req.user?.id;
      const assigned = await Assignment.exists({
        submissionId: submission._id,
        userId: effectiveReaderId,
        status: 'active'
      });
      if (!assigned) {
        return res.status(403).json({
          error: 'Forbidden: you are not assigned to this self-study'
        });
      }
    }

    // Convert nested Map to array format for client
    const submissionObj = submission.toObject();
    const narrativeContent = narrativesMapToArray(submission.narratives);

    // Explicitly flatten standardsStatus Map to POJO for JSON serialization
    // (Mongoose Maps may not serialize correctly via toObject() alone)
    const standardsStatus: Record<string, any> = {};
    if (submission.standardsStatus) {
      submission.standardsStatus.forEach((value: any, key: string) => {
        standardsStatus[key] = typeof value?.toObject === 'function'
          ? value.toObject()
          : { ...value };
      });
    }

    // Flatten standardIntroductions Map → POJO for JSON (same Mongoose-Map
    // serialization gap as standardsStatus). Without this, materialized
    // standard-level Introductions came back as {} and never reached the editor.
    const standardIntroductions: Record<string, string> = {};
    if (submission.standardIntroductions) {
      (submission.standardIntroductions as Map<string, string>).forEach((value, key) => {
        standardIntroductions[key] = value;
      });
    }

    // Debug: log standardsStatus entries with validationStatus set
    const validatedKeys = Object.entries(standardsStatus)
      .filter(([, v]: [string, any]) => v?.validationStatus)
      .map(([k, v]: [string, any]) => `${k}=${v.validationStatus}`);
    if (validatedKeys.length > 0) {
      console.log(`[getSubmission] ${submissionId} has ${validatedKeys.length} validated entries:`, validatedKeys.join(', '));
    } else {
      console.log(`[getSubmission] ${submissionId} standardsStatus has ${Object.keys(standardsStatus).length} keys, 0 with validationStatus`);
    }

    return res.json({
      ...submissionObj,
      narrativeContent,
      standardsStatus,
      standardIntroductions
    });
  } catch (error) {
    console.error('Get submission error:', error);
    return res.status(500).json({ error: 'Failed to get submission' });
  }
};

/**
 * Get submission progress
 */
export const getSubmissionProgress = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.params;

    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Calculate overall progress
    const statusEntries: any[] = submission.standardsStatus
      ? Array.from(submission.standardsStatus.values())
      : [];
    const totalStandards = 21;
    let completedStandards = 0;
    let submittedStandards = 0;
    let validatedStandards = 0;
    let failedStandards = 0;

    statusEntries.forEach((status: any) => {
      if (status.status === 'complete' || status.status === 'submitted' || status.status === 'validated') {
        completedStandards++;
      }
      if (status.status === 'submitted' || status.status === 'validated') {
        submittedStandards++;
      }
      if (status.status === 'validated') {
        validatedStandards++;
      }
      if (status.validationStatus === 'fail') {
        failedStandards++;
      }
    });

    // Get validation results summary
    const validationResults = await ValidationResult.aggregate([
      { $match: { submissionId: submissionId } },
      {
        $group: {
          _id: { standardCode: '$standardCode', specCode: '$specCode' },
          latestResult: { $last: '$result' },
          attemptCount: { $max: '$attemptNumber' }
        }
      }
    ]);

    const passCount = validationResults.filter(v => v.latestResult?.status === 'pass').length;
    const failCount = validationResults.filter(v => v.latestResult?.status === 'fail').length;
    const pendingCount = validationResults.filter(v => v.latestResult?.status === 'pending').length;

    return res.json({
      submissionId,
      totalStandards,
      completedStandards,
      submittedStandards,
      validatedStandards,
      failedStandards,
      progressPercent: Math.round((completedStandards / totalStandards) * 100),
      validation: {
        passed: passCount,
        failed: failCount,
        pending: pendingCount
      },
      standardsStatus: submission.standardsStatus
        ? Object.fromEntries(submission.standardsStatus)
        : {},
      selfStudyProgress: submission.selfStudyProgress || {}
    });
  } catch (error) {
    console.error('Get submission progress error:', error);
    return res.status(500).json({ error: 'Failed to get progress' });
  }
};

/**
 * Save narrative content
 */
export const saveNarrative = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.params;
    const { standardCode, specCode, content, supportingEvidenceText } = req.body;

    // Require standardCode, and at least one of content or supportingEvidenceText
    // Note: content can be empty string (for clearing section)
    if (!standardCode) {
      return res.status(400).json({ error: 'standardCode is required' });
    }

    // Check if at least one field is being updated (content can be empty string, which is valid)
    const hasContent = content !== undefined;
    const hasSupportingEvidence = supportingEvidenceText !== undefined;

    if (!hasContent && !hasSupportingEvidence) {
      return res.status(400).json({ error: 'content or supportingEvidenceText is required' });
    }

    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // CR-060 — only a PC at this submission's institution (or admin/owner) may
    // edit the narrative. Previously this route had NO authorization gate.
    if (!pcCanWrite(req.user, submission)) {
      return res.status(403).json({ error: 'Forbidden: you are not a Program Coordinator for this institution' });
    }

    // Initialize narratives map if not present
    if (!submission.narratives) {
      submission.narratives = new Map();
    }

    // Get or create standard map
    let standardNarratives = submission.narratives.get(standardCode);
    if (!standardNarratives) {
      standardNarratives = new Map();
      submission.narratives.set(standardCode, standardNarratives);
    }

    // Get existing narrative or create new
    const specKey = specCode || '';
    const existingNarrative = standardNarratives.get(specKey);

    // Update only the provided fields, preserving others
    standardNarratives.set(specKey, {
      content: hasContent ? content : (existingNarrative?.content || ''),
      lastModified: new Date(),
      isComplete: existingNarrative?.isComplete || false,
      linkedDocuments: existingNarrative?.linkedDocuments || [],
      supportingEvidenceText: hasSupportingEvidence ? supportingEvidenceText : (existingNarrative?.supportingEvidenceText || '')
    });

    // CRITICAL: Mark nested maps as modified for Mongoose to save them
    submission.markModified('narratives');
    await submission.save();

    // Use atomic $set for standardsStatus (Mongoose Map.set() doesn't persist in Mongoose 8)
    const statusKey = specCode ? `${standardCode}_${specCode}` : standardCode;
    const currentStatus = submission.standardsStatus?.get(statusKey);
    if (!currentStatus || currentStatus.status === 'not_started') {
      await Submission.updateOne(
        { _id: submission._id },
        { $set: {
          [`standardsStatus.${statusKey}.status`]: 'in_progress',
          [`standardsStatus.${statusKey}.completionPercentage`]: 0,
          [`standardsStatus.${statusKey}.lastModified`]: new Date()
        }}
      );
    }

    // Get the saved narrative for the response
    const savedNarrative = standardNarratives.get(specKey);

    return res.json({
      message: 'Narrative saved successfully',
      narrative: {
        standardCode,
        specCode: specKey,
        content: savedNarrative?.content || '',
        supportingEvidenceText: savedNarrative?.supportingEvidenceText || '',
        lastModified: new Date()
      }
    });
  } catch (error) {
    console.error('Save narrative error:', error);
    return res.status(500).json({ error: 'Failed to save narrative' });
  }
};

/**
 * CR-039 Phase 2c part 2 — save the document-level or standard-level
 * Introduction body. Mirrors the saveNarrative shape: PC-only writes,
 * locked-submission middleware in front of the route. Body:
 *
 *   { scope: 'document' }                    → writes documentIntroduction
 *   { scope: 'standard', standardCode: 'N' } → writes standardIntroductions[N]
 *
 * Both modes take `content` (the HTML body from the TipTap editor).
 * Empty string clears the intro for that scope.
 */
export const saveIntroduction = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.params;
    const { scope, standardCode, content } = req.body as {
      scope?: 'document' | 'standard';
      standardCode?: string;
      content?: string;
    };
    if (scope !== 'document' && scope !== 'standard') {
      return res.status(400).json({ error: "scope must be 'document' or 'standard'" });
    }
    if (scope === 'standard' && !standardCode) {
      return res.status(400).json({ error: 'standardCode is required for scope=standard' });
    }
    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'content (string) is required' });
    }
    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    if (scope === 'document') {
      submission.documentIntroduction = content;
    } else {
      if (!submission.standardIntroductions) {
        submission.standardIntroductions = new Map();
      }
      submission.standardIntroductions.set(standardCode!, content);
      submission.markModified('standardIntroductions');
    }
    await submission.save();
    return res.json({
      message: 'Introduction saved',
      scope,
      standardCode: scope === 'standard' ? standardCode : null,
      contentLength: content.length
    });
  } catch (error) {
    console.error('Save introduction error:', error);
    return res.status(500).json({ error: 'Failed to save introduction' });
  }
};

/**
 * CR-047 — GET /api/submissions/:submissionId/workflow-summary
 *
 * Derived rollup powering the reorganized PC dashboard. Mirrors the
 * IMPORT → DRAFTS → SELF-STUDY → SUBMIT workflow (CR-045). All counts
 * are computed from already-persisted data — no schema change:
 *   - import     ← SelfStudyImport records on this submission
 *   - drafts     ← Submission.aiReviewState (cvs / evidenceDocs / intros / buckets)
 *   - selfStudy  ← standardsStatus + narratives + CurriculumMatrix + SupportingEvidence
 *   - submit     ← Institution.accreditationDeadline + validated/total
 *
 * Owner-PC / admin only; cross-institution PC access is 403 (mirrors
 * getSubmission's CR-017 gate).
 */
export const getWorkflowSummary = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.params;
    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // CR-060 — PC-at-this-institution (or admin/owner) only.
    if (!pcCanWrite(req.user, submission)) {
      return res.status(403).json({ error: 'Forbidden: cross-institution access' });
    }

    // -- IMPORT: the PC's uploaded self-study file(s) ----------------
    const imports: any[] = await SelfStudyImport.find({ submissionId })
      .select('originalFilename aiStatus aiS3Key createdAt')
      .sort({ createdAt: -1 })
      .lean();
    const withFile = imports.filter((i) => i.aiS3Key);
    const latest = withFile[0] || imports[0] || null;
    const importInfo = latest
      ? {
          filename: latest.originalFilename,
          importedAt: latest.createdAt,
          aiStatus: latest.aiStatus ?? null,
          fileCount: withFile.length
        }
      : null;

    // -- DRAFTS: items detected by the import and shown in the Review rail.
    // 2026-06-07 (user direction) — these counts now mirror the Review screen
    // EXACTLY: they are TOTALS of what the AI pulled out (CVs / Syllabi /
    // Papers / Introductions / per-spec items), not the un-triaged remainder.
    // The PC compares the dashboard to the Review rail and expects them to
    // match ("the draft screen shows what is there"). A separate `reviewed`
    // count carries the triaged total so the UI can still show progress.
    const rs: any = (submission as any).aiReviewState || {};
    const approvedSet = new Set<string>(Array.isArray(rs.approvedIds) ? rs.approvedIds : []);
    const discardedSet = new Set<string>(Array.isArray(rs.discardedIds) ? rs.discardedIds : []);
    const isResolved = (it: any): boolean =>
      !!it?.sectionId && (approvedSet.has(it.sectionId) || discardedSet.has(it.sectionId));
    const evidenceDocs: any[] = Array.isArray(rs.evidenceDocs) ? rs.evidenceDocs : [];
    const cvsArr: any[] = Array.isArray(rs.cvs) ? rs.cvs : [];
    const cvs = cvsArr.length;
    const syllabusDocs = evidenceDocs.filter((d) => d?.docSubKind === 'syllabus');
    const syllabi = syllabusDocs.length;
    // "Projects" / "Plans" / "Papers" are the same tile — every evidenceDoc
    // that ISN'T a syllabus (matches the Review rail's SpecRail).
    const paperDocs = evidenceDocs.filter((d) => d?.docSubKind !== 'syllabus');
    const papers = paperDocs.length;
    let introductions = 0;
    const introItemsAll: any[] = [];
    const introsObj = rs.introductions || {};
    for (const ib of Object.values(introsObj) as any[]) {
      const items = Array.isArray(ib?.items) ? ib.items : [];
      introductions += items.length;
      introItemsAll.push(...items);
    }
    // Per-spec items — totals (every spec with at least one item).
    const buckets = rs.buckets || {};
    const bySpec: Array<{ std: string; spec: string; count: number }> = [];
    let specItems = 0;
    const bucketItemsAll: any[] = [];
    for (const [key, b] of Object.entries(buckets) as [string, any][]) {
      const narr = Array.isArray(b?.narratives) ? b.narratives : [];
      const evt = Array.isArray(b?.evidenceText) ? b.evidenceText : [];
      const evf = Array.isArray(b?.evidenceFiles) ? b.evidenceFiles : [];
      const count = narr.length + evt.length + evf.length;
      bucketItemsAll.push(...narr, ...evt, ...evf);
      if (count > 0) {
        // bucket keys are "std.spec" (e.g. "1.a") OR carry std/spec fields.
        const std = b?.standardCode ?? key.split('.')[0] ?? key;
        const spec = b?.specCode ?? key.split('.')[1] ?? '';
        bySpec.push({ std: String(std), spec: String(spec), count });
        specItems += count;
      }
    }
    // Triaged (approved OR discarded) across everything — for a "X reviewed"
    // progress indicator alongside the totals.
    const reviewed =
      cvsArr.filter(isResolved).length +
      evidenceDocs.filter(isResolved).length +
      introItemsAll.filter(isResolved).length +
      bucketItemsAll.filter(isResolved).length;
    bySpec.sort((a, b) =>
      a.std === b.std ? a.spec.localeCompare(b.spec) : a.std.localeCompare(b.std, undefined, { numeric: true })
    );

    // -- SELF-STUDY: committed content ------------------------------
    const allStandards = getAllStandards();
    let specsTotal = 0;
    for (const s of allStandards) specsTotal += (s.specifications || []).length;
    let specsValidated = 0;
    let specsExcluded = 0;
    if (submission.standardsStatus) {
      submission.standardsStatus.forEach((v: any) => {
        // CR-050 — excluded specs drop out of the work-to-do; they count
        // toward submit readiness (pass-OR-excluded) but not toward the
        // "X / Y validated" narrative-completion gauge.
        if (v?.excluded === true) {
          specsExcluded++;
          return;
        }
        const vs = v?.validationStatus;
        const st = v?.status;
        if (vs === 'pass' || st === 'validated' || st === 'complete' || st === 'submitted') {
          specsValidated++;
        }
      });
    }
    const specsRequired = Math.max(0, specsTotal - specsExcluded);
    // narratives written — count specs with non-empty content.
    let narrativesWritten = 0;
    const narr: any = submission.narratives;
    if (narr && typeof narr.forEach === 'function') {
      narr.forEach((specMap: any) => {
        const iter = specMap && typeof specMap.forEach === 'function' ? specMap : null;
        if (iter) {
          iter.forEach((content: any) => {
            const html = content?.content || content?.html || '';
            if (typeof html === 'string' && html.replace(/<[^>]*>/g, '').trim().length > 0) {
              narrativesWritten++;
            }
          });
        }
      });
    }
    // matrix rows + evidence files (cheap counts on indexed submissionId).
    const matrices: any[] = await CurriculumMatrix.find({ submissionId })
      .select('rawContent')
      .lean();
    const matrixRows = matrices.reduce(
      (sum, m) => sum + (Array.isArray(m.rawContent) ? m.rawContent.length : 0),
      0
    );
    const evidenceFiles = await SupportingEvidence.countDocuments({
      submissionId,
      isDeleted: { $ne: true }
    });

    // -- SUBMIT readiness -------------------------------------------
    let deadline: string | null = null;
    if (submission.institutionId) {
      const inst: any = await Institution.findById(submission.institutionId)
        .select('accreditationDeadline')
        .lean();
      deadline = inst?.accreditationDeadline ?? null;
    }

    // CR-050 — submit readiness counts pass-OR-excluded; the gauge shows
    // (validated + excluded) / total so the user sees credit for N/A.
    const specsReady = specsValidated + specsExcluded;
    return res.json({
      import: importInfo,
      drafts: { cvs, syllabi, papers, introductions, specItems, bySpec, reviewed },
      selfStudy: {
        specsValidated,
        specsExcluded,
        specsRequired,
        specsTotal,
        narrativesWritten,
        matrixRows,
        evidenceFiles
      },
      submit: {
        deadline,
        validated: specsValidated,
        excluded: specsExcluded,
        total: specsTotal,
        ready: specsTotal > 0 && specsReady === specsTotal
      }
    });
  } catch (error) {
    console.error('Get workflow summary error:', error);
    return res.status(500).json({ error: 'Failed to get workflow summary' });
  }
};

/**
 * Submit a standard for validation
 */
export const submitStandard = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId, standardCode } = req.params;

    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Get all narratives for this standard from the Map
    const standardNarrativesMap = submission.narratives?.get(standardCode);
    const standardNarratives: Array<{ standardCode: string; specCode: string; content: string }> = [];

    if (standardNarrativesMap && standardNarrativesMap instanceof Map) {
      standardNarrativesMap.forEach((narrativeContent, specCode) => {
        standardNarratives.push({
          standardCode,
          specCode,
          content: narrativeContent.content || ''
        });
      });
    }

    if (standardNarratives.length === 0) {
      return res.status(400).json({
        error: 'No content found for this standard. Please add narrative content before submitting.'
      });
    }

    // Validate each specification
    const validationResults: any[] = [];
    const failedSpecs: any[] = [];

    for (const narrative of standardNarratives) {
      try {
        const result = await validationService.validateSection({
          submissionId,
          standardCode: narrative.standardCode,
          specCode: narrative.specCode,
          narrativeText: narrative.content,
          validationType: 'submit'
        });

        validationResults.push({
          standardCode: narrative.standardCode,
          specCode: narrative.specCode,
          result
        });

        // Track failures
        if (result.result?.status === 'fail') {
          failedSpecs.push({
            standardCode: narrative.standardCode,
            specCode: narrative.specCode,
            feedback: result.result.feedback,
            missingElements: result.result.missingElements
          });
        }
      } catch (err) {
        console.error('Validation error for spec:', narrative.specCode, err);
        failedSpecs.push({
          standardCode: narrative.standardCode,
          specCode: narrative.specCode,
          error: 'Validation failed'
        });
      }
    }

    // Update submission status (atomic $set creates the key if missing)
    if (failedSpecs.length === 0) {
      // All passed - mark as submitted (atomic $set bypasses Mongoose 8 Map bug)
      await Submission.updateOne(
        { _id: submission._id },
        { $set: {
          [`standardsStatus.${standardCode}.status`]: 'submitted',
          [`standardsStatus.${standardCode}.validationStatus`]: 'pass',
          [`standardsStatus.${standardCode}.completionPercentage`]: 100,
          [`standardsStatus.${standardCode}.submittedAt`]: new Date(),
          [`standardsStatus.${standardCode}.lastModified`]: new Date()
        }}
      );

      void recordAuditEvent({
        action: 'submission.submit_standard',
        actor: {
          id: req.user!.id,
          role: req.user!.role,
          name: req.user!.name || req.user!.email
        },
        targetType: 'standard',
        targetId: `${submissionId}:${standardCode}`,
        submissionId,
        payload: { standardCode, passed: true, specCount: standardNarratives.length }
      });

      return res.json({
        success: true,
        message: `Standard ${standardCode} submitted successfully`,
        validationResults
      });
    } else {
      // Some failed - mark as in_progress with failures (atomic $set)
      await Submission.updateOne(
        { _id: submission._id },
        { $set: {
          [`standardsStatus.${standardCode}.status`]: 'in_progress',
          [`standardsStatus.${standardCode}.validationStatus`]: 'fail',
          [`standardsStatus.${standardCode}.lastModified`]: new Date()
        }}
      );

      return res.status(400).json({
        success: false,
        message: 'Some specifications failed validation',
        failedSpecs,
        validationResults
      });
    }
  } catch (error) {
    console.error('Submit standard error:', error);
    return res.status(500).json({ error: 'Failed to submit standard' });
  }
};

/**
 * Revert a standard from `submitted` back to `in_progress` so the PC can
 * keep editing. Per CR-006 the per-standard submit must be reversible —
 * only the final-submit on the whole self-study triggers the lockout.
 */
export const revertStandard = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId, standardCode } = req.params;

    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // CR-060 — only a PC at this institution (or admin/owner) may revert.
    if (!pcCanWrite(req.user, submission)) {
      return res.status(403).json({ error: 'Not authorized to revert this standard' });
    }

    // The submissionLockout middleware already refuses if the whole self-study
    // has been final-submitted; we still defend against the per-standard
    // 'validated' state (means a reader has signed off) — that's not revertable
    // from this endpoint.
    const existing = submission.standardsStatus?.get(standardCode);
    if (existing?.status === 'validated') {
      return res.status(409).json({
        error: 'Standard has been validated by a reader and cannot be reverted by the PC'
      });
    }

    await Submission.updateOne(
      { _id: submission._id },
      {
        $set: {
          [`standardsStatus.${standardCode}.status`]: 'in_progress',
          [`standardsStatus.${standardCode}.lastModified`]: new Date()
        },
        $unset: {
          [`standardsStatus.${standardCode}.submittedAt`]: ''
        }
      }
    );

    void recordAuditEvent({
      action: 'submission.revert_standard',
      actor: {
        id: req.user!.id,
        role: req.user!.role,
        name: req.user!.name || req.user!.email
      },
      targetType: 'standard',
      targetId: `${submissionId}:${standardCode}`,
      submissionId,
      payload: { standardCode, previousStatus: existing?.status }
    });

    return res.json({
      success: true,
      message: `Standard ${standardCode} reverted to in_progress`
    });
  } catch (error) {
    console.error('Revert standard error:', error);
    return res.status(500).json({ error: 'Failed to revert standard' });
  }
};

/**
 * Revalidate failed sections only (incremental)
 */
export const revalidateFailed = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.params;
    const { standardCode } = req.body;

    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Get failed validation results
    const failedResults = await ValidationResult.find({
      submissionId,
      ...(standardCode && { standardCode }),
      'result.status': 'fail'
    }).sort({ createdAt: -1 });

    // Get unique failed specs
    const failedSpecsMap = new Map<string, any>();
    failedResults.forEach(result => {
      const key = `${result.standardCode}.${result.specCode}`;
      if (!failedSpecsMap.has(key)) {
        failedSpecsMap.set(key, result);
      }
    });

    if (failedSpecsMap.size === 0) {
      return res.json({
        message: 'No failed validations to revalidate',
        revalidatedCount: 0
      });
    }

    // Revalidate each failed spec
    const revalidationResults: any[] = [];
    let passCount = 0;
    let failCount = 0;

    for (const [key, failedResult] of failedSpecsMap) {
      // Get narrative from the Map format
      const standardNarrativesMap = submission.narratives?.get(failedResult.standardCode);
      const narrativeContent = standardNarrativesMap?.get(failedResult.specCode);

      if (!narrativeContent?.content) continue;

      try {
        const result = await validationService.validateSection({
          submissionId,
          standardCode: failedResult.standardCode,
          specCode: failedResult.specCode,
          narrativeText: narrativeContent.content,
          validationType: 'submit',
          previousValidationId: failedResult._id.toString()
        });

        revalidationResults.push({
          standardCode: failedResult.standardCode,
          specCode: failedResult.specCode,
          previousStatus: 'fail',
          newStatus: result.result?.status,
          result
        });

        if (result.result?.status === 'pass') {
          passCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        console.error('Revalidation error:', err);
        failCount++;
      }
    }

    // Update standard status if all now pass (atomic $set bypasses Mongoose 8 Map bug)
    if (standardCode && failCount === 0 && passCount > 0) {
      await Submission.updateOne(
        { _id: submission._id },
        { $set: {
          [`standardsStatus.${standardCode}.status`]: 'submitted',
          [`standardsStatus.${standardCode}.validationStatus`]: 'pass',
          [`standardsStatus.${standardCode}.completionPercentage`]: 100,
          [`standardsStatus.${standardCode}.submittedAt`]: new Date(),
          [`standardsStatus.${standardCode}.lastModified`]: new Date()
        }}
      );
    }

    return res.json({
      message: 'Revalidation complete',
      revalidatedCount: revalidationResults.length,
      passed: passCount,
      failed: failCount,
      results: revalidationResults
    });
  } catch (error) {
    console.error('Revalidate failed error:', error);
    return res.status(500).json({ error: 'Failed to revalidate' });
  }
};

/**
 * Get failed validations for a submission
 */
export const getFailedValidations = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.params;
    const { standardCode } = req.query;

    const filter: any = {
      submissionId,
      'result.status': 'fail'
    };

    if (standardCode) {
      filter.standardCode = standardCode;
    }

    const failedValidations = await ValidationResult.find(filter)
      .sort({ standardCode: 1, specCode: 1, createdAt: -1 });

    // Group by standard/spec and get latest
    const latestFailures = new Map<string, any>();
    failedValidations.forEach(v => {
      const key = `${v.standardCode}.${v.specCode}`;
      if (!latestFailures.has(key)) {
        latestFailures.set(key, v);
      }
    });

    return res.json(Array.from(latestFailures.values()));
  } catch (error) {
    console.error('Get failed validations error:', error);
    return res.status(500).json({ error: 'Failed to get failed validations' });
  }
};

/**
 * CR-049 Phase 3 — latest AI section evaluation for a spec (verdict +
 * rationale + criteria coverage + improvement suggestions). Powers the
 * editor's "AI Review" panel. Read-only.
 */
export const getSpecEvaluation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId, standardCode, specCode } = req.params;
    const submission = await Submission.findById(submissionId).select('institutionId').lean();
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    const latest = await validationService.getLatestValidation(submissionId, standardCode, specCode);
    return res.json({
      evaluation: latest?.result ?? null,
      validatedAt: latest?.validatedAt ?? null
    });
  } catch (error) {
    console.error('Get spec evaluation error:', error);
    return res.status(500).json({ error: 'Failed to get spec evaluation' });
  }
};

/**
 * CR-049 Phase 3 — run the AI evaluator for a single spec on demand
 * ("Run AI Review" button). Evaluates the current narrative against the
 * rubric criteria and returns + persists the verdict.
 */
export const evaluateSpec = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId, standardCode, specCode } = req.params;
    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    // Owner-PC or admin only.
    // CR-060 — PC-at-this-institution (or admin/owner) only.
    if (!pcCanWrite(req.user, submission)) {
      return res.status(403).json({ error: 'Forbidden: cross-institution access' });
    }

    const standardNarratives = submission.narratives?.get(standardCode);
    const narrative = standardNarratives?.get(specCode);
    const narrativeText = (narrative as any)?.content || '';

    const { result } = await validationService.validateSection({
      submissionId,
      standardCode,
      specCode,
      narrativeText,
      validationType: 'manual_save'
    });
    return res.json({ evaluation: result });
  } catch (error) {
    console.error('Evaluate spec error:', error);
    return res.status(500).json({ error: 'Failed to evaluate spec' });
  }
};

/**
 * CR-049 Phase 4b — a reader/lead reader overrides the AI verdict for a
 * spec. The override becomes the authoritative verdict on the latest
 * ValidationResult AND is fed to the institution's RAG store
 * (`section_eval_override`) so future evaluations learn from it.
 *
 * (The reader-facing UI that calls this lives on the Sprint 3 reader
 * client; this is the endpoint it will hit.)
 */
export const recordSectionEvalOverride = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId, standardCode, specCode } = req.params;
    const { verdict, note } = req.body || {};
    const VALID = ['pass', 'needs_improvement', 'fail'];
    if (!VALID.includes(verdict)) {
      return res.status(400).json({ error: 'verdict must be pass, needs_improvement, or fail' });
    }
    // Readers + lead readers (and admins) record overrides.
    const role = req.user?.role;
    if (!(role === 'reader' || role === 'lead_reader' || role === 'admin' || (req.user as any)?.isSuperuser)) {
      return res.status(403).json({ error: 'Only readers may override an evaluation' });
    }

    const submission = await Submission.findById(submissionId).select('institutionId programLevel').lean();
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Update the latest ValidationResult for this spec (or create one).
    const latest: any = await ValidationResult.findOne({ submissionId, standardCode, specCode }).sort({
      validatedAt: -1
    });
    if (latest) {
      latest.result.verdict = verdict;
      latest.result.readerOverridden = true;
      if (typeof note === 'string') latest.result.readerOverrideNote = note.slice(0, 2000);
      latest.markModified('result');
      await latest.save();
    } else {
      await ValidationResult.create({
        submissionId: new mongoose.Types.ObjectId(submissionId),
        standardCode,
        specCode,
        validationType: 'manual_save',
        validatedAt: new Date(),
        result: { status: verdict === 'pass' ? 'pass' : 'fail', verdict, readerOverridden: true, readerOverrideNote: typeof note === 'string' ? note.slice(0, 2000) : undefined },
        attemptNumber: 1
      });
    }

    // Feed the learning store (best-effort — never block the override).
    void ingestCorrection({
      correctionId: new mongoose.Types.ObjectId().toString(),
      institutionId: submission.institutionId?.toString() || '',
      programLevel: (submission as any).programLevel || 'bachelors',
      expectedStd: standardCode,
      expectedSpec: specCode,
      expectedSectionType: 'narrative_response',
      sourceText: typeof note === 'string' && note ? note : `reader override → ${verdict}`,
      correctionType: 'section_eval_override'
    }).catch((err: any) => console.error('[CR-049] section_eval_override ingest failed', err));

    return res.json({ verdict, readerOverridden: true });
  } catch (error) {
    console.error('Record section-eval override error:', error);
    return res.status(500).json({ error: 'Failed to record override' });
  }
};

/**
 * Mark a standard as complete (manual)
 */
export const markStandardComplete = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId, standardCode } = req.params;

    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Atomic $set bypasses Mongoose 8 Map bug
    await Submission.updateOne(
      { _id: submission._id },
      { $set: {
        [`standardsStatus.${standardCode}.status`]: 'complete',
        [`standardsStatus.${standardCode}.completionPercentage`]: 100,
        [`standardsStatus.${standardCode}.lastModified`]: new Date()
      }}
    );

    return res.json({
      message: `Standard ${standardCode} marked as complete`
    });
  } catch (error) {
    console.error('Mark standard complete error:', error);
    return res.status(500).json({ error: 'Failed to mark standard complete' });
  }
};

/**
 * CR-008 / S2A.2 — pre-submission preflight.
 *
 * Returns the same checks the submit gate enforces, but as a structured
 * "what's missing" + "what's worth knowing" payload the client renders in
 * the FinalSubmitModal. The PC sees every gap before they press Submit,
 * each tagged with where to go to fix it (standardCode + specCode).
 *
 *  - errors[]: gaps that will hard-block Final Submit (server submitSelfStudy
 *    will refuse). These mirror the submit-gate predicate exactly so the
 *    modal and the server agree on what "ready" means.
 *  - warnings[]: things the PC might want to address but won't block submit
 *    (e.g. a passed spec with no narrative content, an evaluation that
 *    landed as needs_improvement).
 *
 * Server-side checks only — the client can't bypass them by skipping the
 * popup; submitSelfStudy still enforces the same predicate.
 */
export const getSubmissionPreflight = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.params;

    const submission: any = await Submission.findById(submissionId).lean();
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // CR-060 — PC at this institution (or admin/owner) only.
    if (!pcCanWrite(req.user, submission)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const allStandards = getAllStandards();

    // standardsStatus may be a Map (live model) or plain object (.lean()).
    const ssRaw = submission.standardsStatus;
    const getStatus = (key: string): any => {
      if (!ssRaw) return undefined;
      if (ssRaw instanceof Map) return ssRaw.get(key);
      return ssRaw[key];
    };

    // narratives may also be a Map or plain object after .lean().
    const narrativesRaw = submission.narratives;
    const getNarrative = (std: string, spec: string): any => {
      if (!narrativesRaw) return undefined;
      const stdMap = narrativesRaw instanceof Map
        ? narrativesRaw.get(std)
        : narrativesRaw[std];
      if (!stdMap) return undefined;
      return stdMap instanceof Map ? stdMap.get(spec) : stdMap[spec];
    };

    const errors: Array<{
      code: string;
      message: string;
      standardCode: string;
      specCode: string;
    }> = [];
    const warnings: Array<{
      code: string;
      message: string;
      standardCode?: string;
      specCode?: string;
    }> = [];

    let totalSpecs = 0;
    let passedCount = 0;
    let excludedCount = 0;

    for (const standard of allStandards) {
      for (const spec of standard.specifications || []) {
        totalSpecs++;
        const key = `${standard.code}_${spec.code}`;
        const status = getStatus(key);
        const passed = status?.validationStatus === 'pass';
        const excluded = status?.excluded === true;

        if (passed) passedCount++;
        if (excluded) excludedCount++;

        if (!passed && !excluded) {
          // Hard error — submit gate will refuse. Distinguish the common
          // sub-cases so the modal can be actionable ("write narrative" vs
          // "ask AI to re-evaluate" vs "mark N/A").
          const narrative = getNarrative(standard.code, spec.code);
          const html = narrative?.content || '';
          const hasContent =
            typeof html === 'string' && html.replace(/<[^>]*>/g, '').trim().length > 0;
          if (!hasContent) {
            errors.push({
              code: 'NARRATIVE_MISSING',
              message: `Standard ${standard.code}.${spec.code} has no narrative. Write content, or mark it Not Applicable.`,
              standardCode: standard.code,
              specCode: spec.code
            });
          } else if (status?.validationStatus === 'fail') {
            errors.push({
              code: 'VALIDATION_FAILED',
              message: `Standard ${standard.code}.${spec.code} did not pass the AI evaluator. Address the rationale or mark it Not Applicable.`,
              standardCode: standard.code,
              specCode: spec.code
            });
          } else {
            errors.push({
              code: 'NOT_EVALUATED',
              message: `Standard ${standard.code}.${spec.code} has not been evaluated yet. Run AI Review on it, or mark it Not Applicable.`,
              standardCode: standard.code,
              specCode: spec.code
            });
          }
        }
      }
    }

    // Warning: lots of excluded specs may mean the program scope is wrong.
    if (excludedCount > totalSpecs * 0.25) {
      warnings.push({
        code: 'MANY_EXCLUDED',
        message: `${excludedCount} of ${totalSpecs} specs are marked Not Applicable (${Math.round((excludedCount / totalSpecs) * 100)}%). Confirm this is intentional.`
      });
    }

    // Warning: a needs_improvement verdict on the latest evaluation isn't a
    // hard block (the submit gate is pass-OR-excluded) but the PC may want
    // to address it before sending to readers. Cheap lookup using
    // standardsStatus.validationStatus only — full coverage is the reader
    // report's job.
    // (left for the reader-report phase; not surfacing as warning today)

    const submitDisabled = errors.length > 0;
    return res.json({
      submitDisabled,
      errors,
      warnings,
      counts: {
        totalSpecs,
        passed: passedCount,
        excluded: excludedCount,
        satisfied: passedCount + excludedCount,
        missing: errors.length
      }
    });
  } catch (error) {
    console.error('Preflight error:', error);
    return res.status(500).json({ error: 'Failed to run preflight' });
  }
};

/**
 * CR-005 S2A.4 — Admin-only unlock. Reverses Final Submit so the PC can
 * edit the submission again, AND clears any reader lock the submission
 * may carry. The reader-side DELETE /api/submissions/:id/lock only
 * clears a reader lock; it cannot lift the post-submit system lock that
 * keeps a final-submitted submission read-only for the PC.
 *
 * Use cases:
 *   - PC submitted in error; admin needs to roll back.
 *   - Reader review hung; admin needs to release the lock for re-assignment.
 *
 * Writes a submission.unlock audit entry with the reason so the timeline
 * shows the admin override.
 */
export const adminUnlockSubmission = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.params;
    const reasonRaw = req.body?.reason;
    const reason = typeof reasonRaw === 'string'
      ? reasonRaw.trim().slice(0, 2000)
      : undefined;

    const isAdmin = req.user?.role === 'admin' || (req.user as any)?.isSuperuser === true;
    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin role required' });
    }

    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const priorStatus = submission.status;
    const priorReaderLock = submission.readerLock
      ? {
          isLocked: !!submission.readerLock.isLocked,
          lockedByName: submission.readerLock.lockedByName,
          lockReason: submission.readerLock.lockReason
        }
      : undefined;

    // Revert status from any post-submit state back to in_progress so the
    // PC can edit. Leave draft / in_progress untouched.
    if (
      submission.status === 'submitted' ||
      submission.status === 'under_review' ||
      submission.status === 'readers_assigned' ||
      submission.status === 'review_complete'
    ) {
      submission.status = 'in_progress';
      submission.submittedAt = undefined;
    }

    // Clear all lock state (final-submit system lock + any reader lock).
    submission.readerLock = { isLocked: false };

    await submission.save();

    void recordAuditEvent({
      action: 'submission.unlock',
      actor: {
        id: req.user!.id,
        role: req.user!.role,
        name: req.user!.name || req.user!.email
      },
      targetType: 'submission',
      targetId: submissionId,
      submissionId,
      payload: { priorStatus, priorReaderLock },
      reason
    });

    return res.json({
      message: 'Submission unlocked by admin',
      submission: {
        _id: submission._id,
        status: submission.status,
        readerLock: submission.readerLock
      }
    });
  } catch (error) {
    console.error('Admin unlock error:', error);
    return res.status(500).json({ error: 'Failed to unlock submission' });
  }
};

/**
 * CR-050 — Mark a single spec as "Not applicable / intentionally excluded".
 * The PC declares intent (with an optional reason). Submit-readiness then
 * treats this spec as satisfied (pass-OR-excluded), so empty-by-design
 * specs no longer hard-block Final Submit. Reusing the dotted Map-key
 * convention (`standardsStatus.${std}_${spec}.…`) and atomic $set the same
 * way markStandardComplete does — Mongoose 8 Map subdoc updates only
 * persist via $set on dotted paths.
 */
export const markSpecNotApplicable = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId, standardCode, specCode } = req.params;
    const reasonRaw = req.body?.reason;
    const reason = typeof reasonRaw === 'string'
      ? reasonRaw.trim().slice(0, 2000)
      : undefined;

    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Ownership — only the PC who owns this submission (or admin) can mark N/A.
    const isAdmin = req.user?.role === 'admin' || (req.user as any)?.isSuperuser === true;
    if (!pcCanWrite(req.user, submission)) {
      return res.status(403).json({ error: 'Not authorized to modify this submission' });
    }

    // Refuse if the submission is locked (post-submit / reader review).
    if (submission.readerLock?.isLocked && !isAdmin) {
      return res.status(409).json({ error: 'Submission is locked' });
    }

    // Sanity-check the spec exists in the rubric so we don't create dead keys.
    const allStandards = getAllStandards();
    const std = allStandards.find((s) => String(s.code) === String(standardCode));
    const spec = std?.specifications?.find((sp) => String(sp.code) === String(specCode));
    if (!std || !spec) {
      return res.status(404).json({ error: 'Spec not found in rubric' });
    }

    const key = `${standardCode}_${specCode}`;
    const now = new Date();
    await Submission.updateOne(
      { _id: submission._id },
      { $set: {
        [`standardsStatus.${key}.excluded`]: true,
        [`standardsStatus.${key}.excludedReason`]: reason || '',
        [`standardsStatus.${key}.excludedAt`]: now,
        [`standardsStatus.${key}.excludedBy`]: new mongoose.Types.ObjectId(req.user!.id),
        [`standardsStatus.${key}.lastModified`]: now
      }}
    );

    void recordAuditEvent({
      action: 'submission.spec_marked_na',
      actor: {
        id: req.user!.id,
        role: req.user!.role,
        name: req.user!.name || req.user!.email
      },
      targetType: 'submission',
      targetId: submissionId,
      submissionId,
      payload: { standardCode, specCode },
      reason
    });

    return res.json({
      message: `Spec ${standardCode}.${specCode} marked not applicable`,
      excluded: true,
      excludedReason: reason || '',
      excludedAt: now
    });
  } catch (error) {
    console.error('Mark spec N/A error:', error);
    return res.status(500).json({ error: 'Failed to mark spec not applicable' });
  }
};

/**
 * CR-050 — Clear the "Not applicable" flag on a spec; the spec returns to
 * the normal lifecycle (validation required to pass the submit gate).
 */
export const clearSpecNotApplicable = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId, standardCode, specCode } = req.params;

    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const isAdmin = req.user?.role === 'admin' || (req.user as any)?.isSuperuser === true;
    if (!pcCanWrite(req.user, submission)) {
      return res.status(403).json({ error: 'Not authorized to modify this submission' });
    }
    if (submission.readerLock?.isLocked && !isAdmin) {
      return res.status(409).json({ error: 'Submission is locked' });
    }

    const key = `${standardCode}_${specCode}`;
    const now = new Date();
    await Submission.updateOne(
      { _id: submission._id },
      {
        $unset: {
          [`standardsStatus.${key}.excluded`]: '',
          [`standardsStatus.${key}.excludedReason`]: '',
          [`standardsStatus.${key}.excludedAt`]: '',
          [`standardsStatus.${key}.excludedBy`]: ''
        },
        $set: {
          [`standardsStatus.${key}.lastModified`]: now
        }
      }
    );

    void recordAuditEvent({
      action: 'submission.spec_na_cleared',
      actor: {
        id: req.user!.id,
        role: req.user!.role,
        name: req.user!.name || req.user!.email
      },
      targetType: 'submission',
      targetId: submissionId,
      submissionId,
      payload: { standardCode, specCode }
    });

    return res.json({
      message: `Spec ${standardCode}.${specCode} N/A cleared`,
      excluded: false
    });
  } catch (error) {
    console.error('Clear spec N/A error:', error);
    return res.status(500).json({ error: 'Failed to clear spec N/A' });
  }
};

/**
 * List all submissions for current user
 */
export const listSubmissions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, limit = 10, offset = 0, institutionId, jointVentureId } = req.query;

    const filter: any = {};

    // CR-017 Gap 1 — Force program coordinators to their own institution,
    // regardless of what `?institutionId=` they pass. The earlier logic
    // honored the query-string value first, which let PC-A enumerate
    // PC-B's submissions by spoofing the parameter. Admin + superuser
    // remain free to filter by any institution they own.
    // CR-060 — role-by-institution list scoping. Replaces the single-role
    // PC-pin / reader-assignment `if/else` (which could only ever apply ONE,
    // so a PC-at-A + Reader-at-B user saw just one scope).
    const READER_VISIBLE_STATUSES = [
      'submitted', 'under_review', 'readers_assigned', 'review_complete', 'compliant', 'non_compliant'
    ];
    const isElevated = isGlobalAdmin(req.user);
    const requestedStatuses: string[] | null = status
      ? (Array.isArray(status) ? status : [status]).map((s) => String(s))
      : null;

    if (isElevated) {
      // Admin / superuser: optional explicit institution + JV + status filters.
      if (institutionId) filter.institutionId = institutionId;
      if (jointVentureId) {
        const jv = await JointVenture.findById(String(jointVentureId)).select('institutionIds').lean();
        const memberIds = (jv?.institutionIds || []).map((id) => String(id));
        if (filter.institutionId) {
          if (!memberIds.includes(String(filter.institutionId))) filter.institutionId = new mongoose.Types.ObjectId();
        } else {
          filter.institutionId = { $in: memberIds.length ? memberIds : [new mongoose.Types.ObjectId()] };
        }
      }
      if (requestedStatuses) {
        filter.status = requestedStatuses.length === 1 ? requestedStatuses[0] : { $in: requestedStatuses };
      }
    } else {
      // Non-elevated: OR together
      //   (a) every submission of an institution where the user is a Program
      //       Coordinator (any status — PCs see their own drafts), and
      //   (b) every submission they hold an ACTIVE assignment to, restricted to
      //       reader-visible statuses (CR-007 assigned-only; the explicit
      //       `?status=` is INTERSECTED with the allow-list, never widening it).
      const pcInsts = institutionIdsWithRole(req.user, 'program_coordinator')
        .map((id) => new mongoose.Types.ObjectId(id));
      const effectiveReaderId = req.user?.impersonation?.impersonatedUserId || req.user?.id;
      const assignments = await Assignment.find({ userId: effectiveReaderId, status: 'active' })
        .select('submissionId').lean();
      const assignedIds = assignments.map((a) => a.submissionId);

      const or: any[] = [];
      if (pcInsts.length) {
        const clause: any = { institutionId: { $in: pcInsts } };
        if (requestedStatuses) clause.status = requestedStatuses.length === 1 ? requestedStatuses[0] : { $in: requestedStatuses };
        or.push(clause);
      }
      if (assignedIds.length) {
        const allowed = requestedStatuses
          ? requestedStatuses.filter((s) => READER_VISIBLE_STATUSES.includes(s))
          : READER_VISIBLE_STATUSES;
        or.push({ _id: { $in: assignedIds }, status: { $in: allowed.length ? allowed : ['__forbidden__'] } });
      }

      if (or.length === 0) {
        filter._id = new mongoose.Types.ObjectId(); // no PC/reviewer role → see nothing
      } else if (or.length === 1) {
        Object.assign(filter, or[0]);
      } else {
        filter.$or = or;
      }
    }

    const [submissions, total] = await Promise.all([
      Submission.find(filter)
        .select('submissionId institutionName institutionId programName programLevel status createdAt updatedAt standardsStatus readerLock')
        .sort({ createdAt: -1 })
        .skip(Number(offset))
        .limit(Number(limit)),
      Submission.countDocuments(filter)
    ]);

    return res.json({
      submissions,
      total,
      hasMore: Number(offset) + submissions.length < total
    });
  } catch (error) {
    console.error('List submissions error:', error);
    return res.status(500).json({ error: 'Failed to list submissions' });
  }
};

/**
 * Create a new submission
 */
export const createSubmission = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      institutionId,
      institutionName,
      programName,
      programLevel,
      type = 'initial'
    } = req.body;

    if (!institutionName || !programName) {
      return res.status(400).json({ error: 'Institution name and program name are required' });
    }

    // Initialize standards status for 21 standards
    const standardsStatus: Record<string, any> = {};
    for (let i = 1; i <= 21; i++) {
      standardsStatus[String(i)] = {
        status: 'not_started',
        completionPercentage: 0,
        lastModified: new Date()
      };
    }

    // Generate submissionId before creating (Mongoose validation runs before pre-save hooks)
    const year = new Date().getFullYear();
    const count = await Submission.countDocuments({
      submissionId: new RegExp(`^${year}-`)
    });
    const submissionId = `${year}-${String(count + 1).padStart(3, '0')}`;

    const submission = new Submission({
      submissionId,
      institutionId,
      institutionName,
      programName,
      programLevel: programLevel || 'bachelors',
      submitterId: req.user!.id,
      type,
      status: 'draft',
      standardsStatus,
      selfStudyProgress: {
        totalSections: 21,
        completedSections: 0,
        validatedSections: 0,
        passedSections: 0,
        failedSections: 0,
        lastActivity: new Date()
      }
    });

    await submission.save();

    // Link institution to this submission so evidence access works
    if (institutionId) {
      await Institution.findByIdAndUpdate(institutionId, {
        currentSubmissionId: submission._id
      });
    }

    return res.status(201).json({
      submission,
      message: 'Self-study created successfully'
    });
  } catch (error) {
    console.error('Create submission error:', error);
    return res.status(500).json({ error: 'Failed to create submission' });
  }
};

/**
 * Submit the entire self-study for review
 * - Requires all specs to be validated (pass)
 * - Locks the self-study (program coordinator becomes read-only)
 * - Notifies the lead reader
 */
export const submitSelfStudy = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.params;

    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // CR-060 — only a PC at this institution (or admin/owner) may submit.
    if (!pcCanWrite(req.user, submission)) {
      return res.status(403).json({ error: 'Not authorized to submit this self-study' });
    }

    // Check if already submitted
    if (submission.status === 'submitted' || submission.status === 'under_review') {
      return res.status(400).json({ error: 'Self-study has already been submitted' });
    }

    // S2A.0 — resolve the required standards/specs from the CSHSE rubric
    // definitions in code (getAllStandards), same source the PC dashboard's
    // workflow-summary uses. The previous `Spec.findOne({ isActive: true })`
    // never matched — the Spec model has no `isActive` field (it uses
    // `status`) — so final submit ALWAYS returned 400 "No active
    // specification found" and a PC could never submit. `activeSpec.standards`
    // was also undefined (Spec has no `standards` field).
    const allStandards = getAllStandards();
    if (!allStandards || allStandards.length === 0) {
      return res.status(500).json({ error: 'Standards definitions unavailable' });
    }

    // Verify all specs are validated (pass) OR explicitly marked N/A (excluded).
    // CR-050 — A spec is satisfied when validationStatus === 'pass' OR
    // excluded === true. Specs that are neither (genuinely un-triaged gaps)
    // still block submission so accidental omissions don't slip through.
    const standardsStatus = submission.standardsStatus || new Map();
    const missingValidations: string[] = [];

    for (const standard of allStandards) {
      for (const spec of standard.specifications || []) {
        const statusKey = `${standard.code}_${spec.code}`;
        const status = standardsStatus instanceof Map
          ? standardsStatus.get(statusKey)
          : standardsStatus[statusKey];

        const passed = status?.validationStatus === 'pass';
        const excluded = status?.excluded === true;
        if (!passed && !excluded) {
          missingValidations.push(`Standard ${standard.code}, Spec ${spec.code}`);
        }
      }
    }

    // CR-008 / S10.3 — override-with-reason. When preflight errors remain
    // (missingValidations non-empty) the PC may still submit, but only by
    // explicitly overriding AND supplying a free-text reason. Without an
    // override the server hard-blocks (the historical behaviour). The reason
    // is mandatory (>= 10 chars) so the audit trail records *why* an
    // incomplete self-study was submitted — this is the auditable bypass the
    // CR's "Sprint 2B" gap called for.
    const overrideRequested = req.body?.override === true || req.body?.override === 'true';
    const overrideReason = typeof req.body?.overrideReason === 'string'
      ? String(req.body.overrideReason).trim().slice(0, 2000)
      : '';
    let didOverride = false;

    if (missingValidations.length > 0) {
      if (!overrideRequested) {
        return res.status(400).json({
          error: 'All specifications must be validated before submitting',
          missingValidations: missingValidations.slice(0, 10), // Show first 10
          totalMissing: missingValidations.length,
          canOverride: true
        });
      }
      if (overrideReason.length < 10) {
        return res.status(400).json({
          error: 'OVERRIDE_REASON_REQUIRED',
          message: 'A reason of at least 10 characters is required to submit with unresolved items.',
          totalMissing: missingValidations.length
        });
      }
      didOverride = true;
    }

    // Update submission status
    submission.status = 'submitted';
    submission.submittedAt = new Date();

    // Lock the self-study (program coordinator can only read, not edit)
    submission.readerLock = {
      isLocked: true,
      lockedBy: undefined, // System lock, not a person
      lockedByName: 'System',
      lockedByRole: undefined,
      lockedAt: new Date(),
      lockReason: 'submission_complete'
    };

    await submission.save();

    // 2026-06-09 — Submit also QUEUES a full "Validate all": every spec with
    // content is enqueued onto the background AI-evaluation queue (drained by the
    // evalQueueWorker), so the reader report is seeded reliably without the old
    // detached fire-and-forget (which could be torn down on Railway). Non-blocking.
    try {
      const keys: string[] = [];
      const narr: any = submission.narratives;
      if (narr && typeof narr.forEach === 'function') {
        narr.forEach((specMap: any, std: string) => {
          if (specMap && typeof specMap.forEach === 'function') {
            specMap.forEach((data: any, spec: string) => {
              if (((data?.content as string) || '').replace(/<[^>]*>/g, '').trim().length > 0) {
                keys.push(`${std}.${spec}`);
              }
            });
          }
        });
      }
      if (keys.length > 0) {
        await Submission.updateOne(
          { _id: submissionId },
          {
            $set: { aiEvalQueue: keys, aiEvalQueueTotal: keys.length, aiEvalQueueStartedAt: new Date() },
            $unset: { aiEvalQueueDoneAt: '' },
          }
        );
      }
    } catch (seedErr) {
      console.error('[submit] enqueue full AI evaluation failed (non-fatal):', seedErr);
    }

    // CR-006 audit trail — record the final-submit event with the optional
    // submission note the PC enters in the confirm modal.
    const submissionNote = typeof req.body?.submissionNote === 'string'
      ? String(req.body.submissionNote).trim().slice(0, 2000)
      : undefined;
    void recordAuditEvent({
      // CR-008 — a forced submit (unresolved preflight errors) is recorded as
      // a distinct, more visible audit action so admins/lead readers can find
      // every overridden submission. Clean submits keep the prior action name.
      action: didOverride ? 'submission.final_submit_override' : 'submission.final_submit',
      actor: {
        id: req.user!.id,
        role: req.user!.role,
        name: req.user!.name || req.user!.email
      },
      targetType: 'submission',
      targetId: submissionId,
      submissionId,
      payload: {
        institutionName: submission.institutionName,
        programLevel: submission.programLevel,
        submittedAt: submission.submittedAt,
        override: didOverride,
        ...(didOverride
          ? {
              unresolvedCount: missingValidations.length,
              unresolved: missingValidations.slice(0, 50)
            }
          : {})
      },
      // On an override the reason field carries the mandatory override reason;
      // otherwise it carries the optional submission note as before.
      reason: didOverride ? overrideReason : submissionNote
    });

    // Notify lead reader if assigned
    if (submission.leadReader) {
      try {
        const leadReader = await User.findById(submission.leadReader);
        const submitter = await User.findById(submission.submitterId);

        if (leadReader && submitter) {
          const baseUrl = process.env.CLIENT_URL || 'http://localhost:5173';
          await emailService.sendSelfStudySubmittedEmail({
            leadReaderName: `${leadReader.firstName} ${leadReader.lastName}`,
            leadReaderEmail: leadReader.email,
            programName: submission.programName,
            institutionName: submission.institutionName,
            submitterName: `${submitter.firstName} ${submitter.lastName}`,
            submissionLink: `${baseUrl}/self-study/${submission._id}`,
            submittedAt: new Date()
          });
        }
      } catch (emailError) {
        console.error('Failed to send submission notification email:', emailError);
        // Don't fail the submission if email fails
      }
    }

    return res.json({
      message: didOverride
        ? 'Self-study submitted with unresolved items (override recorded)'
        : 'Self-study submitted successfully',
      override: didOverride,
      submission: {
        _id: submission._id,
        status: submission.status,
        submittedAt: submission.submittedAt,
        readerLock: submission.readerLock
      }
    });
  } catch (error) {
    console.error('Submit self-study error:', error);
    return res.status(500).json({ error: 'Failed to submit self-study' });
  }
};
