document.addEventListener('DOMContentLoaded', async () => {
    // ---- BAGIAN TAMBAHAN DIMULAI ----
    const backBtn = document.getElementById('back-btn');
    backBtn.addEventListener('click', (e) => {
        e.preventDefault(); // Mencegah link '#' menggulir ke atas halaman
        window.history.back(); // Perilaku sama seperti tombol 'Back' browser
    });
    // ---- BAGIAN TAMBAHAN SELESAI ----

    const loader = document.getElementById('loader');
    const swiperWrapper = document.querySelector('.swiper-wrapper');

    const params = new URLSearchParams(window.location.search);
    const fileId = params.get('fileId');

    if (!fileId) {
        swiperWrapper.innerHTML = '<p style="color:white; text-align:center;">File ID tidak ditemukan.</p>';
        loader.style.display = 'none';
        return;
    }

    try {
        const response = await fetch(`/api/get-page?fileId=${fileId}&page=1`);
        if (!response.ok) throw new Error('Gagal memuat halaman pertama.');
        
        const totalPages = parseInt(response.headers.get('X-Total-Pages'));
        const firstPageBlob = await response.blob();
        
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

        swiper.on('slideChange', () => {
            const activeSlide = swiper.slides[swiper.activeIndex];
            const pageNum = activeSlide.dataset.pageNumber;

            if (activeSlide.querySelector('img')) {
                return;
            }

            console.log(`Loading page ${pageNum}...`);
            activeSlide.innerHTML = `<p style="color:#888;">Loading page ${pageNum}...</p>`;
            const img = document.createElement('img');
            img.src = `/api/get-page?fileId=${fileId}&page=${pageNum}`;
            
            img.onload = () => {
                activeSlide.innerHTML = '';
                activeSlide.appendChild(img);
            };
            img.onerror = () => {
                activeSlide.innerHTML = `<p style="color:red;">Gagal memuat halaman ${pageNum}</p>`;
            };
        });
        
        loader.style.display = 'none';

    } catch (error) {
        console.error(error);
        swiperWrapper.innerHTML = `<p style="color:red; text-align:center;">Error: ${error.message}</p>`;
        loader.style.display = 'none';
    }
});