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

export default async function handler(req, res) {
    // Thumbnail tidak perlu cache di Vercel Blob, jadi kita pakai logika simpel
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

        const doc = await pdfjsLib.getDocument(new Uint8Array(pdfBuffer)).promise;
        const pdfPage = await doc.getPage(1); // Thumbnail selalu halaman 1
        
        // Scale kecil untuk thumbnail
        const viewport = pdfPage.getViewport({ scale: 0.3 });
        
        const canvas = createCanvas(viewport.width, viewport.height);
        const context = canvas.getContext('2d');
        await pdfPage.render({ canvasContext: context, viewport: viewport }).promise;

        const imageBuffer = canvas.toBuffer('image/jpeg', { quality: 50 });

        res.setHeader('Content-Type', 'image/jpeg');
        // Cache thumbnail di browser pengguna selama 1 hari
        res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
        res.status(200).send(imageBuffer);

    } catch (error) {
        console.error('Error in get-thumbnail:', error);
        // Kirim gambar placeholder jika error
        res.status(500).send('Error generating thumbnail');
    }
}