function loadPagePart(url, selector, callback = null, executeScripts = true) {
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Lỗi HTTP! Trạng thái: ${response.status}`);
            }
            return response.text();
        })
        .then(data => {
            const container = document.querySelector(selector);
            if (container) {
                container.innerHTML = data;

                if (executeScripts) {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = data;
                    const scripts = tempDiv.querySelectorAll('script');
                    scripts.forEach(oldScript => {
                        const newScript = document.createElement('script');
                        if (oldScript.src) {
                            if (!document.querySelector(`script[src="${oldScript.src}"]`)) {
                                newScript.src = oldScript.src;
                                newScript.defer = true;
                                document.body.appendChild(newScript);
                            }
                        } else {
                            newScript.textContent = oldScript.textContent;
                            document.body.appendChild(newScript);
                        }
                    });
                }

                if (typeof callback === 'function') {
                    callback();
                }
            }
        })
        .catch(error => {
            console.error(`Lỗi khi tải ${url}:`, error);
        });
}

function isLoggedIn() {
    try {
        if (window.AuthSync && typeof window.AuthSync.isLoggedIn === 'function') {
            return window.AuthSync.isLoggedIn();
        }
    } catch (e) {}
    return !!localStorage.getItem('userName');
}
let deliveryInfo = {};
let currentStep = 1;

function showStep(step) {
    document.querySelectorAll('.checkout-step').forEach(stepDiv => stepDiv.classList.add('d-none'));
    document.getElementById(`step-${step}`).classList.remove('d-none');
    document.querySelectorAll('.breadcrumb-steps .step').forEach(stepEl => {
        stepEl.classList.remove('active', 'completed');
    });
    for (let i = 1; i <= 3; i++) {
        const stepEl = document.getElementById(`breadcrumb-step-${i}`);
        if (i < step) stepEl.classList.add('completed');
        else if (i === step) stepEl.classList.add('active');
    }
    currentStep = step;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Robust wrapper to call shared API or fallback
async function _refreshCartCountFromSharedOrFallback() {
    try {
        if (window.cartCountShared && typeof window.cartCountShared.refresh === 'function') {
            await window.cartCountShared.refresh();
            return;
        }
    } catch (e) {
        console.warn('cartCountShared.refresh() failed:', e);
    }
    // fallback: call legacy updateCartCount if present
    try { if (typeof updateCartCount === 'function') updateCartCount(); } catch (e) {}
}

// [ADD] Lưu/đọc quà "dự kiến" theo phần đã chọn
function getServerGiftsPreview() {
    try { return JSON.parse(localStorage.getItem('serverGiftsPreview') || '[]'); } catch { return []; }
}
function setServerGiftsPreview(gifts) {
    try { localStorage.setItem('serverGiftsPreview', JSON.stringify(Array.isArray(gifts) ? gifts : [])); } catch {}
}

// [ADD] Lấy danh sách item đã chọn dựa trên selectedItems + cartCache
function getSelectedCartFromState() {
    const cart = getCart();
    if (!Array.isArray(cart) || !cart.length) return [];
    if (!Array.isArray(selectedItems) || !selectedItems.length) return [];
    const set = new Set(selectedItems.map(String));
    return cart.filter(it => set.has(String(it.id)));
}

// [ADD] Refresh preview quà cho phần đã chọn + cập nhật Summary theo tổng phần chọn
let _previewInFlight = null;
async function refreshGiftPreviewForSelection() {
    try {
        const selected = getSelectedCartFromState();
        const selectedTotal = selected.reduce((s, it) => s + (Number(it.salePrice) || 0) * (Number(it.quantity) || 1), 0);

        updateCartSummary(selectedTotal);

        if (!selected.length) {
            setServerGiftsPreview([]);
            setGiftPreviewConfirmedFlag(false);
            try { renderCart(); } catch (e) {}
            return;
        }

        const controller = new AbortController();
        if (_previewInFlight) { try { _previewInFlight.abort(); } catch (_) {} }
        _previewInFlight = controller;

        const { group, setCount } = findMatchedGroupAndSetCount(selected);

        let data = null, ok = false;

        if (group && setCount > 0) {
            // Đủ bộ → xin single gift duy nhất với quantity = setCount
            const body = {
                items: group.requiredIds.map(id => {
                    const it = selected.find(x => String(x.id) === String(id));
                    return { id, quantity: it ? Number(it.quantity) || 1 : 0 };
                }),
                requiredIds: group.requiredIds
            };
            const res = await fetch(`${window.API_BASE}/api/gifts/single-select`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body),
                signal: controller.signal
            }).catch(err => { if (err.name !== 'AbortError') throw err; });

            if (res) { data = await res.json(); ok = res.ok && data && data.success; }
            if (ok) {
                setServerGiftsPreview(data.gifts || []);
                setGiftPreviewConfirmedFlag(true);
            } else {
                setServerGiftsPreview([]);
                setGiftPreviewConfirmedFlag(false);
            }
        } else {
            // Chưa đủ bộ → chỉ preview theo tổng (dự kiến)
            const res = await fetch(`${window.API_BASE}/api/gifts/preview`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    items: selected.map(it => ({ salePrice: Number(it.salePrice) || 0, quantity: Number(it.quantity) || 1 }))
                }),
                signal: controller.signal
            }).catch(err => { if (err.name !== 'AbortError') throw err; });

            if (res) { data = await res.json(); ok = res.ok && data && data.success; }
            if (ok) {
                setServerGiftsPreview(data.gifts || []);
            } else {
                setServerGiftsPreview([]);
            }
            setGiftPreviewConfirmedFlag(false);
        }

        try { renderCart(); } catch (e) {}
    } catch (err) {
        console.warn('refreshGiftPreviewForSelection error:', err);
        setServerGiftsPreview([]);
        setGiftPreviewConfirmedFlag(false);
        try { renderCart(); } catch (e) {}
    } finally {
        _previewInFlight = null;
    }
}

function getComboGroups() {
    try { return JSON.parse(localStorage.getItem('comboGroups') || '[]'); } catch { return []; }
}
function setGiftPreviewConfirmedFlag(v) {
    try { localStorage.setItem('giftPreviewConfirmed', v ? '1' : '0'); } catch {}
}
function isGiftPreviewConfirmed() {
    try { return localStorage.getItem('giftPreviewConfirmed') === '1'; } catch { return false; }
}

// [ADD] Tìm group khớp và số "bộ đầy đủ" trong phần đã chọn
function findMatchedGroupAndSetCount(selected) {
    const groups = getComboGroups();
    if (!groups.length) return { group: null, setCount: 0 };

    const idToQty = new Map();
    selected.forEach(it => idToQty.set(String(it.id), (idToQty.get(String(it.id)) || 0) + (Number(it.quantity) || 1)));

    for (const g of groups) {
        const req = (g.requiredIds || []).map(String);
        if (!req.length) continue;
        // đủ id?
        if (!req.every(id => idToQty.has(id))) continue;
        // min qty
        let minSet = Infinity;
        for (const id of req) {
            const q = idToQty.get(id) || 0;
            if (q <= 0) { minSet = 0; break; }
            if (q < minSet) minSet = q;
        }
        if (Number.isFinite(minSet) && minSet > 0) {
            return { group: g, setCount: minSet };
        }
    }
    return { group: null, setCount: 0 };
}

async function initializeCartSystem() {
    const logged = isLoggedIn();

    // pendingCartItem (khi bấm mua lúc chưa login)
    try {
        const pending = localStorage.getItem('pendingCartItem');
        if (pending) {
            const item = JSON.parse(pending);
            await addToCart(
                item.id,
                item.name,
                item.originalPrice,
                item.salePrice,
                item.discountPercent,
                item.image
            );
            localStorage.removeItem('pendingCartItem');
        }
    } catch (e) {
        console.warn('Failed processing pendingCartItem:', e);
    }

    if (logged) {
        try {
            const res = await fetch(`${window.API_BASE}/api/cart`, {
                method: 'GET',
                credentials: 'include'
            });
            const data = await res.json();
            if (data && data.success) {
                const serverCart = data.cart || [];
                const gifts = data.gifts || [];
                saveCart(serverCart);     // saveCart đã lọc quà
                setServerGifts(gifts);
                cartCache = serverCart;

                try {
                    if (window.cartCountShared && typeof window.cartCountShared.setFromCart === 'function') {
                        window.cartCountShared.setFromCart(serverCart); // KHÔNG gộp gifts
                    } else {
                        updateCartCount && updateCartCount();
                    }
                } catch (e) {
                    console.warn('setFromCart failed in init:', e);
                    updateCartCount && updateCartCount();
                }

                updateOrderCount && updateOrderCount();

                if (document.getElementById('cart-items-container')) {
                    renderCart(serverCart);
                }
            } else {
                console.warn('⚠️ API trả về lỗi khi lấy giỏ hàng:', data && data.error);
            }
        } catch (err) {
            console.error('❌ Lỗi khi lấy giỏ hàng từ server (init):', err);
            cartCache = JSON.parse(localStorage.getItem('cart') || '[]');
            setServerGifts([]); // vẫn không có quà khi lỗi
            try {
                if (window.cartCountShared && typeof window.cartCountShared.setFromCart === 'function') {
                    window.cartCountShared.setFromCart(cartCache); // KHÔNG gộp gifts
                } else updateCartCount && updateCartCount();
            } catch (e) {}
            if (document.getElementById('cart-items-container')) renderCart(cartCache);
        }
    } else {
        const localCart = JSON.parse(localStorage.getItem('cart') || '[]');
        cartCache = localCart;
        setServerGifts([]); // khách chưa đăng nhập không có quà server

        try {
            if (window.cartCountShared && typeof window.cartCountShared.setFromCart === 'function') {
                window.cartCountShared.setFromCart(localCart); // KHÔNG gộp gifts
            } else {
                updateCartCount && updateCartCount();
            }
        } catch (e) {
            console.warn('init fallback updateCartCount err:', e);
            updateCartCount && updateCartCount();
        }

        updateOrderCount && updateOrderCount();
        if (document.getElementById('cart-items-container')) {
            renderCart(localCart);
        }
    }

    // Bind buy-button
    document.querySelectorAll('.buy-button').forEach(button => {
        if (button._boundBuy) return;
        button._boundBuy = true;
        button.addEventListener('click', function () {
            const productCard = this.closest('.product-card');
            if (!productCard) {
                showNotification('Không tìm thấy thông tin sản phẩm!', 'error');
                return;
            }

            const productId = productCard.getAttribute('data-id');
            if (!productId) {
                console.error("Thiếu productId, không thể thêm sản phẩm vào giỏ!");
                return;
            }

            const productName = productCard.querySelector('.product-name')?.textContent.trim() || 'Sản phẩm không tên';
            const originalPriceText = productCard.querySelector('.original-price')?.textContent || '0';
            const salePriceText = productCard.querySelector('.sale-price')?.textContent || originalPriceText;
            const originalPrice = parseInt(originalPriceText.replace(/\D/g, '')) || 0;
            const salePrice = parseInt(salePriceText.replace(/\D/g, '')) || originalPrice;
            const discountPercentText = productCard.querySelector('.discount-badge')?.textContent || '0%';
            const discountPercent = parseInt(discountPercentText.replace(/[^0-9]/g, '')) || 0;
            const productImage = productCard.querySelector('.product-image img')?.src || '';

            if (!isLoggedIn()) {
                localStorage.setItem('pendingCartItem', JSON.stringify({
                    id: productId,
                    name: productName,
                    originalPrice,
                    salePrice,
                    discountPercent,
                    image: productImage,
                    quantity: 1
                }));

                if (typeof CyberModal !== "undefined" && CyberModal.open) {
                    CyberModal.open();
                }
                showNotification('Vui lòng đăng nhập để thêm sản phẩm!', 'info');
                return;
            }

            addToCart(productId, productName, originalPrice, salePrice, discountPercent, productImage);
            showNotification(`Đã thêm "${productName}" vào giỏ hàng!`, 'success');
        });
    });

    if (!document.getElementById('notification')) createNotificationElement();
    cleanupExpiredItems();
}

let cartCache = null;
let selectedItems = [];

// [CHANGE] Sau khi xử lý tick chọn → gọi refreshGiftPreviewForSelection()
function handleSelectItem(checkbox, index) {
    const cart = getCart();
    const item = cart[index];
    const cartItemDiv = checkbox.closest('.cart-item');

    if (checkbox.checked) {
        if (!selectedItems.includes(item.id)) {
            selectedItems.push(item.id);
        }
        cartItemDiv.classList.add('selected-item');
    } else {
        selectedItems = selectedItems.filter(id => id !== item.id);
        cartItemDiv.classList.remove('selected-item');
    }

    const selected = cart.filter(item => selectedItems.includes(item.id));
    localStorage.setItem('selectedCart', JSON.stringify(selected));

    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    if (selectAllCheckbox) {
        const allChecked = cart.length > 0 && cart.every(item => selectedItems.includes(item.id));
        selectAllCheckbox.checked = allChecked;
    }

    // NEW: cập nhật preview quà + summary theo phần chọn
    refreshGiftPreviewForSelection();
}

// [CHANGE] Tick tất cả → gọi refreshGiftPreviewForSelection()
function handleSelectAllToggle(checked) {
    const cart = getCart();
    selectedItems = checked ? cart.map(item => item.id) : [];

    const selected = cart.filter(item => selectedItems.includes(item.id));
    localStorage.setItem('selectedCart', JSON.stringify(selected));

    document.querySelectorAll('.normal-cart-item').forEach((itemDiv) => {
        const checkbox = itemDiv.querySelector('.select-checkbox');
        if (checkbox) checkbox.checked = checked;
        itemDiv.classList.toggle('selected-item', checked);
    });

    // NEW: cập nhật preview quà + summary theo phần chọn
    refreshGiftPreviewForSelection();
}

function refreshCartCache() {
    cartCache = JSON.parse(localStorage.getItem('cart')) || [];
    return cartCache;
}

function getCart() {
    if (!cartCache) {
        return refreshCartCache();
    }
    return cartCache;
}

function saveCart(cart) {
    const clean = Array.isArray(cart) ? cart.filter(it => !it.isGift) : [];
    localStorage.setItem('cart', JSON.stringify(clean));
    cartCache = clean;
}

async function addToCart(productId, productName, originalPrice, salePrice, discountPercent, image) {
    // Normalize prices
    originalPrice = typeof originalPrice === 'string' ? parseInt(originalPrice.replace(/\D/g, '')) || 0 : Number(originalPrice) || 0;
    salePrice = typeof salePrice === 'string' ? parseInt(salePrice.replace(/\D/g, '')) || 0 : Number(salePrice) || originalPrice;
    discountPercent = Number(discountPercent) || 0;

    const logged = isLoggedIn();
    animateCartIcon();

    // NOT LOGGED: local only
    if (!logged) {
        let cart = getCart();
        const existingIndex = cart.findIndex(item => item.id === productId);

        if (existingIndex !== -1) {
            cart[existingIndex].quantity = Number(cart[existingIndex].quantity || 0) + 1;
            cart[existingIndex].updatedAt = new Date().toISOString();
        } else {
            cart.push({
                id: productId,
                name: productName,
                originalPrice,
                salePrice,
                discountPercent,
                image,
                quantity: 1,
                addedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }

        saveCart(cart);
        cartCache = cart;

        try {
            if (window.cartCountShared && typeof window.cartCountShared.setFromCart === 'function') {
                window.cartCountShared.setFromCart(cart); // KHÔNG gộp gifts
            } else {
                updateCartCount && updateCartCount();
            }
        } catch (e) {
            console.warn('addToCart local setFromCart failed:', e);
            updateCartCount && updateCartCount();
        }

        renderCart(cart);
        return;
    }

    // LOGGED: server sync (optimistic)
    try {
        try {
            if (window.cartCountShared && typeof window.cartCountShared.increment === 'function') {
                window.cartCountShared.increment(1);
            } else {
                updateCartCount && updateCartCount();
            }
        } catch (e) {
            console.warn('Optimistic increment failed:', e);
        }

        const res = await fetch(`${window.API_BASE}/api/cart`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                id: productId,
                name: productName,
                originalPrice,
                salePrice,
                discountPercent,
                image,
                quantity: 1
            })
        });

        const data = await res.json();
        if (!data.success) {
            console.error('❌ Lỗi thêm sản phẩm trên server:', data.error);
            await _refreshCartCountFromSharedOrFallback();
            return;
        }

        const serverCart = data.cart || [];
        const gifts = data.gifts || [];
        saveCart(serverCart);
        setServerGifts(gifts);
        cartCache = serverCart;

        try {
            if (window.cartCountShared && typeof window.cartCountShared.setFromCart === 'function') {
                window.cartCountShared.setFromCart(serverCart); // KHÔNG gộp gifts
            } else {
                updateCartCount && updateCartCount();
            }
        } catch (e) {
            console.warn('setFromCart failed after addToCart:', e);
            updateCartCount && updateCartCount();
        }

        renderCart(serverCart);
    } catch (err) {
        console.error('❌ Lỗi gọi API addToCart:', err);
        await _refreshCartCountFromSharedOrFallback();
    }
}


function animateCartIcon() {
    const cartIcon = document.querySelector('.user-actions .fa-cart-shopping');
    if (cartIcon) {
        cartIcon.classList.add('cart-bounce');
        setTimeout(() => {
            cartIcon.classList.remove('cart-bounce');
        }, 800);
    }
}

function updateCartCount() {
    try {
        if (window.cartCountShared && typeof window.cartCountShared.refresh === 'function') {
            window.cartCountShared.refresh();
            return;
        }
    } catch (e) {
        console.warn('cartCountShared.refresh error (fallback to legacy):', e);
    }

    try {
        const cartCountElement = document.querySelector('.cart-count');
        if (!cartCountElement) return;

        const logged = (window.AuthSync && typeof window.AuthSync.isLoggedIn === 'function')
            ? window.AuthSync.isLoggedIn()
            : !!localStorage.getItem('userName');

        if (!logged) {
            cartCountElement.style.display = 'none';
            return;
        }

        const cart = JSON.parse(localStorage.getItem('cart') || '[]');
        const normalCount = Array.isArray(cart) ? cart.reduce((t, i) => t + (Number(i.quantity) || 0), 0) : 0;

        cartCountElement.textContent = String(normalCount);
        cartCountElement.style.display = normalCount > 0 ? 'inline-flex' : 'none';
    } catch (err) {
        console.warn('updateCartCount fallback error:', err);
    }
}

function createNotificationElement() {
    const oldNotification = document.getElementById('notification');
    if (oldNotification) {
        oldNotification.remove();
    }

    const notification = document.createElement('div');
    notification.id = 'notification';
    notification.className = 'notification';
    notification.style.display = 'none';
    document.body.appendChild(notification);
    return notification;
}

function showNotification(message = 'Đã thêm sản phẩm vào giỏ hàng!', type = 'success') {
    let notification = document.getElementById('notification-modal');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification-modal';
        notification.className = 'notification-modal';
        document.body.appendChild(notification);
    }

    notification.innerHTML = `
        <div class="notification-modal-content d-flex align-items-center gap-2">
            <i class="fa fa-${type === 'success' ? 'check-circle text-success' : 'exclamation-circle text-danger'} fs-4"></i>
            <span class="text-light">${message}</span>
        </div>
    `;

    notification.style.display = 'flex';
    notification.style.animation = 'fadeInSlide 0.3s ease forwards';

    setTimeout(() => {
        notification.style.animation = 'fadeOutSlide 0.3s ease forwards';
        setTimeout(() => {
            notification.style.display = 'none';
        }, 300);
    }, 3000);
}

// [CHANGE] Xoá cả preview khi clear giỏ
async function clearCart() {
    if (!confirm('Bạn có chắc chắn muốn xóa tất cả sản phẩm khỏi giỏ hàng?')) return;

    try {
        saveCart([]);
        setServerGifts([]);
        localStorage.removeItem('serverGiftsPreview');
        localStorage.removeItem('selectedCart');
        localStorage.removeItem('giftPreviewConfirmed'); // NEW
        cartCache = [];
        selectedItems = [];
    } catch (e) {
        console.warn('local clearCart failed:', e);
    }

    const logged = isLoggedIn();

    if (logged) {
        try {
            const res = await fetch(`${window.API_BASE}/api/cart`, {
                method: 'DELETE',
                credentials: 'include'
            });
            const data = await res.json();
            if (!data.success) {
                console.error('❌ Lỗi xoá toàn bộ giỏ hàng trên server:', data.error);
            } else {
                const serverCart = data.cart || [];
                const gifts = data.gifts || [];
                saveCart(serverCart);
                setServerGifts(gifts);
                cartCache = serverCart;
            }
        } catch (err) {
            console.error('❌ Lỗi khi gọi API clearCart:', err);
        }
    }

    localStorage.removeItem('cartLocked');

    try {
        if (window.cartCountShared && typeof window.cartCountShared.setFromCart === 'function') {
            window.cartCountShared.setFromCart(getCart());
        } else {
            updateCartCount && updateCartCount();
        }
    } catch (e) {
        console.warn('clearCart setFromCart failed:', e);
        updateCartCount && updateCartCount();
    }

    renderCart([]);
    showNotification('Đã xóa tất cả sản phẩm khỏi giỏ hàng', 'success');
}

// [CHANGE] Nếu item đang được chọn → refresh preview sau khi đổi số lượng
async function updateQuantity(index, change) {
    const cart = getCart();
    if (!cart[index]) return;
    if (cart[index].isGift) return;

    const oldQty = Number(cart[index].quantity || 0);
    const newQty = oldQty + change;
    if (newQty < 1) return;

    const cartItems = document.querySelectorAll('.cart-item');
    if (cartItems[index]) {
        cartItems[index].classList.add('quantity-change');
        setTimeout(() => { cartItems[index].classList.remove('quantity-change'); }, 300);
    }

    const logged = isLoggedIn();

    if (!logged) {
        cart[index].quantity = newQty;
        cart[index].updatedAt = new Date().toISOString();
        saveCart(cart);
        cartCache = cart;
        renderCart(cart);

        try {
            if (window.cartCountShared && typeof window.cartCountShared.setFromCart === 'function') {
                window.cartCountShared.setFromCart(cart); // KHÔNG gộp gifts
            } else {
                updateCartCount && updateCartCount();
            }
        } catch (e) {
            console.warn('updateQuantity local setFromCart failed:', e);
            updateCartCount && updateCartCount();
        }

        // NEW: nếu item được chọn → refresh preview quà
        if (selectedItems.includes(cart[index].id)) {
            await refreshGiftPreviewForSelection();
        }
        return;
    }

    const delta = newQty - oldQty;
    try {
        try {
            if (window.cartCountShared && typeof window.cartCountShared.increment === 'function') {
                window.cartCountShared.increment(delta);
            } else {
                updateCartCount && updateCartCount();
            }
        } catch (e) { console.warn('optimistic increment failed:', e); }

        const res = await fetch(`${window.API_BASE}/api/cart/${cart[index].id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ quantity: newQty })
        });

        const data = await res.json();
        if (!data.success) {
            console.error('❌ Lỗi cập nhật số lượng trên server:', data.error);
            await _refreshCartCountFromSharedOrFallback();
            return;
        }

        const serverCart = data.cart || [];
        const gifts = data.gifts || [];
        saveCart(serverCart);
        setServerGifts(gifts);
        cartCache = serverCart;
        renderCart(serverCart);

        try {
            if (window.cartCountShared && typeof window.cartCountShared.setFromCart === 'function') {
                window.cartCountShared.setFromCart(serverCart); // KHÔNG gộp gifts
            } else updateCartCount && updateCartCount();
        } catch (e) {
            console.warn('updateQuantity setFromCart failed:', e);
            updateCartCount && updateCartCount();
        }

        // NEW: nếu item được chọn → refresh preview quà
        const changedItemId = String(cart[index].id);
        if (selectedItems.map(String).includes(changedItemId)) {
            await refreshGiftPreviewForSelection();
        }
    } catch (err) {
        console.error('❌ Lỗi gọi API updateQuantity:', err);
        await _refreshCartCountFromSharedOrFallback();
    }
}

async function removeItem(index) {
    const cart = getCart();
    if (!cart[index]) return;

    const itemName = cart[index].name;
    const productId = cart[index].id;

    const cartItems = document.querySelectorAll('.cart-item');
    if (cartItems[index]) {
        cartItems[index].classList.add('item-removing');
        setTimeout(() => {
            performRemoveItem(index, itemName, productId);
        }, 400); // animation nhanh gọn
    } else {
        performRemoveItem(index, itemName, productId);
    }
}

// [CHANGE] Sau khi xoá → refresh preview theo phần chọn còn lại
async function performRemoveItem(index, itemName, productId) {
    const logged = isLoggedIn();

    if (!logged) {
        let cart = getCart();
        cart.splice(index, 1);
        saveCart(cart);
        cartCache = cart;

        renderCart(cart);

        try {
            if (window.cartCountShared && typeof window.cartCountShared.setFromCart === 'function') {
                window.cartCountShared.setFromCart(cart); // KHÔNG gộp gifts
            } else updateCartCount && updateCartCount();
        } catch (e) {
            console.warn('performRemoveItem local setFromCart failed:', e);
            updateCartCount && updateCartCount();
        }

        if (cart.length === 0) localStorage.removeItem('cartLocked');

        // NEW: cập nhật danh sách chọn và preview
        selectedItems = selectedItems.filter(id => String(id) !== String(productId));
        const selected = cart.filter(item => selectedItems.includes(item.id));
        localStorage.setItem('selectedCart', JSON.stringify(selected));
        await refreshGiftPreviewForSelection();

        showNotification(`Đã xóa "${itemName}" khỏi giỏ hàng`, 'success');
        return;
    }

    const cart = getCart();
    const toRemoveQty = (cart[index] && Number(cart[index].quantity)) || 1;
    try {
        try {
            if (window.cartCountShared && typeof window.cartCountShared.decrement === 'function') {
                window.cartCountShared.decrement(toRemoveQty);
            } else updateCartCount && updateCartCount();
        } catch (e) { console.warn('optimistic decrement failed:', e); }

        const res = await fetch(`${window.API_BASE}/api/cart/${productId}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        const data = await res.json();
        if (!data.success) {
            console.error('❌ Lỗi xoá sản phẩm trên server:', data.error);
            await _refreshCartCountFromSharedOrFallback();
            return;
        }

        const serverCart = data.cart || [];
        const gifts = data.gifts || [];
        saveCart(serverCart);
        setServerGifts(gifts);
        cartCache = serverCart;

        renderCart(serverCart);

        try {
            if (window.cartCountShared && typeof window.cartCountShared.setFromCart === 'function') {
                window.cartCountShared.setFromCart(serverCart); // KHÔNG gộp gifts
            } else updateCartCount && updateCartCount();
        } catch (e) {
            console.warn('performRemoveItem setFromCart failed:', e);
            updateCartCount && updateCartCount();
        }

        if (serverCart.length === 0) localStorage.removeItem('cartLocked');

        // NEW: cập nhật danh sách chọn và preview
        selectedItems = selectedItems.filter(id => String(id) !== String(productId));
        const selected = serverCart.filter(item => selectedItems.includes(item.id));
        localStorage.setItem('selectedCart', JSON.stringify(selected));
        await refreshGiftPreviewForSelection();

        showNotification(`Đã xóa "${itemName}" khỏi giỏ hàng`, 'success');
    } catch (err) {
        console.error('❌ Lỗi gọi API removeItem:', err);
        await _refreshCartCountFromSharedOrFallback();
    }
}

async function cleanupExpiredItems(expiryHours = 72) {
    const cart = getCart();
    const now = new Date();
    let hasExpired = false;

    const cleanedCart = cart.filter(item => {
        const addedAt = new Date(item.addedAt || now);
        const hoursDiff = (now - addedAt) / (1000 * 60 * 60);
        if (hoursDiff > expiryHours) {
            hasExpired = true;
            return false;
        }
        return true;
    });

    if (!hasExpired) return;

    // Tìm danh sách ID bị xoá do hết hạn
    const removedIds = cart
        .filter(oldItem => !cleanedCart.some(n => n.id === oldItem.id))
        .map(it => String(it.id));

    // Cập nhật local trước để UI nhanh
    saveCart(cleanedCart);
    renderCart();
    updateCartCount();
    console.log("Đã xóa các sản phẩm hết hạn từ giỏ hàng");

    // Đồng bộ với server nếu đã đăng nhập
    const logged = isLoggedIn();
    if (!logged) return;

    try {
        // Xoá các item hết hạn trên server (nếu có)
        if (removedIds.length) {
            await fetch(`${window.API_BASE}/api/cart/bulk-delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ ids: removedIds })
            });
        }

        // Đảm bảo số lượng cho các item còn lại (idempotent)
        await Promise.all(cleanedCart.map(item => fetch(`${window.API_BASE}/api/cart`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                id: item.id,
                name: item.name,
                originalPrice: item.originalPrice,
                salePrice: item.salePrice,
                discountPercent: item.discountPercent,
                image: item.image,
                quantity: item.quantity
            })
        }).catch(err => console.error('Lỗi đồng bộ sản phẩm:', err))));

        // Lấy lại giỏ authoritative và cập nhật gifts
        const res = await fetch(`${window.API_BASE}/api/cart`, { credentials: 'include' });
        const data = await res.json();
        if (data && data.success) {
            const serverCart = data.cart || [];
            const gifts = data.gifts || [];
            saveCart(serverCart);
            setServerGifts(gifts);
            cartCache = serverCart;

            try {
                if (window.cartCountShared && typeof window.cartCountShared.setFromCart === 'function') {
                    window.cartCountShared.setFromCart(serverCart); // KHÔNG gộp gifts
                } else {
                    updateCartCount && updateCartCount();
                }
            } catch (e) {
                console.warn('cleanupExpiredItems setFromCart failed:', e);
                updateCartCount && updateCartCount();
            }
            renderCart(serverCart);
        }
    } catch (err) {
        console.error('Lỗi cleanupExpiredItems sync server:', err);
    }
}

function getServerGifts() {
    try { return JSON.parse(localStorage.getItem('serverGifts') || '[]'); } catch { return []; }
}
function setServerGifts(gifts) {
    try { localStorage.setItem('serverGifts', JSON.stringify(Array.isArray(gifts) ? gifts : [])); } catch {}
}

// [CHANGE] renderCart: hiển thị thêm "Quà tặng dự kiến" + Summary theo phần chọn
function renderCart() {
    let raw = JSON.parse(localStorage.getItem('cart') || '[]');
    let migrated = false;
    raw.forEach(it => {
        if (it.price !== undefined && (it.salePrice === undefined || it.originalPrice === undefined)) {
            const p = parseInt(it.price) || 0;
            if (it.originalPrice === undefined) it.originalPrice = p;
            if (it.salePrice === undefined) it.salePrice = p;
            if (it.discountPercent === undefined) it.discountPercent = 0;
            migrated = true;
        }
    });

    const filtered = Array.isArray(raw) ? raw.filter(it => !it.isGift) : [];
    if (filtered.length !== raw.length || migrated) {
        localStorage.setItem('cart', JSON.stringify(filtered));
    }
    cartCache = filtered;

    const cartItemsContainer = document.getElementById('cart-items-container');
    if (!cartItemsContainer) return;

    cartItemsContainer.innerHTML = '';

    const emptyCart = document.getElementById('empty-cart');
    const proceedButton = document.getElementById('proceed-to-step-2');
    const clearCartBtn = document.getElementById('clear-cart');
    const continueBtn = document.getElementById('continue-shopping-btn');

    const cart = getCart();                     // sản phẩm thường
    const giftCart = getServerGifts();          // quà tính theo toàn giỏ (server)
    const previewGifts = getServerGiftsPreview(); // quà dự kiến theo phần đã chọn

    if ((cart.length === 0) && (giftCart.length === 0)) {
        if (emptyCart) emptyCart.classList.remove('d-none');
        cartItemsContainer.classList.add('d-none');
        const selectAllWrapper = document.querySelector('.select-all-wrapper');
        if (selectAllWrapper) selectAllWrapper.classList.add('d-none');
        const cartSummary = document.querySelector('.cart-summary');
        if (cartSummary) cartSummary.classList.add('d-none');
        if (proceedButton) proceedButton.classList.add('d-none');
        if (clearCartBtn) clearCartBtn.classList.add('d-none');
        if (continueBtn) continueBtn.classList.remove('d-none');
        updateCartSummary(0);
        return;
    }

    if (emptyCart) emptyCart.classList.add('d-none');
    if (proceedButton) proceedButton.classList.remove('d-none');
    if (clearCartBtn) clearCartBtn.classList.remove('d-none');
    if (continueBtn) continueBtn.classList.remove('d-none');

    let total = 0;
    let cartItemsHTML = '';

    cart.forEach((item, index) => {
        const itemTotal = item.salePrice * item.quantity;
        total += itemTotal;

        const minusDisabled = item.quantity <= 1 ? 'disabled' : '';

        cartItemsHTML += `
    <div class="cart-item normal-cart-item d-flex align-items-start p-3 mb-3 rounded position-relative" data-index="${index}">
        <input type="checkbox" class="form-check-input select-checkbox position-absolute" style="top: 10px; left: 10px;" onchange="handleSelectItem(this, ${index})">
        <img src="${item.image}" alt="${item.name}" class="cart-item__image me-3" style="width: 80px; height: 80px; object-fit: cover;">
        <div class="cart-item__info flex-grow-1">
            <h5 class="cart-item__name">${item.name}</h5>
            <div class="price-section">
                <span class="original-price me-2">${formatCurrency(item.originalPrice)}</span>
                <span class="sale-price">${formatCurrency(item.salePrice)}</span>
                <span class="discount-badge badge bg-danger ms-2">-${item.discountPercent !== undefined
            ? item.discountPercent
            : Math.round(100 - (item.salePrice / item.originalPrice * 100))
        }%</span>
            </div>
        </div>
        <div class="cart-item__quantity d-flex align-items-center">
            <button class="quantity-btn quantity-btn--decrease ${minusDisabled}" onclick="updateQuantity(${index}, -1)" ${minusDisabled ? 'disabled' : ''}><i class="fa fa-minus"></i></button>
            <input type="number" class="quantity-input" value="${item.quantity}" readonly>
            <button class="quantity-btn quantity-btn--increase" onclick="updateQuantity(${index}, 1)"><i class="fa fa-plus"></i></button>
        </div>
        <div class="cart-item__total ms-3" style="margin-top: 6px;">${formatCurrency(item.salePrice * item.quantity)}</div>
        <button class="cart-item__remove ms-3" onclick="removeItem(${index})"><i class="fa fa-trash"></i></button>
    </div>
    `;
    });

    // Khôi phục selectedItems từ localStorage cho phần chọn hiện tại
    const savedSelected = JSON.parse(localStorage.getItem('selectedCart') || '[]');
    selectedItems = savedSelected.filter(it => !it.isGift).map(item => item.id);

    const hasSelection = Array.isArray(selectedItems) && selectedItems.length > 0;
    const hasPreview = Array.isArray(previewGifts) && previewGifts.length > 0;
    const shouldShowServerGifts = !hasSelection || !hasPreview; // Ẩn giftCart nếu đã có preview theo phần chọn

    if (shouldShowServerGifts && giftCart.length) {
        // Quà server tính cho toàn giỏ (đơn cũ / toàn giỏ)
        cartItemsHTML += `<div class="gift-section mt-2 mb-2"><h5 class="mb-2">🎁 Quà tặng của bạn</h5>`;
        giftCart.forEach((g) => {
            const safeQty = parseInt(g.quantity) || 1;
            cartItemsHTML += `
    <div class="cart-item gift-cart-item d-flex align-items-start p-3 mb-3 rounded position-relative" data-gift-id="${g.id}">
        <img src="${g.image}" alt="${g.name}" class="cart-item__image me-3" style="width: 80px; height: 80px; object-fit: cover;">
        <div class="cart-item__info flex-grow-1">
            <h5 class="cart-item__name">${g.name}</h5>
            <div class="price-section">
                <span class="original-price me-2">${formatCurrency(g.originalPrice)}</span>
                <span class="sale-price">${formatCurrency(0)}</span>
                <span class="discount-badge badge bg-danger ms-2">-100%</span>
            </div>
        </div>
        <div class="cart-item__quantity d-flex align-items-center"><span class="gift-qty">x${safeQty}</span></div>
        <div class="cart-item__total ms-3" style="margin-top: 6px;">${formatCurrency(0)}</div>
    </div>`;
        });
        cartItemsHTML += `</div>`;
    }

    // Hiển thị preview theo phần chọn với tiêu đề động
    if (hasSelection && hasPreview) {
        const confirmed = isGiftPreviewConfirmed();
        const title = confirmed ? '🎁 Quà tặng của bạn' : '🔮 Quà tặng dự kiến cho bạn';
        cartItemsHTML += `<div class="gift-section mt-2 mb-2"><h5 class="mb-2">${title}</h5>`;
        previewGifts.forEach((g) => {
            const safeQty = parseInt(g.quantity) || 1;
            cartItemsHTML += `
    <div class="cart-item gift-preview-item d-flex align-items-start p-3 mb-3 rounded position-relative" data-gift-id="${g.id}">
        <img src="${g.image}" alt="${g.name}" class="cart-item__image me-3" style="width: 80px; height: 80px; object-fit: cover;">
        <div class="cart-item__info flex-grow-1">
            <h5 class="cart-item__name">${g.name}</h5>
            <div class="price-section">
                <span class="original-price me-2">${formatCurrency(g.originalPrice)}</span>
                <span class="sale-price">${formatCurrency(0)}</span>
                <span class="discount-badge badge bg-danger ms-2">-100%</span>
            </div>
        </div>
        <div class="cart-item__quantity d-flex align-items-center"><span class="gift-qty">x${safeQty}</span></div>
        <div class="cart-item__total ms-3" style="margin-top: 6px;">${formatCurrency(0)}</div>
    </div>`;
        });
        cartItemsHTML += `</div>`;
    }

    cartItemsContainer.innerHTML = cartItemsHTML;

    // Đánh dấu lại checkbox theo selectedItems
    document.querySelectorAll('.normal-cart-item').forEach((itemDiv, index) => {
        const item = cart[index];
        const checkbox = itemDiv.querySelector('.select-checkbox');
        if (checkbox && selectedItems.includes(item.id)) {
            checkbox.checked = true;
            itemDiv.classList.add('selected-item');
        }
    });

    // Summary: nếu có phần chọn → dùng tổng phần chọn; nếu không → tổng toàn giỏ
    if (Array.isArray(selectedItems) && selectedItems.length) {
        const set = new Set(selectedItems.map(String));
        const selectedTotal = cart.filter(it => set.has(String(it.id)))
            .reduce((s, it) => s + (Number(it.salePrice) || 0) * (Number(it.quantity) || 1), 0);
        updateCartSummary(selectedTotal);
    } else {
        updateCartSummary(total);
    }

    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    if (selectAllCheckbox) {
        const allChecked = cart.length > 0 && cart.every(item => selectedItems.includes(item.id));
        selectAllCheckbox.checked = allChecked;
    }
}

function updateCartSummary(total) {
    const summaryRows = document.querySelectorAll('.cart-summary__rows .currency-value');
    const shippingFee = total >= 500000 ? 0 : 30000;
    if (summaryRows.length >= 3) {
        summaryRows[0].textContent = formatCurrency(total);
        summaryRows[1].textContent = shippingFee === 0 ? 'Miễn phí' : formatCurrency(shippingFee);
        summaryRows[2].textContent = formatCurrency(total + shippingFee);
    }
}

let provinceDataCheckout = null;
let provinceListenerAttachedCheckout = false;

async function loadProvinceDataCheckout() {
    if (provinceDataCheckout) return provinceDataCheckout;
    try {
        const res = await fetch("/FormText/danhmucxaphuong.json");
        provinceDataCheckout = await res.json();
        return provinceDataCheckout;
    } catch (err) {
        console.error("Lỗi load danh mục tỉnh/xã:", err);
        provinceDataCheckout = [];
        return provinceDataCheckout;
    }
}

async function populateProvinceWardCheckout(preProvince = "", preWard = "") {
    await loadProvinceDataCheckout();
    const provinceEl = document.getElementById("province");
    const wardEl = document.getElementById("ward");
    if (!provinceEl || !wardEl) return;

    provinceEl.innerHTML = `<option value="">-- Chọn Tỉnh/Thành phố --</option>`;
    wardEl.innerHTML = `<option value="">-- Chọn Xã/Phường --</option>`;

    provinceDataCheckout
        .slice()
        .sort((a,b) => a.tentinhmoi.localeCompare(b.tentinhmoi, 'vi'))
        .forEach(p => {
            const opt = document.createElement("option");
            opt.value = p.tentinhmoi;
            opt.textContent = p.tentinhmoi;
            provinceEl.appendChild(opt);
        });

    const getWards = (provinceName) => {
        const province = provinceDataCheckout.find(p => p.tentinhmoi === provinceName);
        if (!province || !province.phuongxa) return [];
        return province.phuongxa
            .map(x => x.tenphuongxa)
            .sort((a,b) => a.localeCompare(b, 'vi'));
    };

    if (!provinceListenerAttachedCheckout) {
        provinceEl.addEventListener("change", () => {
            wardEl.innerHTML = `<option value="">-- Chọn Xã/Phường --</option>`;
            const wards = getWards(provinceEl.value);
            wards.forEach(w => {
                const opt = document.createElement("option");
                opt.value = w;
                opt.textContent = w;
                wardEl.appendChild(opt);
            });
        });
        provinceListenerAttachedCheckout = true;
    }

    if (preProvince) {
        provinceEl.value = preProvince;
        provinceEl.dispatchEvent(new Event("change"));
        if (preWard) {
            setTimeout(() => { wardEl.value = preWard; }, 0);
        }
    }
}

function loadDeliveryInfo() {
    const delivery = JSON.parse(localStorage.getItem('deliveryInfo')) || {};

    const fullNameEl = document.getElementById('recipient-name');
    const phoneEl = document.getElementById('recipient-phone');
    const addressEl = document.getElementById('recipient-address');
    const provinceEl = document.getElementById('province');
    const wardEl = document.getElementById('ward');
    const noteEl = document.getElementById('note');
    const invoiceCheckbox = document.getElementById('invoice-required');

    if (fullNameEl) fullNameEl.value = delivery.name || '';
    if (phoneEl) phoneEl.value = delivery.phone || '';
    if (addressEl) addressEl.value = delivery.address || '';
    if (provinceEl) provinceEl.value = delivery.province || '';
    if (wardEl) wardEl.value = delivery.ward || '';
    if (noteEl) noteEl.value = delivery.note || '';
    if (invoiceCheckbox) {
        invoiceCheckbox.checked = delivery.invoiceRequired !== undefined ? delivery.invoiceRequired : true;
    }

}

function saveDeliveryInfo() {
    const deliveryMode = document.querySelector('input[name="deliveryMode"]:checked')?.value || "custom";
    let deliveryInfo = {};

    if (deliveryMode === "profile") {
        const selectedId = document.querySelector('input[name="profile-address"]:checked')?.value;
        if (!selectedId) {
            showNotification("❌ Vui lòng chọn một địa chỉ giao hàng!", "error");
            return;
        }

        const addr = addressesCache.find(a => a.id == selectedId);
        if (!addr) {
            showNotification("❌ Không tìm thấy địa chỉ đã chọn!", "error");
            return;
        }

        deliveryInfo = {
            mode: "profile",
            name: addr.recipient_name,
            phone: addr.recipient_phone,
            province: addr.city || "",
            ward: addr.ward || "",
            address: addr.street_address || "",
            note: document.getElementById("note").value.trim(),
            invoiceRequired: document.getElementById("invoice-required").checked
        };
    }
    else {
        // Nếu chọn nhập thủ công ("Thông tin khác")
        const provinceSelect = document.getElementById("province");
        const wardSelect = document.getElementById("ward");

        deliveryInfo = {
            mode: "form",
            name: document.getElementById("recipient-name").value.trim(),
            phone: document.getElementById("recipient-phone").value.trim(),
            province: provinceSelect.selectedOptions[0]?.textContent || "",
            ward: wardSelect.selectedOptions[0]?.textContent || "",
            address: document.getElementById("recipient-address").value.trim(),
            note: document.getElementById("note").value.trim(),
            invoiceRequired: document.getElementById("invoice-required").checked
        };
    }

    localStorage.setItem("deliveryInfo", JSON.stringify(deliveryInfo));
    window.deliveryInfo = deliveryInfo; // gán global để render summary dùng
}

function validateDeliveryInfo() {
    // Kiểm tra chế độ hiện tại
    const deliveryMode = document.querySelector('input[name="deliveryMode"]:checked')?.value || "custom";

    if (deliveryMode === "profile") {
        if (!addressesCache || !addressesCache.length) {
            showNotification('❌ Bạn chưa có địa chỉ trong sổ địa chỉ!', 'error');
            return false;
        }
        const selectedId = document.querySelector('input[name="profile-address"]:checked')?.value;
        if (!selectedId) {
            showNotification('❌ Vui lòng chọn một địa chỉ!', 'error');
            return false;
        }
        return true;
    }

    // === Nếu là "Thông tin khác" → kiểm tra form như trước ===
    const nameEl = document.getElementById('recipient-name');
    const phoneEl = document.getElementById('recipient-phone');
    const provinceEl = document.getElementById('province');
    const wardEl = document.getElementById('ward');
    const addressEl = document.getElementById('recipient-address');

    [nameEl, phoneEl, provinceEl, wardEl, addressEl].forEach(el => el.classList.remove('input-invalid'));

    let isValid = true;

    if (!nameEl.value.trim()) {
        nameEl.classList.add('input-invalid');
        isValid = false;
    }

    const phone = phoneEl.value.trim();
    const phoneRegex = /^0\d{9}$/;
    if (!phone || !phoneRegex.test(phone)) {
        phoneEl.classList.add('input-invalid');
        isValid = false;
    }

    if (!provinceEl.value) {
        provinceEl.classList.add('input-invalid');
        isValid = false;
    }

    if (!wardEl.value) {
        wardEl.classList.add('input-invalid');
        isValid = false;
    }

    if (!addressEl.value.trim()) {
        addressEl.classList.add('input-invalid');
        isValid = false;
    }

    if (!isValid) {
        showNotification('Vui lòng điền đầy đủ thông tin giao hàng hợp lệ!', 'error');
    }

    return isValid;
}

async function loadAndRenderProfileAddresses() {
    try {
        const res = await fetch(`${window.API_BASE}/api/addresses`, { credentials: "include" });
        const data = await res.json();

        const container = document.getElementById("profile-addresses-list");
        if (!container) {
            console.warn("⚠️ Không tìm thấy #profile-addresses-list trong DOM");
            return;
        }

        if (!data.success || !data.addresses.length) {
            container.innerHTML = `<p class="text-danger">❌ Bạn chưa có địa chỉ nào trong sổ địa chỉ!</p>`;
            window.addressesCache = [];
            return;
        }

        // sắp xếp mặc định lên đầu
        const sorted = data.addresses.slice().sort((a, b) => b.is_default - a.is_default);
        window.addressesCache = sorted;

        container.innerHTML = sorted.map(addr => `
            <div class="form-check address-card">
                <input type="radio" 
                       name="profile-address" 
                       id="profile-address-${addr.id}" 
                       value="${addr.id}" 
                       class="form-check-input position-absolute top-0 start-0 m-2"
                       ${addr.is_default ? "checked" : ""}>
                ${addr.is_default ? `<span class="badge-default">Mặc định</span>` : ""}
                <label for="profile-address-${addr.id}" class="form-check-label d-block mt-4">
                    <div><strong>Người nhận:</strong> ${addr.recipient_name}</div>
                    <div><strong>SĐT:</strong> ${addr.recipient_phone}</div>
                    <div><strong>Địa chỉ:</strong> ${addr.street_address}, ${addr.ward || ""}, ${addr.city || ""}</div>
                </label>
            </div>
        `).join("");
    } catch (err) {
        console.error("❌ Lỗi loadAndRenderProfileAddresses:", err);
    }
}


// [CHANGE] Step 3 hiển thị thêm “Quà tặng dự kiến”
function renderOrderSummary() {
    const cart = JSON.parse(localStorage.getItem('selectedCart')) || [];
    const orderSummary = document.getElementById('order-summary');

    if (cart.length === 0) {
        orderSummary.innerHTML = '<p>Giỏ hàng trống.</p>';
        document.getElementById('payment-btn').disabled = true;
        return;
    }

    let productsHTML = '';
    let total = 0;

    cart.forEach(item => {
        const itemTotal = item.salePrice * item.quantity;
        total += itemTotal;
        productsHTML += `
            <div class="order-product d-flex align-items-center p-3 mb-2 rounded">
                <img src="${item.image}" alt="${item.name}" class="me-3" style="width: 60px; height: 60px; object-fit: cover; background: white">
                <div class="order-product-info flex-grow-1">
                    <h5 class="order-product-name">${item.name} (x${item.quantity})</h5>
                    <div class="price-section">
                        <span class="original-price me-2">${formatCurrency(item.originalPrice)}</span>
                        <span class="sale-price">${formatCurrency(item.salePrice)}</span>
                        <span class="discount-badge badge bg-danger ms-2">
                          -${item.discountPercent !== undefined
            ? item.discountPercent
            : Math.round(100 - (item.salePrice / item.originalPrice * 100))
        }%
                        </span>
                    </div>
                </div>
            </div>
        `;
    });

    const previewGifts = getServerGiftsPreview();
    let giftsHTML = '';
    if (Array.isArray(previewGifts) && previewGifts.length) {
        const confirmed = isGiftPreviewConfirmed();
        const title = confirmed ? '🎁 Quà tặng của bạn' : '🔮 Quà tặng dự kiến cho bạn';
        giftsHTML = `
            <div class="order-gifts mt-3">
                <h5>${title}</h5>
                ${previewGifts.map(g => `
                    <div class="order-product d-flex align-items-center p-2 mb-2 rounded">
                        <img src="${g.image}" alt="${g.name}" class="me-3" style="width: 48px; height: 48px; object-fit: cover; background: white">
                        <div class="order-product-info flex-grow-1">
                            <h6 class="order-product-name">${g.name} (x${parseInt(g.quantity) || 1})</h6>
                            <div class="price-section">
                                <span class="original-price me-2">${formatCurrency(g.originalPrice)}</span>
                                <span class="sale-price">${formatCurrency(0)}</span>
                                <span class="discount-badge badge bg-danger ms-2">-100%</span>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    orderSummary.innerHTML = `
        ${productsHTML}
        ${giftsHTML}
        <div class="order-total mt-3">Tổng cộng: ${formatCurrency(total)}</div>
    `;
}

function renderDeliverySummary() {
    const summary = document.getElementById("delivery-summary");
    const info = window.deliveryInfo || JSON.parse(localStorage.getItem("deliveryInfo")) || null;

    if (!info) {
        summary.innerHTML = `<p class="text-danger">Chưa có thông tin giao hàng!</p>`;
        return;
    }

    summary.innerHTML = `
        <p><strong>Họ và tên:</strong> ${info.name || "-"}</p>
        <p><strong>Số điện thoại:</strong> ${info.phone || "-"}</p>
        <p><strong>Địa chỉ:</strong> ${info.address || ""}, ${info.ward || ""}, ${info.province || ""}</p>
        ${info.note ? `<p><strong>Ghi chú:</strong> ${info.note}</p>` : ""}
        <p><strong>Xuất hóa đơn:</strong> ${info.invoiceRequired ? "Có" : "Không"}</p>
    `;
}



function showConfirmation() {
    if (!validateDeliveryInfo()) {
        return;
    }

    saveDeliveryInfo(); // lưu vào localStorage trước
    const cart = JSON.parse(localStorage.getItem('selectedCart')) || [];
    if (cart.length === 0) {
        showNotification('Không có sản phẩm nào được chọn!', 'error');
        showStep(1);
        return;
    }

    const selectedMethodEl = document.querySelector('input[name="payment-method"]:checked');
    if (!selectedMethodEl) {
        showNotification('Vui lòng chọn phương thức thanh toán!', 'error');
        return;
    }
    const selectedMethodRaw = selectedMethodEl.value || 'cod';
    const methodKey = String(selectedMethodRaw).toLowerCase();
    const methodTextMap = {
        cod: 'Thanh toán khi nhận hàng (COD)'
    };
    const methodText = methodTextMap[methodKey] || selectedMethodRaw;

    const total = cart.reduce((sum, item) => sum + item.salePrice * item.quantity, 0);

    // 🔑 Lấy thông tin giao hàng mới nhất
    const info = getDeliveryInfo();

    document.getElementById('modal-summary').innerHTML = `
        <p><strong>Tổng tiền:</strong> ${formatCurrency(total)}</p>
        <p><strong>Phương thức thanh toán:</strong> ${methodText}</p>
        <p><strong>Họ và tên:</strong> ${info.name}</p>
        <p><strong>Địa chỉ:</strong> ${info.address}, ${info.ward}, ${info.province}</p>
        ${info.note ? `<p><strong>Ghi chú:</strong> ${info.note}</p>` : ''}
        <p><strong>Yêu cầu xuất hóa đơn:</strong> ${info.invoiceRequired ? 'Có' : 'Không'}</p>
    `;

    const modal = new bootstrap.Modal(document.getElementById('confirmation-modal'));
    modal.show();
}


function closeModal() {
    const modalEl = document.getElementById('confirmation-modal');
    const modal = bootstrap.Modal.getInstance(modalEl);

    if (modal) {
        modal.hide();
    }

    setTimeout(() => {
        const backdrop = document.querySelector('.modal-backdrop');
        if (backdrop) backdrop.remove();

        document.body.classList.remove('modal-open');
        document.body.style.overflow = 'auto';
        document.body.style.paddingRight = '';
    }, 500);
}

function showSuccessModal() {
    const modal = new bootstrap.Modal(document.getElementById('success-modal'));
    modal.show();

    confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
    });

    lottie.loadAnimation({
        container: document.getElementById('success-lottie'),
        renderer: 'svg',
        loop: false,
        autoplay: true,
        path: '/transformanimation/successful.json'
    });
}

function goToLookup() {
    window.location.href = 'resetlookup.html';
}

// Hàm chuẩn hoá dữ liệu giỏ hàng trước khi gửi server
function sanitizeCart(cart) {
    return cart.map(item => {
        let cleanItem = { ...item };

        // Ép kiểu số
        cleanItem.originalPrice = Number(cleanItem.originalPrice) || 0;
        cleanItem.salePrice = Number(cleanItem.salePrice) || 0;
        cleanItem.quantity = Number(cleanItem.quantity) || 1;

        // Chuẩn hoá image → luôn là string URL
        if (typeof cleanItem.image === "object" && cleanItem.image !== null) {
            cleanItem.image = cleanItem.image.src || "";
        } else if (typeof cleanItem.image !== "string") {
            cleanItem.image = "";
        }

        // Xoá các field undefined (Postgres jsonb không nhận undefined)
        Object.keys(cleanItem).forEach(k => {
            if (cleanItem[k] === undefined) delete cleanItem[k];
        });

        return cleanItem;
    });
}

async function processPayment() {
    // Đóng modal thanh toán
    closeModal();

    const loadingModal = new bootstrap.Modal(document.getElementById("loading-overlay"));
    loadingModal.show();

    try {
        lottie.loadAnimation({
            container: document.getElementById("loading-lottie"),
            renderer: "svg",
            loop: true,
            autoplay: true,
            path: "/transformanimation/processpayment.json"
        });
    } catch (error) {
        console.error("⚠️ Lỗi khi tải Lottie animation:", error);
    }

    setTimeout(async () => {
        try {
            let selectedCart = JSON.parse(localStorage.getItem("selectedCart")) || [];

            if (selectedCart.length === 0) {
                loadingModal.hide();
                showNotification("❌ Bạn chưa chọn sản phẩm nào để thanh toán!", "error");
                return;
            }

            // Chuẩn hoá dữ liệu
            selectedCart = selectedCart.map(it => (typeof it === "string" ? JSON.parse(it) : it));
            selectedCart = sanitizeCart(selectedCart);

            const selectedMethod =
                document.querySelector('input[name="payment-method"]:checked')?.value || "COD";
            const deliveryInfo = getDeliveryInfo();
            const total = selectedCart.reduce((sum, item) => sum + item.salePrice * item.quantity, 0);

            // Tính group/setCount từ selectedCart để quyết định gửi comboRequiredIds
            const { group, setCount } = findMatchedGroupAndSetCount(selectedCart);
            const payload = {
                items: selectedCart,
                total,
                paymentMethod: selectedMethod,
                deliveryInfo
            };
            if (group && setCount > 0) {
                payload.comboRequiredIds = group.requiredIds;
            }

            // 1) Tạo đơn
            const res = await fetch(`${window.API_BASE}/api/orders`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (!res.ok || !data.success) {
                console.error("❌ Lỗi khi tạo đơn:", data.error || data.message);
                showNotification("Không thể tạo đơn hàng. Vui lòng thử lại!", "error");
                loadingModal.hide();
                return;
            }

            // 2) Xoá item đã mua khỏi giỏ (server đã xoá có chọn lọc trong /api/orders, gọi lại để an toàn)
            try {
                const idsToRemove = selectedCart.map(item => item.id);
                await fetch(`${window.API_BASE}/api/cart/bulk-delete`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ ids: idsToRemove })
                });
            } catch (err) {
                console.warn("⚠️ Không xoá được sản phẩm đã thanh toán:", err);
            }

            // 3) Đồng bộ lại giỏ hàng còn lại + gifts từ server (authoritative)
            try {
                const cartRes = await fetch(`${window.API_BASE}/api/cart`, { credentials: "include" });
                const updated = await cartRes.json();
                if (updated && updated.success) {
                    const serverCart = updated.cart || [];
                    const gifts = updated.gifts || [];
                    saveCart(serverCart);
                    setServerGifts(gifts);
                    cartCache = serverCart;
                }
            } catch (err) {
                console.error("⚠️ Không thể đồng bộ giỏ hàng sau thanh toán:", err);
            }

            // 4) Dọn localStorage: chỉ xoá danh sách đã chọn; giữ serverGifts
            localStorage.removeItem("selectedCart");
            // Reset cờ preview confirmed
            localStorage.removeItem("giftPreviewConfirmed");

            // Giữ lại note & invoiceRequired cho lần sau
            const savedInfo = {
                note: deliveryInfo?.note || "",
                invoiceRequired: deliveryInfo?.invoiceRequired || false
            };
            localStorage.setItem("deliveryInfo", JSON.stringify(savedInfo));

            // 5) Cập nhật UI
            updateCartCount();
            renderCart();
            updateOrderCount();

            // 6) Hoàn tất
            loadingModal.hide();
            showSuccessModal();
        } catch (err) {
            console.error("❌ Lỗi processPayment:", err);
            showNotification("Có lỗi xảy ra khi xử lý thanh toán!", "error");
            loadingModal.hide();
        }
    }, 2000);
}

function formatCurrency(amount) {
    if (typeof amount === 'string') {
        amount = parseFloat(amount.replace(/[^\d.-]/g, ''));
    }
    if (typeof amount !== 'number' || isNaN(amount) || amount === undefined || amount === null) return '0₫';
    return amount.toLocaleString('vi-VN') + '₫';
}

function setupPaymentMethodAnimations() {
    const animations = [
        { containerId: 'lottie-cod', path: '/transformanimation/cod.json' }
    ];

    animations.forEach(animation => {
        lottie.loadAnimation({
            container: document.getElementById(animation.containerId),
            renderer: 'svg',
            loop: true,
            autoplay: true,
            path: animation.path
        });
    });
}

document.addEventListener("DOMContentLoaded", async function () {
    // Always render checkout page (no auth gate here)
    initializeCartSystem();

    loadPagePart("HTML/Layout/resetheader.html", "#header-container", () => {
        initHeader();
        const checkDomReady = () => {
            const loginBtn = document.getElementById('loginBtn');
            const popup = document.querySelector('.popup');
            if (!loginBtn || !popup) {
                setTimeout(checkDomReady, 100);
                return;
            }
            if (typeof initializeUser === 'function') {
                console.log('Calling initializeUser on checkout...');
                initializeUser();
            }
        };
        checkDomReady();
    });

    loadPagePart("HTML/Layout/resetfooter.html", "#footer-container", () => {
        if (typeof initFooter === 'function') initFooter();
    });

    // Events
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', () => {
            const checked = selectAllCheckbox.checked;
            handleSelectAllToggle(checked);
        });
    }

    loadDeliveryInfo();
    populateProvinceWardCheckout();
    setupPaymentMethodAnimations();

    document.querySelectorAll('.method-option').forEach(option => {
        option.addEventListener('click', () => selectMethod(option.dataset.method));
    });

    const proceedStep2Btn = document.getElementById('proceed-to-step-2');
    if (proceedStep2Btn) {
        proceedStep2Btn.addEventListener('click', () => {
            const cart = getCart();
            const selected = cart.filter(item => selectedItems.includes(item.id));

            if (selected.length === 0) {
                showNotification('Vui lòng chọn ít nhất một sản phẩm để tiếp tục!', 'error');
                return;
            }

            // KHÔNG gộp quà; server sẽ tự chèn dựa trên tổng tiền khi tạo đơn
            localStorage.setItem('selectedCart', JSON.stringify(selected));
            showStep(2);
        });
    }

    const proceedStep3Btn = document.getElementById('proceed-to-step-3');
    if (proceedStep3Btn) {
        proceedStep3Btn.addEventListener('click', async () => { // NEW: async
            if (!validateDeliveryInfo()) return;

            const agreeCheckbox = document.getElementById('agree-terms');
            if (!agreeCheckbox || !agreeCheckbox.checked) {
                const mustAgreeModal = new bootstrap.Modal(document.getElementById('must-agree-modal'));
                mustAgreeModal.show();
                return;
            }

            // NEW: đảm bảo preview quà của phần chọn được cập nhật trước khi render Step 3
            await refreshGiftPreviewForSelection();
            saveDeliveryInfo();
            renderOrderSummary();
            renderDeliverySummary();
            showStep(3);
        });
    }

    const clearCartBtn = document.getElementById('clear-cart');
    if (clearCartBtn) clearCartBtn.addEventListener('click', clearCart);

    const paymentBtn = document.getElementById('payment-btn');
    if (paymentBtn) paymentBtn.addEventListener('click', showConfirmation);

    const termsLink = document.getElementById('terms-link');
    if (termsLink) {
        termsLink.addEventListener('click', () => {
            const termsModal = new bootstrap.Modal(document.getElementById('terms-modal'));
            termsModal.show();
        });
    }

    lottie.loadAnimation({
        container: document.getElementById('empty-cart-lottie'),
        renderer: 'svg',
        loop: true,
        autoplay: true,
        path: '/transformanimation/emptycart.json'
    });

    // Step 2: Delivery mode
    const profileBox = document.getElementById("profile-delivery-box");
    const formBox = document.getElementById("custom-delivery-form");

    await loadAndRenderProfileAddresses();
    document.querySelectorAll('input[name="deliveryMode"]').forEach(input => {
        input.addEventListener("change", e => {
            if (e.target.value === "profile") {
                profileBox.style.display = "block";
                formBox.style.display = "none";
                loadAndRenderProfileAddresses();
            } else {
                profileBox.style.display = "none";
                formBox.style.display = "block";
            }
        });
    });

    // Default to "Của bạn"
    const defaultRadio = document.querySelector("input[name='deliveryMode'][value='profile']");
    if (defaultRadio) {
        defaultRadio.checked = true;
        profileBox.style.display = "block";
        formBox.style.display = "none";
    }
});

if (window.AuthSync && typeof window.AuthSync.onChange === 'function') {
    window.AuthSync.onChange((state) => {
        try {
            if (state && state.loggedIn) {
                // Đăng nhập: đồng bộ lại giỏ hàng từ server
                initializeCartSystem().catch(e => console.warn('initCart after auth change failed', e));
            } else {
                // Đăng xuất: giữ nguyên trang checkout hiển thị, render theo local cart
                renderCart();
                if (typeof updateCartCount === 'function') updateCartCount();
                if (typeof updateOrderCount === 'function') updateOrderCount();
                // KHÔNG ẩn .checkout-container, KHÔNG mở modal ở đây
            }
        } catch (err) {
            console.warn('AuthSync.onChange handler error (checkout):', err);
        }
    });
}

function selectMethod(method) {
    document.querySelectorAll('.method-option').forEach(opt => opt.classList.remove('selected', 'cod'));
    const selected = document.querySelector(`.method-option[data-method="${method}"]`);
    if (selected) {
        selected.classList.add('selected', method);
        selected.querySelector('input').checked = true;
    }
}

// Lấy thông tin giao hàng (Step 2) để hiển thị Step 3
function getDeliveryInfo() {
    const mode = document.querySelector('input[name="deliveryMode"]:checked')?.value || "custom";
    let info = {};
    if (mode === "profile") {
        const selectedId = document.querySelector('input[name="profile-address"]:checked')?.value;
        const addr = addressesCache.find(a => a.id == selectedId);
        if (addr) {
            info = {
                mode: "profile",
                name: addr.recipient_name,
                phone: addr.recipient_phone,
                address: addr.street_address,
                ward: addr.ward || "",
                province: addr.city || "",
                note: document.getElementById("note")?.value.trim() || "",
                invoiceRequired: document.getElementById("invoice-required")?.checked ?? true
            };
        }
    }
    else {
        // lấy từ form nhập tay
        const form = document.getElementById("custom-delivery-form");
        if (form) {
            const provinceSelect = form.querySelector("#province");
            const wardSelect = form.querySelector("#ward");

            info = {
                mode: "form",
                name: form.querySelector("#recipient-name")?.value.trim(),
                phone: form.querySelector("#recipient-phone")?.value.trim(),
                address: form.querySelector("#recipient-address")?.value.trim(),
                ward: wardSelect?.selectedOptions[0]?.textContent || "",
                province: provinceSelect?.selectedOptions[0]?.textContent || "",
                note: document.getElementById("note")?.value.trim() || "",
                invoiceRequired: document.getElementById("invoice-required")?.checked ?? true

            };
        }
    }
    return info;
}

window.addEventListener('storage', function (e) {
    try {
        if (!e || !e.key) return;

        if (e.key === 'cart' || e.key === 'serverGifts' || e.key === 'serverGiftsPreview') { // NEW: serverGiftsPreview
            refreshCartCache();
            try {
                const cartOnly = JSON.parse(localStorage.getItem('cart') || '[]');
                if (window.cartCountShared && typeof window.cartCountShared.setFromCart === 'function') {
                    window.cartCountShared.setFromCart(cartOnly); // KHÔNG gộp gifts
                } else {
                    updateCartCount && updateCartCount();
                }
            } catch (err) {
                console.warn('storage handler setFromCart err:', err);
                updateCartCount && updateCartCount();
            }
            try { renderCart(); } catch (err) {}
        }

        if (e.key === 'orders') {
            updateOrderCount && updateOrderCount();
        }
    } catch (err) {
        console.warn('storage listener error:', err);
    }
});

window.addEventListener('scroll', function() {
    const cartHeader = document.querySelector('.cart-header');
    if (cartHeader) {
        if (window.scrollY > 20) {
            cartHeader.classList.add('header-shadow');
        } else {
            cartHeader.classList.remove('header-shadow');
        }
    }
});