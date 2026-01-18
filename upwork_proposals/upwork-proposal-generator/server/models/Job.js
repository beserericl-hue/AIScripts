import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema({
  jobId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  url: {
    type: String
  },
  // Source of the job (manual, gigradar, n8n, etc.)
  source: {
    type: String,
    enum: ['manual', 'gigradar', 'n8n', 'api'],
    default: 'manual'
  },
  rating: {
    type: Number,
    min: 1,
    max: 10
  },
  status: {
    type: String,
    enum: ['pending', 'proposal_generated', 'rejected', 'submitted', 'won', 'lost'],
    default: 'pending'
  },
  profile: {
    type: String,
    maxlength: 4000
  },
  // Team assignment for multi-tenant filtering
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    index: true
  },
  // Reference to the profile used for this job's proposal
  profileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Profile'
  },
  // Data from N8N evaluation webhook
  evaluationData: {
    type: mongoose.Schema.Types.Mixed
  },
  // Generated proposal data
  proposalData: {
    coverLetter: String,
    docUrl: String,
    mermaidDiagram: String,
    mermaidImageUrl: String
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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

jobSchema.pre('save', function() {
  this.updatedAt = Date.now();
});

jobSchema.index({ status: 1, createdAt: -1 });
jobSchema.index({ title: 'text', description: 'text' });

export default mongoose.model('Job', jobSchema);
