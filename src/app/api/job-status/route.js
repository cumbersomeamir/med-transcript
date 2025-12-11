import { NextResponse } from 'next/server';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');
  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
  }
  // Try to get analysis result
  let result = await connection.get(`analysis:result:${jobId}`);
  if (result) {
    return NextResponse.json({ status: 'completed', type: 'analysis', result: JSON.parse(result) });
  }
  // Try to get diarization result
  result = await connection.get(`diarization:result:${jobId}`);
  if (result) {
    return NextResponse.json({ status: 'completed', type: 'diarization', result: JSON.parse(result) });
  }
  return NextResponse.json({ status: 'processing' });
} 