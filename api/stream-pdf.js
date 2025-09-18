import { head, put } from '@vercel/blob';
import { google } from 'googleapis';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { pipeline } from 'stream/promises';
import pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
import { createCanvas, DOMMatrix } from 'canvas';

// Helper class untuk pdf.js di server
class NodeCanvasFactory {
    create(width, height) { const canvas = createCanvas(width, height); return { canvas, context: canvas.getContext("2d") }; }
    reset(canvasAndContext, width, height) { canvasAndContext.canvas.width = width; canvasAndContext.canvas.height = height; }
    destroy(canvasAndContext) { canvasAndContext.canvas.width = 0; canvasAndContext.canvas.height = 0; canvasAndContext.canvas = null; canvasAndContext.context = null; }
}
global.DOMMatrix = DOMMatrix;

const execFileAsync = promisify(execFile);

export default async function handler(req, res) {
    const { fileId } = req.query;
    if (!fileId) {
        return res.status(400).json({ error: 'File ID tidak ditemukan' });
    }

    const optimizedPdfPath = `optimized/${fileId}.pdf`;

    try {
        // 1. Cek cache dulu, kalau ada langsung berikan
        const blob = await head(optimizedPdfPath);
        return res.redirect(307, blob.url);
    } catch (error) {
        if (error.status !== 404) {
            return res.status(500).json({ error: 'Gagal cek cache PDF' });
        }
    }

    // 2. Jika tidak ada di cache, kita proses
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-'));
    const originalPath = path.join(tempDir, 'original.pdf');
    const optimizedPath = path.join(tempDir, 'optimized.pdf');

    try {
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_CLIENT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        });
        const drive = google.drive({ version: 'v3', auth });

        // Download file utuh dari Google Drive
        const response = await drive.files.get({ fileId: fileId, alt: 'media' }, { responseType: 'stream' });
        await pipeline(response.data, require('fs').createWriteStream(originalPath));
        
        const thumbnailBlobPath = `thumbnails/${fileId}.jpeg`;

        // Fungsi untuk membuat thumbnail
        const generateThumbnail = async () => {
            const doc = await pdfjsLib.getDocument(originalPath).promise;
            const page = await doc.getPage(1);
            const viewport = page.getViewport({ scale: 0.3 });
            const canvasFactory = new NodeCanvasFactory();
            const { canvas, context } = canvasFactory.create(viewport.width, viewport.height);
            await page.render({ canvasContext: context, viewport, canvasFactory }).promise;
            return canvas.toBuffer('image/jpeg', { quality: 50 });
        };

        // Fungsi untuk optimasi PDF dengan qpdf
        const optimizePdf = async () => {
            await execFileAsync('qpdf', ['--linearize', originalPath, optimizedPath]);
            return fs.readFile(optimizedPath);
        };

        // 3. Jalankan kedua proses pembuatan
        const [thumbnailBuffer, optimizedPdfBuffer] = await Promise.all([
            generateThumbnail(),
            optimizePdf()
        ]);
        
        // 4. Upload hasilnya ke Vercel Blob untuk disimpan permanen
        const [uploadedThumbnail, uploadedPdf] = await Promise.all([
            put(thumbnailBlobPath, thumbnailBuffer, { access: 'public', cacheControl: 'public, max-age=31536000, immutable' }),
            put(optimizedPdfPath, optimizedPdfBuffer, { access: 'public', cacheControl: 'public, max-age=31536000, immutable' })
        ]);
        
        // 5. Arahkan pengguna ke PDF yang sudah optimal
        res.redirect(307, uploadedPdf.url);

    } catch (error) {
        console.error('PDF processing error:', error);
        res.status(500).json({ error: 'Gagal memproses PDF.', details: error.message });
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
    }
}