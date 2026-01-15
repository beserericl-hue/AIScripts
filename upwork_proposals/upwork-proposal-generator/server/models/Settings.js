import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  n8nWebhookUrl: {
    type: String,
    default: ''
  },
  n8nEvaluationWebhookUrl: {
    type: String,
    default: ''
  },
  mongodbUrl: {
    type: String,
    default: ''
  },
  mongodbUser: {
    type: String,
    default: ''
  },
  mongodbPassword: {
    type: String,
    default: ''
  },
  mongodbDatabase: {
    type: String,
    default: ''
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

settingsSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model('Settings', settingsSchema);
