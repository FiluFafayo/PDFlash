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

    if (!fileId) {
        swiperWrapper.innerHTML = '<p style="color:white; text-align:center;">File ID tidak ditemukan.</p>';
        loader.style.display = 'none';
        return;
    }

    // Konfigurasi worker untuk pdf.js agar berjalan di browser
    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

    const pdfUrl = `/api/stream-pdf?fileId=${fileId}`;

    try {
        // Meminta PDF dari server (server akan stream dari cache/hasil proses)
        const pdfDoc = await pdfjsLib.getDocument(pdfUrl).promise;
        const totalPages = pdfDoc.numPages;

        swiperWrapper.innerHTML = '';
        for (let i = 1; i <= totalPages; i++) {
            const slide = document.createElement('div');
            slide.className = 'swiper-slide';
            slide.dataset.pageNumber = i;
            // Setiap slide berisi canvas kosong yang siap digambar
            const canvas = document.createElement('canvas');
            slide.appendChild(canvas);
            swiperWrapper.appendChild(slide);
        }

        const swiper = new Swiper('.swiper', {
            navigation: {
                nextEl: '.swiper-button-next',
                prevEl: '.swiper-button-prev',
            },
            keyboard: true,
        });

        // Fungsi untuk menggambar halaman ke canvas
        const renderPage = async (pageNumber) => {
            // Cari slide dan canvas yang sesuai
            const slide = swiper.slides.find(s => parseInt(s.dataset.pageNumber) === pageNumber);
            if (!slide || slide.classList.contains('page-rendered')) return; // Jangan render ulang

            const canvas = slide.querySelector('canvas');
            const context = canvas.getContext('2d');

            const page = await pdfDoc.getPage(pageNumber);
            // Skala render disesuaikan dengan kepadatan pixel layar agar tidak pecah
            const viewport = page.getViewport({ scale: window.devicePixelRatio || 1.5 });
            
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport }).promise;
            slide.classList.add('page-rendered'); // Tandai sudah dirender
        };

        // Mekanisme Lazy Loading
        swiper.on('slideChange', () => {
            const currentPage = swiper.activeIndex + 1;
            renderPage(currentPage); // Render halaman yang aktif
            if (currentPage + 1 <= totalPages) {
                renderPage(currentPage + 1); // Siapkan halaman berikutnya
            }
        });

        // Render halaman pertama saat dibuka
        renderPage(1);
        if (totalPages > 1) renderPage(2);
        loader.style.display = 'none';

    } catch (error) {
        console.error('Viewer error:', error);
        loader.style.display = 'none';
        swiperWrapper.innerHTML = `<p style="color:red; text-align:center;">Gagal memuat PDF: ${error.message}</p>`;
    }
});