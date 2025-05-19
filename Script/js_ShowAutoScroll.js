// js_ShowAutoScroll.js - Sửa lỗi để hoạt động với tất cả danh mục

function updateScrollButtons(wrapper, gridId) {
    // Tìm kiếm nút cuộn chính xác trong phạm vi gần nhất
    const section = wrapper.closest('.product-section, .semiconductor-section');
    const leftBtn = section.querySelector(`.scroll-btn.left[onclick*="${gridId}"]`);
    const rightBtn = section.querySelector(`.scroll-btn.right[onclick*="${gridId}"]`);

    if (!leftBtn || !rightBtn) return;

    const scrollLeft = wrapper.scrollLeft;
    const maxScrollLeft = wrapper.scrollWidth - wrapper.clientWidth;

    leftBtn.style.display = scrollLeft <= 5 ? 'none' : 'block';
    rightBtn.style.display = scrollLeft >= maxScrollLeft - 5 ? 'none' : 'block';
}

function startAutoScroll(wrapper, grid, intervalHolder, gridId) {
    const productCard = grid.querySelector('.product-card');
    if (!productCard) return;

    const cardWidth = productCard.offsetWidth;
    const gap = parseInt(getComputedStyle(grid).gap) || 0;
    const scrollAmount = cardWidth + gap;
    const maxScrollLeft = grid.scrollWidth - wrapper.clientWidth;

    // Nếu không đủ chiều rộng để cuộn, ẩn nút và thoát
    if (grid.scrollWidth <= wrapper.clientWidth) {
        const section = wrapper.closest('.product-section, .semiconductor-section');
        const leftBtn = section.querySelector(`.scroll-btn.left[onclick*="${gridId}"]`);
        const rightBtn = section.querySelector(`.scroll-btn.right[onclick*="${gridId}"]`);

        if (leftBtn) leftBtn.style.display = 'none';
        if (rightBtn) rightBtn.style.display = 'none';
        return;
    }

    function doScroll() {
        const currentScroll = wrapper.scrollLeft;

        if (currentScroll + scrollAmount >= maxScrollLeft - 1) {
            // Cuộn đến cuối → quay về đầu sau 4s
            wrapper.scrollTo({ left: maxScrollLeft, behavior: 'smooth' });
            clearInterval(intervalHolder.id);

            setTimeout(() => {
                wrapper.scrollTo({ left: 0, behavior: 'smooth' });
                intervalHolder.id = setInterval(doScroll, 4000);
                wrapper.autoScrollInterval = intervalHolder.id;
            }, 4000);
        } else {
            wrapper.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }

        updateScrollButtons(wrapper, gridId);
    }

    intervalHolder.id = setInterval(doScroll, 4000);
    wrapper.autoScrollInterval = intervalHolder.id;

    // Tạm dừng khi hover
    wrapper.addEventListener('mouseenter', () => {
        clearInterval(intervalHolder.id);
    });

    wrapper.addEventListener('mouseleave', () => {
        clearInterval(intervalHolder.id);
        intervalHolder.id = setInterval(doScroll, 4000);
        wrapper.autoScrollInterval = intervalHolder.id;
    });

    // 🔄 Tạm dừng / resume khi chuyển tab
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            clearInterval(intervalHolder.id);
        } else {
            clearInterval(intervalHolder.id); // để chắc chắn
            intervalHolder.id = setInterval(doScroll, 4000);
            wrapper.autoScrollInterval = intervalHolder.id;
        }
    });

    wrapper.addEventListener('scroll', () => {
        updateScrollButtons(wrapper, gridId);
    });

    updateScrollButtons(wrapper, gridId);
}

function scrollProducts(gridId, direction) {
    const grid = document.getElementById(gridId);
    const wrapper = grid?.closest('.product-grid-wrapper');
    const card = grid?.querySelector('.product-card');
    if (!wrapper || !card) return;

    const cardWidth = card.offsetWidth;
    const gap = parseInt(getComputedStyle(grid).gap) || 0;
    const scrollAmount = cardWidth + gap;

    if (wrapper.autoScrollInterval) {
        clearInterval(wrapper.autoScrollInterval);
        wrapper.autoScrollInterval = null;
    }

    if (wrapper.restartTimeout) {
        clearTimeout(wrapper.restartTimeout);
        wrapper.restartTimeout = null;
    }

    wrapper.scrollBy({ left: scrollAmount * direction, behavior: 'smooth' });

    // Delay nhỏ để cập nhật đúng vị trí cuộn
    setTimeout(() => updateScrollButtons(wrapper, gridId), 500);

    wrapper.restartTimeout = setTimeout(() => {
        const scrollHolder = {};
        startAutoScroll(wrapper, grid, scrollHolder, gridId);
    }, 4000);
}

function initializeAutoScroll() {
    // Khởi tạo cho tất cả các grid-wrapper hiện có
    const wrappers = document.querySelectorAll('.product-grid-wrapper');

    wrappers.forEach(wrapper => {
        const grid = wrapper.querySelector('.product-grid');
        if (!grid) return;

        const gridId = grid.id;
        if (!gridId) return;

        const scrollHolder = {};
        startAutoScroll(wrapper, grid, scrollHolder, gridId);
    });
}

// Thêm hàm để khởi tạo lại autoscroll cho khi filter
function reInitializeAutoScroll(gridId) {
    console.log("Re-initializing auto-scroll for: " + gridId);
    const grid = document.getElementById(gridId);
    const wrapper = grid?.closest('.product-grid-wrapper');
    if (!wrapper || !grid) {
        console.warn(`Grid ${gridId} or its wrapper not found`);
        return;
    }

    // Xóa interval hiện tại nếu có
    if (wrapper.autoScrollInterval) {
        clearInterval(wrapper.autoScrollInterval);
        wrapper.autoScrollInterval = null;
    }

    // Khởi tạo lại
    const scrollHolder = {};
    startAutoScroll(wrapper, grid, scrollHolder, gridId);
}

// Đảm bảo function được export
window.scrollProducts = scrollProducts;
window.initializeAutoScroll = initializeAutoScroll;
window.reInitializeAutoScroll = reInitializeAutoScroll;