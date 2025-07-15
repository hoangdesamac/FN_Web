// ==========================
// MODULE: Load header/footer
// ==========================
async function loadPagePart(url, containerId, callback = null) {
    try {
        const response = await fetch(url);
        const html = await response.text();
        $(`#${containerId}`).html(html);

        const $tempDiv = $('<div>').html(html);
        $tempDiv.find('script').each(function () {
            const src = $(this).attr('src');
            if (src && $(`script[src="${src}"]`).length) return;
            const $newScript = $('<script>');
            if (src) $newScript.attr('src', src);
            else $newScript.text($(this).text());
            $('body').append($newScript);
        });

        if (typeof callback === 'function') callback();
    } catch (error) {
        console.error(`Lỗi khi tải ${url}:`, error);
    }
}

// ==========================
// MODULE: LightGallery khởi tạo an toàn
// ==========================
function initLightGallerySafe() {
    console.log('💡 Native:', typeof lightGallery);
    if (typeof lightGallery === 'function') {
        lightGallery(document.getElementById('lightgallery'), {
            selector: 'a',
            plugins: [lgThumbnail, lgZoom],
            speed: 300,
            download: false,
            licenseKey: '0000-0000-000-0000'
        });
        console.log('✅ LightGallery (native) chạy!');
    } else {
        console.warn('⏳ LightGallery chưa sẵn sàng...');
        setTimeout(initLightGallerySafe, 100);
    }
}

// ==========================
// MODULE: Render thumbnails & click
// ==========================
function setupThumbnails(thumbnails) {
    const $thumbnailsList = $('#thumbnailsList');
    const $galleryElement = $('#lightgallery');

    $thumbnailsList.html(
        thumbnails.map((thumb, index) => `
            <img src="${thumb}" 
                 data-index="${index}" 
                 alt="Thumbnail ${index + 1}" 
                 class="${index === 0 ? 'active' : ''}">
        `).join('')
    );

    $thumbnailsList.off('click').on('click', 'img', function () {
        const $this = $(this);
        const index = $this.data('index');

        $thumbnailsList.find('img').removeClass('active');
        $this.addClass('active');

        const lg = $galleryElement[0].lg;
        if (lg) {
            lg.openGallery(index);
        } else {
            console.warn('⚠️ lightGallery chưa khởi tạo!');
        }
    });
}

// ==========================
// MODULE: Cart & Toast
// ==========================
function addToCart(productId, productName, priceValue, productImage) {
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    if (!cart.find(item => item.id === productId)) {
        cart.push({ id: productId, name: productName, price: priceValue, image: productImage, quantity: 1 });
        localStorage.setItem('cart', JSON.stringify(cart));
    }
}

function updateCartCount() {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    $('.cart-count').text(cart.length).css('display', cart.length > 0 ? 'inline-flex' : 'none');
}

function showToast(message, isBuyNow = false) {
    let $toast = $('#toastNotification');
    if (!$toast.length) {
        $toast = $('<div id="toastNotification" class="toast-notification"></div>').appendTo('body');
    }
    $toast.html(`
        <div class="toast-content">
            <i class="fas fa-check-circle"></i>
            <span class="toast-message">${message}</span>
            <button class="toast-close"><i class="fas fa-times"></i></button>
        </div>
    `).addClass('show');

    setTimeout(() => {
        if ($toast.hasClass('show')) {
            $toast.removeClass('show').addClass('hide');
            setTimeout(() => $toast.remove(), 300);
            if (isBuyNow) window.location.href = 'resetcheckout.html';
        }
    }, 3000);
}

// ==========================
// MODULE: Scroll helpers
// ==========================
function scrollThumbnails(direction) {
    $('#thumbnailsList').animate({ scrollLeft: `+=${direction * 100}` }, 300);
}

function scrollBundleProducts(direction) {
    const scrollAmount = window.innerWidth <= 768 ? 150 : 180;
    $('#bundleProductList').animate({ scrollLeft: `+=${direction * scrollAmount}` }, 300);
}

function scrollRecent(direction) {
    const scrollAmount = 210; // Tương ứng với chiều rộng thẻ + margin
    $('#recentlyViewedList').animate({ scrollLeft: `+=${direction * scrollAmount}` }, 300);
}


// ==========================
// MODULE: Helpers
// ==========================
function saveRecentlyViewed(product) {
    let viewed = JSON.parse(localStorage.getItem('recentProducts')) || [];
    viewed = viewed.filter(p => p.id !== product.id);
    viewed.unshift(product);
    if (viewed.length > 10) viewed = viewed.slice(0, 10); // Cho phép lưu nhiều sản phẩm hơn
    localStorage.setItem('recentProducts', JSON.stringify(viewed));
}

function renderRecentlyViewed() {
    const viewed = JSON.parse(localStorage.getItem('recentProducts')) || [];

    if (viewed.length === 0) {
        // Ẩn section nếu không có sản phẩm đã xem
        $('.recently-viewed').hide();
        return;
    }

    // Hiển thị section
    $('.recently-viewed').show();

    // Render sản phẩm với giao diện mới
    $('#recentlyViewedList').html(viewed.map(p => `
        <div class="recently-viewed-product" data-id="${p.id}">
            <img src="${p.image}" alt="${p.name}" class="product-img">
            <h4 class="product-title">${p.name}</h4>
            <div class="price-info">
                ${p.originalPrice ? `<span class="product-original-price">${p.originalPrice}</span>` : ''}
                <span class="product-price">${p.salePrice || p.price}</span>
            </div>
            <button class="quick-view-btn" data-id="${p.id}">
                <i class="fas fa-eye"></i> Xem nhanh
            </button>
        </div>
    `).join(''));

    // Thêm sự kiện click cho các sản phẩm đã xem
    $('.recently-viewed-product').off('click').on('click', function(e) {
        if (!$(e.target).closest('.quick-view-btn').length) {
            const productId = $(this).data('id');
            window.location.href = `resetproduct.html?id=${productId}`;
        }
    });

    // Thêm sự kiện click cho nút xem nhanh
    $('.quick-view-btn').off('click').on('click', function(e) {
        e.stopPropagation();
        const productId = $(this).data('id');
        // Có thể hiển thị modal xem nhanh tại đây
        showQuickViewModal(productId);
    });
}
function showQuickViewModal(productId) {
    const product = window.products.find(p => p.id === productId);
    if (!product) return;

    // Hiển thị modal với thông tin sản phẩm
    // Đây là nơi bạn có thể thêm mã để hiển thị modal xem nhanh
    console.log(`Xem nhanh sản phẩm: ${product.name}`);

    // Tạm thời chuyển đến trang sản phẩm
    window.location.href = `resetproduct.html?id=${productId}`;
}


function parsePrice(priceText) {
    return parseInt(priceText.replace(/[^0-9]/g, ''));
}

function formatPrice(price) {
    return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '₫';
}

// ==========================
// BIND ALL EVENTS 1 LẦN
// ==========================
function bindRecentlyViewedEvents() {
    // Sự kiện nút điều hướng
    $('.recently-viewed .nav-prev').off('click').on('click', function() {
        scrollRecent(-1);
    });

    $('.recently-viewed .nav-next').off('click').on('click', function() {
        scrollRecent(1);
    });
}

function bindEventHandlers() {
    $(document).on('click', '.toast-close', function () {
        $('#toastNotification').removeClass('show').addClass('hide');
        setTimeout(() => $('#toastNotification').remove(), 300);
    });

    $(document).on('click', '.nav-prev', function () {
        if ($(this).closest('.thumbnails-wrapper').length) scrollThumbnails(-1);
        else if ($(this).closest('.bundle-products').length) scrollBundleProducts(-1);
        else scrollRecent(-1);
    });

    $(document).on('click', '.nav-next', function () {
        if ($(this).closest('.thumbnails-wrapper').length) scrollThumbnails(1);
        else if ($(this).closest('.bundle-products').length) scrollBundleProducts(1);
        else scrollRecent(1);
    });
    function scrollRecent(direction) {
        const scrollAmount = 210; // Tương ứng với chiều rộng thẻ + margin
        $('#recentlyViewedList').animate({ scrollLeft: `+=${direction * scrollAmount}` }, 300);
    }


    $(document).on('click', '.product-card.clickable', function () {
        const productId = $(this).data('id');
        window.location.href = `resetproduct.html?id=${productId}`;
    });

    $(document).on('click', '.buy-now', function () {
        const productId = $(this).data('id');
        const product = window.products.find(p => p.id === productId);
        if (product) {
            addToCart(product.id, product.name, parsePrice(product.salePrice || product.price), product.image);
            updateCartCount();
            showToast(`Đã thêm ${product.name} vào giỏ hàng!`, true);
        }
    });

    $(document).on('click', '.toast-close', function() {
        $('#toastNotification').removeClass('show').addClass('hide');
        setTimeout(() => $('#toastNotification').remove(), 300);
    });

    $(document).on('click', '.select-product', function () {
        const $card = $(this).closest('.product-card');
        $card.toggleClass('selected');
        $(this).text($card.hasClass('selected') ? 'Bỏ chọn' : 'Chọn sản phẩm');
        updateSubtotal();
    });

    $(document).on('click', '.add-to-cart-bundle', function () {
        const $selectedProducts = $('.bundle-products .product-card.selected');
        if (!$selectedProducts.length) {
            showToast('Vui lòng chọn ít nhất một sản phẩm!');
            return;
        }
        $selectedProducts.each(function () {
            const name = $(this).find('h4').text();
            const price = parsePrice($(this).find('.price').text());
            const img = $(this).find('img').attr('src');
            const id = `combo-${name.toLowerCase().replace(/\s+/g, '-')}`;
            addToCart(id, name, price, img);
        });
        updateCartCount();
        showToast(`Đã thêm ${$selectedProducts.length} sản phẩm combo vào giỏ!`);
    });
}

// ==========================
// MODULE: Subtotal
// ==========================
function updateSubtotal() {
    let subtotal = 0;
    $('.product-card.selected').each(function () {
        subtotal += parsePrice($(this).find('.price').text());
    });
    $('#bundleSubtotal').text(formatPrice(subtotal));
}
// 3) Dữ liệu sản phẩm
// =========================
window.products = [
    // Flash Sale
    {
        id: "monitor-viewsonic-va2432a-h",
        category: "Flash Sale",
        name: "Màn hình Viewsonic VA2432A-H 24\" IPS 120Hz viền mỏng",
        originalPrice: "3.590.000₫",
        salePrice: "2.050.000₫",
        discount: "-43%",
        image: "https://product.hstatic.net/200000722513/product/view_va2432a-h_gearvn_9f5ded4d703e45fa9de460c8ce23bcc7_master.jpg",
        sold: 80,
        rating: 0.0,
        reviews: 0,
        thumbnails: [
            "https://product.hstatic.net/200000722513/product/view_va2432a-h_gearvn_9f5ded4d703e45fa9de460c8ce23bcc7_master.jpg"
        ],
        description: `
                <p><strong>Giới thiệu:</strong> Màn hình Viewsonic VA2432A-H 24" IPS 120Hz viền mỏng, phù hợp cho chơi game và công việc văn phòng.</p>
                <ul>
                    <li>✅ Tần số quét 120Hz.</li>
                    <li>🎮 Công nghệ IPS cho màu sắc chân thực.</li>
                    <li>🛠️ Viền mỏng, thiết kế hiện đại.</li>
                </ul>
                <img src="https://product.hstatic.net/200000722513/product/view_va2432a-h_gearvn_9f5ded4d703e45fa9de460c8ce23bcc7_master.jpg" alt="Ảnh minh họa" style="max-width: 100%; margin-top: 20px; border-radius: 10px;">
            `,
        specs: [
            { key: "Kích thước", value: "24 inch" },
            { key: "Tần số quét", value: "120Hz" },
            { key: "Bảo hành", value: "36 tháng" }
        ],
        reviews: [],
        bundle: [],
        related: []
    },
    {
        id: "monitor-lg-24gs65f-b",
        category: "Flash Sale",
        name: "Màn hình LG 24GS65F-B 24\" IPS 180Hz HDR10 Gsync chuyên game",
        originalPrice: "4.390.000₫",
        salePrice: "3.150.000₫",
        discount: "-28%",
        image: "https://product.hstatic.net/200000722513/product/lg_24gs65f-b_gearvn_af476af1e4514a2684591304b3e4164a_master.jpg",
        sold: 12,
        rating: 0.0,
        reviews: 0,
        thumbnails: [
            "https://product.hstatic.net/200000722513/product/lg_24gs65f-b_gearvn_af476af1e4514a2684591304b3e4164a_master.jpg"
        ],
        description: `
                <p><strong>Giới thiệu:</strong> Màn hình LG 24GS65F-B 24" IPS 180Hz HDR10 Gsync, chuyên dụng cho game thủ.</p>
                <ul>
                    <li>✅ Tần số quét 180Hz.</li>
                    <li>🎮 Hỗ trợ HDR10 và Gsync.</li>
                    <li>🛠️ Thiết kế viền mỏng.</li>
                </ul>
                <img src="https://product.hstatic.net/200000722513/product/lg_24gs65f-b_gearvn_af476af1e4514a2684591304b3e4164a_master.jpg" alt="Ảnh minh họa" style="max-width: 100%; margin-top: 20px; border-radius: 10px;">
            `,
        specs: [
            { key: "Kích thước", value: "24 inch" },
            { key: "Tần số quét", value: "180Hz" },
            { key: "Bảo hành", value: "36 tháng" }
        ],
        reviews: [],
        bundle: [],
        related: []
    },
    // PC Bán Chạy Nhất
    {
        id: "pc-gvn-i5-14400f-rtx5060",
        category: "PC Bán Chạy Nhất",
        name: "PC GVN Intel i5-14400F/ VGA RTX 5060 (DDR5)",
        originalPrice: "27.720.000₫",
        salePrice: "24.590.000₫",
        discount: "-11%",
        image: "https://product.hstatic.net/200000722513/product/pc_case_xigmatek_-_26_2cb0da60a679425680247ca67c42721e_master.png",
        soldInfo: "i5-13400F / RTX 5060 / 32GB / 500GB",
        rating: 0.0,
        reviews: 0,
        thumbnails: [
            "https://product.hstatic.net/200000722513/product/pc_case_xigmatek_-_26_2cb0da60a679425680247ca67c42721e_master.png"
        ],
        description: `
                <p><strong>Giới thiệu:</strong> PC GVN Intel i5-14400F với RTX 5060, cấu hình mạnh mẽ cho game thủ.</p>
                <ul>
                    <li>✅ CPU Intel i5-14400F, 10 nhân 12 luồng.</li>
                    <li>🎮 VGA RTX 5060 hỗ trợ ray tracing.</li>
                    <li>🛠️ RAM 32GB DDR5, SSD 500GB.</li>
                </ul>
                <img src="https://product.hstatic.net/200000722513/product/pc_case_xigmatek_-_26_2cb0da60a679425680247ca67c42721e_master.png" alt="Ảnh minh họa" style="max-width: 100%; margin-top: 20px; border-radius: 10px;">
            `,
        specs: [
            { key: "CPU", value: "Intel i5-14400F" },
            { key: "VGA", value: "RTX 5060" },
            { key: "RAM", value: "32GB DDR5" },
            { key: "SSD", value: "500GB" },
            { key: "Bảo hành", value: "36 tháng" }
        ],
        reviews: [],
        bundle: [],
        related: []
    },
    {
        id: "pc-gvn-i5-12400f-rtx4060",
        category: "PC Bán Chạy Nhất",
        name: "PC GVN Intel i5-12400F/ VGA RTX 4060",
        originalPrice: "20.820.000₫",
        salePrice: "18.190.000₫",
        discount: "-13%",
        image: "https://product.hstatic.net/200000722513/product/pc_case_xigmatek_-_26_bc4f94f5e6484520abc738e769053df4_master.png",
        soldInfo: "i5-13400F / RTX 4060 / 16GB / 500GB",
        rating: 0.0,
        reviews: 0,
        thumbnails: [
            "https://product.hstatic.net/200000722513/product/pc_case_xigmatek_-_26_bc4f94f5e6484520abc738e769053df4_master.png"
        ],
        description: `
                <p><strong>Giới thiệu:</strong> PC GVN Intel i5-12400F với RTX 4060, hiệu năng cân bằng cho game và làm việc.</p>
                <ul>
                    <li>✅ CPU Intel i5-12400F, 6 nhân 12 luồng.</li>
                    <li>🎮 VGA RTX 4060 hỗ trợ DLSS 3.</li>
                    <li>🛠️ RAM 16GB, SSD 500GB.</li>
                </ul>
                <img src="https://product.hstatic.net/200000722513/product/pc_case_xigmatek_-_26_bc4f94f5e6484520abc738e769053df4_master.png" alt="Ảnh minh họa" style="max-width: 100%; margin-top: 20px; border-radius: 10px;">
            `,
        specs: [
            { key: "CPU", value: "Intel i5-12400F" },
            { key: "VGA", value: "RTX 4060" },
            { key: "RAM", value: "16GB" },
            { key: "SSD", value: "500GB" },
            { key: "Bảo hành", value: "36 tháng" }
        ],
        reviews: [],
        bundle: [],
        related: []
    },
    // Chuột Bán Chạy (Updated)
    {
        id: "mouse-asus-tuf-m4-wireless",
        category: "Chuột",
        name: "Chuột Gaming Asus TUF M4 Wireless",
        originalPrice: "1.190.000₫",
        salePrice: "710.000₫",
        discount: "-40%",
        image: "https://product.hstatic.net/200000722513/product/tuf-gaming-m4-wireless-02_56fe3b15890748738508eb07f20c43c5_large_thumb_d7bfc6df9d2d4aeb9fc22906a8fee7ae_master.jpg",
        soldInfo: "Pin rời / Không dây / DPI - 12.000",
        rating: 0.0,
        reviews: 0,
        thumbnails: [
            "https://product.hstatic.net/200000722513/product/tuf-gaming-m4-wireless-02_56fe3b15890748738508eb07f20c43c5_large_thumb_d7bfc6df9d2d4aeb9fc22906a8fee7ae_master.jpg"
        ],
        description: `
                <p><strong>Giới thiệu:</strong> Chuột Gaming Asus TUF M4 Wireless, thiết kế không dây, hiệu năng cao cho game thủ.</p>
                <ul>
                    <li>✅ DPI tối đa 12.000.</li>
                    <li>🎮 Hỗ trợ pin rời.</li>
                    <li>🛠️ Thiết kế ergonomic.</li>
                </ul>
                <img src="https://product.hstatic.net/200000722513/product/tuf-gaming-m4-wireless-02_56fe3b15890748738508eb07f20c43c5_large_thumb_d7bfc6df9d2d4aeb9fc22906a8fee7ae_master.jpg" alt="Ảnh minh họa" style="max-width: 100%; margin-top: 20px; border-radius: 10px;">
            `,
        specs: [
            { key: "Kết nối", value: "Không dây" },
            { key: "DPI", value: "12.000" },
            { key: "Bảo hành", value: "24 tháng" }
        ],
        reviews: [],
        bundle: [],
        related: []
    },
    {
        id: "mouse-logitech-g102-lightsync",
        category: "Chuột",
        name: "Chuột Logitech G102 LightSync Black",
        originalPrice: "599.000₫",
        salePrice: "405.000₫",
        discount: "-32%",
        image: "https://product.hstatic.net/200000722513/product/logitech-g102-lightsync-rgb-black-1_bf4f5774229c4a0f81b8e8a2feebe4d8_aeb4ae49ee844c3e9d315883d4e482d4_master.jpg",
        soldInfo: "Có dây / Led RGB",
        rating: 0.0,
        reviews: 0,
        thumbnails: [
            "https://product.hstatic.net/200000722513/product/logitech-g102-lightsync-rgb-black-1_bf4f5774229c4a0f81b8e8a2feebe4d8_aeb4ae49ee844c3e9d315883d4e482d4_master.jpg"
        ],
        description: `
                <p><strong>Giới thiệu:</strong> Chuột Logitech G102 LightSync Black, thiết kế có dây với LED RGB.</p>
                <ul>
                    <li>✅ LED RGB tùy chỉnh.</li>
                    <li>🎮 DPI tối đa 8.000.</li>
                    <li>🛠️ Thiết kế nhẹ nhàng.</li>
                </ul>
                <img src="https://product.hstatic.net/200000722513/product/logitech-g102-lightsync-rgb-black-1_bf4f5774229c4a0f81b8e8a2feebe4d8_aeb4ae49ee844c3e9d315883d4e482d4_master.jpg" alt="Ảnh minh họa" style="max-width: 100%; margin-top: 20px; border-radius: 10px;">
            `,
        specs: [
            { key: "Kết nối", value: "Có dây" },
            { key: "DPI", value: "8.000" },
            { key: "Bảo hành", value: "24 tháng" }
        ],
        reviews: [],
        bundle: [],
        related: []
    }
    // Thêm các sản phẩm khác từ resetmaincontent.html nếu cần
];
// ==========================
// MAIN INIT: chạy toàn trang
// ==========================
$(document).ready(function () {
    bindEventHandlers();

    loadPagePart("HTML/Layout/resetheader.html", "header-container", () => {
        if (typeof initHeader === 'function') initHeader();
        updateCartCount();
    });
    loadPagePart("HTML/Layout/resetfooter.html", "footer-container");

    window.showTab = function (tabId, event) {
        $('.tab-content').removeClass('active');
        $('.tab-btn').removeClass('active');
        $(`#${tabId}`).addClass('active');
        $(event.currentTarget).addClass('active');
    };

    // Giả sử `window.products` đã tồn tại hoặc khai báo ở file khác
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');
    const product = window.products.find(p => p.id === productId);

    if (product) {
        $('#productCategory').text(product.category);
        $('#productName, #productTitle').text(product.name);
        $('#productPrice').html(`
            <span class="original-price">${product.originalPrice || ''}</span><br>
            <span class="sale-price">${product.salePrice || product.price}</span>
        `);
        $('#productDescription').html(product.description);
        $('.buy-now').attr('data-id', product.id);
        $('#mainImage').attr('src', product.image);
        $('#lightgallery a').attr('href', product.image);
        setupThumbnails(product.thumbnails || [product.image]);
        initLightGallerySafe();

        $('#productSpecs').html(`
            <tr><th>Thành phần</th><th>Chi tiết</th></tr>
            ${product.specs.map(spec => `<tr><td>${spec.key}</td><td>${spec.value}</td></tr>`).join('')}
        `);

        saveRecentlyViewed({
            id: product.id,
            name: product.name,
            image: product.image,
            price: product.salePrice || product.price,
            originalPrice: product.originalPrice // Lưu thêm giá gốc
        });
        renderRecentlyViewed();
        bindRecentlyViewedEvents(); // Thêm binding sự kiện

    } else {
        $('.container').html('<p class="text-center">Sản phẩm không tồn tại.</p>');
    }
});
