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

async function ensureSessionSynced() {
    // Trả về object: { loggedIn: boolean, data: <payload|null> }
    try {
        if (window.fnAuth && typeof window.fnAuth.processAfterLoginNoReload === 'function') {
            try {
                const data = await window.fnAuth.processAfterLoginNoReload();
                return { loggedIn: !!(data && data.user), data };
            } catch (err) {
                // Nếu session-sync thất bại, thử checkLoginStatus nếu có
                console.warn('session-sync failed, fallback to checkLoginStatus:', err);
                if (window.fnAuth && typeof window.fnAuth.checkLoginStatus === 'function') {
                    const me = await window.fnAuth.checkLoginStatus();
                    return { loggedIn: !!(me && me.loggedIn), data: me };
                }
            }
        }

        // Không có window.fnAuth hoặc tất cả fallback đều lỗi → dùng local / /api/me trực tiếp
        if (typeof checkLoginStatus === 'function') {
            const me2 = await checkLoginStatus();
            return { loggedIn: !!(me2 && me2.loggedIn), data: me2 };
        } else {
            // Fallback network call
            const res = await fetch(`${window.API_BASE}/api/me`, { credentials: 'include' });
            const me3 = await res.json();
            return { loggedIn: !!(me3 && me3.loggedIn), data: me3 };
        }
    } catch (err) {
        console.error('ensureSessionSynced error:', err);
        // Không chắc được trạng thái → return loggedIn false (an toàn)
        return { loggedIn: false, data: null };
    }
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

async function initializeCartSystem() {
    // Đồng bộ session (atomic) nếu có → đảm bảo cookie + server state đã sẵn sàng
    const session = await ensureSessionSynced();
    const isLoggedIn = !!session.loggedIn;

    if (isLoggedIn) {
        try {
            // Nếu có pendingCartItem (đã thêm khi chưa login) → sync ngay (server đã sẵn sàng)
            const pending = localStorage.getItem('pendingCartItem');
            if (pending) {
                const item = JSON.parse(pending);
                // addToCart đã xử lý trường hợp login: server POST
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

            // Nếu processAfterLoginNoReload đã trả về cart (atomic), dùng ngay để tránh gọi 2 lần
            let serverCart = null;
            if (session.data && session.data.cart && Array.isArray(session.data.cart)) {
                serverCart = session.data.cart;
            }

            // Nếu không có cart trong payload, gọi /api/cart
            if (!serverCart) {
                try {
                    const res = await fetch(`${window.API_BASE}/api/cart`, {
                        method: 'GET',
                        credentials: 'include'
                    });
                    const data = await res.json();
                    if (data.success) serverCart = data.cart || [];
                    else {
                        console.warn('⚠️ API trả về lỗi khi lấy giỏ hàng:', data.error);
                        serverCart = [];
                    }
                } catch (err) {
                    console.error('❌ Lỗi khi lấy giỏ hàng từ server:', err);
                    serverCart = [];
                }
            }

            // Server là nguồn chính → cache vào local
            try {
                localStorage.setItem('cart', JSON.stringify(serverCart));
            } catch (e) { /* ignore quota errors */ }
            cartCache = serverCart;

            updateCartCount();
            updateOrderCount();
            if (document.getElementById('cart-items-container')) {
                renderCart(serverCart);
            }
        } catch (err) {
            console.error('❌ Lỗi trong initializeCartSystem (login flow):', err);
        }
    } else {
        // Nếu chưa login → chỉ dùng local
        const localCart = JSON.parse(localStorage.getItem('cart')) || [];
        cartCache = localCart;

        updateCartCount();
        updateOrderCount();
        if (document.getElementById('cart-items-container')) {
            renderCart(localCart);
        }
    }

    // Gắn sự kiện cho nút "Mua ngay"
    document.querySelectorAll('.buy-button').forEach(button => {
        button.addEventListener('click', async function () {
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

            // Giá gốc & sale
            const originalPriceText = productCard.querySelector('.original-price')?.textContent || '0';
            const salePriceText = productCard.querySelector('.sale-price')?.textContent || originalPriceText;
            const originalPrice = parseInt(originalPriceText.replace(/\D/g, '')) || 0;
            const salePrice = parseInt(salePriceText.replace(/\D/g, '')) || originalPrice;

            // % giảm
            const discountPercentText = productCard.querySelector('.discount-badge')?.textContent || '0%';
            const discountPercent = parseInt(discountPercentText.replace(/[^0-9]/g, '')) || 0;

            const productImage = productCard.querySelector('.product-image img')?.src || '';

            // Lấy trạng thái login tươi (tránh stale localStorage)
            const sessionNow = await ensureSessionSynced();
            const nowLoggedIn = !!sessionNow.loggedIn;

            if (!nowLoggedIn) {
                // Nếu chưa login → lưu pending
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

            // Đã login → thêm thẳng vào server
            await addToCart(productId, productName, originalPrice, salePrice, discountPercent, productImage);
            showNotification(`Đã thêm "${productName}" vào giỏ hàng!`, 'success');
        });
    });

    // Tạo element notification nếu chưa có
    if (!document.getElementById('notification')) {
        createNotificationElement();
    }

    // Xoá sản phẩm hết hạn (local only)
    cleanupExpiredItems();
}




let cartCache = null;
let selectedItems = [];

function getGiftCart() {
    return (JSON.parse(localStorage.getItem('giftCart')) || []).map(g => ({
        ...g,
        quantity: parseInt(g.quantity) || 1
    }));
}

function saveGiftCart(giftCart) {
    localStorage.setItem('giftCart', JSON.stringify(giftCart));
}

function addGiftToCart(gift) {
    const gifts = getGiftCart();
    if (gifts.some(g => g.id === gift.id)) return;
    const orig = typeof gift.originalPrice === 'string' ? parseInt(gift.originalPrice.replace(/\D/g, '')) || 0 : (gift.originalPrice || 0);
    const giftItem = {
        id: gift.id,
        name: gift.name,
        image: gift.image,
        originalPrice: orig,
        salePrice: 0,
        discountPercent: 100,
        quantity: 1,
        isGift: true,
        addedAt: new Date().toISOString()
    };
    gifts.push(giftItem);
    saveGiftCart(gifts);

    let selected = JSON.parse(localStorage.getItem('selectedCart')) || [];
    if (!selected.some(i => i.id === giftItem.id)) {
        selected.push(giftItem);
        localStorage.setItem('selectedCart', JSON.stringify(selected));
    }

    updateCartCount();
    renderCart();
}

function removeGiftFromCart(giftId) {
    let gifts = getGiftCart();
    gifts = gifts.filter(g => g.id !== giftId);
    saveGiftCart(gifts);

    let selected = JSON.parse(localStorage.getItem('selectedCart')) || [];
    selected = selected.filter(i => i.id !== giftId);
    localStorage.setItem('selectedCart', JSON.stringify(selected));

    updateCartCount();
    renderCart();
}

function validateGiftCartOnLoad() {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const giftCart = JSON.parse(localStorage.getItem('giftCart')) || [];
    const requiredIds = JSON.parse(localStorage.getItem('giftRequirements')) || [];

    if (giftCart.length && requiredIds.length) {
        const hasAllRequired = requiredIds.every(id => cart.some(item => item.id === id));
        if (!hasAllRequired) {
            localStorage.removeItem('giftCart');
            localStorage.removeItem('giftRequirements');
        }
    } else {
        localStorage.removeItem('giftCart');
        localStorage.removeItem('giftRequirements');
    }
}

function updateGiftVisibility() {
    const giftCart = JSON.parse(localStorage.getItem('giftCart')) || [];
    const requiredIds = JSON.parse(localStorage.getItem('giftRequirements')) || [];
    const selected = JSON.parse(localStorage.getItem('selectedCart')) || [];

    if (!giftCart.length || !requiredIds.length) {
        document.querySelectorAll('.gift-section').forEach(el => el.style.display = 'none');
        return;
    }

    const hasAllRequired = requiredIds.every(id => selected.some(s => s.id === id));
    document.querySelectorAll('.gift-section').forEach(el => {
        el.style.display = hasAllRequired ? '' : 'none';
    });
}

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
    updateGiftVisibility();

    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    if (selectAllCheckbox) {
        const allChecked = cart.length > 0 && cart.every(item => selectedItems.includes(item.id));
        selectAllCheckbox.checked = allChecked;
    }
}

function handleSelectAllToggle(checked) {
    const cart = getCart();
    selectedItems = checked ? cart.map(item => item.id) : [];

    const selected = cart.filter(item => selectedItems.includes(item.id));
    localStorage.setItem('selectedCart', JSON.stringify(selected));
    updateGiftVisibility();

    document.querySelectorAll('.normal-cart-item').forEach((itemDiv, index) => {
        const checkbox = itemDiv.querySelector('.select-checkbox');
        if (checkbox) checkbox.checked = checked;

        if (checked) {
            itemDiv.classList.add('selected-item');
        } else {
            itemDiv.classList.remove('selected-item');
        }
    });
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
    localStorage.setItem('cart', JSON.stringify(cart));
    cartCache = cart;
}

async function addToCart(productId, productName, originalPrice, salePrice, discountPercent, image) {
    // 🔑 Chuẩn hoá dữ liệu giá cả
    originalPrice = typeof originalPrice === 'string'
        ? parseInt(originalPrice.replace(/\D/g, '')) || 0
        : Number(originalPrice) || 0;

    salePrice = typeof salePrice === 'string'
        ? parseInt(salePrice.replace(/\D/g, '')) || 0
        : Number(salePrice) || originalPrice;

    discountPercent = Number(discountPercent) || 0;

    const isLoggedIn = !!localStorage.getItem('userName');
    animateCartIcon();

    // ================== CHƯA LOGIN → LOCAL ONLY ==================
    if (!isLoggedIn) {
        let cart = getCart();
        const existingIndex = cart.findIndex(item => item.id === productId);

        if (existingIndex !== -1) {
            cart[existingIndex].quantity += 1;
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
        updateCartCount();
        renderCart(cart);
        return;
    }

    // ================== ĐÃ LOGIN → SERVER ONLY ==================
    try {
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
            return;
        }

        // ✅ Server trả về giỏ hàng mới → đồng bộ local (cache)
        const serverCart = data.cart || [];
        saveCart(serverCart);
        cartCache = serverCart;
        updateCartCount();
        renderCart(serverCart);

    } catch (err) {
        console.error('❌ Lỗi gọi API addToCart:', err);
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
    // Kiểm tra trạng thái đăng nhập trước
    const isLoggedIn = !!localStorage.getItem('userName');
    if (!isLoggedIn) {
        const cartCountElement = document.querySelector('.cart-count');
        if (cartCountElement) {
            cartCountElement.style.display = 'none';
        }
        return; // Dừng luôn, không tính giỏ hàng
    }

    const cart = getCart();
    validateGiftCartOnLoad();
    const giftCart = getGiftCart();
    const normalCount = cart.reduce((total, item) => total + item.quantity, 0);
    const giftCount = giftCart.reduce((total, g) => total + (g.quantity || 0), 0);
    const cartCount = normalCount + giftCount;

    let cartCountElement = document.querySelector('.cart-count');

    if (!cartCountElement) {
        const cartIcon = document.querySelector('.user-actions .fa-cart-shopping')?.parentElement;
        if (cartIcon) {
            cartCountElement = document.createElement('span');
            cartCountElement.className = 'cart-count';
            cartIcon.appendChild(cartCountElement);
        }
    }

    if (cartCountElement) {
        const oldCount = parseInt(cartCountElement.textContent || '0');
        if (oldCount !== cartCount) {
            cartCountElement.classList.add('cart-count-update');
            setTimeout(() => {
                cartCountElement.classList.remove('cart-count-update');
            }, 500);
        }

        cartCountElement.textContent = cartCount;
        cartCountElement.style.display = cartCount > 0 ? 'inline-flex' : 'none';
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

async function clearCart() {
    if (!confirm('Bạn có chắc chắn muốn xóa tất cả sản phẩm khỏi giỏ hàng?')) {
        return;
    }

    // ================== DỌN LOCAL CACHE ==================
    saveCart([]);
    saveGiftCart([]);
    localStorage.removeItem('selectedCart');
    cartCache = [];
    selectedItems = [];

    const isLoggedIn = !!localStorage.getItem('userName');

    // ================== ĐÃ LOGIN → XOÁ TRÊN SERVER ==================
    if (isLoggedIn) {
        try {
            const res = await fetch(`${window.API_BASE}/api/cart`, {
                method: 'DELETE',
                credentials: 'include'
            });

            const data = await res.json();
            if (!data.success) {
                console.error('❌ Lỗi xoá toàn bộ giỏ hàng trên server:', data.error);
            }
        } catch (err) {
            console.error('❌ Lỗi khi gọi API clearCart:', err);
        }
    }

    // 🔑 Giỏ trống → mở khóa để checkout trống có thể truy cập
    localStorage.removeItem('cartLocked');

    // ================== CẬP NHẬT UI ==================
    renderCart([]);
    updateCartCount();
    updateGiftVisibility();
    showNotification('Đã xóa tất cả sản phẩm khỏi giỏ hàng', 'success');
}




async function updateQuantity(index, change) {
    const cart = getCart();
    if (!cart[index]) return;

    // ❌ Không cho chỉnh quà tặng
    if (cart[index].isGift) return;

    const newQty = cart[index].quantity + change;
    if (newQty < 1) return;

    // Hiệu ứng animation số lượng thay đổi
    const cartItems = document.querySelectorAll('.cart-item');
    if (cartItems[index]) {
        cartItems[index].classList.add('quantity-change');
        setTimeout(() => {
            cartItems[index].classList.remove('quantity-change');
        }, 300);
    }

    const isLoggedIn = !!localStorage.getItem('userName');

    // ================== CHƯA LOGIN → LOCAL ONLY ==================
    if (!isLoggedIn) {
        cart[index].quantity = newQty;
        cart[index].updatedAt = new Date().toISOString();
        saveCart(cart);
        cartCache = cart;
        renderCart(cart);
        updateCartCount();
        updateGiftVisibility();
        return;
    }

    // ================== ĐÃ LOGIN → SERVER ONLY ==================
    try {
        const res = await fetch(`${window.API_BASE}/api/cart/${cart[index].id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ quantity: newQty })
        });

        const data = await res.json();
        if (!data.success) {
            console.error('❌ Lỗi cập nhật số lượng trên server:', data.error);
            return;
        }

        // ✅ Server trả về giỏ hàng mới → đồng bộ local (cache)
        const serverCart = data.cart || [];
        saveCart(serverCart);
        cartCache = serverCart;
        renderCart(serverCart);
        updateCartCount();
        updateGiftVisibility();
    } catch (err) {
        console.error('❌ Lỗi gọi API updateQuantity:', err);
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

async function performRemoveItem(index, itemName, productId) {
    const isLoggedIn = !!localStorage.getItem('userName');

    // ================== CHƯA LOGIN → LOCAL ONLY ==================
    if (!isLoggedIn) {
        let cart = getCart();
        cart.splice(index, 1);
        saveCart(cart);
        cartCache = cart;

        validateGiftRequirements(cart);
        renderCart(cart);
        updateCartCount();
        updateGiftVisibility();

        // 🔑 Nếu giỏ trống → mở khóa (cho phép xem checkout trống)
        if (cart.length === 0) {
            localStorage.removeItem('cartLocked');
        }

        showNotification(`Đã xóa "${itemName}" khỏi giỏ hàng`, 'success');
        return;
    }

    // ================== ĐÃ LOGIN → SERVER ONLY ==================
    try {
        const res = await fetch(`${window.API_BASE}/api/cart/${productId}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        const data = await res.json();
        if (!data.success) {
            console.error('❌ Lỗi xoá sản phẩm trên server:', data.error);
            return;
        }

        // ✅ Server trả về giỏ hàng mới → đồng bộ local (cache)
        const serverCart = data.cart || [];
        saveCart(serverCart);
        cartCache = serverCart;

        validateGiftRequirements(serverCart);
        renderCart(serverCart);
        updateCartCount();
        updateGiftVisibility();

        // 🔑 Nếu giỏ trống → mở khóa
        if (serverCart.length === 0) {
            localStorage.removeItem('cartLocked');
        }

        showNotification(`Đã xóa "${itemName}" khỏi giỏ hàng`, 'success');
    } catch (err) {
        console.error('❌ Lỗi gọi API removeItem:', err);
    }
}

// 🔑 Kiểm tra quà tặng khi giỏ hàng thay đổi
function validateGiftRequirements(cart) {
    const requiredIds = JSON.parse(localStorage.getItem('giftRequirements')) || [];
    const hasAllRequired = requiredIds.every(id => cart.some(item => item.id === id));
    if (!hasAllRequired) {
        saveGiftCart([]);
    }
}



function cleanupExpiredItems(expiryHours = 72) {
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

    if (hasExpired) {
        saveCart(cleanedCart);
        updateCartCount();
        renderCart();
        console.log("Đã xóa các sản phẩm hết hạn từ giỏ hàng");

        // Đồng bộ với server nếu đã đăng nhập
        const isLoggedIn = !!localStorage.getItem('userName');
        if (isLoggedIn) {
            cleanedCart.forEach(item => {
                fetch(`${window.API_BASE}/api/cart`, {
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
                }).catch(err => console.error('Lỗi đồng bộ sản phẩm:', err));
            });
        }
    }
}

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
    if (migrated) { localStorage.setItem('cart', JSON.stringify(raw)); }
    cartCache = raw;

    const cartItemsContainer = document.getElementById('cart-items-container');
    if (!cartItemsContainer) return;

    // 🛠 Fix: Xoá nội dung cũ trước khi render mới
    cartItemsContainer.innerHTML = '';

    const emptyCart = document.getElementById('empty-cart');
    const proceedButton = document.getElementById('proceed-to-step-2');
    const clearCartBtn = document.getElementById('clear-cart');
    const continueBtn = document.getElementById('continue-shopping-btn');

    let cart = getCart();
    validateGiftCartOnLoad();
    let giftCart = getGiftCart();

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
                <span class="discount-badge badge bg-danger ms-2">
                   -${item.discountPercent !== undefined
            ? item.discountPercent
            : Math.round(100 - (item.salePrice / item.originalPrice * 100))
        }%
                </span>
            </div>
        </div>
        <div class="cart-item__quantity d-flex align-items-center">
            <button class="quantity-btn quantity-btn--decrease ${minusDisabled}" 
                    onclick="updateQuantity(${index}, -1)" ${minusDisabled ? 'disabled' : ''}>
                <i class="fa fa-minus"></i>
            </button>
            <input type="number" class="quantity-input" value="${item.quantity}" readonly>
            <button class="quantity-btn quantity-btn--increase" onclick="updateQuantity(${index}, 1)">
                <i class="fa fa-plus"></i>
            </button>
        </div>
        <div class="cart-item__total ms-3" style="margin-top: 6px;">${formatCurrency(item.salePrice * item.quantity)}</div>
        <button class="cart-item__remove ms-3" onclick="removeItem(${index})">
            <i class="fa fa-trash"></i>
        </button>
    </div>
    `;
    });

    // Render quà tặng nếu có
    if (giftCart.length) {
        cartItemsHTML += `<div class="gift-section mt-2 mb-2"><h5 class="mb-2">🎁 Sản phẩm tặng kèm</h5>`;
        giftCart.forEach((g, gi) => {
            const safeQty = parseInt(g.quantity) || 1;
            const safePrice = parseInt(g.salePrice) || 0;
            total += safePrice * safeQty;
            cartItemsHTML += `
    <div class="cart-item gift-cart-item d-flex align-items-start p-3 mb-3 rounded position-relative" data-gift-index="${gi}" data-gift-id="${g.id}">
        <img src="${g.image}" alt="${g.name}" class="cart-item__image me-3" style="width: 80px; height: 80px; object-fit: cover;">
        <div class="cart-item__info flex-grow-1">
            <h5 class="cart-item__name">${g.name}</h5>
            <div class="price-section">
                <span class="original-price me-2">${formatCurrency(g.originalPrice)}</span>
                <span class="sale-price">${formatCurrency(0)}</span>
                <span class="discount-badge badge bg-danger ms-2">-100%</span>
            </div>
        </div>
        <div class="cart-item__quantity d-flex align-items-center">
            <span class="gift-qty">x${safeQty}</span>
        </div>
        <div class="cart-item__total ms-3" style="margin-top: 6px;">${formatCurrency(0)}</div>
    </div>
            `;
        });
        cartItemsHTML += `</div>`;
    }

    // Gắn HTML mới vào container
    cartItemsContainer.innerHTML = cartItemsHTML;

    const savedSelected = JSON.parse(localStorage.getItem('selectedCart')) || [];
    selectedItems = savedSelected.filter(it => !it.isGift).map(item => item.id);

    document.querySelectorAll('.normal-cart-item').forEach((itemDiv, index) => {
        const item = cart[index];
        const checkbox = itemDiv.querySelector('.select-checkbox');
        if (checkbox && selectedItems.includes(item.id)) {
            checkbox.checked = true;
            itemDiv.classList.add('selected-item');
        }
    });

    updateCartSummary(total);
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

    orderSummary.innerHTML = `
        ${productsHTML}
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

    const selectedMethod = document.querySelector('input[name="payment-method"]:checked')?.value;
    if (!selectedMethod) {
        showNotification('Vui lòng chọn phương thức thanh toán!', 'error');
        return;
    }

    const methodText = {
        cod: 'Thanh toán khi nhận hàng (COD)'
    }[selectedMethod];

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
        // Hiển thị animation loading
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

    // Giả lập delay xử lý thanh toán
    setTimeout(async () => {
        try {
            let selectedCart = JSON.parse(localStorage.getItem("selectedCart")) || [];

            if (selectedCart.length === 0) {
                loadingModal.hide();
                showNotification("❌ Bạn chưa chọn sản phẩm nào để thanh toán!", "error");
                return;
            }

            // 🔎 Chuẩn hoá dữ liệu giỏ hàng đã chọn
            selectedCart = selectedCart.map(it => (typeof it === "string" ? JSON.parse(it) : it));
            selectedCart = sanitizeCart(selectedCart);

            const selectedMethod =
                document.querySelector('input[name="payment-method"]:checked')?.value || "COD";
            const deliveryInfo = getDeliveryInfo(); // Lấy info chuẩn từ form
            const total = selectedCart.reduce((sum, item) => sum + item.salePrice * item.quantity, 0);

            // 1️⃣ Gửi yêu cầu tạo đơn hàng lên server
            const res = await fetch(`${window.API_BASE}/api/orders`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    items: selectedCart,
                    total,
                    paymentMethod: selectedMethod,
                    deliveryInfo
                })
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                console.error("❌ Lỗi khi tạo đơn:", data.error || data.message);
                showNotification("Không thể tạo đơn hàng. Vui lòng thử lại!", "error");
                loadingModal.hide();
                return;
            }

            console.log("✅ Đơn hàng mới từ server:", data.order);

            // 2️⃣ Xoá các sản phẩm đã thanh toán trên server
            try {
                const idsToRemove = selectedCart.map(item => item.id);
                await fetch(`${window.API_BASE}/api/cart/bulk-delete`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ ids: idsToRemove })
                });
                console.log("🗑️ Đã xoá sản phẩm đã thanh toán khỏi giỏ server.");
            } catch (err) {
                console.warn("⚠️ Không xoá được sản phẩm đã thanh toán:", err);
            }

            // 3️⃣ Đồng bộ lại giỏ hàng còn lại từ server
            try {
                const cartRes = await fetch(`${window.API_BASE}/api/cart`, { credentials: "include" });
                const updated = await cartRes.json();
                if (updated.success) {
                    saveCart(updated.cart || []);
                    cartCache = updated.cart || [];
                }
            } catch (err) {
                console.error("⚠️ Không thể đồng bộ giỏ hàng sau thanh toán:", err);
            }

            // 4️⃣ Dọn localStorage (chỉ xoá selectedCart và giftCart)
            localStorage.removeItem("selectedCart");
            localStorage.removeItem("giftCart");

            // Giữ lại note & invoiceRequired cho lần sau
            const savedInfo = {
                note: deliveryInfo?.note || "",
                invoiceRequired: deliveryInfo?.invoiceRequired || false
            };
            localStorage.setItem("deliveryInfo", JSON.stringify(savedInfo));

            // 5️⃣ Cập nhật lại UI
            updateCartCount();
            renderCart();
            updateOrderCount();

            // 6️⃣ Đóng loading và mở modal thành công
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

async function updateOrderCount() {
    const orderCountElement = document.querySelector('.order-count');
    if (!orderCountElement) return;

    const isLoggedIn = !!localStorage.getItem('userName');

    if (isLoggedIn) {
        try {
            const res = await fetch(`${window.API_BASE}/api/orders`, {
                method: "GET",
                credentials: "include"
            });
            const data = await res.json();

            if (data.success) {
                const count = data.orders.length;
                orderCountElement.textContent = count;
                orderCountElement.style.display = count > 0 ? 'inline-flex' : 'none';
            } else {
                orderCountElement.style.display = "none";
            }
        } catch (err) {
            console.error("Lỗi lấy đơn hàng từ server:", err);
            orderCountElement.style.display = "none";
        }
    } else {
        // ❌ Chưa login → luôn ẩn
        orderCountElement.style.display = "none";
    }
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
    // Ensure session sync early so localStorage user/cart reflect server state
    await ensureSessionSynced().catch(err => {
        console.warn('ensureSessionSynced failed on DOMContentLoaded:', err);
    });

    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const giftCart = JSON.parse(localStorage.getItem('giftCart')) || [];
    const totalItems = cart.reduce((t, i) => t + (i.quantity || 1), 0) +
        giftCart.reduce((t, g) => t + (g.quantity || 0), 0);

    const isLoggedIn = !!localStorage.getItem('userName');
    const isLocked = localStorage.getItem('cartLocked') === 'true';

    // Nếu chưa đăng nhập + giỏ hàng bị khoá HOẶC có sản phẩm cũ
    if (!isLoggedIn && (isLocked || totalItems > 0)) {
        const hideCheckout = () => {
            const container = document.querySelector('.checkout-container');
            if (container) {
                container.classList.add('d-none');
            } else {
                setTimeout(hideCheckout, 50);
            }
        };
        hideCheckout();
        return; // Dừng init
    }

    // ==== Nếu qua được kiểm tra thì mới chạy phần còn lại ====
    validateGiftCartOnLoad();
    await initializeCartSystem();

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

    // ==== Các event khác ====
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
            const giftCart = getGiftCart();

            const merged = [...selected];
            giftCart.forEach(g => {
                if (!merged.some(m => m.id === g.id)) merged.push(g);
            });

            if (selected.length === 0) {
                showNotification('Vui lòng chọn ít nhất một sản phẩm để tiếp tục!', 'error');
                return;
            }

            localStorage.setItem('selectedCart', JSON.stringify(merged));
            showStep(2);
        });
    }

    const proceedStep3Btn = document.getElementById('proceed-to-step-3');
    if (proceedStep3Btn) {
        proceedStep3Btn.addEventListener('click', () => {
            // 1. Kiểm tra form giao hàng
            if (!validateDeliveryInfo()) return;

            // 2. Kiểm tra đã tick đồng ý điều khoản chưa
            const agreeCheckbox = document.getElementById('agree-terms');
            if (!agreeCheckbox || !agreeCheckbox.checked) {
                const mustAgreeModal = new bootstrap.Modal(document.getElementById('must-agree-modal'));
                mustAgreeModal.show();
                return;
            }

            // 3. Nếu hợp lệ thì lưu & sang Step 3
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

    // ================= BƯỚC 2: Delivery Mode =================
    const profileBox = document.getElementById("profile-delivery-box");
    const formBox = document.getElementById("custom-delivery-form");

    // Tải và render sổ địa chỉ ngay từ đầu
    await loadAndRenderProfileAddresses();
    document.querySelectorAll('input[name="deliveryMode"]').forEach(input => {
        input.addEventListener("change", e => {
            if (e.target.value === "profile") {
                profileBox.style.display = "block";
                formBox.style.display = "none";
                loadAndRenderProfileAddresses(); // 🆕 load + render luôn khi chọn
            } else {
                profileBox.style.display = "none";
                formBox.style.display = "block";
            }
        });
    });

    // Mặc định chọn "Của bạn"
    const defaultRadio = document.querySelector("input[name='deliveryMode'][value='profile']");
    if (defaultRadio) {
        defaultRadio.checked = true;
        profileBox.style.display = "block";
        formBox.style.display = "none";
    }
});

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
    const isLoggedIn = !!localStorage.getItem('userName');

    // 🔑 Nếu chưa login → đồng bộ bằng localStorage
    if (!isLoggedIn) {
        if (e.key === 'cart') {
            refreshCartCache();
            updateCartCount();
            renderCart();
        }
        if (e.key === 'giftCart') {
            updateCartCount();
            renderCart();
        }
    }

    // Orders thì vẫn sync cả 2 trạng thái
    if (e.key === 'orders') {
        updateOrderCount();
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