import express from 'express';
import Team from '../models/Team.js';
import User from '../models/User.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Get all teams (admin only)
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const teams = await Team.find()
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    // Get member count for each team
    const teamsWithCounts = await Promise.all(
      teams.map(async (team) => {
        const memberCount = await User.countDocuments({ teamId: team._id });
        return {
          ...team.toObject(),
          memberCount
        };
      })
    );

    res.json(teamsWithCounts);
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// Get team members (users in the same team as current user)
// NOTE: This route MUST come before /:id to avoid "my" being treated as an ID
router.get('/my/members', authenticate, async (req, res) => {
  try {
    if (!req.user.teamId) {
      return res.json([]);
    }

    const members = await User.find({ teamId: req.user.teamId })
      .select('name email role lastProfileId')
      .populate('lastProfileId', 'name')
      .sort({ name: 1 });

    res.json(members);
  } catch (error) {
    console.error('Error fetching team members:', error);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

// Get single team with members
router.get('/:id', authenticate, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('createdBy', 'name email');

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Get team members
    const members = await User.find({ teamId: team._id })
      .select('name email role createdAt')
      .sort({ name: 1 });

    res.json({
      ...team.toObject(),
      members
    });
  } catch (error) {
    console.error('Error fetching team:', error);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

// Create new team (admin only)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, description } = req.body;

    console.log('Creating team with data:', { name, description, userId: req.user._id });

    if (!name?.trim()) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    // Check if team name already exists
    const existingTeam = await Team.findOne({ name: name.trim() });
    if (existingTeam) {
      return res.status(400).json({ error: 'A team with this name already exists' });
    }

    const team = new Team({
      name: name.trim(),
      description: description || '',
      createdBy: req.user._id
    });

    await team.save();
    console.log('Team created successfully:', team._id);
    res.status(201).json(team);
  } catch (error) {
    console.error('Error creating team:', error);
    // Provide more specific error messages
    if (error.code === 11000) {
      return res.status(400).json({ error: 'A team with this name already exists' });
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    res.status(500).json({ error: 'Failed to create team: ' + error.message });
  }
});

// Update team (admin only)
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, description, isActive } = req.body;

    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Check for duplicate name if name is being changed
    if (name && name.trim() !== team.name) {
      const existingTeam = await Team.findOne({
        name: name.trim(),
        _id: { $ne: req.params.id }
      });

      if (existingTeam) {
        return res.status(400).json({ error: 'A team with this name already exists' });
      }
    }

    team.name = name?.trim() || team.name;
    team.description = description !== undefined ? description : team.description;
    team.isActive = isActive !== undefined ? isActive : team.isActive;

    await team.save();
    res.json(team);
  } catch (error) {
    console.error('Error updating team:', error);
    res.status(500).json({ error: 'Failed to update team' });
  }
});

// Assign user to team (admin only)
router.post('/:id/members', authenticate, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.body;

    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.teamId = team._id;
    await user.save();

    res.json({ message: `User ${user.name} assigned to team ${team.name}` });
  } catch (error) {
    console.error('Error assigning user to team:', error);
    res.status(500).json({ error: 'Failed to assign user to team' });
  }
});

// Remove user from team (admin only)
router.delete('/:id/members/:userId', authenticate, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.teamId?.toString() !== req.params.id) {
      return res.status(400).json({ error: 'User is not a member of this team' });
    }

    user.teamId = null;
    await user.save();

    res.json({ message: `User ${user.name} removed from team` });
  } catch (error) {
    console.error('Error removing user from team:', error);
    res.status(500).json({ error: 'Failed to remove user from team' });
  }
});

// Delete team (admin only)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Check if team has members
    const memberCount = await User.countDocuments({ teamId: team._id });
    if (memberCount > 0) {
      return res.status(400).json({
        error: `Cannot delete team with ${memberCount} members. Remove all members first.`
      });
    }

    await Team.findByIdAndDelete(req.params.id);
    res.json({ message: 'Team deleted' });
  } catch (error) {
    console.error('Error deleting team:', error);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

export default router;
