import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const apiKeySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  key: {
    type: String,
    required: true,
    unique: true
  },
  hashedKey: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastUsed: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

apiKeySchema.statics.generateKey = function() {
  return `upw_${uuidv4().replace(/-/g, '')}`;
};

export default mongoose.model('ApiKey', apiKeySchema);
