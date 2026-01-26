import { Request, Response } from 'express';
import { Spec } from '../models/Spec';
import { Institution } from '../models/Institution';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    _id: string;
    name: string;
    role: string;
  };
}

/**
 * Get all specs
 */
export const getSpecs = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status } = req.query;
    const filter: any = {};

    if (status) {
      filter.status = status;
    }

    const specs = await Spec.find(filter)
      .populate('uploadedBy', 'firstName lastName email')
      .sort({ uploadedAt: -1 });

    return res.json({ specs });
  } catch (error: any) {
    console.error('Error fetching specs:', error);
    return res.status(500).json({ error: 'Failed to fetch specs' });
  }
};

/**
 * Get a single spec
 */
export const getSpec = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const spec = await Spec.findById(req.params.id)
      .populate('uploadedBy', 'firstName lastName email');

    if (!spec) {
      return res.status(404).json({ error: 'Spec not found' });
    }

    return res.json({ spec });
  } catch (error: any) {
    console.error('Error fetching spec:', error);
    return res.status(500).json({ error: 'Failed to fetch spec' });
  }
};

/**
 * Create a new spec (admin only)
 */
export const createSpec = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

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
      uploadedBy: req.user.id,
      status: 'active'
    });

    await spec.save();

    const populatedSpec = await Spec.findById(spec._id)
      .populate('uploadedBy', 'firstName lastName email');

    return res.status(201).json({ spec: populatedSpec });
  } catch (error: any) {
    console.error('Error creating spec:', error);
    return res.status(500).json({ error: 'Failed to create spec' });
  }
};

/**
 * Update a spec (admin only)
 */
export const updateSpec = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

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
    if (name || version) {
      await Institution.updateMany(
        { specId: spec._id },
        { $set: { specName: `${spec.name} v${spec.version}` } }
      );
    }

    const populatedSpec = await Spec.findById(spec._id)
      .populate('uploadedBy', 'firstName lastName email');

    return res.json({ spec: populatedSpec });
  } catch (error: any) {
    console.error('Error updating spec:', error);
    return res.status(500).json({ error: 'Failed to update spec' });
  }
};

/**
 * Archive a spec (admin only)
 */
export const archiveSpec = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

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

    return res.json({ message: 'Spec archived successfully' });
  } catch (error: any) {
    console.error('Error archiving spec:', error);
    return res.status(500).json({ error: 'Failed to archive spec' });
  }
};

/**
 * Get institutions using a specific spec
 */
export const getSpecInstitutions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const institutions = await Institution.find({ specId: req.params.id })
      .select('name type status')
      .sort({ name: 1 });

    return res.json({ institutions });
  } catch (error: any) {
    console.error('Error fetching institutions for spec:', error);
    return res.status(500).json({ error: 'Failed to fetch institutions' });
  }
};
