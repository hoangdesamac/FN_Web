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
// AUTH GUARD & PENDING ACTIONS
// ==========================

/**
 * pendingAction stored in localStorage as JSON:
 * { type: 'addToCart' | 'addMultipleToCart' | 'buyNow', payload: {...} }
 */

// --- DÙNG API ĐỂ KIỂM TRA LOGIN "REALTIME" (không chỉ localStorage) ---
async function isLoggedInRealTime() {
    try {
        // 1) Fast local check via AuthSync internal state if available
        if (window.AuthSync && typeof window.AuthSync.getState === 'function') {
            try {
                const st = window.AuthSync.getState();
                if (st && st.loggedIn) return true;
            } catch (e) { /* ignore */ }
        }

        // 2) If AuthSync exists, try its refresh() but with a short timeout
        if (window.AuthSync && typeof window.AuthSync.refresh === 'function') {
            try {
                const refreshPromise = window.AuthSync.refresh();
                const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('AuthSync.refresh timeout')), 800));
                const result = await Promise.race([refreshPromise, timeout]);
                return !!(result && result.loggedIn);
            } catch (e) {
                // fall through to next check
            }
        }

        // 3) Fallback to direct /api/me GET with a short timeout
        try {
            const controller = new AbortController();
            const t = setTimeout(() => controller.abort(), 800);
            const res = await fetch(`${(window.API_BASE || '').replace(/\/$/, '')}/api/me`, {
                method: 'GET',
                credentials: 'include',
                signal: controller.signal
            });
            clearTimeout(t);
            if (!res.ok) return !!(localStorage.getItem('userName') || localStorage.getItem('userId'));
            const data = await res.json();
            return !!(data && data.loggedIn);
        } catch (e) {
            // network or aborted
            return !!(localStorage.getItem('userName') || localStorage.getItem('userId'));
        }
    } catch (err) {
        return !!(localStorage.getItem('userName') || localStorage.getItem('userId'));
    }
}

// --- Hàm kiểm tra login cho logic bình thường (vẫn giữ lại) ---
function isLoggedIn() {
    try {
        if (window.AuthSync && typeof window.AuthSync.isLoggedIn === 'function') {
            return window.AuthSync.isLoggedIn();
        }
    } catch (e) { /* ignore */ }
    // fallback legacy
    return !!localStorage.getItem('userName') || !!localStorage.getItem('userId');
}

function savePendingAction(actionObj) {
    try {
        localStorage.setItem('pendingAction', JSON.stringify(actionObj));
    } catch (err) {
        console.error('Không thể lưu pendingAction:', err);
    }
}

function clearPendingAction() {
    localStorage.removeItem('pendingAction');
}

function openLoginModalAndNotify() {
    if (typeof CyberModal !== 'undefined' && CyberModal.open) {
        CyberModal.open();
    }
    if (typeof showNotification === 'function') {
        showNotification('Vui lòng đăng nhập để tiếp tục', 'info');
    }
}

/**
 * Execute pending action from localStorage (if exists and user is logged in)
 */
async function processPendingAction() {
    // Ensure user actually logged-in now (realtime)
    try {
        if (window.AuthSync && typeof window.AuthSync.refresh === 'function') {
            const s = await window.AuthSync.refresh();
            if (!s || !s.loggedIn) return;
        }
    } catch (e) {
        // fallback to legacy check
        if (!isLoggedIn()) return;
    }

    const raw = localStorage.getItem('pendingAction');
    if (!raw) return;

    let action;
    try {
        action = JSON.parse(raw);
    } catch (err) {
        console.error('Invalid pendingAction JSON:', err);
        clearPendingAction();
        return;
    }

    try {
        if (action.type === 'addToCart') {
            const res = await addToCartAPI(action.payload.product, action.payload.qty || 1);
            await processAddToCartResponse(res);
            if (typeof showToast === 'function') showToast(`Đã thêm ${action.payload.product.name} vào giỏ hàng!`);
        } else if (action.type === 'addMultipleToCart') {
            for (const it of (action.payload.products || [])) {
                const res = await addToCartAPI(it.product, it.qty || 1);
                await processAddToCartResponse(res);
            }
            if (typeof showToast === 'function') showToast(`Đã thêm ${action.payload.products.length} sản phẩm vào giỏ hàng!`);
        } else if (action.type === 'buyNow') {
            // Use handleBuyNowImmediate so we get unified behavior (optimistic + reconcile + redirect)
            const product = action.payload.product;
            const combos = action.payload.combos || [];
            const gifts = action.payload.gifts || [];
            await handleBuyNowImmediate(product, combos, gifts, { redirectIfEligible: true });
        } else {
            console.warn('Unknown pending action type:', action.type);
        }
    } catch (err) {
        console.error('Lỗi khi xử lý pendingAction:', err);
    } finally {
        clearPendingAction();
    }
}

// Process pending action when localStorage 'userName' changes (login event from modal or other tab)
window.addEventListener('storage', function (e) {
    try {
        if (!e || !e.key) return;

        // Legacy: userName written by older scripts
        if (e.key === 'userName' && e.newValue) {
            setTimeout(() => processPendingAction(), 200);
        }

        // AuthSync: canonical key + ping key
        if (e.key === 'auth_state' || e.key === 'auth_ping') {
            // nếu auth_state báo loggedIn thì xử lý pending
            try {
                const s = JSON.parse(localStorage.getItem('auth_state') || '{}');
                if (s && s.loggedIn) {
                    setTimeout(() => processPendingAction(), 150);
                }
            } catch (err) {
                // nếu không parse được, vẫn thử gọi processPendingAction (best-effort)
                setTimeout(() => processPendingAction(), 200);
            }
        }

        // Nếu các key cart/gift thay đổi thì vẫn giữ behavior cũ (nếu cần xử lý, các hàm khác đã lắng nghe)
    } catch (err) {
        console.warn('storage listener error:', err);
    }
});

// Also try to process pending action on page load
document.addEventListener('DOMContentLoaded', function () {
    (async () => {
        try {
            // Nếu AuthSync có init(), chờ nó để tránh race (AuthSync sẽ tự gọi /api/me)
            if (window.AuthSync && typeof window.AuthSync.init === 'function') {
                await window.AuthSync.init();
            } else {
                // nhỏ delay để các script auth khác có thời gian cập nhật localStorage
                await new Promise(r => setTimeout(r, 200));
            }
        } catch (e) {
            // ignore init errors, vẫn tiếp tục
            console.warn('AuthSync init error (ignored):', e);
        }

        // Sau khi AuthSync sẵn sàng (hoặc timeout), cố gắng xử lý pending action
        try { setTimeout(() => processPendingAction(), 200); } catch (err) { console.warn(err); }
    })();
});


// ----- Thêm: lắng nghe AuthSync.onChange để xử lý pending action khi auth thay đổi giữa các tab -----
if (window.AuthSync && typeof window.AuthSync.onChange === 'function') {
    window.AuthSync.onChange((state) => {
        try {
            if (state && state.loggedIn) {
                // khi vừa login ở tab khác hoặc vừa đồng bộ, xử lý pending action
                setTimeout(() => processPendingAction(), 150);
            }
            // khi logout: có thể muốn clear UI / pending (hiện preserve pending so user can login again)
        } catch (err) {
            console.warn('AuthSync.onChange handler error:', err);
        }
    });
}

// Listen for custom same-tab login event (dispatched from js_resetauth.js)
window.addEventListener('user:login', async function () {
    try {
        if (typeof fetchUserInfo === 'function') await fetchUserInfo();
        if (typeof updateUserDisplay === 'function') updateUserDisplay();
        if (typeof updateCartCount === 'function') updateCartCount();
        if (typeof updateOrderCount === 'function') updateOrderCount();
    } catch (err) {
        console.warn('user:login -> fetchUserInfo/updateUserDisplay error', err);
    }
    if (typeof processPendingAction === 'function') {
        processPendingAction();
    }
});

// Helper to require login before running action
function requireLoginThenDo(actionType, payload, immediateFn) {
    (async () => {
        try {
            // 1) fast check via AuthSync in-memory
            if (window.AuthSync && typeof window.AuthSync.getState === 'function') {
                try {
                    const st = window.AuthSync.getState();
                    if (st && st.loggedIn) {
                        if (typeof immediateFn === 'function') return immediateFn();
                    }
                } catch (e) { /* ignore */ }
            } else {
                if (!!localStorage.getItem('userName') || !!localStorage.getItem('userId')) {
                    if (typeof immediateFn === 'function') return immediateFn();
                }
            }

            // 2) brief wait for AuthSync init (useful when header/auth script is loading)
            const waitTotal = 600; // ms
            const pollInterval = 100; // ms
            let waited = 0;
            while (waited < waitTotal) {
                await new Promise(r => setTimeout(r, pollInterval));
                waited += pollInterval;
                try {
                    if (window.AuthSync && typeof window.AuthSync.getState === 'function') {
                        const st2 = window.AuthSync.getState();
                        if (st2 && st2.loggedIn) {
                            if (typeof immediateFn === 'function') return immediateFn();
                        }
                    } else {
                        if (!!localStorage.getItem('userName') || !!localStorage.getItem('userId')) {
                            if (typeof immediateFn === 'function') return immediateFn();
                        }
                    }
                } catch (e) { /* ignore and continue waiting */ }
            }

            // 3) Final realtime check (networked) just before deciding
            let logged = false;
            try {
                logged = await isLoggedInRealTime();
            } catch (e) {
                logged = !!(localStorage.getItem('userName') || localStorage.getItem('userId'));
            }

            if (logged) {
                if (typeof immediateFn === 'function') return immediateFn();
            }

            // 4) Not logged -> persist pendingAction (long-lived) and set a per-tab "open modal once" flag (session)
            try {
                savePendingAction({ type: actionType, payload });
            } catch (err) {
                console.warn('savePendingAction failed', err);
            }

            // Try to set a safe per-tab show-login flag; prefer exported helper if available
            try {
                if (typeof window.setShowLoginAfterReset === 'function') {
                    window.setShowLoginAfterReset(true);
                } else if (typeof sessionStorage !== 'undefined') {
                    sessionStorage.setItem('showLoginAfterReset', 'true');
                } else {
                    // Last resort: localStorage with timestamp (less ideal; cross-tab)
                    localStorage.setItem('showLoginAfterReset', 'true');
                    localStorage.setItem('showLoginAfterReset_ts', String(Date.now()));
                }
            } catch (e) {
                try { sessionStorage.setItem('showLoginAfterReset', 'true'); } catch (_) {}
                try { localStorage.setItem('showLoginAfterReset', 'true'); localStorage.setItem('showLoginAfterReset_ts', String(Date.now())); } catch (_) {}
            }

            // Also set a per-tab postLoginRedirect pointing back to this product page (helps OAuth flows)
            try {
                const redirectUrl = window.location.href;
                if (typeof sessionStorage !== 'undefined') {
                    sessionStorage.setItem('postLoginRedirect', redirectUrl);
                } else {
                    localStorage.setItem('postLoginRedirect', redirectUrl);
                }
            } catch (e) { /* ignore */ }

            // Finally open login modal in the same tab
            openLoginModalAndNotify();
        } catch (err) {
            console.warn('requireLoginThenDo error (fallback to legacy):', err);
            if (localStorage.getItem('userName') || localStorage.getItem('userId')) {
                if (typeof immediateFn === 'function') immediateFn();
            } else {
                try { savePendingAction({ type: actionType, payload }); } catch (e) {}
                openLoginModalAndNotify();
            }
        }
    })();
}

function _mergeCartWithGifts(cartArray) {
    try {
        const gifts = JSON.parse(localStorage.getItem('giftCart') || '[]') || [];
        const normalizedGifts = Array.isArray(gifts) ? gifts.map(g => ({ ...g, quantity: Number(g.quantity) || 1 })) : [];
        return Array.isArray(cartArray) ? cartArray.concat(normalizedGifts) : normalizedGifts;
    } catch (e) {
        return cartArray || [];
    }
}

// Try to refresh via shared module; fallback to legacy updateCartCount()
async function _refreshCartCountFromSharedOrFallback() {
    try {
        if (window.cartCountShared && typeof window.cartCountShared.refresh === 'function') {
            await window.cartCountShared.refresh();
            return;
        }
    } catch (err) {
        console.warn('cartCountShared.refresh() failed:', err);
    }
    // Fallback: call legacy DOM updater if available
    try { if (typeof updateCartCount === 'function') updateCartCount(); } catch (e) { /* ignore */ }
}
function reconcileServerCart(data) {
    try {
        if (data && Array.isArray(data.cart)) {
            try { localStorage.setItem('cart', JSON.stringify(data.cart)); } catch (e) {}
            const merged = _mergeCartWithGifts(data.cart);

            // Prefer shared module
            try {
                if (window.cartCountShared && typeof window.cartCountShared.setFromCart === 'function') {
                    window.cartCountShared.setFromCart(merged);
                    return;
                }
            } catch (e) {
                console.warn('cartCountShared.setFromCart error:', e);
            }

            // Legacy DOM update fallback
            try {
                const total = merged.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
                if (window.jQuery) {
                    $('.cart-count').text(total).css('display', total > 0 ? 'inline-flex' : 'none');
                } else {
                    const el = document.querySelector('.cart-count');
                    if (el) {
                        el.textContent = String(total);
                        el.style.display = total > 0 ? 'inline-flex' : 'none';
                    }
                }
            } catch (err) {
                console.warn('reconcileServerCart DOM update failed:', err);
            }
            return;
        }
    } catch (err) {
        console.warn('reconcileServerCart error:', err);
    }
    // If no authoritative cart returned, ask shared to refresh
    _refreshCartCountFromSharedOrFallback();
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
        const res = await fetch(`${window.API_BASE}/api/cart`, {
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
        if (!res.ok) throw new Error(`API lỗi ${res.status}`);
        return await res.json();
    } catch (err) {
        console.error('Lỗi thêm giỏ hàng:', err);
        return { success: false };
    }
}

async function updateCartCountFromServer() {
    try {
        const res = await fetch(`${window.API_BASE}/api/cart`, { credentials: 'include' });
        if (!res.ok) throw new Error(`API lỗi ${res.status}`);
        const data = await res.json();
        if (!data || !data.success) {
            await _refreshCartCountFromSharedOrFallback();
            return;
        }
        reconcileServerCart(data);
    } catch (err) {
        console.error('Lỗi lấy số lượng giỏ:', err);
        await _refreshCartCountFromSharedOrFallback();
    }
}
async function processAddToCartResponse(res) {
    try {
        // No response → fallback refresh
        if (!res) {
            if (window.cartCountShared && typeof window.cartCountShared.refresh === 'function') {
                await window.cartCountShared.refresh();
            } else if (typeof updateCartCountFromServer === 'function') {
                await updateCartCountFromServer();
            } else if (typeof updateCartCount === 'function') {
                updateCartCount();
            }
            return;
        }

        // If server returned authoritative cart array, reconcile immediately
        if (res.success && Array.isArray(res.cart)) {
            try {
                // persist server cart locally
                try { localStorage.setItem('cart', JSON.stringify(res.cart)); } catch (e) { /* ignore */ }

                // merge with local giftCart so badge includes gifts
                const gifts = JSON.parse(localStorage.getItem('giftCart') || '[]') || [];
                const merged = Array.isArray(res.cart) ? res.cart.concat(gifts) : gifts;

                // Prefer shared module
                if (window.cartCountShared && typeof window.cartCountShared.setFromCart === 'function') {
                    window.cartCountShared.setFromCart(merged);
                } else {
                    // fallback: compute total and update DOM
                    const total = merged.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
                    const $el = window.jQuery ? window.jQuery('.cart-count') : document.querySelector('.cart-count');
                    if ($el) {
                        if (window.jQuery) {
                            $el.text(total).css('display', total > 0 ? 'inline-flex' : 'none');
                        } else {
                            $el.textContent = String(total);
                            $el.style.display = total > 0 ? 'inline-flex' : 'none';
                        }
                    }
                }
            } catch (err) {
                console.warn('processAddToCartResponse: reconcile failed', err);
                if (window.cartCountShared && typeof window.cartCountShared.refresh === 'function') {
                    await window.cartCountShared.refresh();
                } else if (typeof updateCartCountFromServer === 'function') {
                    await updateCartCountFromServer();
                }
            }
            return;
        }

        // No authoritative cart returned → trigger background refresh (debounced by cartCountShared)
        if (window.cartCountShared && typeof window.cartCountShared.refresh === 'function') {
            await window.cartCountShared.refresh();
        } else if (typeof updateCartCountFromServer === 'function') {
            await updateCartCountFromServer();
        } else if (typeof updateCartCount === 'function') {
            updateCartCount();
        }
    } catch (err) {
        console.warn('processAddToCartResponse error:', err);
        try {
            if (window.cartCountShared && typeof window.cartCountShared.refresh === 'function') {
                await window.cartCountShared.refresh();
            } else if (typeof updateCartCountFromServer === 'function') {
                await updateCartCountFromServer();
            } else if (typeof updateCartCount === 'function') {
                updateCartCount();
            }
        } catch (e) { /* ignore */ }
    }
}
async function handleBuyNowImmediate(product, selectedCombos = [], giftCart = [], options = { redirectIfEligible: true, forceRedirect: false }) {
    try {
        // Quick optimistic feedback
        const delta = 1 + (Array.isArray(selectedCombos) ? selectedCombos.length : 0) + (Array.isArray(giftCart) ? giftCart.reduce((s,g)=>s + (Number(g.quantity)||1),0) : 0);
        try {
            if (window.cartCountShared && typeof window.cartCountShared.increment === 'function') {
                window.cartCountShared.increment(delta);
            } else {
                // fallback: call updateCartCount (will read local storage or do server refresh)
                if (typeof updateCartCount === 'function') updateCartCount();
            }
        } catch (e) { console.warn('Optimistic increment failed:', e); }

        let lastServerCart = null;
        let lastRes = null;

        // Helper to POST and process response
        async function postAndProcess(item, qty = 1) {
            try {
                const res = await addToCartAPI(item, qty);
                lastRes = res;
                if (res && res.success && Array.isArray(res.cart)) {
                    lastServerCart = res.cart;
                }
                await processAddToCartResponse(res);
                return res;
            } catch (err) {
                console.warn('postAndProcess error for', item?.id, err);
                return null;
            }
        }

        // 1) add main product
        await postAndProcess(product, 1);

        // 2) add combos
        if (Array.isArray(selectedCombos) && selectedCombos.length) {
            for (const combo of selectedCombos) {
                await postAndProcess(combo, 1);
            }
        }

        // 3) add gifts
        if (Array.isArray(giftCart) && giftCart.length) {
            for (const gift of giftCart) {
                const qty = Number(gift.quantity) || 1;
                await postAndProcess(gift, qty);
            }
        }

        // 4) Reconcile authoritative lastServerCart (if any) or ensure refresh
        if (lastServerCart) {
            try {
                // persist & notify shared
                try { localStorage.setItem('cart', JSON.stringify(lastServerCart)); } catch (e) {}
                const merged = (Array.isArray(lastServerCart) ? lastServerCart.concat(JSON.parse(localStorage.getItem('giftCart')||'[]')) : JSON.parse(localStorage.getItem('giftCart')||'[]'));
                if (window.cartCountShared && typeof window.cartCountShared.setFromCart === 'function') {
                    window.cartCountShared.setFromCart(merged);
                } else if (typeof updateCartCount === 'function') {
                    updateCartCount();
                }
            } catch (e) {
                console.warn('handleBuyNowImmediate reconcile failed', e);
                if (window.cartCountShared && typeof window.cartCountShared.refresh === 'function') {
                    await window.cartCountShared.refresh();
                } else if (typeof updateCartCountFromServer === 'function') {
                    await updateCartCountFromServer();
                } else if (typeof updateCartCount === 'function') {
                    updateCartCount();
                }
            }
        } else {
            // No server cart returned → ensure a refresh
            if (window.cartCountShared && typeof window.cartCountShared.refresh === 'function') {
                await window.cartCountShared.refresh();
            } else if (typeof updateCartCountFromServer === 'function') {
                await updateCartCountFromServer();
            } else if (typeof updateCartCount === 'function') {
                updateCartCount();
            }
        }

        // 5) Ensure checkout won't be blocked by leftover flags
        try { localStorage.removeItem('cartLocked'); } catch (e) { /* ignore */ }

        // 6) Show toast
        let toastMsg = product && product.name ? `Đã thêm ${product.name} vào giỏ hàng` : 'Đã thêm sản phẩm vào giỏ hàng';
        if (Array.isArray(selectedCombos) && selectedCombos.length) toastMsg += ` và ${selectedCombos.length} combo`;
        if (Array.isArray(giftCart) && giftCart.length) toastMsg += `, kèm quà tặng`;
        toastMsg += '!';
        if (typeof showToast === 'function') showToast(toastMsg);

        // 7) Decide redirect: original rule was "redirect when all combos selected AND gifts added"
        const hasCombo = Array.isArray(selectedCombos) && selectedCombos.length > 0;
        const hasGifts = Array.isArray(giftCart) && giftCart.length > 0;
        const shouldRedirect = options.forceRedirect || (options.redirectIfEligible && hasCombo && hasGifts);

        if (shouldRedirect) {
            // Delay slightly to let UI update
            setTimeout(() => { window.location.href = 'resetcheckout.html'; }, 300);
        }

        return { success: true, lastRes, lastServerCart };
    } catch (err) {
        console.error('handleBuyNowImmediate error:', err);
        // best-effort refresh badge
        try {
            if (window.cartCountShared && typeof window.cartCountShared.refresh === 'function') {
                await window.cartCountShared.refresh();
            } else if (typeof updateCartCountFromServer === 'function') {
                await updateCartCountFromServer();
            } else if (typeof updateCartCount === 'function') {
                updateCartCount();
            }
        } catch (e) { /* ignore */ }
        if (typeof showToast === 'function') showToast('Không thể thêm vào giỏ hàng, vui lòng thử lại!');
        return { success: false, error: err };
    }
}

async function updateCartCount() {
    try {
        // Prefer shared cart module (debounced/throttled). Await it so callers that want to can await.
        if (window.cartCountShared && typeof window.cartCountShared.refresh === 'function') {
            try {
                await window.cartCountShared.refresh();
            } catch (e) {
                console.warn('cartCountShared.refresh threw, falling back:', e);
            }
            return;
        }
    } catch (e) {
        console.warn('cartCountShared.refresh error (fallback):', e);
    }

    // Legacy fallback: compute from localStorage
    try {
        const cartCountElement = document.querySelector('.cart-count');
        if (!cartCountElement) return;

        // Auth check (AuthSync preferred)
        let logged = false;
        try {
            if (window.AuthSync && typeof window.AuthSync.isLoggedIn === 'function') {
                logged = window.AuthSync.isLoggedIn();
            } else {
                logged = !!localStorage.getItem('userName') || !!localStorage.getItem('userId');
            }
        } catch (e) {
            logged = !!localStorage.getItem('userName') || !!localStorage.getItem('userId');
        }

        if (!logged) {
            // hide badge when not logged
            cartCountElement.style.display = 'none';
            if (window._cartCountCache) window._cartCountCache.lastCount = null;
            return;
        }

        // Read localStorage safely
        let cart = [];
        let giftCart = [];
        try { cart = JSON.parse(localStorage.getItem('cart') || '[]'); } catch (e) { cart = []; }
        try { giftCart = JSON.parse(localStorage.getItem('giftCart') || '[]'); } catch (e) { giftCart = []; }

        // sum helper that supports { quantity } or { qty }
        const sumQty = (arr) => {
            if (!Array.isArray(arr)) return 0;
            return arr.reduce((s, it) => s + (Number(it?.quantity ?? it?.qty ?? 0) || 0), 0);
        };

        const normal = sumQty(cart);
        const gifts = sumQty(giftCart);
        const total = normal + gifts;

        // update DOM only if changed (animate on change)
        const old = parseInt(cartCountElement.textContent || '0') || 0;
        if (old !== total) {
            cartCountElement.classList.add('cart-count-update');
            setTimeout(() => cartCountElement.classList.remove('cart-count-update'), 500);
        }

        if (window.jQuery) {
            $('.cart-count').text(total).css('display', total > 0 ? 'inline-flex' : 'none');
        } else {
            cartCountElement.textContent = String(total);
            cartCountElement.style.display = total > 0 ? 'inline-flex' : 'none';
        }

        // update local cache if present (helps other logic)
        try {
            window._cartCountCache = window._cartCountCache || {};
            window._cartCountCache.lastCount = total;
            window._cartCountCache.lastFetch = Date.now();
        } catch (e) { /* ignore */ }

        return total;
    } catch (err) {
        console.warn('updateCartCount fallback error:', err);
        // final best-effort: try shared refresh if available
        try {
            if (window.cartCountShared && typeof window.cartCountShared.refresh === 'function') {
                await window.cartCountShared.refresh();
            }
        } catch (e) { /* ignore */ }
    }
}

// Expose / flag so other scripts can detect shared implementation
try {
    window.updateCartCount = updateCartCount;
    window.updateCartCount._isCartShared = true;
} catch (e) { /* ignore */ }

function showToast(message) {
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
    `).removeClass('hide').addClass('show');

    // Đóng khi click vào nút X
    $toast.find('.toast-close').on('click', () => {
        $toast.removeClass('show').addClass('hide');
        setTimeout(() => $toast.remove(), 300);
    });

    // Tự động ẩn sau 3 giây
    setTimeout(() => {
        if ($toast.hasClass('show')) {
            $toast.removeClass('show').addClass('hide');
            setTimeout(() => $toast.remove(), 300);
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

        // If not found in window.products, we can't rely on full object; attempt a minimal payload
        if (!relatedProduct) {
            // Try to construct minimal product from DOM
            const $card = $(this).closest('.product-card');
            const name = $card.find('.product-name').text().trim();
            const image = $card.find('img').attr('src');
            const originalPrice = parsePrice($card.find('.original-price').text());
            const salePrice = parsePrice($card.find('.sale-price').text());
            relatedProduct = {
                id,
                name,
                image,
                originalPrice,
                salePrice,
                discount: (originalPrice && salePrice) ? Math.round((1 - salePrice / originalPrice) * 100) : 0
            };
        }

        const cleanProduct = prepareProduct(relatedProduct);

        const immediate = async () => {
            try {
                const res = await addToCartAPI(cleanProduct, 1);
                if (!res || !res.success) {
                    // server-side error or network error
                    throw new Error((res && res.error) || 'Lỗi khi thêm giỏ hàng');
                }

                // Use the new response handler which will reconcile cart if server returned authoritative cart
                await processAddToCartResponse(res);

                // UX feedback
                showToast && showToast(`Đã thêm ${cleanProduct.name} vào giỏ hàng!`);
            } catch (err) {
                console.error("❌ Lỗi thêm sản phẩm (related):", err);
                showToast && showToast("Không thể thêm sản phẩm vào giỏ hàng!");
            }
        };

        // Require login (if not logged, pending action will be stored)
        requireLoginThenDo('addToCart', { product: cleanProduct, qty: 1 }, immediate);
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

function parsePrice(price) {
    if (price === undefined || price === null || price === '') return null;
    if (typeof price === 'number') return price;
    const parsed = parseInt(price.toString().replace(/\D/g, ''), 10);
    return isNaN(parsed) ? null : parsed;
}

function formatPrice(price) {
    if (price === undefined || price === null) return "Liên hệ";
    return price === 0 ? "0 đ" : price.toLocaleString('vi-VN') + " đ";
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

    // --- FIXED: use window.currentProduct fallback when window.products doesn't contain the rendered product ---
    $(document).on('click', '.buy-now', async function () {
        const $btn = $(this);
        if ($btn.data('processing')) return;
        $btn.data('processing', true).prop('disabled', true).addClass('processing');

        try {
            const productId = $btn.data('id');

            // 🔎 Tìm sản phẩm chính - prefer currentProduct (rendered)
            let product = null;
            try {
                if (window.currentProduct && window.currentProduct.id === productId) product = window.currentProduct;
                if (!product && Array.isArray(window.products)) {
                    product = window.products.find(p => p.id === productId) || null;
                }
            } catch (e) { /* ignore */ }

            if (!product) {
                console.warn('buy-now: product not found for id', productId, 'window.currentProduct=', window.currentProduct);
                showToast('Không thể thêm sản phẩm vào giỏ (thiếu dữ liệu)');
                return;
            }

            const cleanProduct = prepareProduct(product);

            // --- Lấy tất cả combo đã check ---
            const $allCombos = $('.bundle-products .bundle-checkbox');
            const $checkedCombos = $allCombos.filter(':checked');

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
            if (hasAllCombos && product.gift && product.gift.length) {
                giftCart = product.gift.map(g => ({
                    id: g.id,
                    name: g.name,
                    image: g.image,
                    originalPrice: parsePrice(g.originalPrice),
                    salePrice: 0,
                    discount: 100,
                    quantity: g.qty ?? g.quantity ?? 1,
                    isGift: true
                }));
            }

            const immediate = async () => {
                await handleBuyNowImmediate(cleanProduct, selectedCombos, giftCart, { redirectIfEligible: true });
            };

            // Use the robust requireLoginThenDo
            requireLoginThenDo('buyNow', {
                product: cleanProduct,
                combos: selectedCombos,
                gifts: giftCart
            }, immediate);

        } finally {
            // small delay so UI feedback shows then re-enable
            setTimeout(() => {
                $btn.removeData('processing').prop('disabled', false).removeClass('processing');
            }, 800);
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

    // --- Updated: add-to-cart-bundle handler (uses processAddToCartResponse + cartCountShared) ---
    $(document).on('click', '.add-to-cart-bundle', async function () {
        const $checked = $('.bundle-products .bundle-checkbox:checked');
        if (!$checked.length) {
            showToast('Vui lòng chọn ít nhất một sản phẩm combo!');
            return;
        }

        // Build product payloads
        const productsToAdd = [];
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
                originalPrice,
                salePrice
            });

            productsToAdd.push({ product, qty: 1 });
        });

        const immediate = async () => {
            try {
                // optimistic increment for immediate UX feedback
                const totalQty = productsToAdd.reduce((s, it) => s + (Number(it.qty) || 1), 0);
                try {
                    if (window.cartCountShared && typeof window.cartCountShared.increment === 'function') {
                        window.cartCountShared.increment(totalQty);
                    } else if (typeof updateCartCount === 'function') {
                        // best-effort fallback (will schedule background sync)
                        updateCartCount();
                    }
                } catch (e) {
                    console.warn('Optimistic cart increment failed:', e);
                }

                let addedCount = 0;
                let lastServerCart = null;
                const errors = [];

                // Add each product sequentially; continue on errors so other items can still be added
                for (const it of productsToAdd) {
                    try {
                        const res = await addToCartAPI(it.product, it.qty);
                        if (!res || !res.success) {
                            console.warn('⚠️ Không thể thêm item vào giỏ:', it.product?.name, res && res.error);
                            errors.push({ product: it.product, error: (res && res.error) || 'API failed' });
                            // still call processAddToCartResponse to let shared module decide if needed (pass res even if failed)
                            await processAddToCartResponse(res);
                            continue;
                        }
                        // success for this item
                        addedCount += (Number(it.qty) || 1);
                        if (Array.isArray(res.cart)) lastServerCart = res.cart;
                        // let handler reconcile badge/state
                        await processAddToCartResponse(res);
                    } catch (err) {
                        console.warn('❌ Lỗi khi thêm item combo:', it.product?.name, err);
                        errors.push({ product: it.product, error: err });
                        // continue with next item
                    }
                }

                // If server never returned authoritative cart, ensure a refresh (shared module handles debouncing)
                if (!lastServerCart) {
                    if (window.cartCountShared && typeof window.cartCountShared.refresh === 'function') {
                        await window.cartCountShared.refresh();
                    } else if (typeof updateCartCountFromServer === 'function') {
                        await updateCartCountFromServer();
                    } else if (typeof updateCartCount === 'function') {
                        updateCartCount();
                    }
                } else {
                    // persist last returned authoritative cart (reconcileServerCart already called inside processAddToCartResponse,
                    // but we keep this as best-effort to ensure localStorage/cart state is consistent)
                    try { localStorage.setItem('cart', JSON.stringify(lastServerCart)); } catch (e) {}
                }

                // UX: show toast about success/fail
                if (addedCount > 0) {
                    showToast(`Đã thêm ${addedCount} sản phẩm combo vào giỏ!`);
                }
                if (errors.length) {
                    console.warn('Một số item không thêm được:', errors);
                    // show a secondary message only when nothing was added
                    if (addedCount === 0) showToast('Không thể thêm combo vào giỏ hàng!');
                }
            } catch (err) {
                console.error('❌ Lỗi thêm combo (immediate):', err);
                // best-effort refresh
                try {
                    if (window.cartCountShared && typeof window.cartCountShared.refresh === 'function') {
                        await window.cartCountShared.refresh();
                    } else if (typeof updateCartCountFromServer === 'function') {
                        await updateCartCountFromServer();
                    } else if (typeof updateCartCount === 'function') {
                        updateCartCount();
                    }
                } catch (e) { /* ignore */ }
                showToast('Không thể thêm combo vào giỏ hàng!');
            }
        };

        // If not logged in, save pending action to add multiples
        const payload = { products: productsToAdd };
        requireLoginThenDo('addMultipleToCart', payload, immediate);
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
            ${giftItems.map(g => {
        const qty = g.qty ?? g.quantity ?? 1;
        return `
                <div class="gift-item">
                    <img src="${g.image}" alt="${g.name}">
                    <div class="gift-info">
                        <p class="gift-name">${g.name}</p>
                        <span class="gift-qty">x${qty}</span>
                    </div>
                </div>
            `;
    }).join('')}
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
        originalPrice: 3590000,
        salePrice: 2050000,
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
                originalPrice: 1190000,
                salePrice: 710000,
                description: "Pin rời / Không dây / DPI - 12.000",
                rating: 0.0,
                reviews: 0
            },
            {
                id: "keyboard-edra-ek375w-ek398w-white-black-green",
                name: "Bàn phím E-Dra EK375W EK398W (White + Black + Green)",
                image: "https://cdn.hstatic.net/products/200000722513/imgi_3_594_ek398w_black_white_green_1__fd6be6580b244eb38d0ad895cc97d764_master.jpg",
                originalPrice: 1090000,
                salePrice: 820000,
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
                originalPrice: 3990000,
                salePrice: 2390000,
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
                originalPrice: 3390000,
                salePrice: 2690000,
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
                originalPrice: 3990000,
                salePrice: 2690000,
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
                originalPrice: 3790000,
                salePrice: 2850000,
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
                originalPrice: 4390000,
                salePrice: 3150000,
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
                originalPrice: 4990000,
                salePrice: 3290000,
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
                originalPrice: 4190000,
                salePrice: 3490000,
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
                originalPrice: 4490000,
                salePrice: 3690000,
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
                originalPrice: 6890000,
                salePrice: 5400000,
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
                originalPrice: 990000,
                salePrice: 0, // Vì là quà tặng
                discount: 100, // Giảm 100% khi mua đủ combo
                qty: 1
            }

        ]


    },
    {
        id: "pc-gvn-i5-14400f-rtx-5060",
        category: "PC BÁN CHẠY NHẤT",
        name: "PC GVN Intel i5-14400F/ VGA RTX 5060 (DDR5)",
        originalPrice: 27720000,
        salePrice: 24590000,
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
                originalPrice: 1190000,
                salePrice: 710000,
                description: "Pin rời / Không dây / DPI - 12.000",
                rating: 0.0,
                reviews: 0
            },
            {
                id: "keyboard-edra-ek375w-ek398w-white-black-green",
                name: "Bàn phím E-Dra EK375W EK398W (White + Black + Green)",
                image: "https://cdn.hstatic.net/products/200000722513/imgi_3_594_ek398w_black_white_green_1__fd6be6580b244eb38d0ad895cc97d764_master.jpg",
                originalPrice: 1090000,
                salePrice: 820000,
                description: "Layout độc đáo, phối màu nổi bật, kết nối không dây tiện dụng",
                rating: 0.0,
                reviews: 0
            },
            {
                id: "dahua-lm25e231",
                name: "Màn hình Dahua DHI-LM25-E231 25\" IPS 180Hz chuyên game",
                image: "https://product.hstatic.net/200000722513/product/thit-k-cha-c-tn-_4__d80b68c7123a41b89bf213ffadb4d43f_master.png",
                category: "Flash Sale",
                originalPrice: 3990000,
                salePrice: 2390000,
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
                originalPrice: 21120000,
                salePrice: 18990000,
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
                originalPrice: 35920000,
                salePrice: 34790000,
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
                originalPrice: 19420000,
                salePrice: 17190000,
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
                originalPrice: 18420000,
                salePrice: 16190000,
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
                originalPrice: 990000,
                salePrice: 0, // Vì là quà tặng
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
            const $btn = $(`.tab-btn`). filter(function () {
                return $(this).attr('onclick')?.includes(tabId);
            });
            $btn.addClass('active');
        }
        if (tabId === 'tab3') {
            const targetOffset = document.querySelector('.product-tabs').offsetTop - 60;
            window.scrollTo({ top: targetOffset, behavior: 'smooth' });
        }
    };

    // ---------------------------
    // Robust URL param handling & recovery (for OAuth / login redirects)
    // ---------------------------
    const urlParams = new URLSearchParams(window.location.search);
    let productId = urlParams.get('id');
    let normName = urlParams.get('name');
    let type = urlParams.get('type');

    // small helper to parse query from an arbitrary URL string
    function parseQueryFromUrl(url) {
        try {
            const u = new URL(url, window.location.origin);
            return new URLSearchParams(u.search);
        } catch (err) {
            const idx = url.indexOf('?');
            if (idx === -1) return new URLSearchParams('');
            return new URLSearchParams(url.slice(idx + 1));
        }
    }

    // Try to recover product identifying params from known places:
    //  - localStorage.postLoginRedirect (saved before starting OAuth)
    //  - localStorage.pendingAction (pendingAction payload may contain product)
    //  - localStorage.pendingCartItem
    //  - document.referrer (if it was a product link)
    //  - sessionStorage.lastProductURL (optional)
    function tryRecoverParams() {
        // 1) sessionStorage.postLoginRedirect (per-tab) preferred
        try {
            if (typeof sessionStorage !== 'undefined') {
                const postSession = sessionStorage.getItem('postLoginRedirect');
                if (postSession) {
                    const p = parseQueryFromUrl(postSession);
                    const rid = p.get('id'), rname = p.get('name'), rtype = p.get('type');
                    if (rid || rname || rtype) {
                        console.log('[RECOVER] from sessionStorage.postLoginRedirect:', postSession);
                        return { id: rid, name: rname, type: rtype, source: 'session' };
                    }
                }
            }
        } catch (e) { /* ignore */ }

        // 2) localStorage.postLoginRedirect (fallback)
        try {
            const post = localStorage.getItem('postLoginRedirect');
            if (post) {
                const p = parseQueryFromUrl(post);
                const rid = p.get('id'), rname = p.get('name'), rtype = p.get('type');
                if (rid || rname || rtype) {
                    console.log('[RECOVER] from localStorage.postLoginRedirect:', post);
                    return { id: rid, name: rname, type: rtype, source: 'local' };
                }
            }
        } catch (e) { /* ignore */ }

        // 3) pendingAction payload product(s)
        try {
            const raw = localStorage.getItem('pendingAction');
            if (raw) {
                const act = JSON.parse(raw);
                const p = act.payload;
                if (p) {
                    const pr = p.product || p;
                    if (pr && pr.id) {
                        console.log('[RECOVER] from pendingAction.payload.product');
                        return { id: pr.id, name: pr.name || null, type: null, source: 'pendingAction' };
                    }
                    if (Array.isArray(p.products) && p.products.length && p.products[0].product && p.products[0].product.id) {
                        const pr0 = p.products[0].product;
                        console.log('[RECOVER] from pendingAction.payload.products[0]');
                        return { id: pr0.id, name: pr0.name || null, type: null, source: 'pendingAction' };
                    }
                }
            }
        } catch (e) { /* ignore */ }

        // 4) pendingCartItem
        try {
            const pending = localStorage.getItem('pendingCartItem');
            if (pending) {
                const it = JSON.parse(pending);
                if (it && it.id) {
                    console.log('[RECOVER] from pendingCartItem');
                    return { id: it.id, name: it.name || null, type: null, source: 'pendingCartItem' };
                }
            }
        } catch (e) { /* ignore */ }

        // 5) referrer
        try {
            const ref = document.referrer;
            if (ref && ref.includes('resetproduct.html')) {
                const p = parseQueryFromUrl(ref);
                const rid = p.get('id'), rname = p.get('name'), rtype = p.get('type');
                if (rid || rname || rtype) {
                    console.log('[RECOVER] from document.referrer:', ref);
                    return { id: rid, name: rname, type: rtype, source: 'referrer' };
                }
            }
        } catch (e) { /* ignore */ }

        // 6) sessionStorage.lastProductURL
        try {
            const last = sessionStorage.getItem('lastProductURL');
            if (last) {
                const p = parseQueryFromUrl(last);
                const rid = p.get('id'), rname = p.get('name'), rtype = p.get('type');
                if (rid || rname || rtype) {
                    console.log('[RECOVER] from sessionStorage.lastProductURL');
                    return { id: rid, name: rname, type: rtype, source: 'session-last' };
                }
            }
        } catch (e) { /* ignore */ }

        return null;
    }

    // Detect if URL looks like a login callback (contains credentials or login marker) but missing product params
    const hasLoginLike = urlParams.get('email') || urlParams.get('login') || urlParams.get('password');

    if (!productId && hasLoginLike) {
        console.log('[INFO] URL contains login-like params but no productId — attempting post-login recovery.');

        // If processAfterLoginNoReload exists, run it to refresh header/cart and process pendingAction,
        // then try to recover product params and redirect back to product page if found.
        if (typeof processAfterLoginNoReload === 'function') {
            processAfterLoginNoReload().then(() => {
                const rec = tryRecoverParams();
                if (rec && (rec.id || rec.name || rec.type)) {
                    const base = window.location.pathname.replace(/\/?resetproduct\.html$/i, '/resetproduct.html');
                    const params = new URLSearchParams(window.location.search);
                    // remove sensitive/login params
                    params.delete('email'); params.delete('password'); params.delete('login');
                    if (rec.id) params.set('id', rec.id);
                    if (rec.name) params.set('name', rec.name);
                    if (rec.type) params.set('type', rec.type);
                    const newUrl = base + '?' + params.toString();
                    try { localStorage.removeItem('postLoginRedirect'); } catch (e) {}
                    console.log('[RECOVER] Redirecting to recovered product URL:', newUrl);
                    window.location.href = newUrl;
                    return;
                } else {
                    // no recoverable product; clean login params from URL to avoid repeated confusion
                    const clean = window.location.pathname;
                    window.history.replaceState({}, document.title, clean);
                    // continue initialization (will show not found below)
                }
            }).catch(err => {
                console.warn('processAfterLoginNoReload failed:', err);
                // fallback immediate recover attempt
                const rec = tryRecoverParams();
                if (rec && (rec.id || rec.name || rec.type)) {
                    const base = window.location.pathname.replace(/\/?resetproduct\.html$/i, '/resetproduct.html');
                    const params = new URLSearchParams(window.location.search);
                    params.delete('email'); params.delete('password'); params.delete('login');
                    if (rec.id) params.set('id', rec.id);
                    if (rec.name) params.set('name', rec.name);
                    if (rec.type) params.set('type', rec.type);
                    const newUrl = base + '?' + params.toString();
                    try { localStorage.removeItem('postLoginRedirect'); } catch (e) {}
                    window.location.href = newUrl;
                    return;
                }
            });

            // stop further synchronous initialization here — the async path will redirect if recovered
            return;
        } else {
            // processAfterLoginNoReload not available → try immediate recovery
            const rec = tryRecoverParams();
            if (rec && (rec.id || rec.name || rec.type)) {
                const base = window.location.pathname.replace(/\/?resetproduct\.html$/i, '/resetproduct.html');
                const params = new URLSearchParams(window.location.search);
                params.delete('email'); params.delete('password'); params.delete('login');
                if (rec.id) params.set('id', rec.id);
                if (rec.name) params.set('name', rec.name);
                if (rec.type) params.set('type', rec.type);
                const newUrl = base + '?' + params.toString();
                try { localStorage.removeItem('postLoginRedirect'); } catch (e) {}
                window.location.href = newUrl;
                return;
            } else {
                const clean = window.location.pathname;
                window.history.replaceState({}, document.title, clean);
                // continue init; will show not found
            }
        }
    }

    // If still missing product identifiers, attempt a silent recover before proceeding
    if (!productId && !normName && !type) {
        const rec = tryRecoverParams();
        if (rec) {
            productId = rec.id;
            normName = rec.name;
            type = rec.type;
            console.log('[RECOVER] Applied recovered params:', { productId, normName, type });
        }
    }

    // Debug: log URL params after recovery attempts
    console.log('[DEBUG] URL params (after recover attempt):', { productId, normName, type });

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

    // 🔥 Helper: Lấy giá từ product an toàn
    function getPrices(product) {
        const sale = product.salePrice !== undefined && product.salePrice !== null
            ? product.salePrice
            : parsePrice(product.price_new ?? product.new_price ?? product.price);

        const original = product.originalPrice !== undefined && product.originalPrice !== null
            ? product.originalPrice
            : parsePrice(product.price_old ?? product.old_price);

        return {
            sale: sale ?? 0,
            original: original ?? 0
        };
    }

    function renderProduct(product) {
        if (!product) {
            showNotFound('Không tìm thấy sản phẩm (product null)');
            return;
        }

        console.log('[DEBUG] Render product:', product);


        // 🔹 Luôn chuẩn hoá category về string để tránh lỗi khi là mảng
        if (Array.isArray(product.category)) {
            product.category = product.category.join(' ');
        }

        // Ensure we have an id (some data sources might not provide id)
        if (!product.id && product.name) {
            product.id = normalizeName(product.name);
            console.warn('[DEBUG] product had no id - generated id from name:', product.id);
        }

        // Store last product URL to help recovery if redirect occurs later
        try {
            sessionStorage.setItem('lastProductURL', window.location.href);
        } catch (e) { /* ignore */ }

        // Expose current rendered product so buy handlers can use it even if it's not in window.products
        window.currentProduct = product;

        // 🔹 Set thông tin cơ bản
    $('#productCategory').text(product.category || '');
        $('#productName, #productTitle').text(product.name || '');

        // 🔹 Rating
        const ratingStars = generateStars(product.rating || 0);
        $('#productRatingSection').html(`
        <span class="stars">${ratingStars}</span>
        <a href="#tab3" class="review-link" onclick="document.querySelectorAll('.tab-btn')[2].click()">Xem đánh giá</a>
    `);

        // 🔹 Lấy giá
        const { sale, original } = getPrices(product);

        $('#productPrice').text(formatPrice(sale));
        if (original && original > sale) {
            $('#productOriginalPrice').text(formatPrice(original));
            $('#productDiscount').text(`-${Math.round((1 - sale / original) * 100)}%`);
        } else {
            $('#productOriginalPrice').text('');
            $('#productDiscount').text('');
        }

        // 🔹 Mô tả và nút mua
        $('#productDescription').html(product.description || '');
        $('.buy-now').attr('data-id', product.id || '');

        // 🔹 Ảnh chính
        const $img = $('#mainImage');
        $img.attr('src', product.image)
            .css({
                'object-fit': 'contain',
                'width': '100%',
                'height': '100%',
                'margin': '0',
                'padding': '50px',
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
            function () { $(this).css({'box-shadow': '0 16px 48px 0 rgba(0,0,0,0.22)', 'transform': 'scale(1.01)'}); },
            function () { $(this).css({'box-shadow': '0 8px 32px 0 rgba(0,0,0,0.18)', 'transform': 'scale(1)'}); }
        );

        $('#lightgallery a').attr('href', product.image);
        if (product.thumbnails && Array.isArray(product.thumbnails) && product.thumbnails.length > 1) {
            setupThumbnails(product.thumbnails);
        } else {
            setupThumbnails([product.image]);
        }

        // Sau khi render xong product
        if (product.category?.toLowerCase() === "flash sale" || product.tags?.includes("flash")) {
            $("#flashSaleBox").css("display", "block");
            startFlashSaleCountdown(product); // gọi hàm countdown
        } else {
            $("#flashSaleBox").css("display", "none");
        }

        // 🔹 Bảng thông số kỹ thuật
        let specsHtml = '<tr><th>Thành phần</th><th>Chi tiết</th></tr>';

        const categoryStr = typeof product.category === 'string' ? product.category.toLowerCase() : '';
        if (
            (categoryStr.includes('chuột') || product.name?.toLowerCase()?.includes('chuột')
                || window.location.search.includes('type=mouse'))
        ) {
            // 🖱 Chuột
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
            // 🔹 Specs mảng
            specsHtml += product.specs.map(spec => `<tr><td>${spec.key}</td><td>${spec.value}</td></tr>`).join('');

        } else if (
            window.location.search.includes('type=display') ||
            categoryStr.includes('màn hình') ||
            product.name?.toLowerCase()?.includes('màn hình')
        ) {
            // 🖥 Màn hình
            const displayFields = [
                { key: 'Tấm nền', value: product.panel },
                { key: 'Tần số quét', value: product.refresh_rate },
                { key: 'Kích thước', value: product.size },
                { key: 'Độ phân giải', value: product.resolution }
            ];
            specsHtml += displayFields.filter(f => f.value).map(f => `<tr><td>${f.key}</td><td>${f.value}</td></tr>`).join('');

        } else if (product.desc && Array.isArray(product.desc) && product.desc.length > 0) {
            specsHtml += product.desc.map(d => `<tr><td>Đặc điểm</td><td>${d}</td></tr>`).join('');

        } else {
            // 🔹 Thông số PC/laptop
            const fields = [
                { key: 'CPU', value: product.cpu },
                { key: 'GPU', value: product.gpu },
                { key: 'RAM', value: product.ram },
                { key: 'Ổ cứng', value: product.storage },
                { key: 'Màn hình', value: product.display || product.screen },
                { key: 'Mainboard', value: product.mainboard },
                { key: 'PSU', value: product.psu },
                { key: 'Case', value: product.case },
                { key: 'Hệ điều hành', value: product.os }
            ];
            specsHtml += fields.filter(f => f.value).map(f => `<tr><td>${f.key}</td><td>${f.value}</td></tr>`).join('');
        }

        $('#productSpecs').html(specsHtml);

        // 🔹 Recently viewed + bundle + related
        saveRecentlyViewed(prepareProduct(product));
        renderRecentlyViewed();
        bindRecentlyViewedEvents();
        renderBundleProducts(product.bundle);
        renderRelatedProducts(product.related);
        checkComboGift(product);

        // 🔹 Toggle mô tả
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
        (async () => {
            // 1. Kiểm tra trong window.products trước (dữ liệu từ index)
            const foundInWindow = window.products.find(p => p.id === productId);
            if (foundInWindow) {
                renderProduct(foundInWindow);
                return;
            }
            // 2. Thử tìm trong các file loại sản phẩm
            const allTypes = ['pc', 'laptop', 'mouse', 'keyboard', 'display'];
            let allProducts = [];
            for (const t of allTypes) {
                await new Promise(resolve => {
                    fetchProductsByType(t, list => {
                        allProducts = allProducts.concat(list);
                        resolve();
                    });
                });
            }
            const found = allProducts.find(p => p.id === productId);
            if (found) {
                renderProduct(found);
                return;
            }
            // 3. Nếu vẫn không thấy, thử tìm trong news.json (tìm trong từng bài và từng section)
            try {
                const resp = await fetch('./pc-part-dataset/processed/news.json');
                if (!resp.ok) throw new Error('Fetch news.json failed: ' + resp.status);
                const newsList = await resp.json();
                let foundProduct = null;
                for (const news of newsList) {
                    // Kiểm tra trực tiếp trong news.products (nếu có)
                    if (Array.isArray(news.products)) {
                        foundProduct = news.products.find(p => p.id === productId);
                        if (foundProduct) break;
                    }
                    // Kiểm tra trong từng section.products (nếu có)
                    if (Array.isArray(news.sections)) {
                        for (const section of news.sections) {
                            if (Array.isArray(section.products)) {
                                foundProduct = section.products.find(p => p.id === productId);
                                if (foundProduct) break;
                            }
                        }
                        if (foundProduct) break;
                    }
                }
                if (foundProduct) {
                    renderProduct(foundProduct);
                } else {
                    showNotFound(`Không tìm thấy sản phẩm với ID: ${productId}`);
                }
            } catch (err) {
                console.error('[DEBUG] Lỗi fetch news.json:', err);
                showNotFound('Lỗi tải dữ liệu sản phẩm');
            }
        })();
        // Nếu có type và name (từ allproducts) → giữ logic cũ
    } else if (type && normName) {
        fetchProductsByType(type, list => {
            if (!Array.isArray(list)) return showNotFound('Dữ liệu sản phẩm không hợp lệ');
            console.log('[DEBUG] Fetched list for type ' + type + ':', list);
            const found = list.find(p => normalizeName(p.name) === normName);
            if (found) {
                // ensure currentProduct set so buy-now works even if window.products doesn't include it
                renderProduct(found);
            }
            else showNotFound('Không tìm thấy sản phẩm trong file dữ liệu cho type: ' + type);
        });
        // Nếu thiếu cả id, name, type → not founds
    } else {
        showNotFound('Thiếu thông tin id, name hoặc type trên URL');
    }
});