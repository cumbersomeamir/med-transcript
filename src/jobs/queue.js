import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');

export const analysisQueue = new Queue('analysis', { connection });
export const diarizationQueue = new Queue('diarization', { connection }); 