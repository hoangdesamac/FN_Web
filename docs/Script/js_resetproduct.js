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
async function addToCartAPI(product, qty = 1) {
    try {
        const res = await fetch('/api/cart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                id: product.id,
                name: product.name,
                originalPrice: product.originalPrice,
                salePrice: product.salePrice,
                discountPercent: product.discount || 0,
                image: product.image,
                quantity: qty
            })
        });
        return await res.json();
    } catch (err) {
        console.error('Lỗi thêm giỏ hàng:', err);
        return { success: false };
    }
}

async function updateCartCountFromServer() {
    try {
        const res = await fetch('/api/cart', { credentials: 'include' });
        const data = await res.json();
        if (!data.success) return;
        const totalCount = data.cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
        $('.cart-count').text(totalCount).css('display', totalCount > 0 ? 'inline-flex' : 'none');
    } catch (err) {
        console.error('Lỗi lấy số lượng giỏ:', err);
    }
}

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
    $container.find('.add-to-cart').on('click', async function (e) {
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

        try {
            // --- Thêm vào giỏ qua API ---
            const res = await addToCartAPI(cleanProduct, 1);
            if (!res.success) throw new Error(res.error || "Lỗi khi thêm giỏ hàng");

            // --- Cập nhật số lượng giỏ ---
            await updateCartCountFromServer();

            // --- Thông báo ---
            showToast(`Đã thêm ${cleanProduct.name} vào giỏ hàng!`);

        } catch (err) {
            console.error("❌ Lỗi thêm sản phẩm:", err);
            showToast("Không thể thêm sản phẩm vào giỏ hàng!");
        }
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

    $(document).on('click', '.buy-now', async function () {
        const productId = $(this).data('id');
        const product = window.products.find(p => p.id === productId);
        if (!product) return;

        const cleanProduct = prepareProduct(product);

        // --- Lấy tất cả combo đã check ---
        const $allCombos = $('.bundle-products .bundle-checkbox');
        const $checkedCombos = $allCombos.filter(':checked');

        // Danh sách combo đã chọn
        const selectedCombos = [];
        $checkedCombos.each(function () {
            const $card = $(this).closest('.product-card');
            selectedCombos.push(prepareProduct({
                id: $card.data('id'),
                name: $card.find('.product-name').text().trim(),
                image: $card.find('img').attr('src'),
                originalPrice: parsePrice($card.find('.original-price').text()),
                salePrice: parsePrice($card.find('.sale-price').text()),
            }));
        });

        // --- Xử lý quà tặng ---
        const hasAllCombos = ($allCombos.length > 0 && $checkedCombos.length === $allCombos.length);
        let giftCart = [];
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
        }

        try {
            // --- Thêm sản phẩm chính vào giỏ ---
            await addToCartAPI(cleanProduct, 1);

            // --- Thêm combo vào giỏ ---
            for (const combo of selectedCombos) {
                await addToCartAPI(combo, 1);
            }

            // --- Thêm quà tặng nếu đủ combo ---
            for (const gift of giftCart) {
                await addToCartAPI(gift, 1);
            }

            // --- Cập nhật badge giỏ hàng ---
            await updateCartCountFromServer();

            // --- Hiển thị thông báo ---
            let toastMsg = '';
            if ($checkedCombos.length) {
                toastMsg = `Đã thêm sản phẩm chính và ${$checkedCombos.length} combo`;
            } else {
                toastMsg = `Đã thêm ${product.name} vào giỏ hàng`;
            }
            if (giftCart.length) toastMsg += `, kèm theo quà tặng đính kèm vào giỏ hàng!`;
            else toastMsg += '!';

            showToast(toastMsg, hasAllCombos);

        } catch (err) {
            console.error('Lỗi khi thêm vào giỏ hàng:', err);
            showToast('Không thể thêm vào giỏ hàng, vui lòng thử lại!');
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

    $(document).on('click', '.add-to-cart-bundle', async function () {
        const $checked = $('.bundle-products .bundle-checkbox:checked');
        if (!$checked.length) {
            showToast('Vui lòng chọn ít nhất một sản phẩm combo!');
            return;
        }

        try {
            // Thêm từng sản phẩm combo vào giỏ qua API
            for (const el of $checked) {
                const $card = $(el).closest('.product-card');
                const id = $card.data('id');
                const name = $card.find('.product-name').text().trim();
                const image = $card.find('img').attr('src');
                const originalPrice = parsePrice($card.find('.original-price').text());
                const salePrice = parsePrice($card.find('.sale-price').text());

                const product = prepareProduct({
                    id,
                    name,
                    image,
                    originalPrice,
                    salePrice
                });

                addToSelectedCart(product); // Giữ để tracking selectedCart

                // Gọi API thêm vào giỏ
                const res = await addToCartAPI(product, 1);
                if (!res.success) throw new Error(res.error || "Lỗi thêm combo");
            }

            // Cập nhật số lượng giỏ từ server
            await updateCartCountFromServer();

            // Thông báo thành công
            showToast(`Đã thêm ${$checked.length} sản phẩm combo vào giỏ!`);

        } catch (err) {
            console.error('❌ Lỗi thêm combo:', err);
            showToast('Không thể thêm combo vào giỏ hàng!');
        }
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
            .replace(/[^a-z0-9 ]/g, '')
            .replace(/\s+/g, '-')
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
        $('.tab-content').removeClass('active');
        $('.tab-btn').removeClass('active');
        $(`#${tabId}`).addClass('active');
        if (event) $(event.currentTarget).addClass('active');
        else {
            const $btn = $(`.tab-btn`).filter(function () {
                return $(this).attr('onclick')?.includes(tabId);
            });
            $btn.addClass('active');
        }
        if (tabId === 'tab3') {
            const targetOffset = document.querySelector('.product-tabs').offsetTop - 60;
            window.scrollTo({ top: targetOffset, behavior: 'smooth' });
        }
    };

    // Lấy id, name và type từ URL
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');
    const normName = urlParams.get('name');
    const type = urlParams.get('type');

    // Debug: log URL params
    console.log('[DEBUG] URL params:', { productId, normName, type });

    // Lấy đúng danh sách sản phẩm theo type
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
        if (type === 'laptop' && Array.isArray(product.category)) product.category = product.category.join(' ');
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
        let sale = 0, original = 0;
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
            sale = parsePrice(product.price_new);
            original = parsePrice(product.price_old);
        } else if (product.price) {
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
        if (product.image && product.image.includes('_medium')) {
            const highRes = product.image.replace('_medium', '_master');
            $img.attr('srcset', `${product.image} 1x, ${highRes} 2x`);
        }
        $img.hover(
            function() { $(this).css({'box-shadow': '0 16px 48px 0 rgba(0,0,0,0.22)', 'transform': 'scale(1.01)'}); },
            function() { $(this).css({'box-shadow': '0 8px 32px 0 rgba(0,0,0,0.18)', 'transform': 'scale(1)'}); }
        );
        $('#lightgallery a').attr('href', product.image);
        if (product.thumbnails && Array.isArray(product.thumbnails) && product.thumbnails.length > 1) {
            setupThumbnails(product.thumbnails);
        } else {
            setupThumbnails([product.image]);
        }
        $("#flashSaleBox").css("display", "none");
        let specsHtml = '<tr><th>Thành phần</th><th>Chi tiết</th></tr>';
        if (
            ((product.category?.toLowerCase()?.includes('chuột') || product.name?.toLowerCase()?.includes('chuột')) || (window.location.search.includes('type=mouse')))
        ) {
            const keysOrder = ['Kết nối', 'Pin', 'DPI'];
            let specsMap = {};
            if (product.specs && Array.isArray(product.specs)) {
                product.specs.forEach(s => {
                    if (s.key && s.value) specsMap[s.key.trim().toLowerCase()] = s.value;
                });
            }
            let descArr = Array.isArray(product.desc) ? product.desc : [];
            keysOrder.forEach((key, idx) => {
                let val = specsMap[key.toLowerCase()];
                if (!val && descArr[idx]) {
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

    // Nếu có id (từ index) → tìm trong window.products hoặc fetch all types
    if (productId) {
        // Kiểm tra trong window.products trước (dữ liệu từ index)
        const foundInWindow = window.products.find(p => p.id === productId);
        if (foundInWindow) {
            renderProduct(foundInWindow);
        } else {
            // Nếu không tìm thấy, fetch tất cả types để tìm theo id
            const allTypes = ['pc', 'laptop', 'mouse', 'keyboard', 'display'];
            let allProducts = [];
            let promises = allTypes.map(t => new Promise(resolve => {
                fetchProductsByType(t, list => {
                    allProducts = allProducts.concat(list);
                    resolve();
                });
            }));
            Promise.all(promises).then(() => {
                console.log('[DEBUG] Fetched all types lists:', allProducts);
                const found = allProducts.find(p => p.id === productId);
                if (found) renderProduct(found);
                else showNotFound(`Không tìm thấy sản phẩm với ID: ${productId}`);
            }).catch(err => {
                console.error('[DEBUG] Lỗi fetch all types:', err);
                showNotFound('Lỗi tải dữ liệu sản phẩm');
            });
        }
        // Nếu có type và name (từ allproducts) → giữ logic cũ
    } else if (type && normName) {
        fetchProductsByType(type, list => {
            if (!Array.isArray(list)) return showNotFound('Dữ liệu sản phẩm không hợp lệ');
            console.log('[DEBUG] Fetched list for type ' + type + ':', list);
            const found = list.find(p => normalizeName(p.name) === normName);
            if (found) renderProduct(found);
            else showNotFound('Không tìm thấy sản phẩm trong file dữ liệu cho type: ' + type);
        });
        // Nếu thiếu cả id, name, type → not found
    } else {
        showNotFound('Thiếu thông tin id, name hoặc type trên URL');
    }
});
