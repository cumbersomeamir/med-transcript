import { NextResponse } from 'next/server';

export async function GET() {
  console.log('Test API called');
  
  return NextResponse.json({ 
    message: 'API is working!',
    timestamp: new Date().toISOString(),
    env: {
      hasAwsKey: !!process.env.AWS_ACCESS_KEY,
      hasAwsSecret: !!process.env.AWS_SECRET_KEY,
      awsRegion: process.env.AWS_REGION,
      bucketName: process.env.S3_BUCKET_NAME,
      diarizationUrl: process.env.DIARIZATION_API_URL,
      hasAzureEndpoint: !!process.env.AZURE_OPENAI_ENDPOINT,
    }
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    console.log('Test POST API called with:', body);
    
    return NextResponse.json({ 
      message: 'POST test successful',
      receivedData: body,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Test API error:', error);
    return NextResponse.json(
      { error: 'Test API failed', details: error.message },
      { status: 500 }
    );
  }
}