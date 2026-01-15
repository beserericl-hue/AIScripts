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
    type: String,
    maxlength: 4000
  },
  url: {
    type: String,
    required: true
  },
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  status: {
    type: String,
    enum: ['pending', 'proposal_generated', 'rejected', 'applied'],
    default: 'pending'
  },
  profile: {
    type: String,
    maxlength: 4000
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

jobSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

jobSchema.index({ status: 1, createdAt: -1 });
jobSchema.index({ title: 'text', description: 'text' });

export default mongoose.model('Job', jobSchema);
