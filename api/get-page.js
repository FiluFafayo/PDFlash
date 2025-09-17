// Impor "alat bantu" yang baru
import { google } from 'googleapis';
import * as pdfjsLib from 'pdfjs-dist';
import { createCanvas } from 'canvas';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Helper function untuk mengubah stream menjadi buffer
async function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

// Fungsi utama yang akan dijalankan Vercel
export default async function handler(req, res) {
  try {
    // 1. Ambil File ID dan nomor halaman dari URL
    const { fileId, page } = req.query;
    if (!fileId) {
      return res.status(400).json({ error: 'File ID tidak ditemukan' });
    }
    const pageNum = parseInt(page) || 1;

    // 2. Setup koneksi ke Google Drive (ini tetap sama)
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    const drive = google.drive({ version: 'v3', auth });

    // 3. Download PDF dari Drive, tapi kali ini langsung jadi buffer di memori
    const response = await drive.files.get(
      { fileId: fileId, alt: 'media' },
      { responseType: 'stream' }
    );
    const pdfBuffer = await streamToBuffer(response.data);

    // 4. Proses PDF menggunakan PDF.js
    const doc = await pdfjsLib.getDocument(pdfBuffer).promise;
    if (pageNum > doc.numPages) {
        return res.status(400).json({ error: `Halaman tidak valid. PDF ini hanya punya ${doc.numPages} halaman.` });
    }
    const pdfPage = await doc.getPage(pageNum);
    
    // Tentukan skala render, misal 1.5x dari ukuran asli untuk kualitas lebih baik
    const viewport = pdfPage.getViewport({ scale: 1.5 });
    
    // Buat canvas virtual
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');

    // Render halaman PDF ke canvas
    await pdfPage.render({ canvasContext: context, viewport: viewport }).promise;

    // 5. Ubah canvas menjadi gambar PNG dan kirim ke browser
    const imageBuffer = canvas.toBuffer('image/png');
    
    res.setHeader('Content-Type', 'image/png');
    res.status(200).send(imageBuffer);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Terjadi kesalahan di server', details: error.message });
  }
}