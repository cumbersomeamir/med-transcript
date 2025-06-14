import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let requestBody;
    let fetchHeaders = {};
    let url;

    if (contentType.includes('application/json')) {
      ({ url } = await request.json());

      if (!url) {
        return NextResponse.json(
          { error: 'Audio URL is required' },
          { status: 400 }
        );
      }

      console.log(`Received audio URL: ${url}`);
      requestBody = JSON.stringify({ url });
      fetchHeaders['Content-Type'] = 'application/json';
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('audio');

      if (!file) {
        return NextResponse.json(
          { error: 'Audio file is required' },
          { status: 400 }
        );
      }

      console.log(`Received audio file: ${file.name}`);
      const buffer = Buffer.from(await file.arrayBuffer());
      requestBody = buffer;
      fetchHeaders['Content-Type'] = file.type || 'application/octet-stream';
    } else {
      return NextResponse.json(
        { error: 'Unsupported Content-Type' },
        { status: 400 }
      );
    }

    // Use environment variable for diarization API URL
    const diarizationApiUrl = process.env.DIARIZATION_API_URL || 'http://20.121.121.110:5286/diarize';
    console.log(`Using diarization API URL: ${diarizationApiUrl}`);

    console.log('Making fetch request to diarization API...');
    const response = await fetch(diarizationApiUrl, {
      method: 'POST',
      headers: fetchHeaders,
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