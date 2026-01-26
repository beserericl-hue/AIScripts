import { Router } from 'express';
import { Spec } from '../models/Spec';
import { Institution } from '../models/Institution';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { Response } from 'express';

const router = Router();

// Get all specs
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status } = req.query;
    const filter: any = {};

    if (status) {
      filter.status = status;
    }

    const specs = await Spec.find(filter)
      .populate('uploadedBy', 'firstName lastName email')
      .sort({ uploadedAt: -1 });

    res.json({ specs });
  } catch (error: any) {
    console.error('Error fetching specs:', error);
    res.status(500).json({ error: 'Failed to fetch specs' });
  }
});

// Get a single spec
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const spec = await Spec.findById(req.params.id)
      .populate('uploadedBy', 'firstName lastName email');

    if (!spec) {
      return res.status(404).json({ error: 'Spec not found' });
    }

    res.json({ spec });
  } catch (error: any) {
    console.error('Error fetching spec:', error);
    res.status(500).json({ error: 'Failed to fetch spec' });
  }
});

// Create a new spec (admin only)
router.post('/', authenticateToken, requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, version, description, documentUrl, documentKey, standardsCount } = req.body;

    if (!name || !version) {
      return res.status(400).json({ error: 'Name and version are required' });
    }

    // Check for duplicate name/version
    const existing = await Spec.findOne({ name, version });
    if (existing) {
      return res.status(400).json({ error: 'A spec with this name and version already exists' });
    }

    const spec = new Spec({
      name,
      version,
      description,
      documentUrl,
      documentKey,
      standardsCount: standardsCount || 21,
      uploadedBy: req.user!._id,
      status: 'active'
    });

    await spec.save();

    const populatedSpec = await Spec.findById(spec._id)
      .populate('uploadedBy', 'firstName lastName email');

    res.status(201).json({ spec: populatedSpec });
  } catch (error: any) {
    console.error('Error creating spec:', error);
    res.status(500).json({ error: 'Failed to create spec' });
  }
});

// Update a spec (admin only)
router.put('/:id', authenticateToken, requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, version, description, documentUrl, documentKey, standardsCount, status } = req.body;

    const spec = await Spec.findById(req.params.id);
    if (!spec) {
      return res.status(404).json({ error: 'Spec not found' });
    }

    // Check for duplicate name/version if changing
    if ((name && name !== spec.name) || (version && version !== spec.version)) {
      const existing = await Spec.findOne({
        name: name || spec.name,
        version: version || spec.version,
        _id: { $ne: spec._id }
      });
      if (existing) {
        return res.status(400).json({ error: 'A spec with this name and version already exists' });
      }
    }

    // Update fields
    if (name) spec.name = name;
    if (version) spec.version = version;
    if (description !== undefined) spec.description = description;
    if (documentUrl !== undefined) spec.documentUrl = documentUrl;
    if (documentKey !== undefined) spec.documentKey = documentKey;
    if (standardsCount) spec.standardsCount = standardsCount;
    if (status) spec.status = status;

    await spec.save();

    // Also update specName on any institutions using this spec
    if (name) {
      await Institution.updateMany(
        { specId: spec._id },
        { $set: { specName: `${name} v${version || spec.version}` } }
      );
    }

    const populatedSpec = await Spec.findById(spec._id)
      .populate('uploadedBy', 'firstName lastName email');

    res.json({ spec: populatedSpec });
  } catch (error: any) {
    console.error('Error updating spec:', error);
    res.status(500).json({ error: 'Failed to update spec' });
  }
});

// Archive a spec (admin only)
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const spec = await Spec.findById(req.params.id);
    if (!spec) {
      return res.status(404).json({ error: 'Spec not found' });
    }

    // Check if any institutions are using this spec
    const institutionsUsingSpec = await Institution.countDocuments({ specId: spec._id });
    if (institutionsUsingSpec > 0) {
      return res.status(400).json({
        error: `Cannot delete spec. ${institutionsUsingSpec} institution(s) are currently using it.`
      });
    }

    spec.status = 'archived';
    await spec.save();

    res.json({ message: 'Spec archived successfully' });
  } catch (error: any) {
    console.error('Error archiving spec:', error);
    res.status(500).json({ error: 'Failed to archive spec' });
  }
});

// Get institutions using a specific spec
router.get('/:id/institutions', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const institutions = await Institution.find({ specId: req.params.id })
      .select('name type status')
      .sort({ name: 1 });

    res.json({ institutions });
  } catch (error: any) {
    console.error('Error fetching institutions for spec:', error);
    res.status(500).json({ error: 'Failed to fetch institutions' });
  }
});

export default router;
