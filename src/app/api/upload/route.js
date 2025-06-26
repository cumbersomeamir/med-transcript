import { NextResponse } from 'next/server';
import { uploadToS3, generateUniqueFilename, validateAudioFile } from '@/lib/s3-upload';

export async function GET() {
  console.log('Test API called');
  
  const envVars = {
    AWS_ACCESS_KEY: process.env.AWS_ACCESS_KEY ? 'SET' : 'MISSING',
    AWS_SECRET_KEY: process.env.AWS_SECRET_KEY ? 'SET' : 'MISSING', 
    S3_BUCKET_NAME: process.env.S3_BUCKET_NAME || 'MISSING',
    AWS_REGION: process.env.AWS_REGION || 'MISSING',
    DIARIZATION_API_URL: process.env.DIARIZATION_API_URL || 'MISSING',
    AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT ? 'SET' : 'MISSING',
    AZURE_OPENAI_API_KEY: process.env.AZURE_OPENAI_API_KEY ? 'SET' : 'MISSING'
  };
  
  console.log('Environment variables:', envVars);
  
  // Test AWS SDK import
  let awsSdkTest = 'OK';
  try {
    const { S3Client } = await import('@aws-sdk/client-s3');
    new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_KEY,
      },
    });
  } catch (error) {
    awsSdkTest = `FAILED: ${error.message}`;
  }
  
  return NextResponse.json({ 
    message: 'Test API working',
    timestamp: new Date().toISOString(),
    environment: envVars,
    awsSdkTest,
    runtime: 'Vercel Edge Function'
  });
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('audio');
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate audio file type
    if (!validateAudioFile(file)) {
      return NextResponse.json({ error: 'Invalid audio file type. Only .mp3 and .wav are supported.' }, { status: 400 });
    }

    // Generate unique filename for S3
    const s3Key = generateUniqueFilename(file.name);

    // Upload to S3
    let awsUrl;
    try {
      awsUrl = await uploadToS3(file, s3Key);
    } catch (err) {
      return NextResponse.json({ error: 'Failed to upload to S3', details: err.message }, { status: 500 });
    }

    return NextResponse.json({
      message: 'File uploaded successfully',
      awsUrl,
      fileInfo: {
        name: file.name,
        size: file.size,
        type: file.type
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Upload POST error:', error);
    return NextResponse.json(
      { error: 'Upload failed', details: error.message },
      { status: 500 }
    );
  }
}