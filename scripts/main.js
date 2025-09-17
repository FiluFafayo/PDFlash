document.addEventListener('DOMContentLoaded', () => {
    const loadBtn = document.getElementById('load-btn');
    const folderUrlInput = document.getElementById('folder-url');
    const pdfGrid = document.getElementById('pdf-grid');
    const loader = document.getElementById('loader');

    loadBtn.addEventListener('click', async () => {
        const url = folderUrlInput.value;
        if (!url) {
            alert('Masukkan URL folder terlebih dahulu.');
            return;
        }

        const folderId = extractFolderIdFromUrl(url);
        if (!folderId) {
            alert('URL tidak valid. Pastikan formatnya benar.');
            return;
        }

        loader.style.display = 'block';
        pdfGrid.innerHTML = '';

        try {
            const response = await fetch(`/api/get-files?folderId=${folderId}`);
            if (!response.ok) {
                throw new Error('Gagal memuat daftar file dari server.');
            }
            const files = await response.json();

            if (files.length === 0) {
                pdfGrid.innerHTML = '<p>Tidak ada file PDF yang ditemukan di folder ini.</p>';
            } else {
                files.forEach(file => {
                    const card = document.createElement('a');
                    card.href = `/viewer.html?fileId=${file.id}`; // Nanti akan kita buat di Tahap 3
                    card.className = 'pdf-card';

                    const thumbnail = document.createElement('img');
                    thumbnail.src = `/api/get-thumbnail?fileId=${file.id}`;
                    thumbnail.alt = `Cover of ${file.name}`;

                    const title = document.createElement('p');
                    title.textContent = file.name.replace('.pdf', '');

                    card.appendChild(thumbnail);
                    card.appendChild(title);
                    pdfGrid.appendChild(card);
                });
            }
        } catch (error) {
            console.error(error);
            pdfGrid.innerHTML = `<p>Error: ${error.message}</p>`;
        } finally {
            loader.style.display = 'none';
        }
    });

    function extractFolderIdFromUrl(url) {
        const match = url.match(/folders\/([a-zA-Z0-9_-]+)/);
        return match ? match[1] : null;
    }
});