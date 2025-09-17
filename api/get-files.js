import { google } from 'googleapis';

// Fungsi utama yang dipanggil Vercel
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

        // Mulai pencarian rekursif dari folder awal
        const allFiles = await fetchFilesRecursively(drive, folderId);

        // Urutkan hasilnya berdasarkan nama untuk konsistensi
        allFiles.sort((a, b) => a.name.localeCompare(b.name));
        
        res.status(200).json(allFiles);

    } catch (error) {
        console.error('Error in get-files:', error);
        res.status(500).json({ error: 'Gagal mengambil daftar file', details: error.message });
    }
}

// FUNGSI REKURSIF: "Penyelam" folder kita
async function fetchFilesRecursively(drive, folderId) {
    let filesFound = [];
    let pageToken = null;

    do {
        const response = await drive.files.list({
            q: `'${folderId}' in parents`,
            fields: 'nextPageToken, files(id, name, mimeType)',
            pageToken: pageToken,
            pageSize: 1000 // Ambil maksimal item per panggilan
        });

        const items = response.data.files;

        for (const item of items) {
            if (item.mimeType === 'application/pdf') {
                // Jika ini PDF, tambahkan ke hasil
                filesFound.push({ id: item.id, name: item.name });
            } else if (item.mimeType === 'application/vnd.google-apps.folder') {
                // Jika ini folder, "selami" lebih dalam!
                console.log(`Menyelami subfolder: ${item.name}`);
                const subfolderFiles = await fetchFilesRecursively(drive, item.id);
                // Gabungkan hasil dari subfolder ke daftar utama
                filesFound = filesFound.concat(subfolderFiles);
            }
        }

        pageToken = response.data.nextPageToken;
    } while (pageToken);

    return filesFound;
}