document.addEventListener('DOMContentLoaded', async () => {
    const loader = document.getElementById('loader');
    const swiperWrapper = document.querySelector('.swiper-wrapper');

    // 1. Ambil File ID dari URL
    const params = new URLSearchParams(window.location.search);
    const fileId = params.get('fileId');

    if (!fileId) {
        swiperWrapper.innerHTML = '<p style="color:white; text-align:center;">File ID tidak ditemukan.</p>';
        loader.style.display = 'none';
        return;
    }

    try {
        // 2. Ambil halaman pertama DAN total halaman dari header
        const response = await fetch(`/api/get-page?fileId=${fileId}&page=1`);
        if (!response.ok) throw new Error('Gagal memuat halaman pertama.');

        const totalPages = parseInt(response.headers.get('X-Total-Pages'));
        const firstPageBlob = await response.blob();

        // 3. Buat "slide" untuk semua halaman (awalnya kosong)
        for (let i = 1; i <= totalPages; i++) {
            const slide = document.createElement('div');
            slide.className = 'swiper-slide';
            // Simpan nomor halaman di slide untuk referensi
            slide.dataset.pageNumber = i;

            if (i === 1) {
                // Untuk halaman pertama, langsung tampilkan gambar
                const img = document.createElement('img');
                img.src = URL.createObjectURL(firstPageBlob);
                slide.appendChild(img);
            } else {
                // Untuk halaman lain, tampilkan placeholder/loading
                slide.innerHTML = `<p style="color:#888;">Page ${i}</p>`;
            }
            swiperWrapper.appendChild(slide);
        }

        // 4. Inisialisasi Swiper
        const swiper = new Swiper('.swiper', {
            navigation: {
                nextEl: '.swiper-button-next',
                prevEl: '.swiper-button-prev',
            },
            // Aktifkan keyboard untuk navigasi
            keyboard: true,
        });

        // 5. Logika LAZY LOADING
        swiper.on('slideChange', () => {
            const activeSlide = swiper.slides[swiper.activeIndex];
            const pageNum = activeSlide.dataset.pageNumber;

            // Cek apakah slide ini sudah punya gambar atau belum
            if (activeSlide.querySelector('img')) {
                return; // Sudah ada, tidak perlu load lagi
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

        // Sembunyikan loader utama
        loader.style.display = 'none';

    } catch (error) {
        console.error(error);
        swiperWrapper.innerHTML = `<p style="color:red; text-align:center;">Error: ${error.message}</p>`;
        loader.style.display = 'none';
    }
});