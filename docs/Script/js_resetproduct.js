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
                id: "mouse-asus-tuf-m4-wireless",
                name: "Chuột Gaming Asus TUF M4 Wireless",
                image: "https://product.hstatic.net/200000722513/product/tuf-gaming-m4-wireless-02_56fe3b15890748738508eb07f20c43c5_large_thumb_d7bfc6df9d2d4aeb9fc22906a8fee7ae_master.jpg",
                originalPrice: "1.190.000₫",
                salePrice: "710.000₫",
                description: "Pin rời / Không dây / DPI - 12.000",
                rating: 0.0,
                reviews: 0
            },
            {
                id: "keyboard-edra-ek375w-ek398w-white-black-green",
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


    },
{
        id: "pc-gvn-i5-14400f-rtx-5060",
        category: "PC BÁN CHẠY NHẤT",
        name: "PC GVN Intel i5-14400F/ VGA RTX 5060 (DDR5)",
        originalPrice: "27.720.000₫",
        salePrice: "24.590.000₫",
        image: "https://product.hstatic.net/200000722513/product/pc_case_xigmatek_-_26_2cb0da60a679425680247ca67c42721e_master.png",
        sold: 80,
        rating: 0.0,
        reviews: 0,
        thumbnails: [
            "https://product.hstatic.net/200000722513/product/pc_case_xigmatek_-_26_2cb0da60a679425680247ca67c42721e_master.png",
            "https://cdn.hstatic.net/products/200000722513/web__4_of_80__a7e18bbf607c4e6fb86dd03f9c08ebee_master.jpg",
            "https://cdn.hstatic.net/products/200000722513/web__8_of_80__9e20594552dd4db4b0f3fcd82f9412a1_master.jpg",
            "https://cdn.hstatic.net/products/200000722513/web__13_of_80__692daf44395346c2ae27d9fc6d49bd61_master.jpg",
            "https://cdn.hstatic.net/products/200000722513/web__14_of_80__c0beb9de19794283a9f3629c01ce3c29_master.jpg",
            "https://cdn.hstatic.net/products/200000722513/web__17_of_80__f26e7fa750c74d1da307fc868a63ebac_master.jpg",
            "https://cdn.hstatic.net/products/200000722513/web__18_of_80__36303d2484e84f0b8540ecbbe16bd7bb_master.jpg",
            "https://cdn.hstatic.net/products/200000722513/web__23_of_80__97c8b7ac4715443f8bbc08b9b03da6c0_master.jpg",
        ],
        description: `
        <p><strong>Bộ PC Gaming Core I5 14400F – RTX 5060</strong> là sự kết hợp mạnh mẽ và mức giá phải chăng, hứa hẹn đưa bạn đến thế giới game sống động, chân thực. Ngoài gaming, cấu hình này còn xử lý mượt các tác vụ render video, chỉnh sửa ảnh chuyên nghiệp.</p>

    <h4>Mainboard Asus Gaming B760</h4>
    <img src="https://product.hstatic.net/200000722513/product/1024__5__ae6d71b490224ffc8b9035e928b5e6ea_master.jpg" >
    <ul>
        <li>Hỗ trợ PCIe 5.0, RAM DDR4, tốc độ cao.</li>
        <li>Khe M.2 PCIe 4.0, cổng USB 3.2 Gen 2, HDMI, DP.</li>
        <li>VRM ổn định, BIOS UEFI dễ dùng.</li>
    </ul>

    <h4>CPU Intel Core i5-14400F (4.70GHz)</h4>
    <img src="https://product.hstatic.net/200000722513/product/n22561-001-i5f-_univ_2e1135c9919d46ce97e95d2e19cb74f3_master.png" >
    <ul>
        <li>Hiệu năng tốt, đơn nhân mạnh mẽ, đa nhiệm ổn.</li>
        <li>Không có iGPU, ép xung hạn chế.</li>
    </ul>

    <h4>RAM 16GB 3200MHz</h4>
    <ul>
        <li>Dung lượng tiêu chuẩn cho gaming &amp; làm việc.</li>
        <li>Tốc độ cao, nhưng ép xung không nhiều.</li>
    </ul>

    <h4>Case DARKFLASH TH285M</h4>
    <img src="https://product.hstatic.net/200000722513/product/image_20240621094047_f2f9063fcfb24f41839e1d1b198c77ae_master.jpg" >
    <ul>
        <li>Thiết kế trắng sang trọng, kính cường lực.</li>
        <li>Hỗ trợ nhiều quạt, dễ quản lý cáp.</li>
        <li>Nhược điểm: dễ bám vân tay.</li>
    </ul>

    <h4>VGA Colorful GeForce RTX 5060 EX 8GB</h4>
    <img src="https://product.hstatic.net/200000722513/product/geforce_rtx__5060_windforce_oc_8g-01_068c4900c0bc4ccf9673d722c18c1299_master.png" >
    <ul>
        <li>Chơi game mượt ở 1440p, ép xung nhẹ.</li>
        <li>Hỗ trợ HDMI 2.1a, DP 1.4a, kích thước gọn.</li>
    </ul>

    <h4>Nguồn Centaur CT – 850W</h4>
    <img src="https://product.hstatic.net/200000722513/product/nguon_fsp_hv_pro_650w_-_9_c83eecc17d7247cbb2a882ebaaf9041c_8ab94aaa9c25486cb3ebfe1c8476d5ef_master.png" >
    <ul>
        <li>Công suất đủ cho cấu hình tầm trung/cao cấp.</li>
        <li>Có bảo vệ cơ bản, giá rẻ.</li>
        <li>Nhược điểm: ồn khi tải cao.</li>
    </ul>

    <p><strong>Kết luận:</strong> PC Core I5 14400F + RTX 5060 8GB mang lại hiệu năng cân bằng cho cả công việc và giải trí. Lựa chọn đáng cân nhắc trong phân khúc tầm trung.</p>
    `,
        specs: [
            { key: "Mainboard", value: "Bo mạch chủ MSI MAG B760M MORTAR II WIFI DDR5" },
            { key: "CPU", value: "Bộ vi xử lý Intel Core i5-14400F" },
            { key: "RAM", value: "Ram Corsair Vengeance RGB 32GB 5600 DDR5" },
            { key: "VGA ", value: "Card màn hình Gigabyte GeForce RTX 5060 Windforce OC 8GB" },
            { key: "HDD", value: "Có thể tùy chọn Nâng cấp" },
            { key: "SSD", value: "	Ổ cứng SSD Kingston NV3 500GB M.2 PCIe NVMe Gen4" },
            { key: "PSU", value: "Nguồn FSP HV PRO 650W - 80 Plus Bronze" },
            { key: "Case", value: "	Vỏ máy tính Xigmatek QUANTUM 3GF" },
            { key: "Tản nhiệt", value: "	Cooler Master Hyper 212 Spectrum V3 ARGB" },
            { key: "Bảo hành", value: "36 tháng" },
        ]
        ,
        reviews: [],
        bundle: [
            {
                id: "mouse-asus-tuf-m4-wireless",
                name: "Chuột Gaming Asus TUF M4 Wireless",
                image: "https://product.hstatic.net/200000722513/product/tuf-gaming-m4-wireless-02_56fe3b15890748738508eb07f20c43c5_large_thumb_d7bfc6df9d2d4aeb9fc22906a8fee7ae_master.jpg",
                originalPrice: "1.190.000₫",
                salePrice: "710.000₫",
                description: "Pin rời / Không dây / DPI - 12.000",
                rating: 0.0,
                reviews: 0
            },
            {
                id: "keyboard-edra-ek375w-ek398w-white-black-green",
                name: "Bàn phím E-Dra EK375W EK398W (White + Black + Green)",
                image: "https://cdn.hstatic.net/products/200000722513/imgi_3_594_ek398w_black_white_green_1__fd6be6580b244eb38d0ad895cc97d764_master.jpg",
                originalPrice: "1.090.000₫",
                salePrice: "820.000₫",
                description: "Layout độc đáo, phối màu nổi bật, kết nối không dây tiện dụng",
                rating: 0.0,
                reviews: 0
            },
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
            }
        ],
        related: [
            {
                id: "pc-gvn-i5-12400f-rtx-5060-main-h",
                name: "PC GVN Intel i5-12400F/ VGA RTX 5060 (Main H)",
                image: "https://product.hstatic.net/200000722513/product/pc_case_xigmatek_-_26_8cc60d3205d446d89294340c40b09d62_master.png",
                category: "PC BÁN CHẠY NHẤT",
                originalPrice: "21.120.000₫",
                salePrice: "18.990.000₫",
                description: "Màn hình gaming 25 inch, tấm nền IPS, tần số quét cao 180Hz, thích hợp chơi game mượt mà.",
                rating: 0.0,
                reviews: 0,
                sold: 1,
                tags: ["flash"]
            },
            {
                id: "pc-gvn-i7-14700f-rtx-5060",
                name: "PC GVN Intel i7-14700F/ VGA RTX 5060",
                image: "https://product.hstatic.net/200000722513/product/smart_5f512d33804f42a980a0997f3ef5b007_master.png",
                category: "PC BÁN CHẠY NHẤT",
                originalPrice: "35.920.000₫",
                salePrice: "34.790.000₫",
                description: "Màn hình gaming ViewSonic 24 inch, IPS, tần số quét cao 180Hz, thiết kế hiện đại, viền mỏng.",
                rating: 0.0,
                reviews: 0,
                sold: 5,
                tags: ["flash"]
            },
            {
                id: "pc-gvn-i5-12400f-rx-7600",
                name: "PC GVN Intel i5-12400F/ VGA RX 7600",
                image: "https://product.hstatic.net/200000722513/product/pc_gvn_rx6500xt_-_3_79097d10e652493cb4319978c296271e_master.png",
                category: "PC BÁN CHẠY NHẤT",
                originalPrice: "19.420.000₫",
                salePrice: "17.190.000₫",
                description: "Màn hình TUF Gaming 24 inch IPS, tần số quét 146Hz, thiết kế mạnh mẽ, phù hợp chơi game tốc độ cao.",
                rating: 0.0,
                reviews: 0,
                sold: 3,
                tags: ["flash"]
            },
            {
                id: "pc-gvn-i5-12400f-rtx-3060",
                name: "PC GVN Intel i5-12400F/ VGA RTX 3060 (Main H)",
                image: "https://product.hstatic.net/200000722513/product/pc_case_xigmatek_-_26_82498939d3bc46308cf3b15fd293d616_master.png",
                category: "PC BÁN CHẠY NHẤT",
                originalPrice: "18.420.000₫",
                salePrice: "16.190.000₫",
                description: "Màn hình Acer 24 inch tấm nền IPS, tần số quét siêu cao 200Hz, hỗ trợ G-Sync, cực kỳ mượt khi chơi game.",
                rating: 0.0,
                reviews: 0,
                sold: 9,
                tags: ["flash"]    


                
            },
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


    },
    {

    },
    {

    }

    // Thêm các sản phẩm khác từ resetmaincontent.html nếu cần
];
// ==========================
// MAIN INIT: chạy toàn trang
// ==========================
$(document).ready(function () {
    // ================== HÀM CHUẨN HÓA DÙNG CHUNG ==================
    function normalizeName(str) {
        return (str || '')
            .toLowerCase()
            .normalize('NFD').replace(/\p{Diacritic}/gu, '')
            .replace(/[^a-z0-9]/g, '')
            .trim();
    }
    function categoryToString(category) {
        if (Array.isArray(category)) return category.join(' ').toLowerCase();
        if (typeof category === 'string') return category.toLowerCase();
        return '';
    }
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




    // Lấy name và type từ URL
    const urlParams = new URLSearchParams(window.location.search);
    const normName = urlParams.get('name');
    const type = urlParams.get('type');

    // Debug: log URL params
    console.log('[DEBUG] URL params:', { normName, type });

    // Hàm normalize giống bên allproducts
    function normalizeName(str) {
        return (str || '')
            .toLowerCase()
            .normalize('NFD').replace(/\p{Diacritic}/gu, '')
            .replace(/[^a-z0-9 ]/g, '')
            .replace(/\s+/g, '-')
            .trim();
    }

    // Lấy đúng danh sách sản phẩm theo type
    // Luôn fetch theo type nếu có type (không dùng window.products cho các loại này)
    function fetchProductsByType(type, cb) {
        let file = '';
        if (type === 'pc') file = 'pc-part-dataset/processed/pc.json';
        else if (type === 'laptop') file = 'pc-part-dataset/processed/laptop.json';
        else if (type === 'mouse') file = 'pc-part-dataset/processed/mousenew.json';
        else if (type === 'keyboard') file = 'pc-part-dataset/processed/keyboadnew.json';
        else if (type === 'display') file = 'pc-part-dataset/processed/display.json';
        if (!file) {
            console.error('[DEBUG] Không xác định được file dữ liệu cho type:', type);
            return cb([]);
        }
        fetch(file)
            .then(r => {
                if (!r.ok) throw new Error('Fetch failed: ' + r.status);
                return r.json();
            })
            .then(list => {
                console.log('[DEBUG] Fetched product list:', list);
                cb(list);
            })
            .catch((err) => {
                console.error('[DEBUG] Lỗi fetch file:', file, err);
                cb([]);
            });
    }

    function renderProduct(product) {
        // Fix riêng cho laptop: chuẩn hóa category về string nếu type=laptop
        if (type === 'laptop') {
            if (Array.isArray(product.category)) product.category = product.category.join(' ');
        }
        console.log('[DEBUG] Render product:', product);
        if (!product) {
            showNotFound('Không tìm thấy sản phẩm (product null)');
            return;
        }
        $('#productCategory').text(product.category || '');
        $('#productName, #productTitle').text(product.name || '');
        const ratingStars = generateStars(product.rating || 0);
        $('#productRatingSection').html(`
           <span class="stars">${ratingStars}</span>
           <a href="#tab3" class="review-link" onclick="document.querySelectorAll('.tab-btn')[2].click()">Xem đánh giá</a>
        `);
        // Hiển thị giá cho từng loại sản phẩm
        let sale = 0, original = 0;
        // Ưu tiên lấy giá cho bàn phím
        if (window.location.search.includes('type=keyboard') || (product.name && product.name.toLowerCase().includes('bàn phím'))) {
            if (product.new_price && product.old_price) {
                sale = parsePrice(product.new_price);
                original = parsePrice(product.old_price);
            } else if (product.old_price) {
                sale = parsePrice(product.old_price);
            } else if (product.price) {
                sale = parsePrice(product.price);
            }
        } else if (product.price_new && product.price_old) {
            // Mouse: có price_new, price_old
            sale = parsePrice(product.price_new);
            original = parsePrice(product.price_old);
        } else if (product.price) {
            // PC/Laptop: chỉ có price
            sale = parsePrice(product.price);
        } else if (product.salePrice && product.originalPrice) {
            sale = parsePrice(product.salePrice);
            original = parsePrice(product.originalPrice);
        }
        $('#productPrice').text(formatPrice(sale));
        if (original && original > sale) {
            $('#productOriginalPrice').text(formatPrice(original));
            const discount = Math.round((1 - sale / original) * 100);
            $('#productDiscount').text(`-${discount}%`);
        } else {
            $('#productOriginalPrice').text('');
            $('#productDiscount').text('');
        }
        $('#productDescription').html(product.description || '');
        $('.buy-now').attr('data-id', product.id || '');
        // Hiển thị hình ảnh đẹp hơn, căn giữa, bo góc, đổ bóng
        // Hiển thị ảnh sắc nét nhất có thể
        const $img = $('#mainImage');
        $img.attr('src', product.image)
            .css({
                'object-fit': 'cover',
                'width': '100%',
                'height': '100%',
                'max-width': '100%',
                'max-height': '100%',
                'border-radius': '32px',
                'box-shadow': '0 8px 32px 0 rgba(0,0,0,0.18)',
                'margin': '0',
                'padding': '0',
                'background': 'none',
                'border': 'none',
                'display': 'block',
                'transition': 'box-shadow 0.3s, transform 0.3s',
                'image-rendering': 'auto',
                'image-rendering': 'crisp-edges',
                'image-rendering': '-webkit-optimize-contrast',
                'backface-visibility': 'hidden',
                'will-change': 'transform',
            });
        // Nếu có ảnh độ phân giải cao hơn, dùng srcset cho màn hình retina
        if (product.image && product.image.includes('_medium')) {
            const highRes = product.image.replace('_medium', '_master');
            $img.attr('srcset', `${product.image} 1x, ${highRes} 2x`);
        }
        $img.hover(
            function() { $(this).css({'box-shadow': '0 16px 48px 0 rgba(0,0,0,0.22)', 'transform': 'scale(1.01)'}); },
            function() { $(this).css({'box-shadow': '0 8px 32px 0 rgba(0,0,0,0.18)', 'transform': 'scale(1)'}); }
        );
        $('#lightgallery a').attr('href', product.image);
        // Nếu có nhiều ảnh thì dùng thumbnails, còn không thì chỉ 1 ảnh
        if (product.thumbnails && Array.isArray(product.thumbnails) && product.thumbnails.length > 1) {
            setupThumbnails(product.thumbnails);
        } else {
            setupThumbnails([product.image]);
        }
        // Ẩn flash sale nếu không có
        $("#flashSaleBox").css("display", "none");
        // Hiển thị thông số kỹ thuật cho từng loại sản phẩm
        let specsHtml = '<tr><th>Thành phần</th><th>Chi tiết</th></tr>';
        if (
            ((product.category?.toLowerCase()?.includes('chuột') || product.name?.toLowerCase()?.includes('chuột')) || (window.location.search.includes('type=mouse')))
        ) {
            // Luôn hiển thị 3 dòng cố định bên trái
            const keysOrder = ['Kết nối', 'Pin', 'DPI'];
            // Ưu tiên lấy từ specs dạng object
            let specsMap = {};
            if (product.specs && Array.isArray(product.specs)) {
                product.specs.forEach(s => {
                    if (s.key && s.value) specsMap[s.key.trim().toLowerCase()] = s.value;
                });
            }
            // Nếu không có specs, lấy từ desc dạng text
            let descArr = Array.isArray(product.desc) ? product.desc : [];
            keysOrder.forEach((key, idx) => {
                let val = specsMap[key.toLowerCase()];
                if (!val && descArr[idx]) {
                    // Nếu desc có dạng 'DPI - 12000' thì tách lấy số
                    if (key === 'DPI' && /dpi/i.test(descArr[idx])) {
                        let match = descArr[idx].match(/\d+[.,]?\d*/);
                        val = match ? match[0] : descArr[idx];
                    } else {
                        val = descArr[idx];
                    }
                }
                specsHtml += `<tr><td>${key}</td><td>${val || ''}</td></tr>`;
            });
        } else if (product.specs && Array.isArray(product.specs) && product.specs.length > 0) {
            specsHtml += product.specs.map(spec => `<tr><td>${spec.key}</td><td>${spec.value}</td></tr>`).join('');
        } else if (window.location.search.includes('type=display') || (product.category?.toLowerCase()?.includes('màn hình') || product.name?.toLowerCase()?.includes('màn hình'))) {
            // Nếu là màn hình mà không có specs thì tự động lấy các trường panel, refresh_rate, size, resolution
            const displayFields = [
                { key: 'Tấm nền', value: product.panel },
                { key: 'Tần số quét', value: product.refresh_rate },
                { key: 'Kích thước', value: product.size },
                { key: 'Độ phân giải', value: product.resolution }
            ];
            specsHtml += displayFields.filter(f => f.value).map(f => `<tr><td>${f.key}</td><td>${f.value}</td></tr>`).join('');
        } else if (product.desc && Array.isArray(product.desc) && product.desc.length > 0) {
            specsHtml += product.desc.map((d) => `<tr><td>Đặc điểm</td><td>${d}</td></tr>`).join('');
        } else {
            // Nếu không có specs/desc, tự tạo bảng từ các trường cơ bản
            const fields = [
                { key: 'CPU', value: product.cpu },
                { key: 'GPU', value: product.gpu },
                { key: 'RAM', value: product.ram },
                { key: 'Ổ cứng', value: product.storage },
                { key: 'Mainboard', value: product.mainboard },
                { key: 'PSU', value: product.psu },
                { key: 'Case', value: product.case },
                { key: 'Hệ điều hành', value: product.os }
            ];
            specsHtml += fields.filter(f => f.value).map(f => `<tr><td>${f.key}</td><td>${f.value}</td></tr>`).join('');
        }
        $('#productSpecs').html(specsHtml);
        saveRecentlyViewed(prepareProduct(product));
        renderRecentlyViewed();
        bindRecentlyViewedEvents();
        renderBundleProducts(product.bundle);
        renderRelatedProducts(product.related);
        checkComboGift(product);
        $('#toggleDescriptionBtn').on('click', function () {
            const desc = $('#productDescription');
            const btn = $(this);
            const isExpanded = desc.hasClass('expanded');
            desc.toggleClass('expanded collapsed');
            btn.toggleClass('expanded').html(`${isExpanded ? 'Xem thêm' : 'Thu gọn'} <i class="fas fa-chevron-down"></i>`);
        });
    }

    function showNotFound(msg) {
        const message = msg || 'Sản phẩm không tồn tại.';
        $('.container').html(`<p class="text-center" style="color:red;font-weight:bold;">${message}</p>`);
        console.warn('[DEBUG] showNotFound:', message);
    }

    if (type && normName) {
        fetchProductsByType(type, list => {
            if (!Array.isArray(list)) return showNotFound('Dữ liệu sản phẩm không hợp lệ');
            console.log('[DEBUG] Fetched list:', list);
            const found = list.find(p => normalizeName(p.name) === normName);
            if (found) renderProduct(found);
            else showNotFound('Không tìm thấy sản phẩm trong file dữ liệu');
        });
    } else if (window.products && window.products.length) {
        console.log('[DEBUG] window.products:', window.products);
        const found = window.products.find(p => normalizeName(p.name) === normName);
        if (found) renderProduct(found);
        else showNotFound('Không tìm thấy sản phẩm trong window.products');
    } else {
        showNotFound('Thiếu thông tin name hoặc type trên URL');
    }
});
