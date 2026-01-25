import { Request, Response } from 'express';
import { ChangeRequest } from '../models/ChangeRequest';
import { Submission } from '../models/Submission';
import { Institution } from '../models/Institution';
import { SiteVisit } from '../models/SiteVisit';
import mongoose from 'mongoose';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    name: string;
    role: string;
  };
}

/**
 * Get all change requests
 */
export const getChangeRequests = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId, type, status, page = '1', limit = '50' } = req.query;
    const userRole = req.user?.role;
    const userId = req.user?.id;

    const query: any = {};

    if (submissionId) query.submissionId = submissionId;
    if (type) query.type = type;
    if (status) query.status = status;

    // Filter based on role
    if (userRole === 'program_coordinator') {
      query.requestedBy = userId;
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const [changeRequests, total] = await Promise.all([
      ChangeRequest.find(query)
        .populate('submissionId', 'submissionId institutionName')
        .populate('requestedBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      ChangeRequest.countDocuments(query)
    ]);

    return res.json({
      changeRequests,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get change requests error:', error);
    return res.status(500).json({ error: 'Failed to get change requests' });
  }
};

/**
 * Get single change request
 */
export const getChangeRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const changeRequest = await ChangeRequest.findById(id)
      .populate('submissionId')
      .populate('requestedBy', 'firstName lastName email')
      .lean();

    if (!changeRequest) {
      return res.status(404).json({ error: 'Change request not found' });
    }

    return res.json(changeRequest);
  } catch (error) {
    console.error('Get change request error:', error);
    return res.status(500).json({ error: 'Failed to get change request' });
  }
};

/**
 * Create a change request (Program Coordinator only)
 */
export const createChangeRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'program_coordinator') {
      return res.status(403).json({ error: 'Program Coordinator access required' });
    }

    const { submissionId, type, requestedValue, reason, siteVisitId } = req.body;

    // Get submission info
    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Get current value based on type
    let currentValue: string;
    if (type === 'deadline') {
      // Get from institution
      const institution = await Institution.findOne({ currentSubmissionId: submissionId });
      currentValue = institution?.accreditationDeadline?.toISOString().split('T')[0] || 'Not set';
    } else if (type === 'site_visit') {
      const siteVisit = await SiteVisit.findById(siteVisitId);
      if (!siteVisit) {
        return res.status(400).json({ error: 'Site visit not found' });
      }
      currentValue = siteVisit.scheduledDate.toISOString().split('T')[0];
    } else {
      return res.status(400).json({ error: 'Invalid change request type' });
    }

    // Check for existing pending request
    const existingRequest = await ChangeRequest.findOne({
      submissionId,
      type,
      status: 'pending'
    });

    if (existingRequest) {
      return res.status(409).json({
        error: 'A pending change request already exists for this type',
        existingRequestId: existingRequest._id
      });
    }

    // Get institution info
    const institution = await Institution.findOne({ currentSubmissionId: submissionId });

    const changeRequest = new ChangeRequest({
      submissionId,
      institutionId: institution?._id,
      institutionName: submission.institutionName,
      type,
      currentValue,
      requestedValue,
      reason,
      requestedBy: req.user!.id,
      requestedByName: req.user!.name,
      requestedByRole: req.user!.role,
      status: 'pending',
      siteVisitId: type === 'site_visit' ? siteVisitId : undefined
    });

    await changeRequest.save();

    // TODO: Send notification to admin and lead reader
    changeRequest.notifications.push({
      type: 'request_created',
      sentAt: new Date(),
      recipients: [] // TODO: Add admin and lead reader emails
    });
    await changeRequest.save();

    return res.status(201).json({
      message: 'Change request submitted successfully',
      changeRequest
    });
  } catch (error) {
    console.error('Create change request error:', error);
    return res.status(500).json({ error: 'Failed to create change request' });
  }
};

/**
 * Approve a change request (Admin or Lead Reader)
 */
export const approveChangeRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'admin' && userRole !== 'lead_reader') {
      return res.status(403).json({ error: 'Admin or Lead Reader access required' });
    }

    const { id } = req.params;
    const { comments } = req.body;

    const changeRequest = await ChangeRequest.findById(id);
    if (!changeRequest) {
      return res.status(404).json({ error: 'Change request not found' });
    }

    if (changeRequest.status !== 'pending') {
      return res.status(400).json({ error: `Cannot approve a ${changeRequest.status} request` });
    }

    // Determine which approval to update
    const approvalKey = userRole === 'admin' ? 'admin' : 'leadReader';

    // Check if already approved by this role
    if (changeRequest.approvals[approvalKey].approved !== undefined) {
      return res.status(400).json({ error: `Already responded as ${userRole}` });
    }

    // Set approval
    changeRequest.approvals[approvalKey] = {
      role: userRole === 'admin' ? 'admin' : 'lead_reader',
      userId: new mongoose.Types.ObjectId(req.user!.id),
      userName: req.user!.name,
      approved: true,
      approvedAt: new Date(),
      comments
    };

    await changeRequest.save();

    // Check if both approved
    const isFullyApproved =
      changeRequest.approvals.admin.approved === true &&
      changeRequest.approvals.leadReader.approved === true;

    if (isFullyApproved) {
      // Implement the change
      await implementChange(changeRequest);

      // Send notification
      changeRequest.notifications.push({
        type: 'fully_approved',
        sentAt: new Date(),
        recipients: [] // TODO: Add program coordinator email
      });
    } else {
      // Notify about partial approval
      changeRequest.notifications.push({
        type: 'approval_received',
        sentAt: new Date(),
        recipients: []
      });
    }

    await changeRequest.save();

    return res.json({
      message: isFullyApproved
        ? 'Change request fully approved and implemented'
        : 'Approval recorded. Waiting for other approval.',
      changeRequest,
      fullyApproved: isFullyApproved
    });
  } catch (error) {
    console.error('Approve change request error:', error);
    return res.status(500).json({ error: 'Failed to approve change request' });
  }
};

/**
 * Deny a change request (Admin or Lead Reader)
 */
export const denyChangeRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'admin' && userRole !== 'lead_reader') {
      return res.status(403).json({ error: 'Admin or Lead Reader access required' });
    }

    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'Denial reason is required' });
    }

    const changeRequest = await ChangeRequest.findById(id);
    if (!changeRequest) {
      return res.status(404).json({ error: 'Change request not found' });
    }

    if (changeRequest.status !== 'pending') {
      return res.status(400).json({ error: `Cannot deny a ${changeRequest.status} request` });
    }

    // Determine which approval to update
    const approvalKey = userRole === 'admin' ? 'admin' : 'leadReader';

    // Set denial
    changeRequest.approvals[approvalKey] = {
      role: userRole === 'admin' ? 'admin' : 'lead_reader',
      userId: new mongoose.Types.ObjectId(req.user!.id),
      userName: req.user!.name,
      approved: false,
      approvedAt: new Date(),
      comments: reason
    };

    // Mark as denied
    changeRequest.status = 'denied';
    changeRequest.finalDecision = {
      approved: false,
      decidedAt: new Date()
    };

    await changeRequest.save();

    // Send notification
    changeRequest.notifications.push({
      type: 'denied',
      sentAt: new Date(),
      recipients: [] // TODO: Add program coordinator email
    });
    await changeRequest.save();

    return res.json({
      message: 'Change request denied',
      changeRequest
    });
  } catch (error) {
    console.error('Deny change request error:', error);
    return res.status(500).json({ error: 'Failed to deny change request' });
  }
};

/**
 * Withdraw a change request (Program Coordinator only)
 */
export const withdrawChangeRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const changeRequest = await ChangeRequest.findById(id);
    if (!changeRequest) {
      return res.status(404).json({ error: 'Change request not found' });
    }

    // Only requester can withdraw
    if (changeRequest.requestedBy.toString() !== req.user!.id) {
      return res.status(403).json({ error: 'Only the requester can withdraw' });
    }

    if (changeRequest.status !== 'pending') {
      return res.status(400).json({ error: `Cannot withdraw a ${changeRequest.status} request` });
    }

    changeRequest.status = 'withdrawn';
    await changeRequest.save();

    return res.json({
      message: 'Change request withdrawn',
      changeRequest
    });
  } catch (error) {
    console.error('Withdraw change request error:', error);
    return res.status(500).json({ error: 'Failed to withdraw change request' });
  }
};

/**
 * Helper function to implement the approved change
 */
async function implementChange(changeRequest: any): Promise<void> {
  try {
    if (changeRequest.type === 'deadline') {
      // Update institution deadline
      await Institution.findByIdAndUpdate(changeRequest.institutionId, {
        accreditationDeadline: new Date(changeRequest.requestedValue)
      });
    } else if (changeRequest.type === 'site_visit') {
      // Update site visit date
      await SiteVisit.findByIdAndUpdate(changeRequest.siteVisitId, {
        scheduledDate: new Date(changeRequest.requestedValue),
        status: 'rescheduled',
        $push: {
          changeHistory: {
            changedAt: new Date(),
            changedBy: changeRequest.approvals.admin.userId || changeRequest.approvals.leadReader.userId,
            changedByName: 'Change Request Approved',
            previousDate: new Date(changeRequest.currentValue),
            newDate: new Date(changeRequest.requestedValue),
            reason: 'Approved change request'
          }
        }
      });
    }

    changeRequest.finalDecision.implementedAt = new Date();
    await changeRequest.save();
  } catch (error) {
    console.error('Implement change error:', error);
    throw error;
  }
}

/**
 * Get pending change requests for dashboard
 */
export const getPendingChangeRequests = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userRole = req.user?.role;

    if (userRole !== 'admin' && userRole !== 'lead_reader') {
      return res.status(403).json({ error: 'Admin or Lead Reader access required' });
    }

    const query: any = { status: 'pending' };

    // For lead reader, show only requests where they haven't responded yet
    if (userRole === 'lead_reader') {
      query['approvals.leadReader.approved'] = { $exists: false };
    }

    const pendingRequests = await ChangeRequest.find(query)
      .populate('submissionId', 'submissionId institutionName')
      .populate('requestedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return res.json({
      pendingRequests,
      count: pendingRequests.length
    });
  } catch (error) {
    console.error('Get pending change requests error:', error);
    return res.status(500).json({ error: 'Failed to get pending change requests' });
  }
};
