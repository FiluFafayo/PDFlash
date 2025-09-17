document.addEventListener('DOMContentLoaded', () => {
    const loadBtn = document.getElementById('load-btn');
    const folderUrlInput = document.getElementById('folder-url');
    const pdfGrid = document.getElementById('pdf-grid');
    const loader = document.getElementById('loader');
    const breadcrumbsContainer = document.getElementById('breadcrumbs');

    // "Memori" untuk menyimpan jejak navigasi kita
    let navigationStack = [];
    let rootFolderId = null;

    // FUNGSI UNTUK MERENDER BREADCRUMBS
    const renderBreadcrumbs = () => {
        breadcrumbsContainer.innerHTML = '';
        navigationStack.forEach((folder, index) => {
            const link = document.createElement('a');
            link.href = '#';
            link.textContent = folder.name;
            link.dataset.folderId = folder.id;
            link.addEventListener('click', (e) => {
                e.preventDefault();
                // Kembali ke folder yang diklik
                const newStack = navigationStack.slice(0, index + 1);
                navigationStack = newStack;
                loadFolder(folder.id);
            });
            breadcrumbsContainer.appendChild(link);

            if (index < navigationStack.length - 1) {
                const separator = document.createElement('span');
                separator.textContent = '>';
                breadcrumbsContainer.appendChild(separator);
            }
        });
    };

    // FUNGSI UTAMA UNTUK ME-LOAD FOLDER
    const loadFolder = async (folderId, isRoot = false) => {
        loader.style.display = 'block';
        pdfGrid.innerHTML = '';

        try {
            const response = await fetch(`/api/get-files?folderId=${folderId}`);
            if (!response.ok) throw new Error('Gagal memuat daftar file.');
            const items = await response.json();

            // Update URL & Navigasi
            const newUrl = `/?folderId=${folderId}`;
            if (window.location.search !== `?folderId=${folderId}`) {
                window.history.pushState({ folderId }, '', newUrl);
            }
            if (isRoot) {
                rootFolderId = folderId;
                navigationStack = [{ id: folderId, name: 'Home' }];
            }
            renderBreadcrumbs();

            if (items.length === 0) {
                pdfGrid.innerHTML = '<p>Folder ini kosong.</p>';
            } else {
                items.forEach(item => {
                    const card = document.createElement('div');
                    card.className = 'item-card';

                    const thumbnailDiv = document.createElement('div');
                    thumbnailDiv.className = 'thumbnail';

                    if (item.mimeType === 'application/pdf') {
                        card.addEventListener('click', () => { window.location.href = `/viewer.html?fileId=${item.id}`; });
                        const thumbnailImg = document.createElement('img');
                        thumbnailImg.src = `/api/get-thumbnail?fileId=${item.id}`;
                        thumbnailDiv.appendChild(thumbnailImg);
                    } else if (item.mimeType === 'application/vnd.google-apps.folder') {
                        card.addEventListener('click', () => {
                            navigationStack.push({ id: item.id, name: item.name });
                            loadFolder(item.id);
                        });
                        const folderIcon = document.createElement('div');
                        folderIcon.className = 'folder-icon';
                        folderIcon.textContent = '📁';
                        thumbnailDiv.appendChild(folderIcon);
                    }

                    const title = document.createElement('p');
                    title.textContent = item.name.replace('.pdf', '');

                    card.appendChild(thumbnailDiv);
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
        if (!url) return;
        const folderId = extractFolderIdFromUrl(url);
        if (folderId) loadFolder(folderId, true);
    });

    function extractFolderIdFromUrl(url) {
        const match = url.match(/folders\/([a-zA-Z0-9_-]+)/);
        return match ? match[1] : null;
    }

    // Cek URL saat halaman pertama kali dibuka
    const initialParams = new URLSearchParams(window.location.search);
    const initialFolderId = initialParams.get('folderId');
    if (initialFolderId) {
        // Asumsi folder dari URL adalah root
        loadFolder(initialFolderId, true);
    }
});