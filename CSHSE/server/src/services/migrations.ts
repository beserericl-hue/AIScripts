import { Submission } from '../models/Submission';
import { Institution } from '../models/Institution';

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
 * Run all data migrations on startup.
 * Each migration is idempotent — safe to run multiple times.
 */
export async function runMigrations(): Promise<void> {
  try {
    await backfillSubmissionInstitutionIds();
  } catch (error) {
    console.error('[Migration] Error running migrations:', error);
  }
}
