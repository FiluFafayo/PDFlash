// Impor semua "alat bantu" yang kita butuhkan
import { google } from 'googleapis';
import { Poppler } from 'pdf-poppler';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';

// Fungsi utama yang akan dijalankan Vercel
export default async function handler(req, res) {
  try {
    // 1. Ambil File ID dan nomor halaman dari URL
    const { fileId, page } = req.query;
    if (!fileId) {
      return res.status(400).json({ error: 'File ID tidak ditemukan' });
    }
    const pageNum = parseInt(page) || 1;

    // 2. Setup koneksi ke Google Drive
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    const drive = google.drive({ version: 'v3', auth });
    
    // 3. Download file PDF dari Drive ke folder sementara di server Vercel
    const tempFilePath = path.join(os.tmpdir(), `${fileId}.pdf`);
    const dest = await fs.open(tempFilePath, 'w');
    const fileStream = dest.createWriteStream();

    const response = await drive.files.get(
      { fileId: fileId, alt: 'media' },
      { responseType: 'stream' }
    );
    
    await new Promise((resolve, reject) => {
        response.data
            .on('end', resolve)
            .on('error', reject)
            .pipe(fileStream);
    });
    
    // 4. Proses konversi PDF ke gambar menggunakan Poppler
    const poppler = new Poppler();
    const outputFile = path.join(os.tmpdir(), `${fileId}_page_${pageNum}`);
    
    // Opsi: -f = halaman pertama, -l = halaman terakhir, -png = output format
    const options = {
      firstPageToConvert: pageNum,
      lastPageToConvert: pageNum,
      pngFile: true,
    };
    await poppler.pdfToCairo(tempFilePath, outputFile, options);

    // 5. Kirim gambar hasilnya ke browser
    const imagePath = `${outputFile}-${pageNum}.png`;
    const imageBuffer = await fs.readFile(imagePath);
    
    res.setHeader('Content-Type', 'image/png');
    res.send(imageBuffer);

    // 6. (Opsional tapi bagus) Hapus file sementara
    await fs.unlink(tempFilePath);
    await fs.unlink(imagePath);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Terjadi kesalahan di server', details: error.message });
  }
}