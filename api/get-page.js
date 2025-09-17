// Panggil library versi 2 yang stabil
const pdfjsLib = require('pdfjs-dist');
// Konfigurasi penting untuk mematikan worker
pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/build/pdf.worker.js');

// Impor "alat bantu" baru untuk Vercel Blob
import { head, put } from '@vercel/blob';

// Impor library lainnya
import { google } from 'googleapis';
import { createCanvas } from 'canvas';

// Helper function untuk mengubah stream menjadi buffer
async function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

// Fungsi utama versi BARU yang lebih pintar
export default async function handler(req, res) {
    try {
        const { fileId, page } = req.query;
        if (!fileId || !page) {
            return res.status(400).json({ error: 'File ID dan nomor halaman dibutuhkan' });
        }
        
        const pageNum = parseInt(page);
        // Nama file di "kulkas" kita. Format: ID_PDF/halaman.webp
        const blobPath = `${fileId}/${pageNum}.webp`;

        // 1. CEK "KULKAS" (VERCEL BLOB)
        // Kita gunakan .catch() agar tidak error jika file tidak ditemukan
        const blobInfo = await head(blobPath).catch(err => null);

        if (blobInfo) {
            // JIKA ADA: Langsung alihkan ke URL gambar yang sudah jadi. Super cepat!
            console.log(`Cache hit for ${blobPath}. Redirecting to blob URL.`);
            // Kode 307 (Temporary Redirect) memberitahu browser untuk tidak men-cache redirect ini
            return res.redirect(307, blobInfo.url);
        }

        // 2. JIKA TIDAK ADA, "MASAK" HALAMANNYA
        console.log(`Cache miss for ${blobPath}. Generating page...`);
        
        // Setup koneksi ke Google Drive
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_CLIENT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        });
        const drive = google.drive({ version: 'v3', auth });

        // Download PDF dari Google Drive
        const response = await drive.files.get(
            { fileId: fileId, alt: 'media' },
            { responseType: 'stream' }
        );
        const pdfBuffer = await streamToBuffer(response.data);

        // Proses PDF menggunakan PDF.js
        const doc = await pdfjsLib.getDocument(new Uint8Array(pdfBuffer)).promise;

        if (pageNum <= 0 || pageNum > doc.numPages) {
            return res.status(400).json({ error: `Halaman tidak valid. PDF ini hanya punya ${doc.numPages} halaman.` });
        }
        
        const pdfPage = await doc.getPage(pageNum);
        const viewport = pdfPage.getViewport({ scale: 1.5 });
        const canvas = createCanvas(viewport.width, viewport.height);
        const context = canvas.getContext('2d');
        await pdfPage.render({ canvasContext: context, viewport: viewport }).promise;

        // Gunakan format .webp yang lebih efisien dan kualitas 80%
        const imageBuffer = canvas.toBuffer('image/webp', { quality: 80 });

        // 3. SIMPAN HASIL "MASAKAN" KE KULKAS
        await put(blobPath, imageBuffer, {
            access: 'public',
            // Cache di browser dan CDN selama setahun
            cacheControl: 'public, max-age=31536000, immutable'
        });
        
        // 4. Sajikan hasil masakan yang baru jadi
        res.setHeader('Content-Type', 'image/webp');
        res.setHeader('X-Total-Pages', doc.numPages);
        res.status(200).send(imageBuffer);

    } catch (error) {
        console.error('Error in get-page:', error);
        res.status(500).json({ error: 'Terjadi kesalahan di server', details: error.message });
    }
}