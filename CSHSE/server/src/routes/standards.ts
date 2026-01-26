import { Router, Request, Response } from 'express';
import { getAllStandards, getStandardByCode, getStandardsByPart } from '../data/standards';

const router = Router();

/**
 * GET /api/standards
 * Returns all CSHSE standards with their specifications
 */
router.get('/', (_req: Request, res: Response) => {
  try {
    const standards = getAllStandards();
    return res.json(standards);
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
