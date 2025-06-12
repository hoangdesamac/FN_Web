function initializeSlideshow() {
    const slides = document.querySelectorAll('.slide');
    const prevButton = document.querySelector('.prev-button');
    const nextButton = document.querySelector('.next-button');
    const mainBanner = document.querySelector('.main-banner');
    let currentSlide = 0;
    let slideInterval;
    let isAnimating = false;

    // Kiểm tra nếu các phần tử cần thiết không tồn tại
    if (!slides.length || !prevButton || !nextButton || !mainBanner) {
        console.error('Không tìm thấy các phần tử cần thiết cho slideshow:', {
            slides: slides.length,
            prevButton: !!prevButton,
            nextButton: !!nextButton,
            mainBanner: !!mainBanner
        });
        return;
    }

    const showSlide = (index) => {
        if (isAnimating) return;
        isAnimating = true;
        console.log('Current Slide Index:', index);
        slides.forEach((slide, i) => {
            const offset = (i - index) * 100;
            slide.style.transform = `translateX(${offset}%)`;
        });
        setTimeout(() => {
            isAnimating = false;
        }, 500);
    };

    const startAutoSlide = () => {
        clearInterval(slideInterval);
        slideInterval = setInterval(nextSlide, 3000);
    };

    const nextSlide = () => {
        currentSlide = (currentSlide + 1) % slides.length;
        showSlide(currentSlide);
    };

    const prevSlide = () => {
        currentSlide = (currentSlide - 1 + slides.length) % slides.length;
        showSlide(currentSlide);
    };

    // Khởi động hiển thị ban đầu
    showSlide(currentSlide);
    startAutoSlide();

    // Xử lý sự kiện nhấn nút
    nextButton.addEventListener('click', () => {
        if (!isAnimating) {
            nextSlide();
            clearInterval(slideInterval);
            setTimeout(startAutoSlide, 3000);
        }
    });

    prevButton.addEventListener('click', () => {
        if (!isAnimating) {
            prevSlide();
            clearInterval(slideInterval);
            setTimeout(startAutoSlide, 3000);
        }
    });

    // Xử lý hover vào main banner
    mainBanner.addEventListener('mouseenter', () => {
        clearInterval(slideInterval);
    });

    mainBanner.addEventListener('mouseleave', () => {
        setTimeout(startAutoSlide, 3000);
    });

    // Xử lý click vào main banner
    mainBanner.addEventListener('click', () => {
        if (!isAnimating) {
            nextSlide();
            clearInterval(slideInterval);
            setTimeout(startAutoSlide, 3000);
        }
    });
}

// Gọi hàm khởi tạo nếu cần chạy ngay khi script load (tùy chọn)
document.addEventListener('DOMContentLoaded', initializeSlideshow);