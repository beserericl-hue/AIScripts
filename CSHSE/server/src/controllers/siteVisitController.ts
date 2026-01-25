import { Request, Response } from 'express';
import { SiteVisit } from '../models/SiteVisit';
import { Submission } from '../models/Submission';
import { Institution } from '../models/Institution';
import { User } from '../models/User';
import mongoose from 'mongoose';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    name: string;
    role: string;
  };
}

/**
 * Get all site visits
 */
export const getSiteVisits = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      institutionId,
      leadReaderId,
      upcoming,
      startDate,
      endDate,
      status,
      page = '1',
      limit = '50'
    } = req.query;

    const query: any = {};

    if (institutionId) query.institutionId = institutionId;
    if (leadReaderId) query.leadReaderId = leadReaderId;
    if (status) query.status = status;

    if (upcoming === 'true') {
      query.scheduledDate = { $gte: new Date() };
    }

    if (startDate || endDate) {
      query.scheduledDate = {};
      if (startDate) query.scheduledDate.$gte = new Date(startDate as string);
      if (endDate) query.scheduledDate.$lte = new Date(endDate as string);
    }

    // Filter based on user role
    const userRole = req.user?.role;
    const userId = req.user?.id;

    if (userRole === 'lead_reader') {
      query.leadReaderId = userId;
    } else if (userRole === 'reader') {
      query.readerIds = userId;
    } else if (userRole === 'program_coordinator') {
      // Program coordinator can only see their institution's visits
      const user = await User.findById(userId);
      if (user?.institutionId) {
        query.institutionId = user.institutionId;
      }
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const [siteVisits, total] = await Promise.all([
      SiteVisit.find(query)
        .populate('submissionId', 'submissionId status')
        .populate('leadReaderId', 'firstName lastName email')
        .populate('readerIds', 'firstName lastName email')
        .sort({ scheduledDate: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      SiteVisit.countDocuments(query)
    ]);

    return res.json({
      siteVisits,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get site visits error:', error);
    return res.status(500).json({ error: 'Failed to get site visits' });
  }
};

/**
 * Get single site visit
 */
export const getSiteVisit = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const siteVisit = await SiteVisit.findById(id)
      .populate('submissionId')
      .populate('leadReaderId', 'firstName lastName email')
      .populate('readerIds', 'firstName lastName email')
      .lean();

    if (!siteVisit) {
      return res.status(404).json({ error: 'Site visit not found' });
    }

    return res.json(siteVisit);
  } catch (error) {
    console.error('Get site visit error:', error);
    return res.status(500).json({ error: 'Failed to get site visit' });
  }
};

/**
 * Schedule a site visit (Lead Reader only)
 */
export const scheduleSiteVisit = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'lead_reader' && userRole !== 'admin') {
      return res.status(403).json({ error: 'Lead Reader or Admin access required' });
    }

    const {
      submissionId,
      scheduledDate,
      scheduledTime,
      duration,
      location,
      agenda,
      notes
    } = req.body;

    // Get submission and institution info
    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Create site visit
    const siteVisit = new SiteVisit({
      submissionId,
      institutionId: submission.submitterId, // Assuming submitterId links to institution
      institutionName: submission.institutionName,
      scheduledDate: new Date(scheduledDate),
      scheduledTime,
      duration,
      leadReaderId: req.user!.id,
      leadReaderName: req.user!.name,
      readerIds: submission.assignedReaders,
      readers: [],
      status: 'scheduled',
      location,
      agenda,
      notes,
      scheduledBy: req.user!.id,
      scheduledByName: req.user!.name
    });

    // Populate readers info
    if (submission.assignedReaders.length > 0) {
      const readers = await User.find({ _id: { $in: submission.assignedReaders } });
      siteVisit.readers = readers.map(r => ({
        id: r._id,
        name: `${r.firstName} ${r.lastName}`,
        confirmed: false
      }));
    }

    await siteVisit.save();

    // Update submission with site visit date
    // Note: We need to update the Institution model, not submission
    // This depends on your data model

    // TODO: Send notification emails to:
    // - Administrator
    // - Lead Reader
    // - All assigned Readers
    // - Program Coordinator

    siteVisit.notificationsSent.push({
      type: 'scheduled',
      sentAt: new Date(),
      recipients: [] // TODO: Add actual recipient emails
    });
    await siteVisit.save();

    return res.status(201).json({
      message: 'Site visit scheduled successfully',
      siteVisit
    });
  } catch (error) {
    console.error('Schedule site visit error:', error);
    return res.status(500).json({ error: 'Failed to schedule site visit' });
  }
};

/**
 * Update site visit
 */
export const updateSiteVisit = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'lead_reader' && userRole !== 'admin') {
      return res.status(403).json({ error: 'Lead Reader or Admin access required' });
    }

    const { id } = req.params;
    const updates = req.body;

    const siteVisit = await SiteVisit.findById(id);
    if (!siteVisit) {
      return res.status(404).json({ error: 'Site visit not found' });
    }

    // Track date changes
    const previousDate = siteVisit.scheduledDate;
    let dateChanged = false;

    // Apply updates
    if (updates.scheduledDate && new Date(updates.scheduledDate).getTime() !== previousDate.getTime()) {
      dateChanged = true;
      siteVisit.changeHistory.push({
        changedAt: new Date(),
        changedBy: new mongoose.Types.ObjectId(req.user!.id),
        changedByName: req.user!.name,
        previousDate,
        newDate: new Date(updates.scheduledDate),
        reason: updates.changeReason
      });
    }

    Object.keys(updates).forEach(key => {
      if (key !== '_id' && key !== 'changeReason' && updates[key] !== undefined) {
        (siteVisit as any)[key] = updates[key];
      }
    });

    await siteVisit.save();

    // Send notifications if date changed
    if (dateChanged) {
      // TODO: Send notification emails about date change
      siteVisit.notificationsSent.push({
        type: 'change',
        sentAt: new Date(),
        recipients: []
      });
      await siteVisit.save();
    }

    return res.json({
      message: 'Site visit updated successfully',
      siteVisit
    });
  } catch (error) {
    console.error('Update site visit error:', error);
    return res.status(500).json({ error: 'Failed to update site visit' });
  }
};

/**
 * Cancel site visit
 */
export const cancelSiteVisit = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'lead_reader' && userRole !== 'admin') {
      return res.status(403).json({ error: 'Lead Reader or Admin access required' });
    }

    const { id } = req.params;
    const { reason } = req.body;

    const siteVisit = await SiteVisit.findById(id);
    if (!siteVisit) {
      return res.status(404).json({ error: 'Site visit not found' });
    }

    siteVisit.status = 'cancelled';
    siteVisit.changeHistory.push({
      changedAt: new Date(),
      changedBy: new mongoose.Types.ObjectId(req.user!.id),
      changedByName: req.user!.name,
      reason: reason || 'Cancelled'
    });

    await siteVisit.save();

    // TODO: Send cancellation notifications
    siteVisit.notificationsSent.push({
      type: 'cancelled',
      sentAt: new Date(),
      recipients: []
    });
    await siteVisit.save();

    return res.json({
      message: 'Site visit cancelled',
      siteVisit
    });
  } catch (error) {
    console.error('Cancel site visit error:', error);
    return res.status(500).json({ error: 'Failed to cancel site visit' });
  }
};

/**
 * Confirm reader attendance
 */
export const confirmAttendance = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const siteVisit = await SiteVisit.findById(id);
    if (!siteVisit) {
      return res.status(404).json({ error: 'Site visit not found' });
    }

    // Find the reader in the readers list
    const readerIndex = siteVisit.readers.findIndex(
      r => r.id.toString() === userId
    );

    if (readerIndex === -1) {
      return res.status(403).json({ error: 'You are not assigned to this site visit' });
    }

    siteVisit.readers[readerIndex].confirmed = true;
    siteVisit.readers[readerIndex].confirmedAt = new Date();

    // Check if all readers confirmed
    const allConfirmed = siteVisit.readers.every(r => r.confirmed);
    if (allConfirmed) {
      siteVisit.status = 'confirmed';
    }

    await siteVisit.save();

    return res.json({
      message: 'Attendance confirmed',
      siteVisit
    });
  } catch (error) {
    console.error('Confirm attendance error:', error);
    return res.status(500).json({ error: 'Failed to confirm attendance' });
  }
};
