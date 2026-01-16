import mongoose from 'mongoose';

const profileSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    maxlength: 4000,
    default: ''
  },
  // User who owns this profile
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Team this profile belongs to (for filtering)
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true
  },
  // Track if this is the last used profile for this user
  isLastUsed: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

profileSchema.pre('save', function() {
  this.updatedAt = Date.now();
});

// Compound index for user's profiles
profileSchema.index({ userId: 1, teamId: 1 });
profileSchema.index({ userId: 1, name: 1 }, { unique: true });

export default mongoose.model('Profile', profileSchema);
