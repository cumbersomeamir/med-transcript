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

    const systemPrompt = `You are gpt4omini, a medical conversation analysis AI. Analyze the doctor-patient conversation transcript and return insights in the following JSON format:

    {
      "summary": "A well-structured summary of the conversation for quick reference",
      "keyPoints": [
        "Key insight 1",
        "Key insight 2",
        "Key insight 3"
      ],
      "followUp": [
        "Recommended follow-up 1",
        "Recommended follow-up 2"
      ],
      "medicalTerms": [
        {
          "term": "medical term",
          "definition": "brief explanation"
        }
      ],
      "symptoms": ["list any symptoms mentioned"],
      "diagnosis": "possible diagnosis mentioned",
      "treatmentPlan": "treatment plan discussed"
    }

    Provide the summary in a clear, organized manner and highlight key insights and factual details useful for the doctor.`;

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
