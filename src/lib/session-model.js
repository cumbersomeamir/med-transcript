import mongoose from 'mongoose';

const SessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  transcript: { type: String, required: true },
  insights: { type: mongoose.Schema.Types.Mixed, required: true },
  audioUrl: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.models.Session || mongoose.model('Session', SessionSchema); 