document.addEventListener('DOMContentLoaded', () => {
    const loadBtn = document.getElementById('load-btn');
    const folderUrlInput = document.getElementById('folder-url');
    const pdfGrid = document.getElementById('pdf-grid');
    const loader = document.getElementById('loader');
    const breadcrumbsContainer = document.getElementById('breadcrumbs');
    const historySection = document.getElementById('history-section');
    const historyList = document.getElementById('history-list');

    const CACHE_KEY = 'pdflash_cache';
    const HISTORY_KEY = 'pdflash_history';
    
    let fileCache = JSON.parse(localStorage.getItem(CACHE_KEY)) || {};
    let folderHistory = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];

    const renderHistory = () => {
        historyList.innerHTML = '';
        if (folderHistory.length > 0) {
            historySection.style.display = 'block';
            folderHistory.forEach(folder => {
                const link = document.createElement('a');
                link.href = '#';
                link.textContent = folder.name;
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    loadFolder(folder.id, true);
                });
                historyList.appendChild(link);
            });
        }
    };

    const addToHistory = (folderId, folderName) => {
        folderHistory = folderHistory.filter(f => f.id !== folderId);
        folderHistory.unshift({ id: folderId, name: folderName });
        folderHistory = folderHistory.slice(0, 5);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(folderHistory));
        renderHistory();
    };

    let navigationStack = [];

    const renderBreadcrumbs = () => {
        breadcrumbsContainer.innerHTML = '';
        navigationStack.forEach((folder, index) => {
            const link = document.createElement('a');
            link.href = '#';
            link.textContent = folder.name;
            link.dataset.folderId = folder.id;
            link.addEventListener('click', (e) => {
                e.preventDefault();
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
    
    const renderGrid = (items) => {
        pdfGrid.innerHTML = '';
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
                    
                    // --- INI BAGIAN YANG DIUBAH ---
                    // Langsung pakai thumbnailLink dari Google.
                    // Tambahkan .replace untuk meminta gambar resolusi lebih tinggi jika perlu.
                    if (item.thumbnailLink) {
                         thumbnailImg.src = item.thumbnailLink.replace(/=s220$/, '=s480');
                    } else {
                        // Jika tidak ada thumbnail, bisa tampilkan placeholder
                        // thumbnailImg.src = '/placeholder.svg';
                    }
                    // --- AKHIR BAGIAN YANG DIUBAH ---

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
    };

    const loadFolder = async (folderId, isRoot = false) => {
        loader.style.display = 'block';
        pdfGrid.innerHTML = '';

        if (fileCache[folderId]) {
            console.log(`Cache hit for folder ${folderId}. Loading from cache.`);
            const items = fileCache[folderId];
            
            const newUrl = `/?folderId=${folderId}`;
            if (window.location.search !== `?folderId=${folderId}`) {
                window.history.pushState({ folderId }, '', newUrl);
            }
            if (isRoot) {
                navigationStack = [{ id: folderId, name: 'Home' }]; // Tetap 'Home' atau ambil nama folder nanti
            }
            renderBreadcrumbs();
            addToHistory(folderId, navigationStack[navigationStack.length - 1].name);

            renderGrid(items);
            loader.style.display = 'none';
            return;
        }
        
        console.log(`Cache miss for folder ${folderId}. Fetching from API...`);
        try {
            const response = await fetch(`/api/get-files?folderId=${folderId}`);
            if (!response.ok) throw new Error('Gagal memuat daftar file.');
            const items = await response.json();

            fileCache[folderId] = items;
            localStorage.setItem(CACHE_KEY, JSON.stringify(fileCache));

            const newUrl = `/?folderId=${folderId}`;
            if (window.location.search !== `?folderId=${folderId}`) {
                window.history.pushState({ folderId }, '', newUrl);
            }
            if (isRoot) {
                navigationStack = [{ id: folderId, name: 'Home' }];
            }
            renderBreadcrumbs();
            addToHistory(folderId, navigationStack[navigationStack.length-1].name);
            
            renderGrid(items);

        } catch (error) {
            console.error(error);
            pdfGrid.innerHTML = `<p>Error: ${error.message}</p>`;
        } finally {
            loader.style.display = 'none';
        }
    };
    
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
    
    const initialParams = new URLSearchParams(window.location.search);
    const initialFolderId = initialParams.get('folderId');
    if (initialFolderId) {
        loadFolder(initialFolderId, true);
    }

    renderHistory();
});