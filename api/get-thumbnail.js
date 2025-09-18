import { head, put } from '@vercel/blob';
import { google } from 'googleapis';
import pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
import { createCanvas, DOMMatrix } from 'canvas';
import { pipeline } from 'stream/promises';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// ==========================================================
// DEFINISI FUNGSI DAN HELPER KITA LETAKKAN DI ATAS
// ==========================================================
class NodeCanvasFactory {
    create(width, height) { const canvas = createCanvas(width, height); return { canvas, context: canvas.getContext("2d") }; }
    reset(canvasAndContext, width, height) { canvasAndContext.canvas.width = width; canvasAndContext.canvas.height = height; }
    destroy(canvasAndContext) { /* ... */ }
}
global.DOMMatrix = DOMMatrix;

function createPlaceholderImage() {
    const canvas = createCanvas(200, 280);
    const context = canvas.getContext('2d');
    context.fillStyle = '#f0f0f0';
    context.fillRect(0, 0, 200, 280);
    context.strokeStyle = '#ddd';
    context.strokeRect(0, 0, 200, 280);
    context.fillStyle = '#999';
    context.font = '14px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('Preview Failed', 100, 140);
    return canvas.toBuffer('image/jpeg', { quality: 50 });
}
// ==========================================================

export default async function handler(req, res) {
    const { fileId } = req.query;
    if (!fileId) {
        return res.status(400).json({ error: 'File ID tidak ditemukan' });
    }

    const blobPath = `thumbnails/${fileId}.jpeg`;

    // --- LANGKAH 1: Cek Cache Dulu ---
    try {
        const blob = await head(blobPath);
        console.log(`Thumbnail CACHE HIT for ${fileId}`);
        return res.redirect(307, blob.url);
    } catch (error) {
        if (!error.message.includes('The requested blob does not exist')) {
            console.error('Vercel Blob head error:', error);
            return res.status(500).json({ error: 'Gagal cek cache thumbnail' });
        }
        // Jika cache tidak ada, kita lanjutkan ke proses pembuatan di bawah
    }

    // --- LANGKAH 2: Jika Cache Tidak Ada, Buat Thumbnail ---
    console.log(`Thumbnail CACHE MISS for ${fileId}. Generating...`);
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-thumb-'));
    const tempFilePath = path.join(tempDir, 'temp.pdf');

    try {
        const auth = new google.auth.GoogleAuth({
            credentials: { /* ... kredensialmu ... */ },
            scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        });
        const drive = google.drive({ version: 'v3', auth });

        const response = await drive.files.get({ fileId: fileId, alt: 'media' }, { responseType: 'stream' });
        await pipeline(response.data, require('fs').createWriteStream(tempFilePath));
        
        const doc = await pdfjsLib.getDocument(tempFilePath).promise;
        const page = await doc.getPage(1);
        const viewport = page.getViewport({ scale: 0.3 });
        const canvasFactory = new NodeCanvasFactory();
        const { canvas, context } = canvasFactory.create(viewport.width, viewport.height);
        await page.render({ canvasContext: context, viewport, canvasFactory }).promise;
        const imageBuffer = await canvas.toBuffer('image/jpeg', { quality: 50 });
        
        // Simpan hasil ke cache untuk lain kali
        await put(blobPath, imageBuffer, {
            access: 'public',
            cacheControl: 'public, max-age=31536000, immutable'
        });

        // Kirim thumbnail yang baru dibuat ke browser
        res.setHeader('Content-Type', 'image/jpeg');
        return res.status(200).send(imageBuffer);

    } catch (error) {
        // --- LANGKAH 3: Jika Pembuatan Gagal, Kirim Placeholder ---
        console.error(`Failed to generate thumbnail for ${fileId}:`, error);
        const placeholder = createPlaceholderImage();
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache placeholder sebentar
        return res.status(200).send(placeholder);
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
    }
}