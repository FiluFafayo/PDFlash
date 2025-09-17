// Panggil library versi 2
const pdfjsLib = require('pdfjs-dist');
// Beri alamat WORKER yang benar, bukan alamat ENTRY
pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/build/pdf.worker.js');

// Impor library lainnya
import { google } from 'googleapis';
import { createCanvas } from 'canvas';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Helper function (tetap sama)
async function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

// Fungsi utama
export default async function handler(req, res) {
  try {
    const { fileId, page } = req.query;
    if (!fileId) {
      return res.status(400).json({ error: 'File ID tidak ditemukan' });
    }
    const pageNum = parseInt(page) || 1;
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
    if (pageNum > doc.numPages) {
      return res.status(400).json({ error: `Halaman tidak valid. PDF ini hanya punya ${doc.numPages} halaman.` });
    }
    const pdfPage = await doc.getPage(pageNum);
    const viewport = pdfPage.getViewport({ scale: 1.5 });
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');
    await pdfPage.render({ canvasContext: context, viewport: viewport }).promise;
    const imageBuffer = canvasAndContext.canvas.toBuffer('image/png');
    res.setHeader('Content-Type', 'image/png');
    // BARIS TAMBAHAN: Kirim total halaman di header
    res.setHeader('X-Total-Pages', doc.numPages);
    res.status(200).send(imageBuffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Terjadi kesalahan di server', details: error.message });
  }
}