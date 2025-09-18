import { head, put } from '@vercel/blob';
import { google } from 'googleapis';
import pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
import { createCanvas, DOMMatrix } from 'canvas';
import { pipeline } from 'stream/promises';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Helper class untuk pdf.js di server
class NodeCanvasFactory {
    create(width, height) { const canvas = createCanvas(width, height); return { canvas, context: canvas.getContext("2d") }; }
    reset(canvasAndContext, width, height) { canvasAndContext.canvas.width = width; canvasAndContext.canvas.height = height; }
    destroy(canvasAndContext) { canvasAndContext.canvas.width = 0; canvasAndContext.canvas.height = 0; canvasAndContext.canvas = null; canvasAndContext.context = null; }
}
global.DOMMatrix = DOMMatrix;

export default async function handler(req, res) {
    const { fileId } = req.query;
    if (!fileId) {
        return res.status(400).json({ error: 'File ID tidak ditemukan' });
    }

    const blobPath = `thumbnails/${fileId}.jpeg`;

    try {
        // Cek cache dan langsung redirect jika ada
        const blob = await head(blobPath);
        return res.redirect(307, blob.url);
    } catch (error) {
        // Jika tidak ada (404), artinya PDF belum pernah dibuka.
        // GANTI KONDISI DI BAWAH INI
        if (error.name === 'BlobNotFoundError') {
            const placeholder = createPlaceholderImage();
            res.setHeader('Content-Type', 'image/jpeg');
            res.setHeader('Cache-Control', 'public, max-age=60'); 
            return res.status(200).send(placeholder);
        }
        
        // Jika errornya BUKAN karena file tidak ditemukan, baru laporkan sebagai 500
        console.error('Vercel Blob head error:', error);
        return res.status(500).json({ error: 'Gagal cek cache thumbnail' });
    }

    console.log(`Thumbnail CACHE MISS for ${fileId}. Generating...`);
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-thumb-'));
    const tempFilePath = path.join(tempDir, 'temp.pdf');

    try {
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_CLIENT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        });
        const drive = google.drive({ version: 'v3', auth });

        // Download file utuh dari Google Drive ke file temporary
        const response = await drive.files.get({ fileId: fileId, alt: 'media' }, { responseType: 'stream' });
        await pipeline(response.data, require('fs').createWriteStream(tempFilePath));
        
        // Buat thumbnail dari file temporary
        const doc = await pdfjsLib.getDocument(tempFilePath).promise;
        const page = await doc.getPage(1);
        const viewport = page.getViewport({ scale: 0.3 });
        const canvasFactory = new NodeCanvasFactory();
        const { canvas, context } = canvasFactory.create(viewport.width, viewport.height);
        await page.render({ canvasContext: context, viewport, canvasFactory }).promise;
        const imageBuffer = canvas.toBuffer('image/jpeg', { quality: 50 });
        
        // Upload thumbnail ke Vercel Blob
        const uploadedBlob = await put(blobPath, imageBuffer, {
            access: 'public',
            cacheControl: 'public, max-age=31536000, immutable'
        });

        // Kirim thumbnail yang baru dibuat (atau redirect)
        res.setHeader('Content-Type', 'image/jpeg');
        return res.status(200).send(imageBuffer);

    } catch (error) {
        console.error(`Failed to generate thumbnail for ${fileId}:`, error);
        // Jika gagal, bisa kirim placeholder atau error
        res.status(500).json({ error: 'Gagal membuat thumbnail' });
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
    }
}