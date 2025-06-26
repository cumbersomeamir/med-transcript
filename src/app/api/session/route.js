import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Session from '@/lib/session-model';
import { v4 as uuidv4 } from 'uuid';

// GET all sessions
export async function GET(request) {
  await connectToDatabase();
  const sessions = await Session.find({}, '-_id sessionId transcript insights audioUrl createdAt updatedAt').sort({ updatedAt: -1 });
  return NextResponse.json(sessions);
}

// POST create new session
export async function POST(request) {
  await connectToDatabase();
  const { transcript, insights, audioUrl } = await request.json();
  const sessionId = uuidv4();
  const session = await Session.create({ sessionId, transcript, insights, audioUrl });
  return NextResponse.json({ sessionId, createdAt: session.createdAt });
} 