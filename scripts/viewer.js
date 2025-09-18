document.addEventListener('DOMContentLoaded', async () => {
    const backBtn = document.getElementById('back-btn');
    backBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.history.back();
    });

    const loader = document.getElementById('loader');
    const swiperWrapper = document.querySelector('.swiper-wrapper');
    const params = new URLSearchParams(window.location.search);
    const fileId = params.get('fileId');
    const storageKey = `pdf_pages_${fileId}`;
    let totalPages = localStorage.getItem(storageKey) || null;

    if (!fileId) {
        swiperWrapper.innerHTML = '<p style="color:white; text-align:center;">File ID tidak ditemukan.</p>';
        loader.style.display = 'none';
        return;
    }

    try {
        // Tambahkan timeout untuk fetch
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 detik timeout
        
        const response = await fetch(`/api/get-page?fileId=${fileId}&page=1`, { 
            redirect: 'follow',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) throw new Error('Gagal memuat halaman pertama.');
        
        if (!totalPages) {
            totalPages = parseInt(response.headers.get('X-Total-Pages'));
            if (totalPages) localStorage.setItem(storageKey, totalPages);
        }
        
        const firstPageBlob = await response.blob();
        
        // Buat array untuk tracking object URLs
        const objectUrls = [];
        
        // Cleanup function untuk revoke object URLs
        const cleanup = () => {
            objectUrls.forEach(url => URL.revokeObjectURL(url));
            objectUrls.length = 0;
        };
        
        // Cleanup saat page unload
        window.addEventListener('beforeunload', cleanup);
        
        // Handle first page
        const firstPageUrl = URL.createObjectURL(firstPageBlob);
        objectUrls.push(firstPageUrl);
        
        for (let i = 1; i <= totalPages; i++) {
            const slide = document.createElement('div');
            slide.className = 'swiper-slide';
            slide.dataset.pageNumber = i;

            if (i === 1) {
                const img = document.createElement('img');
                img.src = firstPageUrl;
                img.onload = () => URL.revokeObjectURL(firstPageUrl); // Revoke setelah load
                slide.appendChild(img);
            } else {
                slide.innerHTML = `<p style="color:#888;">Page ${i}</p>`;
            }
            swiperWrapper.appendChild(slide);
        }

        const swiper = new Swiper('.swiper', {
            navigation: {
                nextEl: '.swiper-button-next',
                prevEl: '.swiper-button-prev',
            },
            keyboard: true,
        });

        swiper.on('slideChange', async () => {
            const activeSlide = swiper.slides[swiper.activeIndex];
            const pageNum = activeSlide.dataset.pageNumber;

            if (activeSlide.querySelector('img')) return;

            console.log(`Loading page ${pageNum}...`);
            activeSlide.innerHTML = `<p style="color:#888;">Loading page ${pageNum}...</p>`;
            
            try {
                const pageController = new AbortController();
                const pageTimeoutId = setTimeout(() => pageController.abort(), 30000);
                
                const pageResponse = await fetch(`/api/get-page?fileId=${fileId}&page=${pageNum}`, { 
                    redirect: 'follow',
                    signal: pageController.signal
                });
                
                clearTimeout(pageTimeoutId);
                
                if (!pageResponse.ok) throw new Error('Gagal memuat halaman.');
                
                const pageBlob = await pageResponse.blob();
                const pageUrl = URL.createObjectURL(pageBlob);
                objectUrls.push(pageUrl);
                
                const img = document.createElement('img');
                img.src = pageUrl;
                
                img.onload = () => {
                    activeSlide.innerHTML = '';
                    activeSlide.appendChild(img);
                    URL.revokeObjectURL(pageUrl); // Revoke setelah load
                };
                
                img.onerror = () => {
                    activeSlide.innerHTML = `<p style="color:red;">Gagal memuat halaman ${pageNum}</p>`;
                    URL.revokeObjectURL(pageUrl);
                };
            } catch (error) {
                if (error.name === 'AbortError') {
                    activeSlide.innerHTML = `<p style="color:orange;">Request timeout</p>`;
                } else {
                    activeSlide.innerHTML = `<p style="color:red;">Error: ${error.message}</p>`;
                }
            }
        });
        
        loader.style.display = 'none';

    } catch (error) {
        console.error('Viewer error:', error);
        if (error.name === 'AbortError') {
            swiperWrapper.innerHTML = `<p style="color:orange; text-align:center;">Request timeout. Coba lagi.</p>`;
        } else {
            swiperWrapper.innerHTML = `<p style="color:red; text-align:center;">Error: ${error.message}</p>`;
        }
        loader.style.display = 'none';
    }
});