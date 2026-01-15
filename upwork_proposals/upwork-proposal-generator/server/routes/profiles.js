import express from 'express';
import Profile from '../models/Profile.js';
import User from '../models/User.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Get all profiles for a specific user (must be in same team)
router.get('/user/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;

    // Verify the requested user is in the same team
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check team membership (same team or admin)
    if (req.user.teamId?.toString() !== targetUser.teamId?.toString() && req.user.role !== 'administrator') {
      return res.status(403).json({ error: 'Access denied - user not in your team' });
    }

    const profiles = await Profile.find({
      userId,
      teamId: req.user.teamId
    }).sort({ updatedAt: -1 });

    res.json(profiles);
  } catch (error) {
    console.error('Error fetching user profiles:', error);
    res.status(500).json({ error: 'Failed to fetch profiles' });
  }
});

// Get all profiles for current user
router.get('/my', authenticate, async (req, res) => {
  try {
    const profiles = await Profile.find({
      userId: req.user._id
    }).sort({ updatedAt: -1 });

    res.json(profiles);
  } catch (error) {
    console.error('Error fetching profiles:', error);
    res.status(500).json({ error: 'Failed to fetch profiles' });
  }
});

// Get single profile
router.get('/:id', authenticate, async (req, res) => {
  try {
    const profile = await Profile.findById(req.params.id)
      .populate('userId', 'name email');

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Verify team membership
    if (profile.teamId?.toString() !== req.user.teamId?.toString() && req.user.role !== 'administrator') {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(profile);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Create new profile
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, content } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: 'Profile name is required' });
    }

    // Check if user has a team assigned
    if (!req.user.teamId) {
      return res.status(400).json({ error: 'You must be assigned to a team to create profiles' });
    }

    // Check if profile name already exists for this user
    const existingProfile = await Profile.findOne({
      userId: req.user._id,
      name: name.trim()
    });

    if (existingProfile) {
      return res.status(400).json({ error: 'A profile with this name already exists' });
    }

    // If this is the first profile, mark it as last used
    const profileCount = await Profile.countDocuments({ userId: req.user._id });

    const profile = new Profile({
      name: name.trim(),
      content: content || '',
      userId: req.user._id,
      teamId: req.user.teamId,
      isLastUsed: profileCount === 0
    });

    await profile.save();

    // Update user's lastProfileId if this is the first profile
    if (profileCount === 0) {
      await User.findByIdAndUpdate(req.user._id, { lastProfileId: profile._id });
    }

    res.status(201).json(profile);
  } catch (error) {
    console.error('Error creating profile:', error);
    res.status(500).json({ error: 'Failed to create profile' });
  }
});

// Update profile
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { name, content } = req.body;

    const profile = await Profile.findById(req.params.id);

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Verify ownership
    if (profile.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You can only edit your own profiles' });
    }

    // Check for duplicate name if name is being changed
    if (name && name.trim() !== profile.name) {
      const existingProfile = await Profile.findOne({
        userId: req.user._id,
        name: name.trim(),
        _id: { $ne: req.params.id }
      });

      if (existingProfile) {
        return res.status(400).json({ error: 'A profile with this name already exists' });
      }
    }

    profile.name = name?.trim() || profile.name;
    profile.content = content !== undefined ? content : profile.content;
    await profile.save();

    res.json(profile);
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Set profile as last used (for current user)
router.post('/:id/set-active', authenticate, async (req, res) => {
  try {
    const profile = await Profile.findById(req.params.id);

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Clear isLastUsed on all user's profiles
    await Profile.updateMany(
      { userId: req.user._id },
      { isLastUsed: false }
    );

    // Set this profile as last used
    profile.isLastUsed = true;
    await profile.save();

    // Update user's lastProfileId
    await User.findByIdAndUpdate(req.user._id, { lastProfileId: profile._id });

    res.json(profile);
  } catch (error) {
    console.error('Error setting active profile:', error);
    res.status(500).json({ error: 'Failed to set active profile' });
  }
});

// Delete profile
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const profile = await Profile.findById(req.params.id);

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Verify ownership
    if (profile.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You can only delete your own profiles' });
    }

    await Profile.findByIdAndDelete(req.params.id);

    // If this was the last used profile, update user's lastProfileId
    if (profile.isLastUsed) {
      const nextProfile = await Profile.findOne({ userId: req.user._id }).sort({ updatedAt: -1 });
      if (nextProfile) {
        nextProfile.isLastUsed = true;
        await nextProfile.save();
        await User.findByIdAndUpdate(req.user._id, { lastProfileId: nextProfile._id });
      } else {
        await User.findByIdAndUpdate(req.user._id, { lastProfileId: null });
      }
    }

    res.json({ message: 'Profile deleted' });
  } catch (error) {
    console.error('Error deleting profile:', error);
    res.status(500).json({ error: 'Failed to delete profile' });
  }
});

export default router;
