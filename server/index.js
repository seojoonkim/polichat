import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import express from 'express';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env'), override: true });

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!API_KEY) {
  console.error('ANTHROPIC_API_KEY is not set in .env file');
  process.exit(1);
}

const client = new Anthropic({ apiKey: API_KEY });

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Image upload (local development)
app.post('/api/upload-image', (req, res) => {
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

    // Save to public folder
    const publicDir = path.resolve(__dirname, '..', 'public', 'idols', idolId);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    const filePath = path.join(publicDir, filename);
    fs.writeFileSync(filePath, buffer);

    // Return relative URL for local development
    const url = `/idols/${idolId}/${filename}`;
    console.log('Image saved locally:', url);
    
    return res.status(200).json({ url });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: 'Upload failed', details: error.message });
  }
});

// Streaming chat proxy
app.post('/api/chat', async (req, res) => {
  const { system, messages, model, max_tokens } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    const stream = client.messages.stream({
      model: model || 'claude-opus-4-6',
      max_tokens: max_tokens || 1024,
      system: system || undefined,
      messages,
    });

    stream.on('text', (text) => {
      res.write(`data: ${JSON.stringify({ type: 'text', text })}\n\n`);
    });

    stream.on('error', (error) => {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
    });

    await stream.finalMessage();
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // If headers already sent, send as SSE event
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: message })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: message });
    }
  }

  // Handle client disconnect
  req.on('close', () => {
    // Stream will be garbage collected
  });
});

app.listen(PORT, () => {
  console.log(`StanVibe proxy server running on http://localhost:${PORT}`);
});
