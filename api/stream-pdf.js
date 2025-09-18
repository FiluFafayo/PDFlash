// File: /api/stream-pdf.js (Versi Final dengan Base64)

import { google } from 'googleapis';
import { Readable } from 'stream';

// Fungsi helper untuk decode Base64
function decodeBase64(base64String) {
    return Buffer.from(base64String, 'base64').toString('utf8');
}

export default async function handler(req, res) {
    const { fileId } = req.query;
    if (!fileId) {
        return res.status(400).json({ error: 'File ID tidak ditemukan' });
    }

    try {
        const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
        const privateKeyBase64 = process.env.GOOGLE_PRIVATE_KEY_BASE64;

        if (!clientEmail || !privateKeyBase64) {
             console.error("Missing Google credentials in environment variables");
             return res.status(500).json({ error: 'Konfigurasi server tidak lengkap.' });
        }
        
        // Decode private key dari Base64 ke format PEM asli
        const privateKey = decodeBase64(privateKeyBase64);

        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: clientEmail,
                private_key: privateKey, // Gunakan key yang sudah di-decode
            },
            scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        });
        const accessToken = await auth.getAccessToken();
        
        const driveApiUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
        const range = req.headers.range;
        const driveRequestHeaders = {
            'Authorization': `Bearer ${accessToken}`,
        };
        if (range) {
            driveRequestHeaders['Range'] = range;
        }

        const driveResponse = await fetch(driveApiUrl, {
            headers: driveRequestHeaders,
        });

        if (!driveResponse.ok) {
            const errorBody = await driveResponse.json();
            console.error('Google Drive API error:', errorBody);
            return res.status(driveResponse.status).json({ error: 'Gagal mengambil file dari Google Drive', details: errorBody });
        }
        
        res.setHeader('Content-Type', driveResponse.headers.get('content-type'));
        res.setHeader('Content-Length', driveResponse.headers.get('content-length'));
        if (driveResponse.headers.get('content-range')) {
             res.setHeader('Content-Range', driveResponse.headers.get('content-range'));
        }
        res.setHeader('Accept-Ranges', 'bytes');
        res.status(driveResponse.status);

        Readable.fromWeb(driveResponse.body).pipe(res);

    } catch (error) {
        console.error('Proxy stream error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan internal saat streaming PDF', details: error.message, code: error.code });
    }
}