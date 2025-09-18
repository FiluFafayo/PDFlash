import { head, put } from '@vercel/blob';
import { google } from 'googleapis';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { pipeline } from 'stream/promises';
import { createReadStream } from 'fs'; // Dibutuhkan untuk streaming upload

const execFileAsync = promisify(execFile);

export default async function handler(req, res) {
    const { fileId } = req.query;
    if (!fileId) {
        return res.status(400).json({ error: 'File ID tidak ditemukan' });
    }

    const optimizedPdfPath = `optimized/${fileId}.pdf`;

    try {
        const blob = await head(optimizedPdfPath);
        console.log(`Optimized PDF CACHE HIT for ${fileId}`);
        return res.redirect(307, blob.url);
    } catch (error) {
        // KONDISI BARU: Cek isi pesan errornya
        if (!error.message.includes('The requested blob does not exist')) {
            // Jika pesan error TIDAK mengandung teks ini, baru laporkan 500
            console.error('Vercel Blob head error:', error);
            return res.status(500).json({ error: 'Gagal cek cache PDF' });
        }
        // Jika mengandung teks itu, berarti cache miss dan kita lanjutkan proses
    }

    console.log(`Optimized PDF CACHE MISS for ${fileId}. Processing...`);

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
        const response = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
        await pipeline(response.data, require('fs').createWriteStream(originalPath));
        
        // HANYA jalankan optimasi PDF
        await execFileAsync('qpdf', ['--linearize', originalPath, optimizedPath]);
        
        // Upload hasilnya ke Vercel Blob menggunakan stream agar hemat memori
        const optimizedFileStream = createReadStream(optimizedPath);
        const uploadedPdf = await put(optimizedPdfPath, optimizedFileStream, {
            access: 'public',
            cacheControl: 'public, max-age=31536000, immutable'
        });
        
        console.log(`Successfully optimized and uploaded PDF for ${fileId}`);
        
        // Arahkan pengguna ke PDF yang sudah optimal
        res.redirect(307, uploadedPdf.url);

    } catch (error) {
        console.error('PDF processing error:', error);
        res.status(500).json({ error: 'Gagal memproses PDF.', details: error.message });
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
    }
}