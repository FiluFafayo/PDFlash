const pdfjsLib = require('pdfjs-dist');
pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/build/pdf.worker.js');

import { list, put } from '@vercel/blob';
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
    try {
        const { fileId, page } = req.query;
        
        // Input validation
        if (!fileId || !page) {
            return res.status(400).json({ error: 'File ID dan nomor halaman dibutuhkan' });
        }
        
        if (!/^[a-zA-Z0-9_-]+$/.test(fileId) || !/^\d+$/.test(page)) {
            return res.status(400).json({ error: 'Format File ID atau halaman tidak valid' });
        }
        
        const pageNum = parseInt(page);
        
        // Cache detection logic
        const blobPrefix = `${fileId}/${pageNum}`;
        const blobUploadPath = `${fileId}/${pageNum}.jpeg`;

        // Search for blobs with this prefix and .jpeg extension
        const { blobs } = await list({ prefix: blobPrefix, limit: 10 });
        const blobInfo = blobs.find(blob => 
            blob.pathname.startsWith(blobPrefix) && 
            blob.pathname.endsWith('.jpeg')
        );
        
        if (blobInfo) {
            console.log(`Cache HIT: ${fileId}/${pageNum} -> ${blobInfo.url}`);
            return res.redirect(307, blobInfo.url);
        }
        
        console.log(`Cache MISS: ${fileId}/${pageNum}. Generating...`);
        console.log(`Available blobs:`, blobs.map(b => b.pathname));
        
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

        if (pageNum <= 0 || pageNum > doc.numPages) {
            return res.status(400).json({ error: `Halaman tidak valid. PDF ini hanya punya ${doc.numPages} halaman.` });
        }
        
        const pdfPage = await doc.getPage(pageNum);
        const viewport = pdfPage.getViewport({ scale: 1.5 });
        const canvas = createCanvas(viewport.width, viewport.height);
        const context = canvas.getContext('2d');
        await pdfPage.render({ canvasContext: context, viewport: viewport }).promise;

        const imageBuffer = canvas.toBuffer('image/jpeg', { quality: 80 });

        const blob = await put(blobUploadPath, imageBuffer, {
            access: 'public',
            cacheControl: 'public, max-age=31536000, immutable'
        });
        
        console.log(`Uploaded to blob: ${blob.url}`);
        
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('X-Total-Pages', doc.numPages);
        res.status(200).send(imageBuffer);

    } catch (error) {
        console.error('Error in get-page:', error);
        res.status(500).json({ error: 'Terjadi kesalahan di server', details: error.message });
    }
}
