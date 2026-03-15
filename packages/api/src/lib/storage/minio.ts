import { Client } from 'minio';
import { config } from '../../config.js';

let minioClient: Client | null = null;

export function getMinioClient(): Client {
  if (!minioClient) {
    minioClient = new Client({
      endPoint: config.minio.endpoint,
      port: config.minio.port,
      useSSL: config.nodeEnv === 'production',
      accessKey: config.minio.accessKey,
      secretKey: config.minio.secretKey,
    });
  }
  return minioClient;
}

export async function ensureBucket(name: string): Promise<void> {
  const client = getMinioClient();
  const exists = await client.bucketExists(name);
  if (!exists) {
    await client.makeBucket(name);
  }
}

export async function uploadFile(
  key: string,
  buffer: Buffer,
  contentType: string,
  bucket?: string,
): Promise<string> {
  const client = getMinioClient();
  const bucketName = bucket || config.minio.bucket;
  await ensureBucket(bucketName);
  await client.putObject(bucketName, key, buffer, buffer.length, {
    'Content-Type': contentType,
  });
  // Return the object path — actual URL depends on deployment
  return `/${bucketName}/${key}`;
}

export async function getPresignedUrl(
  key: string,
  bucket?: string,
  expirySeconds = 3600,
): Promise<string> {
  const client = getMinioClient();
  const bucketName = bucket || config.minio.bucket;
  return client.presignedGetObject(bucketName, key, expirySeconds);
}
