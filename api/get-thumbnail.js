import { head } from '@vercel/blob';
import { createCanvas } from 'canvas';

// Fungsi untuk membuat placeholder jika thumbnail belum ada
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
    context.fillText('Loading preview...', 100, 140);
    return canvas.toBuffer('image/jpeg', { quality: 50 });
}

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
        if (error.status === 404) {
            const placeholder = createPlaceholderImage();
            res.setHeader('Content-Type', 'image/jpeg');
            // Jangan cache placeholder terlalu lama agar browser mau cek lagi nanti
            res.setHeader('Cache-Control', 'public, max-age=60'); 
            return res.status(200).send(placeholder);
        }
        
        console.error('Vercel Blob head error:', error);
        return res.status(500).json({ error: 'Gagal cek cache thumbnail' });
    }
}