import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'Audio URL is required' },
        { status: 400 }
      );
    }

    console.log(`Sending audio URL to diarization API: ${url}`);

    // Use environment variable for diarization API URL
    const diarizationApiUrl = process.env.DIARIZATION_API_URL;

    // Call your diarization API
    const response = await fetch(diarizationApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Diarization API error: ${response.status} - ${errorText}`);
      throw new Error(`Diarization API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Diarization completed successfully');
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in diarization API:', error);
    return NextResponse.json(
      { error: `Failed to process audio diarization: ${error.message}` },
      { status: 500 }
    );
  }
}