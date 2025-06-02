import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Initialize S3 client using the same structure as your Python code
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});

export async function uploadToS3(file, s3Key) {
  /**
   * Uploads a file to S3 and returns the file URL.
   * Matches the Python upload_file_to_s3 function structure
   */
  try {
    if (!process.env.AWS_ACCESS_KEY || !process.env.AWS_SECRET_KEY) {
      throw new Error('AWS credentials not available');
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: s3Key,
      Body: buffer,
      ContentType: file.type,
    });

    await s3Client.send(command);
    
    // Return the S3 URL using the same format as Python code
    const s3Url = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
    console.log(`Uploaded: ${s3Url}`);
    return s3Url;
  } catch (error) {
    if (error.name === 'NoCredentialsError' || error.message.includes('credentials')) {
      console.error('Error: AWS credentials not available');
    } else {
      console.error(`Error uploading ${s3Key}: ${error.message}`);
    }
    throw new Error('Failed to upload file to S3');
  }
}

export function generateUniqueFilename(originalFilename) {
  /**
   * Generates a unique filename while preserving the original extension
   * Supports .mp3 and .wav formats as specified in your Python code
   */
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const extension = originalFilename.split('.').pop().toLowerCase();
  
  // Validate supported audio formats (matching your Python code)
  const supportedFormats = ['mp3', 'wav', 'jpeg', 'jpg', 'png', 'webp', 'mp4'];
  if (!supportedFormats.includes(extension)) {
    throw new Error(`Unsupported file format: .${extension}. Supported formats: ${supportedFormats.join(', ')}`);
  }
  
  return `audio_${timestamp}_${randomString}.${extension}`;
}

export function validateAudioFile(file) {
  /**
   * Validates if the uploaded file is a supported audio format
   */
  const fileName = file.name.toLowerCase();
  const supportedAudioFormats = ['.mp3', '.wav'];
  
  return supportedAudioFormats.some(format => fileName.endsWith(format));
}