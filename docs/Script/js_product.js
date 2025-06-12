// Tabs handler
function showTab(tabId, event) {
    const contents = document.querySelectorAll(".tab-content");
    const buttons = document.querySelectorAll(".tab-btn");

    contents.forEach(content => content.classList.remove("active"));
    buttons.forEach(btn => btn.classList.remove("active"));

    document.getElementById(tabId).classList.add("active");
    event.currentTarget.classList.add("active");
}

// Pop-up thông báo khi thêm vào giỏ hàng
let autoCloseTimeout = null;
let isMouseOverPopup = false;
let isBuyNowPending = false;

function showCartPopup(message, isBuyNow = false) {
    let popup = document.getElementById('productCartPopup');
    if (!popup) {
        popup = document.createElement('div');
        popup.id = 'productCartPopup';
        popup.style.display = 'none';
        document.querySelector('.user-actions').appendChild(popup);
    } else {
        // Xóa sự kiện cũ để tránh xung đột
        const oldEvents = popup.getAttribute('data-events');
        if (oldEvents) {
            popup.removeEventListener('mouseenter', null);
            popup.removeEventListener('mouseleave', null);
            popup.removeEventListener('click', null);
        }
    }

    const cartIcon = document.querySelector('.cart-icon .bx-cart, .cart-icon .bxs-cart');
    if (cartIcon) {
        const rect = cartIcon.getBoundingClientRect();
        popup.style.position = 'fixed';
        popup.style.top = `${rect.bottom + window.scrollY + 10}px`;
        popup.style.right = `${Math.max(10, window.innerWidth - rect.right + 10)}px`; // Đảm bảo không tràn ngoài
        popup.style.zIndex = '9999';
        popup.style.width = '320px'; // Đặt chiều rộng cố định
        popup.style.minHeight = '100px'; // Đảm bảo chiều cao tối thiểu
    }

    popup.innerHTML = `
        <div class="popup-content">
            <div class="header">
                <i class='bx bx-check-circle'></i>
                <span class="popup-message">${message}</span>
                <button class="popup-close" onclick="closeCartPopup()">
                    <i class='bx bx-x'></i>
                </button>
            </div>
            <button class="view-cart-btn" onclick="handleViewCartClick(${isBuyNow})">Xem giỏ hàng</button>
        </div>
    `;

    popup.className = 'notification-popup';
    popup.classList.add('show');
    popup.style.display = 'block';

    isMouseOverPopup = false;
    isBuyNowPending = isBuyNow;

    popup.addEventListener('mouseenter', () => {
        isMouseOverPopup = true;
        if (autoCloseTimeout) {
            clearTimeout(autoCloseTimeout);
            autoCloseTimeout = null;
        }
    });

    popup.addEventListener('mouseleave', () => {
        isMouseOverPopup = false;
        startAutoCloseTimer();
    });

    popup.addEventListener('click', (event) => {
        event.stopPropagation();
    });

    startAutoCloseTimer();
}

function startAutoCloseTimer() {
    if (autoCloseTimeout) clearTimeout(autoCloseTimeout);
    autoCloseTimeout = setTimeout(() => {
        if (!isMouseOverPopup) closeCartPopup();
    }, 4000);
}

function closeCartPopup() {
    const popup = document.getElementById('productCartPopup');
    if (popup) {
        popup.classList.remove('show');
        popup.classList.add('hide');
        setTimeout(() => {
            popup.style.display = 'none';
        }, 300);
    }
    if (autoCloseTimeout) {
        clearTimeout(autoCloseTimeout);
        autoCloseTimeout = null;
    }
    isBuyNowPending = false;
}

function handleViewCartClick(isBuyNow) {
    if (isBuyNow) window.location.href = 'checkout.html';
    closeCartPopup();
}

// Xử lý click ngoài pop-up
document.addEventListener('click', (event) => {
    const popup = document.getElementById('productCartPopup');
    if (!popup || !popup.classList.contains('show')) return;

    const isClickInside = popup.contains(event.target);
    const isButtonClick = event.target.closest('.buy-now') || event.target.closest('.add-to-cart-bundle');
    if (isClickInside || isButtonClick) {
        event.stopPropagation();
        return;
    }
    closeCartPopup();
});

// Lưu sản phẩm đã xem
function saveRecentlyViewed(product) {
    let viewed = JSON.parse(localStorage.getItem('recentProducts')) || [];
    viewed = viewed.filter(p => p.id !== product.id);
    viewed.unshift(product);
    if (viewed.length > 5) viewed = viewed.slice(0, 5);
    localStorage.setItem('recentProducts', JSON.stringify(viewed));
}

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

// Scroll sản phẩm đã xem
function scrollRecent(direction) {
    const container = document.getElementById('recentlyViewedList');
    const scrollAmount = 180;
    container.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
}

// Khởi tạo lightGallery
document.addEventListener('DOMContentLoaded', () => {
    const galleryElement = document.getElementById('lightgallery');
    if (galleryElement) {
        lightGallery(galleryElement, {
            selector: 'a',
            plugins: [lgZoom],
            speed: 0,
            download: false,
            zoom: true
        });
    }
});

// Xử lý click thumbnails
document.addEventListener('DOMContentLoaded', () => {
    let currentIndex = 0;
    const thumbnails = document.querySelectorAll(".thumbnails img");
    thumbnails.forEach((thumb, index) => {
        thumb.addEventListener("click", () => {
            const fullSrc = thumb.dataset.full;
            const mainImage = document.getElementById("mainImage");
            const imageContainer = mainImage.parentElement;
            const lightLink = document.querySelector("#lightgallery a");
            const direction = index > currentIndex ? "slide-left" : "slide-right";
            imageContainer.classList.add(direction);
            mainImage.src = fullSrc;
            lightLink.href = fullSrc;
            imageContainer.classList.remove(direction);
            imageContainer.classList.add("slide-reset");
            setTimeout(() => imageContainer.classList.remove("slide-reset"), 50);
            currentIndex = index;
            thumbnails.forEach(t => t.classList.remove("active"));
            thumb.classList.add("active");
        });
    });
});

// Hàm scrollThumbnails
function scrollThumbnails(direction) {
    const container = document.getElementById('thumbnailsList');
    const scrollAmount = 100;
    container.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
}

function scrollBundleProducts(direction) {
    const container = document.getElementById('bundleProductList');
    const scrollAmount = window.innerWidth <= 768 ? 150 : 180;
    container.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
}

// Xử lý zoom ảnh
document.querySelectorAll('.image-container .main-image').forEach(image => {
    image.addEventListener('click', function() {
        const isZoomed = this.classList.contains('zoom-active');
        requestAnimationFrame(() => this.classList.toggle('zoom-active', !isZoomed));
    });
});

// Logic tính tạm tính cho sản phẩm mua kèm
document.addEventListener('DOMContentLoaded', () => {
    const selectButtons = document.querySelectorAll('.select-product');
    const subtotalElement = document.getElementById('bundleSubtotal');

    function parsePrice(priceText) { return parseInt(priceText.replace(/[^0-9]/g, '')); }
    function formatPrice(price) { return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '₫'; }

    function updateSubtotal() {
        const selectedCards = document.querySelectorAll('.product-card.selected');
        let subtotal = 0;
        selectedCards.forEach(card => subtotal += parsePrice(card.querySelector('.price').textContent));
        subtotalElement.textContent = formatPrice(subtotal);
    }

    selectButtons.forEach(button => {
        button.addEventListener('click', function() {
            const card = this.closest('.product-card');
            card.classList.toggle('selected');
            updateSubtotal();
            this.textContent = card.classList.contains('selected') ? 'Bỏ chọn' : 'Chọn sản phẩm';
        });
    });

    updateSubtotal();
});

// Gắn sự kiện "thêm vào giỏ"
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.buy-now').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation(); // Ngăn sự kiện lan ra ngoài
            const productCard = this.closest('.product-section') || this.closest('.product-card');
            const productId = this.getAttribute('data-id') || 'pc-gvn-i5-13400f-rx6600';
            const productName = productCard.querySelector('.product-name').textContent;
            const priceText = productCard.querySelector('.price-box .price strong').textContent;
            const priceValue = parseInt(priceText.replace(/\D/g, ''));
            const productImage = document.querySelector('.main-image').src;

            addToCart(productId, productName, priceValue, productImage);
            updateCartCount();
            showCartPopup(`Đã thêm 1 sản phẩm vào giỏ hàng!`, this.classList.contains('buy-now'));
        });
    });

    const addToCartBundleBtn = document.querySelector('.add-to-cart-bundle');
    if (addToCartBundleBtn) {
        addToCartBundleBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            const selectedProducts = document.querySelectorAll('.bundle-products .product-card.selected');
            if (selectedProducts.length === 0) {
                showCartPopup('Vui lòng chọn ít nhất một sản phẩm để thêm vào giỏ!');
                return;
            }

            selectedProducts.forEach(product => {
                const productName = product.querySelector('h4').textContent;
                const priceText = product.querySelector('.price').textContent;
                const priceValue = parseInt(priceText.replace(/\D/g, ''));
                const productImage = product.querySelector('img').src;
                const productId = `combo-${productName.toLowerCase().replace(/\s+/g, '-')}`;
                addToCart(productId, productName, priceValue, productImage);
            });

            showCartPopup(`Đã thêm ${selectedProducts.length} sản phẩm vào giỏ hàng!`, true);
            updateCartCount();
        });
    }
});

// Gắn sự kiện cho thẻ sản phẩm
document.querySelectorAll('.product-card.clickable').forEach(card => {
    card.addEventListener('click', () => {
        const product = {
            id: card.dataset.id || Math.random().toString(36).substring(2, 10),
            name: card.querySelector('h4')?.textContent || card.querySelector('.product-name')?.textContent,
            img: card.querySelector('img')?.src || document.querySelector('.main-image')?.src,
            price: card.querySelector('.price')?.textContent || card.querySelector('.price-box .price strong')?.textContent
        };
        saveRecentlyViewed(product);
    });
});

document.addEventListener('DOMContentLoaded', () => {
    renderRecentlyViewed();
});

// Hàm hỗ trợ
function updateCartCount() {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const cartCountElement = document.querySelector('.cart-count');
    if (cartCountElement) {
        cartCountElement.textContent = cart.length;
        cartCountElement.style.display = cart.length > 0 ? 'inline-flex' : 'none';
    }
}

function addToCart(productId, productName, priceValue, productImage) {
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    const existingProduct = cart.find(item => item.id === productId);
    if (!existingProduct) {
        cart.push({ id: productId, name: productName, price: priceValue, image: productImage, quantity: 1 });
        localStorage.setItem('cart', JSON.stringify(cart));
    }
}

window.addEventListener('scroll', () => {
    const popup = document.getElementById('productCartPopup');
    if (popup && popup.style.display === 'block') {
        const cartIcon = document.querySelector('.cart-icon .bx-cart, .cart-icon .bxs-cart');
        if (cartIcon) {
            const rect = cartIcon.getBoundingClientRect();
            popup.style.top = `${rect.bottom + window.scrollY + 10}px`;
            popup.style.right = `${window.innerWidth - rect.right + 10}px`;
        }
    }
});