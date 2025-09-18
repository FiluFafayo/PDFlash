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

        let allFiles = [];
        let pageToken = null;

        // Loop untuk mengambil semua halaman hasil (pagination)
        do {
            const response = await drive.files.list({
                q: `'${folderId}' in parents and (mimeType='application/pdf' or mimeType='application/vnd.google-apps.folder')`,
                // Minta thumbnailLink, ini kuncinya!
                fields: 'nextPageToken, files(id, name, mimeType, thumbnailLink)',
                orderBy: 'folder, name',
                pageSize: 1000, // Ambil sebanyak mungkin dalam satu request
                pageToken: pageToken,
            });

            allFiles = allFiles.concat(response.data.files);
            pageToken = response.data.nextPageToken;
        } while (pageToken);

        res.status(200).json(allFiles);

    } catch (error) {
        console.error('Error in get-files:', error);
        res.status(500).json({ error: 'Gagal mengambil daftar file', details: error.message });
    }
}