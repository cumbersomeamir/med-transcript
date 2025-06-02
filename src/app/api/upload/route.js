import { NextResponse } from 'next/server';

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
    // Test file upload without S3
    const formData = await request.formData();
    const file = formData.get('audio');
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    const fileInfo = {
      name: file.name,
      size: file.size,
      type: file.type
    };
    
    // Test environment again
    const envCheck = {
      hasAwsKey: !!process.env.AWS_ACCESS_KEY,
      hasAwsSecret: !!process.env.AWS_SECRET_KEY,
      bucketName: process.env.S3_BUCKET_NAME,
      region: process.env.AWS_REGION
    };
    
    return NextResponse.json({
      message: 'File received successfully',
      fileInfo,
      envCheck,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Test POST error:', error);
    return NextResponse.json(
      { error: 'Test failed', details: error.message },
      { status: 500 }
    );
  }
}