import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
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

    // For production: Upload to S3 (matching your Python code structure)
    if (process.env.AWS_ACCESS_KEY && process.env.AWS_SECRET_KEY && process.env.S3_BUCKET_NAME) {
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
        console.error('S3 upload failed, falling back to local storage:', s3Error.message);
        // Continue to local storage fallback
      }
    } else {
      console.log('AWS credentials not configured, using local storage for development');
    }

    // Fallback: Local storage for development
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    try {
      await mkdir(uploadsDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    const filepath = path.join(uploadsDir, s3Key);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    // Return the local URL with a mock AWS URL for development
    const localUrl = `/uploads/${s3Key}`;
    // Use your actual bucket and region format for mock URL
    const mockAwsUrl = `https://${process.env.S3_BUCKET_NAME || 'mygenerateddatabucket'}.s3.${process.env.AWS_REGION || 'eu-north-1'}.amazonaws.com/${s3Key}`;

    console.log(`Saved locally: ${localUrl}`);

    return NextResponse.json({ 
      success: true, 
      localUrl: localUrl,
      awsUrl: mockAwsUrl, // Use this for development
      filename: s3Key,
      message: `File saved locally for development: ${localUrl}`
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: `Failed to upload file: ${error.message}` },
      { status: 500 }
    );
  }
}