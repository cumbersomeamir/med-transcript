import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { AzureOpenAI } from 'openai';
import { diarizationQueue } from './queue';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');

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

const worker = new Worker('analysis', async job => {
  const { transcript } = job.data;
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const apiVersion = "2024-02-15-preview";
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;

  const client = new AzureOpenAI({ endpoint, apiKey, apiVersion, deployment });

  const result = await client.chat.completions.create({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Please analyze this medical conversation transcript:\n\n${transcript}` }
    ],
    max_tokens: 1500,
    temperature: 0.3,
  });

  const analysisText = result.choices[0].message.content;
  let analysis;
  try {
    analysis = JSON.parse(analysisText);
  } catch {
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
  // Save result to Redis for retrieval by job ID
  await connection.set(`analysis:result:${job.id}`, JSON.stringify(analysis), 'EX', 3600);
  return analysis;
}, { connection });

worker.on('completed', job => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});

const diarizationWorker = new Worker('diarization', async job => {
  const { url } = job.data;
  const diarizationApiUrl = process.env.DIARIZATION_API_URL || 'http://20.121.121.110:5286/diarize';
  const requestBody = JSON.stringify({ url });
  const response = await fetch(diarizationApiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: requestBody,
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Diarization API error: ${response.status} - ${errorText}`);
  }
  const data = await response.json();
  await connection.set(`diarization:result:${job.id}`, JSON.stringify(data), 'EX', 3600);
  return data;
}, { connection });

diarizationWorker.on('completed', job => {
  console.log(`Diarization job ${job.id} completed`);
});

diarizationWorker.on('failed', (job, err) => {
  console.error(`Diarization job ${job?.id} failed:`, err);
}); 