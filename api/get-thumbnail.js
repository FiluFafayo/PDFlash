const pdfjsLib = require('pdfjs-dist');
pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/build/pdf.worker.js');

import { google } from 'googleapis';
import { createCanvas, DOMMatrix } from 'canvas';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

global.DOMMatrix = DOMMatrix;

async function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

// Fungsi untuk membuat placeholder image
function createPlaceholderImage() {
  const canvas = createCanvas(200, 280);
  const context = canvas.getContext('2d');
  
  // Background
  context.fillStyle = '#f0f0f0';
  context.fillRect(0, 0, 200, 280);
  
  // Border
  context.strokeStyle = '#ddd';
  context.lineWidth = 2;
  context.strokeRect(0, 0, 200, 280);
  
  // Icon
  context.fillStyle = '#999';
  context.font = '40px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('📄', 100, 120);
  
  // Text
  context.font = '14px Arial';
  context.fillText('Preview not available', 100, 160);
  
  return canvas.toBuffer('image/jpeg', { quality: 50 });
}

export default async function handler(req, res) {
  try {
    const { fileId } = req.query;
    if (!fileId) {
      return res.status(400).json({ error: 'File ID tidak ditemukan' });
    }
    
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    const drive = google.drive({ version: 'v3', auth });

    const response = await drive.files.get(
      { fileId: fileId, alt: 'media' },
      { responseType: 'stream' }
    );
    const pdfBuffer = await streamToBuffer(response.data);

    // Cek ukuran PDF untuk mencegah memory issue
    if (pdfBuffer.length > 50 * 1024 * 1024) { // 50MB limit
      console.log(`PDF too large for thumbnail: ${fileId}`);
      const placeholder = createPlaceholderImage();
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
      return res.status(200).send(placeholder);
    }

    let doc;
    try {
      doc = await pdfjsLib.getDocument(new Uint8Array(pdfBuffer)).promise;
    } catch (pdfError) {
      console.error(`Invalid PDF for thumbnail: ${fileId}`, pdfError.message);
      const placeholder = createPlaceholderImage();
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
      return res.status(200).send(placeholder);
    }

    let pdfPage;
    try {
      pdfPage = await doc.getPage(1); // Thumbnail selalu halaman 1
    } catch (pageError) {
      console.error(`Error getting page 1 for thumbnail: ${fileId}`, pageError.message);
      const placeholder = createPlaceholderImage();
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
      return res.status(200).send(placeholder);
    }
    
    // Scale kecil untuk thumbnail
    const viewport = pdfPage.getViewport({ scale: 0.3 });
    
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');
    
    try {
      await pdfPage.render({ canvasContext: context, viewport: viewport }).promise;
    } catch (renderError) {
      console.error(`Error rendering thumbnail: ${fileId}`, renderError.message);
      const placeholder = createPlaceholderImage();
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
      return res.status(200).send(placeholder);
    }

    const imageBuffer = canvas.toBuffer('image/jpeg', { quality: 50 });

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.status(200).send(imageBuffer);

  } catch (error) {
    console.error('Error in get-thumbnail:', error.message);
    // Kirim gambar placeholder jika error
    const placeholder = createPlaceholderImage();
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.status(200).send(placeholder);
  }
}