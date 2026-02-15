import { put } from '@vercel/blob';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export const config = {
  runtime: 'nodejs',
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { idolId, imageData, contentType } = req.body;

    if (!idolId || !imageData) {
      return res.status(400).json({ error: 'Missing idolId or imageData' });
    }

    // Decode base64
    const buffer = Buffer.from(imageData, 'base64');

    // Generate unique filename
    const timestamp = Date.now();
    const ext = contentType === 'image/png' ? 'png' : 'jpg';
    const filename = `profile-${timestamp}.${ext}`;

    // Check if we're in Vercel production environment
    const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;

    if (isVercel && process.env.BLOB_READ_WRITE_TOKEN) {
      // Upload to Vercel Blob in production
      try {
        const blob = await put(`idols/${idolId}/${filename}`, buffer, {
          access: 'public',
          contentType: contentType || 'image/jpeg',
        });
        return res.status(200).json({ url: blob.url });
      } catch (blobError) {
        console.error('Vercel Blob error, falling back to local:', blobError);
        // Fall through to local save
      }
    }

    // Local fallback: save to public folder
    const publicDir = join(process.cwd(), 'public', 'idols', idolId);
    
    // Create directory if it doesn't exist
    if (!existsSync(publicDir)) {
      mkdirSync(publicDir, { recursive: true });
    }

    const filePath = join(publicDir, filename);
    writeFileSync(filePath, buffer);

    // Return relative URL for local development
    const url = `/idols/${idolId}/${filename}`;
    console.log('Image saved locally:', url);
    
    return res.status(200).json({ url });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ 
      error: 'Upload failed', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
