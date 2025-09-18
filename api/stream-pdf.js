import { google } from 'googleapis';
import { Readable } from 'stream';

export default async function handler(req, res) {
    const { fileId } = req.query;
    if (!fileId) {
        return res.status(400).json({ error: 'File ID tidak ditemukan' });
    }

    try {
        // --- TAMBAHKAN BLOK KODE INI UNTUK DEBUGGING ---
        console.log("--- DEBUGGING ENV VARIABLES ---");
        const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
        const privateKey = process.env.GOOGLE_PRIVATE_KEY;
        console.log(`CLIENT_EMAIL: ${clientEmail}`);
        console.log(`PRIVATE_KEY length: ${privateKey ? privateKey.length : 'NOT FOUND'}`);
        console.log(`PRIVATE_KEY starts with: ${privateKey ? privateKey.slice(0, 30) : 'N/A'}`);
        console.log(`PRIVATE_KEY ends with: ${privateKey ? privateKey.slice(-30) : 'N/A'}`);
        console.log("-------------------------------");
        // --- AKHIR BLOK KODE DEBUGGING ---
        
        // --- LANGKAH 1: Otentikasi dan dapatkan Access Token ---
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_CLIENT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        });
        const accessToken = await auth.getAccessToken();

        // --- LANGKAH 2: Siapkan request ke Google Drive API ---
        const driveApiUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
        
        // Ambil header 'Range' dari permintaan browser, jika ada
        const range = req.headers.range;

        const driveRequestHeaders = {
            'Authorization': `Bearer ${accessToken}`,
        };
        if (range) {
            driveRequestHeaders['Range'] = range; // Teruskan permintaan 'potongan'
        }

        // --- LANGKAH 3: Lakukan fetch ke Google dan stream hasilnya ---
        const driveResponse = await fetch(driveApiUrl, {
            headers: driveRequestHeaders,
        });

        if (!driveResponse.ok) {
            const errorBody = await driveResponse.json();
            console.error('Google Drive API error:', errorBody);
            return res.status(driveResponse.status).json({ error: 'Gagal mengambil file dari Google Drive', details: errorBody });
        }
        
        // --- LANGKAH 4: Kirim balik header & body ke browser ---
        // Salin header penting dari Google ke respons kita
        res.setHeader('Content-Type', driveResponse.headers.get('content-type'));
        res.setHeader('Content-Length', driveResponse.headers.get('content-length'));
        if (driveResponse.headers.get('content-range')) {
             res.setHeader('Content-Range', driveResponse.headers.get('content-range'));
        }
        res.setHeader('Accept-Ranges', 'bytes');
        
        // Jika ada 'range', statusnya 206 (Partial Content). Jika tidak, 200 (OK).
        res.status(driveResponse.status);

        // Alirkan body dari respons Google langsung ke browser. Inilah intinya!
        Readable.fromWeb(driveResponse.body).pipe(res);

    } catch (error) {
        console.error('Proxy stream error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan internal saat streaming PDF', details: error.message });
    }
}