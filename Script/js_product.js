// Tabs handler
function showTab(tabId, event) {
    const contents = document.querySelectorAll(".tab-content");
    const buttons = document.querySelectorAll(".tab-btn");

    contents.forEach(content => content.classList.remove("active"));
    buttons.forEach(btn => btn.classList.remove("active"));

    document.getElementById(tabId).classList.add("active");
    event.currentTarget.classList.add("active");
}

// Toast thông báo khi thêm vào giỏ hàng
function showToast(message = "Đã thêm vào giỏ hàng!") {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    // Hiển thị & tự ẩn sau 3s
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Gắn sự kiện "thêm vào giỏ"
document.querySelectorAll('.add-to-cart').forEach(btn => {
    btn.addEventListener('click', () => {
        showToast("🛒 Đã thêm vào giỏ hàng!");
        // Logic thêm vào giỏ...
    });
});

// Lưu sản phẩm đã xem
function saveRecentlyViewed(product) {
    let viewed = JSON.parse(localStorage.getItem('recentProducts')) || [];

    viewed = viewed.filter(p => p.id !== product.id);
    viewed.unshift(product);
    if (viewed.length > 5) viewed = viewed.slice(0, 5);

    localStorage.setItem('recentProducts', JSON.stringify(viewed));
}

// Gắn sự kiện cho thẻ sản phẩm
document.querySelectorAll('.product-card.clickable').forEach(card => {
    card.addEventListener('click', () => {
        const product = {
            id: card.dataset.id || Math.random().toString(36).substring(2, 10), // fallback ID
            name: card.querySelector('h4').textContent,
            img: card.querySelector('img').src,
            price: card.querySelector('.price').textContent
        };
        saveRecentlyViewed(product);
    });
});

// Render sản phẩm đã xem gần đây
function renderRecentlyViewed() {
    const viewed = JSON.parse(localStorage.getItem('recentProducts')) || [];
    const container = document.querySelector('#recentlyViewedList');
    if (!container) return;

    container.innerHTML = viewed.map(p => `
        <div class="product-card">
            <img src="${p.img}" alt="${p.name}">
            <h4>${p.name}</h4>
            <p class="price">${p.price}</p>
        </div>
    `).join('');
}
document.addEventListener('DOMContentLoaded', renderRecentlyViewed);

// Scroll sản phẩm đã xem
function scrollRecent(direction) {
    const container = document.getElementById('recentlyViewedList');
    const scrollAmount = 180;
    container.scrollBy({
        left: direction * scrollAmount,
        behavior: 'smooth'
    });
}

// Khởi tạo lightGallery sau DOM load
document.addEventListener('DOMContentLoaded', () => {
    const galleryElement = document.getElementById('lightgallery');
    if (galleryElement) {
        lightGallery(galleryElement, {
            selector: 'a',
            plugins: [lgZoom],
            speed: 400,
            download: false,
            zoom: true
        });
    }
});

document.addEventListener('DOMContentLoaded', () => {
    let currentIndex = 0;
    const thumbnails = document.querySelectorAll(".thumbnails img");

    thumbnails.forEach((thumb, index) => {
        thumb.addEventListener("click", () => {
            const fullSrc = thumb.dataset.full;
            const mainImage = document.getElementById("mainImage");
            const imageContainer = mainImage.parentElement; // Lấy .image-container
            const lightLink = document.querySelector("#lightgallery a");

            // Xác định hướng trượt
            const direction = index > currentIndex ? "slide-left" : "slide-right";
            imageContainer.classList.add(direction);

            // Đợi transition hoàn tất (400ms) rồi đổi ảnh
            setTimeout(() => {
                mainImage.src = fullSrc;
                lightLink.href = fullSrc;
                imageContainer.classList.remove(direction);
                imageContainer.classList.add("slide-reset");

                // Loại bỏ slide-reset
                setTimeout(() => {
                    imageContainer.classList.remove("slide-reset");
                }, 50);

                // Cập nhật chỉ số và active
                currentIndex = index;
                thumbnails.forEach(t => t.classList.remove("active"));
                thumb.classList.add("active");
            }, 400);
        });
    });
});

// Hàm scrollThumbnails (giữ nguyên)
function scrollThumbnails(direction) {
    const container = document.getElementById('thumbnailsList');
    const scrollAmount = 100;
    container.scrollBy({
        left: direction * scrollAmount,
        behavior: 'smooth'
    });
}
function scrollBundleProducts(direction) {
    const container = document.getElementById('bundleProductList');
    const scrollAmount = window.innerWidth <= 768 ? 150 : 180; // 150px (mobile), 180px (desktop)
    container.scrollBy({
        left: direction * scrollAmount,
        behavior: 'smooth'
    });
}
