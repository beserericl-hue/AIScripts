import { Router, Request, Response } from 'express';
import { getAllStandards, getStandardByCode, getStandardsByPart } from '../data/standards';
import { getLevelStandards } from '../data/levelStandards';
import { Submission } from '../models/Submission';

const router = Router();

/**
 * GET /api/standards
 * Returns all CSHSE standards with their specifications.
 *
 * Level-aware: pass ?level=associate|baccalaureate|masters (or ?submissionId=…
 * to resolve the level from the submission) to get that degree level's official
 * standard titles + specification criteria. Without either param it falls back
 * to the legacy flat catalog so existing callers keep working.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    let level = typeof req.query.level === 'string' ? req.query.level : '';
    const submissionId = typeof req.query.submissionId === 'string' ? req.query.submissionId : '';
    if (!level && submissionId) {
      const sub = await Submission.findById(submissionId).select('programLevel').lean();
      level = (sub as any)?.programLevel || '';
    }
    if (level) {
      const levelStds = getLevelStandards(level);
      if (levelStds) return res.json(levelStds);
    }
    return res.json(getAllStandards());
  } catch (error) {
    console.error('Get standards error:', error);
    return res.status(500).json({ error: 'Failed to get standards' });
  }
});

/**
 * GET /api/standards/part/:part
 * Returns standards for a specific part (I or II)
 */
router.get('/part/:part', (req: Request, res: Response) => {
  try {
    const { part } = req.params;

    if (part !== 'I' && part !== 'II') {
      return res.status(400).json({ error: 'Part must be I or II' });
    }

    const standards = getStandardsByPart(part);
    return res.json(standards);
  } catch (error) {
    console.error('Get standards by part error:', error);
    return res.status(500).json({ error: 'Failed to get standards' });
  }
});

/**
 * GET /api/standards/:code
 * Returns a specific standard by code
 */
router.get('/:code', (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const standard = getStandardByCode(code);

    if (!standard) {
      return res.status(404).json({ error: 'Standard not found' });
    }

    return res.json(standard);
  } catch (error) {
    console.error('Get standard error:', error);
    return res.status(500).json({ error: 'Failed to get standard' });
  }
});

export default router;
