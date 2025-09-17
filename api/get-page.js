const pdfjsLib = require('pdfjs-dist');
pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/build/pdf.worker.js');

import { head, put } from '@vercel/blob';
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
        if (!fileId || !page) {
            return res.status(400).json({ error: 'File ID dan nomor halaman dibutuhkan' });
        }
        
        const pageNum = parseInt(page);
        // PERUBAHAN 1: Ganti path ke .jpeg
        const blobPath = `${fileId}/${pageNum}.jpeg`;

        const blobInfo = await head(blobPath).catch(err => null);

        if (blobInfo) {
            console.log(`Cache hit for ${blobPath}. Redirecting to blob URL.`);
            return res.redirect(307, blobInfo.url);
        }

        console.log(`Cache miss for ${blobPath}. Generating page...`);
        
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

        // PERUBAHAN 2: Ganti format buffer ke .jpeg
        const imageBuffer = canvas.toBuffer('image/jpeg', { quality: 80 });

        await put(blobPath, imageBuffer, {
            access: 'public',
            cacheControl: 'public, max-age=31536000, immutable'
        });
        
        // PERUBAHAN 3: Ganti header ke .jpeg
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('X-Total-Pages', doc.numPages);
        res.status(200).send(imageBuffer);

    } catch (error) {
        console.error('Error in get-page:', error);
        res.status(500).json({ error: 'Terjadi kesalahan di server', details: error.message });
    }
}
