const products = [
    {
        id: "mouse-logitech-g309",
        category: "mouse",
        name: "Chuột Logitech G309 Lightspeed Wireless Bluetooth Trắng",
        price: "2.090.000₫",
        image: "Images/logitechg309.jpg",
        thumbnails: [
            "Images/logitechg309.jpg",
            "https://product.hstatic.net/200000722513/product/3_79a2ad3d6f294967a65bfab3a8e602a6_1024x1024.png",
            "https://product.hstatic.net/200000722513/product/4_25734bfc8ae049dd8b8028c07b93c7d0_1024x1024.png",
            "https://product.hstatic.net/200000722513/product/6_4e3c52d079ae48f3a5721cdbc4345a33_1024x1024.png",
            "https://product.hstatic.net/200000722513/product/7_43ae2533e22a4b09a8ba8c5e3f781298_1024x1024.png",
            "https://product.hstatic.net/200000722513/product/9_fbcf80c142e0489382c1ae23c91d20f1_1024x1024.png",
            "https://product.hstatic.net/200000722513/product/2_bfa5bc1c86a144d2be91ce35e63973fe_1024x1024.png",
            "https://product.hstatic.net/200000722513/product/5_b90eddef1ba84b21806ba7e5f68c72a6_1024x1024.png",
            "https://product.hstatic.net/200000722513/product/8_00edfb946fa2488a9c75d4aca622f046_1024x1024.png"

        ],
        description: `
            <p><strong>Giới thiệu:</strong> Bộ PC GVN sử dụng vi xử lý Intel Core i5 thế hệ 13 mạnh mẽ, kết hợp card đồ họa RX 6600 – phù hợp cho game thủ 1080p và người làm đồ họa nhẹ.</p>
            <ul>
                <li>✅ Hiệu năng vượt trội với CPU i5 13400F.</li>
                <li>🎮 Hỗ trợ chơi tốt các game AAA như GTA V, Valorant, Elden Ring.</li>
                <li>🛠️ Dễ nâng cấp, tản nhiệt tốt, thiết kế case hiện đại RGB.</li>
            </ul>
            <img src="Images/logitechg309.jpg" alt="Ảnh minh họa" style="max-width: 100%; margin-top: 20px; border-radius: 10px;">
        `,
        specs: [
            { key: "Hỗ trợ", value: "Logitech G Hub" },
            { key: "Bảo hành", value: "24 tháng" },
            { key: "Pin", value: "300 giờ với Lightspeed không dây / 600 giờ với Bluetooth" },
            { key: "Feet", value: "PTFE Feet" },
            { key: "Độ phân giải", value: "100 - 25600 Dpi" },

        ],
        reviews: [
            { rating: 5, comment: "Quá tuyệt vời cho tầm giá này!", author: "Nguyễn Văn A" },
            { rating: 4, comment: "Cấu hình ổn định, chơi game mượt.", author: "Trần Thị B" }
        ],
        bundle: [
            { name: "Màn hình ASUS TUF GAMING VG279QM 27\" Fast IPS 280Hz G-Sync 1ms", price: "7.290.000₫", image: "https://product.hstatic.net/200000722513/product/asus_vg279qm_gearvn_a98628ac0e1e4043b992a5fd45453867_6a9571bd574740629dad747eb46bcd39_1024x1024.jpg" },
            { name: "Bàn phím Logitech G913 TKL Lightspeed Wireless Clicky", price: "3.710.000₫", image: "https://product.hstatic.net/200000722513/product/thumbphim_b8b3aa506f7a422eaa3db1caa37aae35_e2d7efdfdfb64de7bb20550dd0eddb53_1024x1024.png" },
            { name: "Tai nghe Rapoo Gaming VH520", price: "400.000₫", image: "https://product.hstatic.net/200000722513/product/vn-tai-nghe-rapoo-vh520-virtual-7-1-6_494abb477fa3403db70586180ed81526_cbc91a990e82454f9d509217388e2cf4_1024x1024.jpg" },
        ],
        related: [
            { id: "pc-ryzen5-gtx1660", name: "Chuột Logitech G102 LightSync Black", price: "599.000₫", image: "Images/logitech-g102-lightsync-rgb-black.jpg" },
            { id: "pc-i5-rtx3060", name: "Chuột Logitech G502 X Plus LightSpeed White", price: "3.890.000₫", image: "Images/LogitechG502.jpg" }
        ]
    },
    // Thêm các sản phẩm khác từ mainContent.html
    {
        id: "pc-ryzen5-gtx1660",
        category: "PC",
        name: "PC Ryzen 5 + GTX 1660 Super",
        price: "16.990.000₫",
        image: "/PCRyzen5.jpg",
        thumbnails: ["/PCRyzen5.jpg"],
        description: "PC Ryzen 5 với GTX 1660 Super, phù hợp cho chơi game 1080p.",
        specs: [
            { key: "CPU", value: "Ryzen 5 3600" },
            { key: "VGA", value: "GTX 1660 Super" }
        ],
        reviews: [],
        bundle: [],
        related: [
            { id: "pc-gvn-i5-13400f-rx6600", name: "PC GVN Intel i5 13400F / RX 6600 / Main H610", price: "18.490.000₫", image: "Images/HPHyperX.png" }
        ]
    },
    {
        id: "pc-i5-rtx3060",
        category: "PC",
        name: "PC Intel i5 + RTX 3060",
        price: "22.990.000₫",
        image: "/PCi5RTX3060.jpg",
        thumbnails: ["/PCi5RTX3060.jpg"],
        description: "PC Intel i5 với RTX 3060, lý tưởng cho chơi game và đồ họa.",
        specs: [
            { key: "CPU", value: "Intel i5-12400F" },
            { key: "VGA", value: "RTX 3060" }
        ],
        reviews: [
            { id: "pc-gvn-i5-13400f-rx6600", name: "PC GVN Intel i5 13400F / RX 3060 / Main H610", price: "18.490.000₫", image: "Images/HPHyperX.png" }
        ]
    }
];

// Tabs handler
function showTab(tabId, event) {
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');
}

// Toast notification
function showToast(message, isBuyNow = false) {
    let toast = document.getElementById('toastNotification');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toastNotification';
        document.body.appendChild(toast);
    }
    toast.innerHTML = `
        <div class="toast-content">
            <i class='bx bx-check-circle'></i>
            <span class="toast-message">${message}</span>
            <button class="toast-close" onclick="closeToast()">
                <i class='bx bx-x'></i>
            </button>
        </div>
    `;
    toast.className = 'toast-notification show';
    setTimeout(() => {
        if (toast.classList.contains('show')) {
            closeToast();
            if (isBuyNow) window.location.href = 'checkout.html';
        }
    }, 3000);
}

function closeToast() {
    const toast = document.getElementById('toastNotification');
    if (toast) {
        toast.classList.remove('show');
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 300);
    }
}

// Save recently viewed products
function saveRecentlyViewed(product) {
    let viewed = JSON.parse(localStorage.getItem('recentProducts')) || [];
    viewed = viewed.filter(p => p.id !== product.id);
    viewed.unshift(product);
    if (viewed.length > 5) viewed = viewed.slice(0, 5);
    localStorage.setItem('recentProducts', JSON.stringify(viewed));
}

// Render recently viewed products
function renderRecentlyViewed() {
    const viewed = JSON.parse(localStorage.getItem('recentProducts')) || [];
    const container = document.querySelector('#recentlyViewedList');
    if (!container) return;
    container.innerHTML = viewed.map(p => `
        <div class="product-card clickable" data-id="${p.id}">
            <img src="${p.image}" alt="${p.name}">
            <h4>${p.name}</h4>
            <p class="price">${p.price}</p>
        </div>
    `).join('');

    // Attach click events for related products
    document.querySelectorAll('.product-card.clickable').forEach(card => {
        card.addEventListener('click', () => {
            const productId = card.getAttribute('data-id');
            window.location.href = `product.html?id=${productId}`;
        });
    });
}

// Scroll functions
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

function scrollRecent(direction) {
    const container = document.getElementById('recentlyViewedList');
    const scrollAmount = 180;
    container.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
}

// Thumbnails handler
document.addEventListener('DOMContentLoaded', () => {
    let currentIndex = 0;
    const thumbnailsList = document.getElementById('thumbnailsList');
    const mainImage = document.getElementById('mainImage');
    const lightLink = document.querySelector('#lightgallery a');
    const galleryElement = document.getElementById('lightgallery');
    let galleryInstance = null;

    if (galleryElement) {
        galleryInstance = lightGallery(galleryElement, {
            selector: 'a',
            plugins: [],
            speed: 0,
            download: false,
            zoom: false,
            closable: true,
            closeOnOverlayClick: true
        });
    }

    function setupThumbnails(thumbnails) {
        thumbnailsList.innerHTML = thumbnails.map((thumb, index) => `
            <img src="${thumb}" data-full="${thumb}" alt="Thumbnail ${index + 1}" class="${index === 0 ? 'active' : ''}">
        `).join('');

        const thumbs = thumbnailsList.querySelectorAll('img');
        thumbs.forEach((thumb, index) => {
            thumb.addEventListener('click', () => {
                const fullSrc = thumb.dataset.full;
                mainImage.src = fullSrc;
                lightLink.href = fullSrc;
                galleryInstance.refresh();
                currentIndex = index;
                thumbs.forEach(t => t.classList.remove('active'));
                thumb.classList.add('active');
            });
        });
    }

    // Load product based on URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');
    const product = products.find(p => p.id === productId);

    if (product) {
        // Update breadcrumb
        document.getElementById('productCategory').textContent = product.category;
        document.getElementById('productName').textContent = product.name;

        // Update product info
        document.getElementById('productTitle').textContent = product.name;
        document.getElementById('productPrice').textContent = product.price;
        document.getElementById('productDescription').innerHTML = product.description;
        document.querySelector('.buy-now').setAttribute('data-id', product.id);
        mainImage.src = product.image;
        lightLink.href = product.image;

        // Update thumbnails
        setupThumbnails(product.thumbnails || [product.image]);

        // Update specs
        document.getElementById('productSpecs').innerHTML = `
            <tr><th>Thành phần</th><th>Chi tiết</th></tr>
            ${product.specs.map(spec => `<tr><td>${spec.key}</td><td>${spec.value}</td></tr>`).join('')}
        `;

        // Update reviews
        const ratingCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        product.reviews.forEach(review => ratingCounts[review.rating]++);
        document.getElementById('ratingSummary').innerHTML = `
            <li>⭐⭐⭐⭐⭐ (${ratingCounts[5]})</li>
            <li>⭐⭐⭐⭐ (${ratingCounts[4]})</li>
            <li>⭐⭐⭐ (${ratingCounts[3]})</li>
            <li>⭐⭐ (${ratingCounts[2]})</li>
            <li>⭐ (${ratingCounts[1]})</li>
        `;
        document.getElementById('reviewList').innerHTML = product.reviews.map(review => `
            <div class="review-item">⭐${'⭐'.repeat(review.rating - 1)} - ${review.comment} (${review.author})</div>
        `).join('');

        // Update bundle products
        document.getElementById('bundleProductList').innerHTML = product.bundle.map(item => `
            <div class="product-card">
                <div class="card-content">
                    <img src="${item.image}" alt="${item.name}">
                    <h4>${item.name}</h4>
                </div>
                <p class="price">${item.price}</p>
                <button class="select-product">Chọn sản phẩm</button>
            </div>
        `).join('');

        // Update related products
        document.getElementById('relatedProducts').innerHTML = product.related.map(related => `
            <div class="product-card clickable" data-id="${related.id}">
                <img src="${related.image}" alt="${related.name}">
                <h4>${related.name}</h4>
                <p class="price">${related.price}</p>
            </div>
        `).join('');

        // Save and render recently viewed
        saveRecentlyViewed({
            id: product.id,
            name: product.name,
            image: product.image,
            price: product.price
        });
        renderRecentlyViewed();
    } else {
        document.querySelector('.container').innerHTML = '<p>Sản phẩm không tồn tại.</p>';
    }

    // Bundle products logic
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
            this.textContent = card.classList.contains('selected') ? 'Bỏ chọn' : 'Chọn sản phẩm';
            updateSubtotal();
        });
    });

    // Buy now and add to cart
    document.querySelectorAll('.buy-now').forEach(btn => {
        btn.addEventListener('click', function() {
            const productId = this.getAttribute('data-id');
            const product = products.find(p => p.id === productId);
            if (product) {
                addToCart(product.id, product.name, parsePrice(product.price), product.image);
                updateCartCount();
                showToast(`Đã thêm ${product.name} vào giỏ hàng!`, true);
            }
        });
    });

    const addToCartBundleBtn = document.querySelector('.add-to-cart-bundle');
    if (addToCartBundleBtn) {
        addToCartBundleBtn.addEventListener('click', function() {
            const selectedProducts = document.querySelectorAll('.bundle-products .product-card.selected');
            if (selectedProducts.length === 0) {
                showToast('Vui lòng chọn ít nhất một sản phẩm để thêm vào giỏ!');
                return;
            }
            selectedProducts.forEach(product => {
                const productName = product.querySelector('h4').textContent;
                const priceText = product.querySelector('.price').textContent;
                const priceValue = parsePrice(priceText);
                const productImage = product.querySelector('img').src;
                const productId = `combo-${productName.toLowerCase().replace(/\s+/g, '-')}`;
                addToCart(productId, productName, priceValue, productImage);
            });
            showToast(`Đã thêm ${selectedProducts.length} sản phẩm vào giỏ hàng!`);
            updateCartCount();
        });
    }
});

function addToCart(productId, productName, priceValue, productImage) {
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    const existingProduct = cart.find(item => item.id === productId);
    if (!existingProduct) {
        cart.push({ id: productId, name: productName, price: priceValue, image: productImage, quantity: 1 });
        localStorage.setItem('cart', JSON.stringify(cart));
    }
}

function updateCartCount() {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const cartCountElement = document.querySelector('.cart-count');
    if (cartCountElement) {
        cartCountElement.textContent = cart.length;
        cartCountElement.style.display = cart.length > 0 ? 'inline-flex' : 'none';
    }
}