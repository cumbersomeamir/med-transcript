import { NextRequest, NextResponse } from 'next/server';
import { uploadToS3, generateUniqueFilename, validateAudioFile } from '@/lib/s3-upload';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('audio');

    if (!file) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    // Validate file format (accepts .mp3 and .wav like your Python code)
    if (!validateAudioFile(file)) {
      return NextResponse.json(
        { error: 'Unsupported file format. Please upload .mp3 or .wav files only.' },
        { status: 400 }
      );
    }

    console.log(`Processing file: ${file.name}`);

    // Generate unique filename (s3_key in your Python terminology)
    const s3Key = generateUniqueFilename(file.name);

    // Upload to S3 (required for Vercel deployment)
    if (!process.env.AWS_ACCESS_KEY || !process.env.AWS_SECRET_KEY || !process.env.S3_BUCKET_NAME) {
      return NextResponse.json(
        { error: 'AWS S3 credentials not configured. Please set AWS_ACCESS_KEY, AWS_SECRET_KEY, and S3_BUCKET_NAME environment variables.' },
        { status: 500 }
      );
    }

    try {
      console.log(`Uploading ${file.name} to S3...`);
      const s3Url = await uploadToS3(file, s3Key);
      
      return NextResponse.json({ 
        success: true, 
        awsUrl: s3Url,
        filename: s3Key,
        message: `Successfully uploaded to S3: ${s3Url}`
      });
    } catch (s3Error) {
      console.error('S3 upload failed:', s3Error.message);
      return NextResponse.json(
        { error: `S3 upload failed: ${s3Error.message}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: `Failed to upload file: ${error.message}` },
      { status: 500 }
    );
  }
}