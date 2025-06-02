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

    console.log(`Received audio URL: ${url}`);

    // Use environment variable for diarization API URL
    const diarizationApiUrl = process.env.DIARIZATION_API_URL || 'http://20.121.121.110:5286/diarize';
    console.log(`Using diarization API URL: ${diarizationApiUrl}`);

    // Log the full request being made
    const requestBody = JSON.stringify({ url });
    console.log(`Sending request body: ${requestBody}`);

    // Call your diarization API
    console.log('Making fetch request to diarization API...');
    const response = await fetch(diarizationApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: requestBody,
    });

    console.log(`Diarization API response status: ${response.status}`);
    console.log(`Diarization API response headers:`, Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Diarization API error response: ${errorText}`);
      return NextResponse.json(
        { 
          error: `Diarization API error: ${response.status}`,
          details: errorText,
          requestUrl: diarizationApiUrl,
          requestBody: requestBody
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('Diarization response received:', data);
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in diarization API:', error);
    return NextResponse.json(
      { 
        error: `Failed to process audio diarization: ${error.message}`,
        stack: error.stack
      },
      { status: 500 }
    );
  }
}