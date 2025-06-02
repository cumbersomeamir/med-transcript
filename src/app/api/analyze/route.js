import { NextResponse } from 'next/server';
import { AzureOpenAI } from "openai";

export async function POST(request) {
  try {
    const { transcript } = await request.json();

    if (!transcript) {
      return NextResponse.json(
        { error: 'Transcript is required' },
        { status: 400 }
      );
    }

    console.log('Starting analysis of transcript...');

    // Initialize Azure OpenAI client with API key (simpler approach)
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const apiVersion = "2024-02-15-preview";
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;

    if (!endpoint || !apiKey) {
      console.error('Missing Azure OpenAI configuration');
      return NextResponse.json(
        { error: 'Azure OpenAI not configured properly' },
        { status: 500 }
      );
    }

    const client = new AzureOpenAI({
      endpoint,
      apiKey,
      apiVersion,
      deployment
    });

    const systemPrompt = `You are a medical conversation analysis AI. Analyze the following doctor-patient conversation transcript and provide insights in the following JSON format:

{
  "summary": "A concise summary of the conversation highlighting the main medical concerns, symptoms, and diagnosis/treatment discussed",
  "keyPoints": [
    "Key point 1",
    "Key point 2",
    "Key point 3"
  ],
  "followUp": [
    "Follow-up action 1",
    "Follow-up action 2"
  ],
  "medicalTerms": [
    {
      "term": "medical term",
      "definition": "explanation of the term"
    }
  ],
  "symptoms": ["list of symptoms mentioned"],
  "diagnosis": "potential diagnosis mentioned",
  "treatmentPlan": "treatment plan discussed"
}

Focus on accuracy and provide clinically relevant insights.`;

    console.log('Calling Azure OpenAI...');
    const result = await client.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Please analyze this medical conversation transcript:\n\n${transcript}` }
      ],
      max_tokens: 1500,
      temperature: 0.3,
    });

    const analysisText = result.choices[0].message.content;
    console.log('Azure OpenAI response received');
    
    // Try to parse as JSON, fallback to structured response if parsing fails
    let analysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch (parseError) {
      console.log('JSON parsing failed, creating structured response');
      // Fallback structured response
      analysis = {
        summary: analysisText.substring(0, 500) + "...",
        keyPoints: ["Analysis completed", "Please review transcript"],
        followUp: ["Schedule follow-up appointment"],
        medicalTerms: [],
        symptoms: [],
        diagnosis: "To be determined",
        treatmentPlan: "To be discussed"
      };
    }

    console.log('Analysis completed successfully');
    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Error in analysis API:', error);
    return NextResponse.json(
      { error: `Failed to analyze transcript: ${error.message}` },
      { status: 500 }
    );
  }
}