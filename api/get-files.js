import { google } from 'googleapis';

export default async function handler(req, res) {
    const { folderId } = req.query;

    if (!folderId) {
        return res.status(400).json({ error: 'Folder ID tidak ditemukan' });
    }

    try {
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_CLIENT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        });
        const drive = google.drive({ version: 'v3', auth });

        const response = await drive.files.list({
            q: `'${folderId}' in parents and mimeType='application/pdf'`,
            fields: 'files(id, name)',
            orderBy: 'name',
        });
        
        res.status(200).json(response.data.files);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Gagal mengambil daftar file', details: error.message });
    }
}