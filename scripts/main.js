document.addEventListener('DOMContentLoaded', () => {
    const loadBtn = document.getElementById('load-btn');
    const folderUrlInput = document.getElementById('folder-url');
    const pdfGrid = document.getElementById('pdf-grid');
    const loader = document.getElementById('loader');

    // FUNGSI UTAMA UNTUK ME-LOAD FOLDER
    const loadFolder = async (folderId) => {
        if (!folderId) return;

        loader.style.display = 'block';
        pdfGrid.innerHTML = '';

        try {
            const response = await fetch(`/api/get-files?folderId=${folderId}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.details || 'Gagal memuat daftar file dari server.');
            }
            const files = await response.json();

            // BAGIAN BARU: Simpan "ingatan" di URL
            const newUrl = `/?folderId=${folderId}`;
            // Cek agar tidak push state yang sama berulang kali
            if (window.location.search !== `?folderId=${folderId}`) {
                window.history.pushState({ folderId }, '', newUrl);
            }
            // Update juga nilai di input box
            folderUrlInput.value = `https://drive.google.com/drive/folders/${folderId}`;

            if (files.length === 0) {
                pdfGrid.innerHTML = '<p>Tidak ada file PDF yang ditemukan di folder ini.</p>';
            } else {
                files.forEach(file => {
                    const card = document.createElement('a');
                    card.href = `/viewer.html?fileId=${file.id}`;
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
    };

    // Event listener untuk tombol "Load"
    loadBtn.addEventListener('click', () => {
        const url = folderUrlInput.value;
        if (!url) return alert('Masukkan URL folder terlebih dahulu.');
        
        const folderId = extractFolderIdFromUrl(url);
        if (!folderId) return alert('URL tidak valid. Pastikan formatnya benar.');
        
        loadFolder(folderId);
    });

    function extractFolderIdFromUrl(url) {
        const match = url.match(/folders\/([a-zA-Z0-9_-]+)/);
        return match ? match[1] : null;
    }

    // BAGIAN BARU: Cek "ingatan" saat halaman pertama kali dibuka
    const initialParams = new URLSearchParams(window.location.search);
    const initialFolderId = initialParams.get('folderId');
    if (initialFolderId) {
        console.log(`Folder ID ditemukan di URL: ${initialFolderId}. Memuat otomatis...`);
        loadFolder(initialFolderId);
    }
});
