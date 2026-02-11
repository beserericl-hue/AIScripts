import { Submission } from '../models/Submission';
import { Institution } from '../models/Institution';
import { ValidationResult } from '../models/ValidationResult';

/**
 * Backfill institutionId on submissions that were created before the field existed.
 * Matches by institutionName → Institution.name (unique).
 * Also links Institution.currentSubmissionId if not already set.
 */
async function backfillSubmissionInstitutionIds(): Promise<void> {
  const submissions = await Submission.find({
    institutionId: { $exists: false }
  }).lean();

  if (submissions.length === 0) return;

  console.log(`[Migration] Found ${submissions.length} submissions without institutionId`);

  for (const sub of submissions) {
    const institution = await Institution.findOne({ name: sub.institutionName }).lean();
    if (!institution) {
      console.log(`[Migration] No institution found for "${sub.institutionName}" (submission ${sub._id})`);
      continue;
    }

    await Submission.updateOne(
      { _id: sub._id },
      { $set: { institutionId: institution._id } }
    );

    // Also link the institution if it has no currentSubmissionId
    if (!institution.currentSubmissionId) {
      await Institution.updateOne(
        { _id: institution._id },
        { $set: { currentSubmissionId: sub._id } }
      );
    }

    console.log(`[Migration] Linked submission ${sub._id} → institution ${institution._id} (${institution.name})`);
  }
}

/**
 * Backfill standardsStatus from existing ValidationResult documents.
 * Fixes the missing markModified('standardsStatus') bug where validation
 * results were stored but standardsStatus on Submission was never updated.
 */
async function backfillValidationStatus(): Promise<void> {
  // Find the latest pass/fail validation per submission+standard+spec
  const latestValidations = await ValidationResult.aggregate([
    { $match: { 'result.status': { $in: ['pass', 'fail'] } } },
    { $sort: { validatedAt: -1 } },
    {
      $group: {
        _id: {
          submissionId: '$submissionId',
          standardCode: '$standardCode',
          specCode: '$specCode'
        },
        latestResult: { $first: '$result' },
        validatedAt: { $first: '$validatedAt' }
      }
    }
  ]);

  if (latestValidations.length === 0) return;

  console.log(`[Migration] Found ${latestValidations.length} validation results to backfill`);

  // Group by submissionId
  const bySubmission = new Map<string, typeof latestValidations>();
  for (const v of latestValidations) {
    const subId = v._id.submissionId.toString();
    if (!bySubmission.has(subId)) bySubmission.set(subId, []);
    bySubmission.get(subId)!.push(v);
  }

  let updated = 0;
  for (const [subId, validations] of bySubmission) {
    const submission = await Submission.findById(subId);
    if (!submission) continue;

    let changed = false;
    for (const v of validations) {
      const statusKey = `${v._id.standardCode}_${v._id.specCode}`;
      const current = submission.standardsStatus?.get(statusKey);
      const resultStatus = v.latestResult.status;

      // Only update if validationStatus is missing or different
      if (!current?.validationStatus || current.validationStatus !== resultStatus) {
        const newStatus = {
          ...(current || { status: 'in_progress', completionPercentage: 0 }),
          status: resultStatus === 'pass' ? 'validated' : (current?.status || 'in_progress'),
          validationStatus: resultStatus,
          validatedAt: v.validatedAt,
          lastModified: new Date()
        };
        submission.standardsStatus.set(statusKey, newStatus as any);
        changed = true;
      }
    }

    if (changed) {
      submission.markModified('standardsStatus');
      submission.recalculateProgress();
      await submission.save();
      updated++;
      console.log(`[Migration] Backfilled ${validations.length} validation statuses for submission ${subId}`);
    }
  }

  console.log(`[Migration] Backfill complete: updated ${updated} submissions`);
}

/**
 * Run all data migrations on startup.
 * Each migration is idempotent — safe to run multiple times.
 */
export async function runMigrations(): Promise<void> {
  try {
    await backfillSubmissionInstitutionIds();
    await backfillValidationStatus();
  } catch (error) {
    console.error('[Migration] Error running migrations:', error);
  }
}
