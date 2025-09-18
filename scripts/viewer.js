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
        // Fetch dengan redirect handling
        const response = await fetch(`/api/get-page?fileId=${fileId}&page=1`, { 
            redirect: 'follow' 
        });
        
        if (!response.ok) throw new Error('Gagal memuat halaman pertama.');
        
        // Simpan total pages dari header jika belum ada di cache
        if (!totalPages) {
            totalPages = parseInt(response.headers.get('X-Total-Pages'));
            localStorage.setItem(storageKey, totalPages);
        }
        
        const firstPageBlob = await response.blob();
        
        // Inisialisasi swiper dengan total pages
        for (let i = 1; i <= totalPages; i++) {
            const slide = document.createElement('div');
            slide.className = 'swiper-slide';
            slide.dataset.pageNumber = i;

            if (i === 1) {
                const img = document.createElement('img');
                img.src = URL.createObjectURL(firstPageBlob);
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
                // Fetch dengan redirect handling untuk halaman lainnya
                const pageResponse = await fetch(`/api/get-page?fileId=${fileId}&page=${pageNum}`, { 
                    redirect: 'follow' 
                });
                
                if (!pageResponse.ok) throw new Error('Gagal memuat halaman.');
                
                const img = document.createElement('img');
                img.src = URL.createObjectURL(await pageResponse.blob());
                
                img.onload = () => {
                    activeSlide.innerHTML = '';
                    activeSlide.appendChild(img);
                };
                
                img.onerror = () => {
                    activeSlide.innerHTML = `<p style="color:red;">Gagal memuat halaman ${pageNum}</p>`;
                };
            } catch (error) {
                activeSlide.innerHTML = `<p style="color:red;">Error: ${error.message}</p>`;
            }
        });
        
        loader.style.display = 'none';

    } catch (error) {
        console.error(error);
        swiperWrapper.innerHTML = `<p style="color:red; text-align:center;">Error: ${error.message}</p>`;
        loader.style.display = 'none';
    }
});
