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
// MODULE: Render thumbnails & click
// ==========================
let currentIndex = 0;                // Chỉ số ảnh đang hiển thị
let zoomGalleryInstance = null;     // LightGallery instance (toàn cục)

function setupThumbnails(thumbnails) {
    const $thumbnailsList = $('#thumbnailsList');
    const $mainImage = $('#mainImage');
    const $zoomList = $('#zoomImageList');

    console.log('👉 setupThumbnails bắt đầu...');
    console.log('📸 Danh sách thumbnails:', thumbnails);

    // 1. Render danh sách thumbnail bên dưới ảnh chính
    $thumbnailsList.html(
        thumbnails.map((thumb, index) => `
            <img src="${thumb}" 
                 data-index="${index}" 
                 alt="Thumbnail ${index + 1}" 
                 class="${index === 0 ? 'active' : ''}">
        `).join('')
    );

    // 2. Gán ảnh đầu tiên làm ảnh chính
    $mainImage.attr('src', thumbnails[0]);
    currentIndex = 0;
    console.log('🖼️ Ảnh chính được đặt:', thumbnails[0]);

    // 3. Render danh sách ảnh zoom với external thumbnail
    $zoomList.html(
        thumbnails.map((thumb, index) => `
        <a 
            href="${thumb}" 
            data-lg-size="1406-1390"
            data-index="${index}"
            data-thumb="${thumb}" 
            data-external-thumb-image="${thumb}">
        </a>
    `).join('')
    );

    console.log('🧩 Zoom gallery HTML đã render');

    // 4. Khởi tạo lại LightGallery
    if (typeof lightGallery === 'function') {
        // Nếu đã tồn tại thì huỷ trước
        if (zoomGalleryInstance) {
            zoomGalleryInstance.destroy(true);
            console.log('♻️ Zoom gallery cũ đã destroy');
        }

        // Tạm thời hiện zoom list để LightGallery lấy thumbnail
        $zoomList.css({
            visibility: 'visible',
            height: 'auto',
            position: 'relative',
            zIndex: 1,
            pointerEvents: 'auto'
        });

        // Khởi tạo mới LightGallery
        zoomGalleryInstance = lightGallery(document.getElementById('zoomImageList'), {
            selector: 'a',
            plugins: [lgThumbnail, lgZoom],
            thumbnail: true,
            showThumbByDefault: true,
            animateThumb: true,
            thumbWidth: 80,
            thumbHeight: 80,
            exThumbImage: 'data-external-thumb-image',
            speed: 300,
            download: false,
            licenseKey: '0000-0000-000-0000'
        });



        console.log('✅ LightGallery đã khởi tạo với thumbnail và zoom');

        // Sau 200ms → ẩn đi
        setTimeout(() => {
            $zoomList.css({
                visibility: 'hidden',
                height: 0,
                position: 'absolute',
                zIndex: -1,
                pointerEvents: 'none'
            });
            console.log('🙈 Đã ẩn lại zoom gallery');
        }, 200);
    } else {
        console.warn('⚠️ lightGallery chưa sẵn sàng hoặc không tồn tại!');
    }

    // 5. Gán sự kiện khi click thumbnail
    $thumbnailsList.off('click').on('click', 'img', function () {
        const $this = $(this);
        const index = +$this.data('index');
        const newSrc = $this.attr('src');

        if (index === currentIndex) return;

        const direction = index > currentIndex ? 'slide-left' : 'slide-right';
        $mainImage.removeClass('slide-left slide-right');
        $mainImage.attr('src', newSrc);
        void $mainImage[0].offsetWidth; // Kích hoạt lại animation
        $mainImage.addClass(direction);

        currentIndex = index;
        $thumbnailsList.find('img').removeClass('active');
        $this.addClass('active');

        console.log(`🔁 Thumbnail click → đổi ảnh chính sang index ${index}`);
    });

    // 6. Click ảnh chính để mở đúng ảnh trong zoom gallery
    $mainImage.off('click').on('click', function () {
        if (zoomGalleryInstance) {
            zoomGalleryInstance.openGallery(currentIndex);
            console.log(`🔍 Click ảnh chính → mở LightGallery ảnh index ${currentIndex}`);
        }
    });

    console.log('✅ setupThumbnails hoàn tất');
}

// ==========================
// MODULE: Cart & Toast
// ==========================
function addToSelectedCart(product) {
    let selectedCart = JSON.parse(localStorage.getItem('selectedCart')) || [];
    const existing = selectedCart.find(item => item.id === product.id);

    if (existing) {
        existing.quantity += 1;
    } else {
        selectedCart.push(product);
    }

    localStorage.setItem('selectedCart', JSON.stringify(selectedCart));
}

function updateCartCount() {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const giftCart = JSON.parse(localStorage.getItem('giftCart')) || [];

    const totalCount =
        cart.reduce((sum, item) => sum + (item.quantity || 0), 0) +
        giftCart.reduce((sum, item) => sum + (item.quantity || 0), 0);

    $('.cart-count')
        .text(totalCount)
        .css('display', totalCount > 0 ? 'inline-flex' : 'none');
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
    const scrollAmount = 220; // Tương ứng với chiều rộng thẻ + margin
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
function renderBundleProducts(bundle) {
    const $list = $('#bundleProductList');

    if (!bundle || !bundle.length) {
        $('.bundle-products').hide();
        return;
    }

    $list.html(bundle.map((p, index) => {
        const original = parsePrice(p.originalPrice);
        const sale = parsePrice(p.salePrice);
        const discount = Math.round((1 - sale / original) * 100);

        return `
            <div class="product-card bundle-card position-relative" data-id="${p.id}">
                <input type="checkbox" class="bundle-checkbox" data-price="${sale}" style="position:absolute; top:10px; left:10px;" />
                <div class="flash-badge">🎁</div>
                <div class="discount-badge">-${discount}%</div>
                <div class="product-image">
                    <img src="${p.image}" alt="${p.name}">
                </div>
                <h3 class="product-name">${p.name}</h3>
                <div class="price-section">
                    <span class="original-price">${formatPrice(original)}</span><br>
                    <span class="sale-price">${formatPrice(sale)}</span>
                </div>
                <div class="rating">⭐ 0.0 <span class="votes">(0 đánh giá)</span></div>
                <button class="choose-other-btn btn btn-sm btn-outline-primary mt-2">Chọn sản phẩm khác!</button>
            </div>
        `;
    }).join(''));

    // ✅ Phục hồi trạng thái tick từ localStorage nếu có
    const savedComboIds = JSON.parse(localStorage.getItem('selectedComboIds')) || [];
    $list.find('.product-card').each(function () {
        const $card = $(this);
        const id = $card.data('id');
        if (savedComboIds.includes(id)) {
            $card.find('.bundle-checkbox').prop('checked', true);
        }
    });

    // ✅ Cập nhật tổng tạm tính và sub-text
    updateBundleSubtotal();
    updateBuyNowSubText(); // nếu bạn đã khai báo hàm này
}


// ================================
// MODULE: Render Related Products
// ================================
function renderRelatedProducts(related) {
    const $container = $('#relatedProducts');

    if (!related || !related.length) {
        $container.html('<p class="text-center">Không có sản phẩm liên quan.</p>');
        return;
    }

    const cards = related.map(p => {
        const original = parsePrice(p.originalPrice);
        const sale = parsePrice(p.salePrice);
        const discount = original > sale ? Math.round((1 - sale / original) * 100) : 0;

        return `
            <div class="col-product">
                <div class="product-card clickable" data-id="${p.id}">
                   ${(p.tags?.includes("flash") || p.category === 'Flash Sale') ? '<div class="flash-badge">🔥 Flash Sale</div>' : ''}
                    <div class="discount-badge">-${discount}%</div>
                    <div class="product-image">
                        <img src="${p.image}" alt="${p.name}">
                    </div>
                    <h3 class="product-name">${p.name}</h3>
                    <div class="price-section">
                        <span class="original-price">${formatPrice(original)}</span><br>
                        <span class="sale-price">${formatPrice(sale)}</span>
                    </div>
                    <div class="action-buttons d-flex gap-2 justify-content-center mt-2">
                        <button class="btn btn-sm btn-outline-primary view-detail" data-id="${p.id}">Xem chi tiết</button>
                        <button class="btn btn-sm btn-success add-to-cart" data-id="${p.id}"><i class="fas fa-cart-plus"></i></button>
                    </div>
                </div>
            </div>
        `;
    });

    $container.html(cards.join(''));

    // Sự kiện xem chi tiết
    $container.find('.view-detail').on('click', function(e) {
        const id = $(this).data('id');
        window.location.href = `resetproduct.html?id=${id}`;
    });

    // Sự kiện thêm vào giỏ
    $container.find('.add-to-cart').on('click', function(e) {
        e.stopPropagation(); // ✅ Ngăn nổi bọt → không bị click .product-card

        const id = $(this).data('id');

        // ✅ Tìm sản phẩm liên quan đúng theo ID
        let relatedProduct = null;
        for (const mainProduct of window.products) {
            if (mainProduct.related) {
                relatedProduct = mainProduct.related.find(r => r.id === id);
                if (relatedProduct) break;
            }
        }

        if (!relatedProduct) return;

        const cleanProduct = prepareProduct(relatedProduct);

        addToSelectedCart(cleanProduct);

        let cart = JSON.parse(localStorage.getItem('cart')) || [];
        const existing = cart.find(item => item.id === cleanProduct.id);

        if (existing) {
            existing.quantity += 1;
        } else {
            cart.push(cleanProduct);
        }
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartCount();
        showToast(`Đã thêm ${cleanProduct.name} vào giỏ hàng!`);
    });

}

function renderRecentlyViewed() {
    const viewed = JSON.parse(localStorage.getItem('recentProducts')) || [];

    if (viewed.length === 0) {
        $('.recently-viewed').hide();
        return;
    }

    $('.recently-viewed').show();

    $('#recentlyViewedList').html(viewed.map(p => {
        let discountPercent = '';
        if (p.originalPrice && p.salePrice) {
            discountPercent = Math.round(((p.originalPrice - p.salePrice) / p.originalPrice) * 100);
        }

        return `
        <div class="recently-viewed-product" data-id="${p.id}">
            <img src="${p.image}" alt="${p.name}" class="product-img">
            <div class="product-info">
                <h4 class="product-title">${p.name}</h4>
                <div class="price-info">
                    ${p.originalPrice ? `<span class="product-original-price">${formatPrice(p.originalPrice)}</span>` : ''}
                    <span class="product-price">${formatPrice(p.salePrice || p.price)}</span>
                    ${discountPercent ? `<span class="discount-badge">-${discountPercent}%</span>` : ''}
                </div>
            </div>
        </div>`;
    }).join(''));

    // Click vào toàn bộ sản phẩm → chuyển trang chi tiết
    $('.recently-viewed-product').off('click').on('click', function () {
        const productId = $(this).data('id');
        window.location.href = `resetproduct.html?id=${productId}`;
    });
}

function parsePrice(priceText) {
    return parseInt(priceText?.toString().replace(/[^0-9]/g, '')) || 0;
}

function formatPrice(price) {
    return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '₫';
}

function updateBuyNowSubText() {
    const $buyNow = $('.buy-now');
    const hasCombo = $('.bundle-checkbox:checked').length > 0;
    $buyNow.toggleClass('combo-active', hasCombo);
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
    $(document).on('change', '.bundle-checkbox', function () {
        updateBundleSubtotal();
        updateBuyNowSubText(); // Giữ dòng text phụ
        // ✅ Lấy lại product hiện tại từ URL
        const urlParams = new URLSearchParams(window.location.search);
        const productId = urlParams.get('id');
        const currentProduct = window.products.find(p => p.id === productId);

        checkComboGift(currentProduct);

        // ✅ Lưu trạng thái tick combo
        const selectedIds = $('.bundle-checkbox:checked').map(function () {
            return $(this).closest('.product-card').data('id');
        }).get();

        localStorage.setItem('selectedComboIds', JSON.stringify(selectedIds));
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
        if (!product) return;

        const cleanProduct = prepareProduct(product);
        addToSelectedCart(cleanProduct);

        // --- Lấy giỏ hàng hiện tại từ localStorage ---
        let cart = JSON.parse(localStorage.getItem('cart')) || [];

        // --- Thêm sản phẩm chính vào cart ---
        let existingMain = cart.find(item => item.id === cleanProduct.id);
        if (existingMain) {
            existingMain.quantity = (existingMain.quantity || 1) + 1;
        } else {
            cart.push({ ...cleanProduct, quantity: 1 });
        }

        // --- Mảng quà tặng mới ---
        let giftCart = [];

        // --- Lấy tất cả combo ---
        const $allCombos = $('.bundle-products .bundle-checkbox');
        const $checkedCombos = $allCombos.filter(':checked');

        // --- Thêm combo đã chọn ---
        $checkedCombos.each(function () {
            const $card = $(this).closest('.product-card');
            const comboProduct = prepareProduct({
                id: $card.data('id'),
                name: $card.find('.product-name').text().trim(),
                image: $card.find('img').attr('src'),
                originalPrice: parsePrice($card.find('.original-price').text()) + '₫',
                salePrice: parsePrice($card.find('.sale-price').text()) + '₫',
            });

            addToSelectedCart(comboProduct);

            let existingCombo = cart.find(item => item.id === comboProduct.id);
            if (existingCombo) {
                existingCombo.quantity = (existingCombo.quantity || 1) + 1;
            } else {
                cart.push({ ...comboProduct, quantity: 1 });
            }
        });

        // --- Kiểm tra đủ combo để thêm quà ---
        const hasAllCombos = ($allCombos.length > 0 && $checkedCombos.length === $allCombos.length);

        if (hasAllCombos) {
            giftCart.push({
                id: "north-bayou-dual-monitor-nb-p160",
                name: "Giá treo màn hình máy tính North Bayou Dual Monitor NB-P160",
                image: "https://product.hstatic.net/200000722513/product/nb-p160_gearvn_f943c1ef5d8a4973b555cc6086b90ce1_master.jpg",
                originalPrice: 990000,
                salePrice: 0,
                discount: 100,
                quantity: 1
            });

            const requiredIds = [productId];
            $checkedCombos.each(function () {
                requiredIds.push($(this).closest('.product-card').data('id'));
            });

            localStorage.setItem('giftRequirements', JSON.stringify(requiredIds));
            localStorage.setItem('giftCart', JSON.stringify(giftCart));
        } else {
            localStorage.removeItem('giftCart');
            localStorage.removeItem('giftRequirements');
        }

        // --- Lưu giỏ hàng ---
        localStorage.setItem('cart', JSON.stringify(cart));

        // --- Cập nhật số lượng tổng (theo quantity + quà tặng) ---
        let totalCount = cart.reduce((sum, item) => sum + (item.quantity || 1), 0) + giftCart.length;
        $('.cart-count')
            .text(totalCount)
            .css('display', totalCount > 0 ? 'inline-flex' : 'none');

        // --- Thông báo ---
        let toastMsg = '';
        if ($checkedCombos.length) {
            toastMsg = `Đã thêm sản phẩm chính và ${$checkedCombos.length} combo`;
        } else {
            toastMsg = `Đã thêm ${product.name} vào giỏ hàng`;
        }
        if (giftCart.length) toastMsg += `, kèm theo quà tặng đính kèm vào giỏ hàng!`;
        else toastMsg += '!';

        // ✅ Chỉ chuyển trang nếu đủ toàn bộ combo
        showToast(toastMsg, hasAllCombos);
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
        const $checked = $('.bundle-products .bundle-checkbox:checked');
        if (!$checked.length) {
            showToast('Vui lòng chọn ít nhất một sản phẩm combo!');
            return;
        }

        $checked.each(function () {
            const $card = $(this).closest('.product-card');
            const id = $card.data('id');
            const name = $card.find('.product-name').text().trim();
            const image = $card.find('img').attr('src');
            const originalPrice = parsePrice($card.find('.original-price').text());
            const salePrice = parsePrice($card.find('.sale-price').text());

            const product = prepareProduct({
                id,
                name,
                image,
                originalPrice: originalPrice + '₫',
                salePrice: salePrice + '₫',
            });

            // ✅ Thêm vào selectedCart (để lưu riêng các sản phẩm đã chọn)
            addToSelectedCart(product);

            // ✅ Đồng thời thêm vào cart (giỏ hiển thị)
            let cart = JSON.parse(localStorage.getItem('cart')) || [];
            const existing = cart.find(item => item.id === product.id);
            if (existing) {
                existing.quantity += 1;
            } else {
                cart.push(product);
            }
            localStorage.setItem('cart', JSON.stringify(cart));
        });

        updateCartCount();
        showToast(`Đã thêm ${$checked.length} sản phẩm combo vào giỏ!`);
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

function updateBundleSubtotal() {
    let subtotal = 0;
    $('.bundle-checkbox:checked').each(function () {
        subtotal += parseInt($(this).data('price')) || 0;
    });
    $('#bundleSubtotal').text(formatPrice(subtotal));
}

function startFlashSaleCountdown() {
    function setNewEndTime() {
        const newEnd = Date.now() + 10 * 60 * 60 * 1000; // 10 giờ mới
        localStorage.setItem("flashSaleEndTime", newEnd);
        return newEnd;
    }

    let endTime = parseInt(localStorage.getItem("flashSaleEndTime"), 10);
    if (!endTime) {
        endTime = setNewEndTime();
    }

    function updateTimer() {
        const now = Date.now();
        let distance = endTime - now;

        if (distance <= 0) {
            endTime = setNewEndTime();
            distance = 10 * 60 * 60 * 1000; // reset về 10h
        }

        const hours = String(Math.floor(distance / (1000 * 60 * 60))).padStart(2, '0');
        const minutes = String(Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, '0');
        const seconds = String(Math.floor((distance % (1000 * 60)) / 1000)).padStart(2, '0');

        document.getElementById("flashSaleTimer").innerHTML =
            `<span>${hours}</span> : <span>${minutes}</span> : <span>${seconds}</span>`;
    }

    setInterval(updateTimer, 1000);
    updateTimer();
}


function renderGiftItems(giftItems) {
    const container = $('#gift-container');
    container.html(`
        <h5 class="gift-title">🎁 Quà tặng kèm</h5>
        <div class="gift-list">
            ${giftItems.map(g => `
                <div class="gift-item">
                    <img src="${g.image}" alt="${g.name}">
                    <div class="gift-info">
                        <p class="gift-name">${g.name}</p>
                        <span class="gift-qty">x${g.qty}</span>
                    </div>
                </div>
            `).join('')}
        </div>
    `);
    container.show();
}

function checkComboGift(product) {
    if (!product?.gift || !product.gift.length) {
        $('#gift-container').hide();
        localStorage.removeItem('giftCart');
        localStorage.removeItem('giftRequirements'); // Xóa luôn điều kiện quà
        return;
    }

    const comboCheckboxes = $('.bundle-checkbox');
    const allChecked = comboCheckboxes.length > 0 &&
        comboCheckboxes.filter(':checked').length === comboCheckboxes.length;

    if (allChecked) {
        renderGiftItems(product.gift);

        // ✅ Lưu giftCart đúng định dạng với giỏ hàng
        let giftCart = product.gift.map(g => ({
            id: g.id,
            name: g.name,
            image: g.image,
            originalPrice: parsePrice(g.originalPrice), // dạng số
            salePrice: 0, // dạng số
            discount: 100, // số %
            quantity: 1, // số lượng cố định 1
            isGift: true
        }));
        localStorage.setItem('giftCart', JSON.stringify(giftCart));

        // ✅ Lưu danh sách sản phẩm cần có để giữ quà
        const requiredIds = [product.id];
        comboCheckboxes.each(function () {
            requiredIds.push($(this).closest('.product-card').data('id'));
        });
        localStorage.setItem('giftRequirements', JSON.stringify(requiredIds));

    } else {
        $('#gift-container').hide();
        localStorage.removeItem('giftCart');
        localStorage.removeItem('giftRequirements');
    }
}

function validateGiftOnProductPage() {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const giftCart = JSON.parse(localStorage.getItem('giftCart')) || [];
    const requirements = JSON.parse(localStorage.getItem('giftRequirements')) || [];

    // Nếu không đủ sản phẩm trong cart để giữ quà => xóa quà
    const hasAllRequired = requirements.length > 0 && requirements.every(reqId =>
        cart.some(c => c.id === reqId)
    );

    if (!hasAllRequired) {
        localStorage.removeItem('giftCart');
        localStorage.removeItem('giftRequirements');
    }
}






function prepareProduct(product) {
    const original = parsePrice(product.originalPrice || product.price);
    const sale = parsePrice(product.salePrice || product.price);
    const discount = original && sale && original > sale
        ? Math.round((1 - sale / original) * 100)
        : 0;

    return {
        id: product.id,
        name: product.name,
        image: product.image,
        originalPrice: original,
        salePrice: sale,
        price: sale,
        discount: discount,
        quantity: 1,
        addedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}


function generateStars(rating) {
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.5 ? 1 : 0;
    const emptyStars = 5 - fullStars - halfStar;

    return '★'.repeat(fullStars) + (halfStar ? '✬' : '') + '☆'.repeat(emptyStars);
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
        image: "https://product.hstatic.net/200000722513/product/view_va2432a-h_gearvn_9f5ded4d703e45fa9de460c8ce23bcc7_master.jpg",
        sold: 80,
        rating: 0.0,
        reviews: 0,
        thumbnails: [
            "https://product.hstatic.net/200000722513/product/view_va2432a-h_gearvn_9f5ded4d703e45fa9de460c8ce23bcc7_master.jpg",
            "https://product.hstatic.net/200000722513/product/gpg-24-mon-va2432a-h-product_photo_b01_34643b4168d64ca99f7ae640f850e18f_master.png",
            "https://product.hstatic.net/200000722513/product/gpg-24-mon-va2432a-h-product_photo_c01_df569d203a7f4e949ae41e8f4c0cbab2_master.png",
            "https://product.hstatic.net/200000722513/product/gpg-24-mon-va2432a-h-product_photo_lf01_b4d9ad0c25784e30ae46f8ec68977bea_master.png",
            "https://product.hstatic.net/200000722513/product/gpg-24-mon-va2432a-h-product_photo_r01_e8012b8b6c8241b39889767bd3bea8b6_master.png",
            "https://product.hstatic.net/200000722513/product/gpg-24-mon-va2432a-h-product_photo_rb01_05d69c3a11584c8bb33e1070712ded21_master.png",
            "https://product.hstatic.net/200000722513/product/gpg-24-mon-va2432a-h-product_photo_rf01_90d2eef2b03146eeb5778e0462031306_master.png",
            "https://product.hstatic.net/200000722513/product/gpg-24-mon-va2432a-h-product_photo_s01_997ea1be58504f7ca25cc6c594a8db48_master.png",
        ],
        description: `
        <h3>Đánh giá chi tiết màn hình Viewsonic VA2432A-H 24" IPS 120Hz viền mỏng</h3>
        <p>Với tần số quét 120Hz và tấm nền IPS, màn hình <strong>Viewsonic VA2432A-H 24"</strong> là một lựa chọn tuyệt vời cho cả game thủ và dân thiết kế. Chiếc màn hình này mang đến hình ảnh sinh động, mượt mà, hỗ trợ tối đa hiệu suất làm việc và giải trí.</p>

        <h3>Hình ảnh sắc nét với tần số quét 120Hz, tốc độ phản hồi 1ms</h3>
        <img src="https://product.hstatic.net/200000722513/product/view_va2432a-h_gearvn_9f5ded4d703e45fa9de460c8ce23bcc7_master.jpg" alt="Viewsonic VA2432A-H tổng quan">
        <p>Chuyển động mượt hơn gấp đôi so với màn 60Hz. Phản hồi siêu nhanh 1ms giúp giảm hiện tượng bóng mờ, cực kỳ phù hợp với các tựa game hành động và eSports.</p>

        <h3>Ngoại hình hiện đại, tinh tế với ba cạnh không viền</h3>
        <img src="https://product.hstatic.net/200000722513/product/gpg-24-mon-va2432a-h-product_photo_s01_997ea1be58504f7ca25cc6c594a8db48_1024x1024.png" alt="Thiết kế không viền">
        <p>Thiết kế siêu mỏng với ba cạnh không viền giúp tăng tính thẩm mỹ, tạo cảm giác màn hình lớn hơn, hiện đại và chuyên nghiệp hơn cho góc làm việc.</p>

        <h3>Tấm nền IPS SuperClear® góc rộng 178 độ</h3>
        <img src="https://product.hstatic.net/200000722513/product/gpg-24-mon-va2432a-h-product_photo_lf01_b4d9ad0c25784e30ae46f8ec68977bea_1024x1024.png" alt="IPS 178 độ">
        <p>Hình ảnh sống động, màu sắc chính xác và không bị biến đổi khi nhìn từ các góc khác nhau. Độ phân giải Full HD 1920x1080, phù hợp cho cả giải trí và đồ họa.</p>

        <h3>Được tích hợp nhiều công nghệ hiện đại</h3>
        <img src="https://product.hstatic.net/200000722513/product/gpg-24-mon-va2432a-h-product_photo_b01_34643b4168d64ca99f7ae640f850e18f_1024x1024.png" alt="Cổng kết nối và công nghệ bảo vệ mắt">
        <p>Tích hợp Eye Protech+ bảo vệ mắt, giảm nhấp nháy nhờ công nghệ Flicker-Free, kết hợp bộ lọc ánh sáng xanh giúp làm việc lâu không mỏi mắt.</p>

        <h3>Chế độ Eco Mode tiết kiệm năng lượng</h3>
        <img src="https://product.hstatic.net/200000722513/product/gpg-24-mon-va2432a-h-product_photo_rf01_90d2eef2b03146eeb5778e0462031306_1024x1024.png" alt="Chế độ tiết kiệm điện năng">
        <p>Giảm tiêu thụ điện năng, bảo vệ môi trường và kéo dài tuổi thọ thiết bị. Phù hợp cho cả cá nhân, văn phòng và doanh nghiệp.</p>

        <p>Nếu bạn đang cân nhắc nâng cấp màn hình, <strong>Viewsonic VA2432A-H</strong> là lựa chọn thông minh với hiệu năng vượt trội trong tầm giá.</p>
    `,
        specs: [
            { key: "Không gian màu", value: "105% sRGB" },
            { key: "Khử nhấp nháy", value: "Có" },
            { key: "Tương thích VESA", value: "75 x 75 mm" },
            { key: "Phụ kiện trong hộp", value: "Dây nguồn; dây HDMI (tùy chọn); dây DisplayPort (tùy chọn)" },
            { key: "Độ phân giải", value: "Full HD (1920 × 1080)" },
            { key: "Tấm nền", value: "IPS" },
            { key: "Bảo hành", value: "36 tháng" },
            { key: "Kiểu màn hình", value: "Phẳng" },
            { key: "Thời gian phản hồi", value: "1ms" },
            { key: "Tần số quét", value: "120Hz" },
            { key: "Cổng kết nối", value: "1 x HDMI™, 1 x VGA" },
            { key: "Kích thước", value: "24 inch" },
            { key: "Độ sáng (Typ.)", value: "250 cd/m²" }
        ]
        ,
        reviews: [],
        bundle: [
            {
                id: "asus-tuf-m4-wireless",
                name: "Chuột Gaming Asus TUF M4 Wireless",
                image: "https://product.hstatic.net/200000722513/product/tuf-gaming-m4-wireless-02_56fe3b15890748738508eb07f20c43c5_large_thumb_d7bfc6df9d2d4aeb9fc22906a8fee7ae_master.jpg",
                originalPrice: "1.190.000₫",
                salePrice: "710.000₫",
                description: "Pin rời / Không dây / DPI - 12.000",
                rating: 0.0,
                reviews: 0
            },
            {
                id: "edra-ek375w-ek398w",
                name: "Bàn phím E-Dra EK375W EK398W (White + Black + Green)",
                image: "https://cdn.hstatic.net/products/200000722513/imgi_3_594_ek398w_black_white_green_1__fd6be6580b244eb38d0ad895cc97d764_master.jpg",
                originalPrice: "1.090.000₫",
                salePrice: "820.000₫",
                description: "Layout độc đáo, phối màu nổi bật, kết nối không dây tiện dụng",
                rating: 0.0,
                reviews: 0
            }
        ],
        related: [
            {
                id: "dahua-lm25e231",
                name: "Màn hình Dahua DHI-LM25-E231 25\" IPS 180Hz chuyên game",
                image: "https://product.hstatic.net/200000722513/product/thit-k-cha-c-tn-_4__d80b68c7123a41b89bf213ffadb4d43f_master.png",
                category: "Flash Sale",
                originalPrice: "3.990.000₫",
                salePrice: "2.390.000₫",
                description: "Màn hình gaming 25 inch, tấm nền IPS, tần số quét cao 180Hz, thích hợp chơi game mượt mà.",
                rating: 0.0,
                reviews: 0,
                sold: 1,
                tags: ["flash"]
            },
            {
                id: "viewsonic-vx2479-hd-pro",
                name: "Màn hình ViewSonic VX2479-HD-PRO 24\" IPS 180Hz chuyên game",
                image: "https://product.hstatic.net/200000722513/product/gpg-23-mon-vx2479-hd-pro-prdp_f02_558eae93bff3480b9fe9a171ba7bc4aa_master.png",
                category: "Flash Sale",
                originalPrice: "3.390.000₫",
                salePrice: "2.690.000₫",
                description: "Màn hình gaming ViewSonic 24 inch, IPS, tần số quét cao 180Hz, thiết kế hiện đại, viền mỏng.",
                rating: 0.0,
                reviews: 0,
                sold: 5,
                tags: ["flash"]
            },
            {
                id: "asus-vg249qe5a-r",
                name: "Màn hình Asus TUF GAMING VG249QE5A-R 24\" IPS 146Hz chuyên game",
                image: "https://product.hstatic.net/200000722513/product/asus_vg249qe5a-r_gearvn_ffd9fbb049944b0b99e96d9090651676_master.jpg",
                category: "Flash Sale",
                originalPrice: "3.990.000₫",
                salePrice: "2.690.000₫",
                description: "Màn hình TUF Gaming 24 inch IPS, tần số quét 146Hz, thiết kế mạnh mẽ, phù hợp chơi game tốc độ cao.",
                rating: 0.0,
                reviews: 0,
                sold: 3,
                tags: ["flash"]
            },
            {
                id: "acer-kg240y-x1",
                name: "Màn hình Acer KG240Y-X1 24\" IPS 200Hz Gsync chuyên game",
                image: "https://product.hstatic.net/200000722513/product/acer_kg240y_x1_gearvn_a8aad1a4eb7c460ea9cacf5aecc2b15f_master.jpg",
                category: "Flash Sale",
                originalPrice: "3.790.000₫",
                salePrice: "2.850.000₫",
                description: "Màn hình Acer 24 inch tấm nền IPS, tần số quét siêu cao 200Hz, hỗ trợ G-Sync, cực kỳ mượt khi chơi game.",
                rating: 0.0,
                reviews: 0,
                sold: 9,
                tags: ["flash"]
            },
            {
                id: "lg-24gs65f-b",
                name: "Màn hình LG 24GS65F-B 24\" IPS 180Hz HDR10 Gsync chuyên game",
                image: "https://product.hstatic.net/200000722513/product/lg_24gs65f-b_gearvn_af476af1e4514a2684591304b3e4164a_master.jpg",
                category: "Flash Sale",
                originalPrice: "4.390.000₫",
                salePrice: "3.150.000₫",
                description: "Màn hình LG 24 inch, IPS 180Hz, hỗ trợ HDR10, Gsync, dành cho gaming mượt mà.",
                rating: 0.0,
                reviews: 0,
                sold: 12,
                tags: ["flash"]
            },
            {
                id: "asus-vg279qe5a-r",
                name: "Màn hình Asus TUF GAMING VG279QE5A-R 27\" IPS 146Hz chuyên game",
                image: "https://product.hstatic.net/200000722513/product/asus_vg279qe5a-r_gearvn_6188c0e4ab7f4752921a84e66398de3a_master.jpg",
                category: "Flash Sale",
                originalPrice: "4.990.000₫",
                salePrice: "3.290.000₫",
                description: "Màn hình Asus TUF 27 inch, IPS 146Hz, tối ưu cho game thủ với hình ảnh mượt mà, sắc nét.",
                rating: 0.0,
                reviews: 0,
                sold: 14,
                tags: ["flash"]
            },
            {
                id: "acer-kg270-x1",
                name: "Màn hình Acer KG270-X1 27\" IPS 200Hz Gsync chuyên game",
                image: "https://product.hstatic.net/200000722513/product/acer_kg270_x1_gearvn_15f0f9177bba487197fa984aac42d623_master.jpg",
                category: "Flash Sale",
                originalPrice: "4.190.000₫",
                salePrice: "3.490.000₫",
                description: "Màn hình Acer 27 inch, IPS 200Hz, Gsync hỗ trợ gaming mượt mà, hình ảnh sắc nét.",
                rating: 0.0,
                reviews: 0,
                sold: 18,
                tags: ["flash"]
            },
            {
                id: "viewsonic-vx2479a-hd-pro",
                name: "Màn hình ViewSonic VX2479A-HD-PRO 24\" IPS 240Hz 1ms chuyên game",
                image: "https://product.hstatic.net/200000722513/product/view_vx2479a-hd-pro_gearvn_6f2507d66980467a8f1eb20e5cb6be09_master.jpg",
                category: "Flash Sale",
                originalPrice: "4.490.000₫",
                salePrice: "3.690.000₫",
                description: "Màn hình ViewSonic 24 inch IPS, 240Hz, 1ms dành cho game thủ chuyên nghiệp.",
                rating: 0.0,
                reviews: 0,
                sold: 11,
                tags: ["flash"]
            },
            {
                id: "lg-27up600k-w",
                name: "Màn hình LG 27UP600K-W 27\" IPS 4K HDR10",
                image: "https://product.hstatic.net/200000722513/product/lg_27up600k_gearvn_9090c44f723a4e68b6eab393a3ca48f1_master.jpg",
                category: "Flash Sale",
                originalPrice: "6.890.000₫",
                salePrice: "5.400.000₫",
                description: "Màn hình LG 27 inch IPS 4K HDR10, hiển thị sắc nét, phù hợp đồ họa lẫn giải trí.",
                rating: 0.0,
                reviews: 0,
                sold: 23,
                tags: ["flash"]
            }

        ],
        gift: [
            {
                id: "north-bayou-dual-monitor-nb-p160",
                name: "Giá treo màn hình máy tính North Bayou Dual Monitor NB-P160",
                image: "https://product.hstatic.net/200000722513/product/nb-p160_gearvn_f943c1ef5d8a4973b555cc6086b90ce1_master.jpg",
                originalPrice: "990.000₫",
                salePrice: "0₫", // Vì là quà tặng
                discount: 100, // Giảm 100% khi mua đủ combo
                qty: 1
            }

        ]


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
        validateGiftOnProductPage();
        updateCartCount();
    });
    loadPagePart("HTML/Layout/resetfooter.html", "footer-container");

    window.showTab = function (tabId, event = null) {
        // 1. Ẩn toàn bộ nội dung tab và bỏ trạng thái active ở các nút
        $('.tab-content').removeClass('active');
        $('.tab-btn').removeClass('active');

        // 2. Hiện nội dung tab được chọn
        $(`#${tabId}`).addClass('active');

        // 3. Nếu sự kiện đến từ click thật (VD click vào button)
        if (event) {
            $(event.currentTarget).addClass('active');
        } else {
            // 4. Nếu là gọi gián tiếp (VD: từ link "Xem đánh giá")
            // → tìm đúng nút .tab-btn có onclick gọi tabId
            const $btn = $(`.tab-btn`).filter(function () {
                return $(this).attr('onclick')?.includes(tabId);
            });

            // 👉 Gán class active và mô phỏng hiệu ứng như click thật
            $btn.addClass('active');

            // (Tùy chọn) Nếu bạn muốn hiệu ứng ripple/click thì có thể gọi $btn.trigger('click');
            // Nhưng ở đây ta không gọi lại vì đã xử lý nội dung tab rồi
        }

        // 5. Nếu là tab đánh giá → scroll xuống
        if (tabId === 'tab3') {
            const targetOffset = document.querySelector('.product-tabs').offsetTop - 60;
            window.scrollTo({
                top: targetOffset,
                behavior: 'smooth'
            });
        }
    };




    // Giả sử `window.products` đã tồn tại hoặc khai báo ở file khác
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');
    const product = window.products.find(p => p.id === productId);

    if (product) {
        $('#productCategory').text(product.category);
        $('#productName, #productTitle').text(product.name);
        const ratingStars = generateStars(product.rating || 0);
        $('#productRatingSection').html(`
           <span class="stars">${ratingStars}</span>
           <a href="#tab3" class="review-link" onclick="document.querySelectorAll('.tab-btn')[2].click()">Xem đánh giá</a>

        `);
        const original = parsePrice(product.originalPrice || product.price) || 0;
        const sale = parsePrice(product.salePrice || product.price) || 0;

        let discount = '';
        if (original > sale && original > 0 && sale > 0) {
            const percent = Math.round((1 - sale / original) * 100);
            if (percent > 0) discount = `-${percent}%`;
        }
        $('#productPrice').text(formatPrice(sale));
        $('#productOriginalPrice').text(original > sale ? formatPrice(original) : '');
        $('#productDiscount').text(discount);
        $('#productDescription').html(product.description);
        $('.buy-now').attr('data-id', product.id);
        $('#mainImage').attr('src', product.image);
        $('#lightgallery a').attr('href', product.image);
        setupThumbnails(product.thumbnails || [product.image]);
        if (product.category?.toLowerCase() === "flash sale" || product.tags?.includes("Flash Sale")) {
            $("#flashSaleBox").css("display", "flex");
            startFlashSaleCountdown();
        }

        $('#productSpecs').html(`
            <tr><th>Thành phần</th><th>Chi tiết</th></tr>
            ${product.specs.map(spec => `<tr><td>${spec.key}</td><td>${spec.value}</td></tr>`).join('')}
        `);

        saveRecentlyViewed(prepareProduct(product));
        renderRecentlyViewed();
        bindRecentlyViewedEvents(); // Thêm binding sự kiện
        renderBundleProducts(product.bundle);
        renderRelatedProducts(product.related);
        checkComboGift(product);
        $('#toggleDescriptionBtn').on('click', function () {
            const desc = $('#productDescription');
            const btn = $(this);
            const isExpanded = desc.hasClass('expanded');

            desc.toggleClass('expanded collapsed');
            btn
                .toggleClass('expanded')
                .html(`${isExpanded ? 'Xem thêm' : 'Thu gọn'} <i class="fas fa-chevron-down"></i>`);
        });


    } else {
        $('.container').html('<p class="text-center">Sản phẩm không tồn tại.</p>');
    }
});
