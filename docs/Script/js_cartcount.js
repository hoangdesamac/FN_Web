// Shared cart count helper (auth-aware, optimistic updates, debounce + cross-tab sync)
(function () {
    if (window.updateCartCount && window.updateCartCount._isCartShared) return;

    function isAuth() {
        try {
            if (window.AuthSync && typeof window.AuthSync.isLoggedIn === 'function') {
                return window.AuthSync.isLoggedIn();
            }
        } catch (e) {}
        return !!(localStorage.getItem('userId') || localStorage.getItem('userName'));
    }

    // cache/state
    window._cartCountCache = window._cartCountCache || {
        lastCount: null,
        lastFetch: 0,
        inFlight: false,
        minInterval: 2000, // ms - don't fetch too often
        pendingSyncTimer: null,
        syncDebounceMs: 700
    };

    // Helper: read count from localStorage (fast)
    function countFromLocal() {
        try {
            const cart = JSON.parse(localStorage.getItem('cart') || '[]');
            const gift = JSON.parse(localStorage.getItem('giftCart') || '[]');
            const normal = Array.isArray(cart) ? cart.reduce((t, i) => t + (Number(i.quantity) || 0), 0) : 0;
            const giftCount = Array.isArray(gift) ? gift.reduce((t, i) => t + (Number(i.quantity) || 0), 0) : 0;
            return normal + giftCount;
        } catch (e) {
            return null;
        }
    }

    function setDOMCount(n) {
        const el = document.querySelector('.cart-count');
        if (!el) return;
        const old = parseInt(el.textContent || '0') || 0;
        if (old !== n) {
            el.classList.add('cart-count-update');
            setTimeout(() => el.classList.remove('cart-count-update'), 500);
        }
        el.textContent = String(n);
        el.style.display = n > 0 ? 'inline-flex' : 'none';
    }

    // Use /api/cart to get authoritative cart when needed
    async function fetchServerCartCount() {
        try {
            const res = await fetch(`${(window.API_BASE || '').replace(/\/$/, '')}/api/cart`, {
                method: 'GET',
                credentials: 'include'
            });
            if (res.status === 401 || res.status === 403) return null;
            const data = await res.json();
            if (!data || !data.success) return null;
            const total = Array.isArray(data.cart) ? data.cart.reduce((t, i) => t + (Number(i.quantity) || 0), 0) : 0;
            return { total, cart: data.cart };
        } catch (e) {
            console.warn('cartcount fetch error', e);
            return null;
        }
    }

    // Public: updateCartCount() — quick path: localStorage -> cache -> server (throttled)
    async function updateCartCount() {
        const el = document.querySelector('.cart-count');
        if (!el) return;

        // If unauth, hide
        if (!isAuth()) {
            el.style.display = 'none';
            window._cartCountCache.lastCount = null;
            return;
        }

        // 1) Try local quick read
        const local = countFromLocal();
        if (typeof local === 'number') {
            window._cartCountCache.lastCount = local;
            window._cartCountCache.lastFetch = Date.now();
            setDOMCount(local);
            // schedule background authoritative sync but do not block UI
            scheduleBackgroundSync();
            return;
        }

        // 2) fallback to server fetch (throttled)
        const now = Date.now();
        if (now - window._cartCountCache.lastFetch < window._cartCountCache.minInterval &&
            typeof window._cartCountCache.lastCount === 'number') {
            setDOMCount(window._cartCountCache.lastCount);
            return;
        }

        if (window._cartCountCache.inFlight) {
            if (typeof window._cartCountCache.lastCount === 'number') setDOMCount(window._cartCountCache.lastCount);
            return;
        }

        window._cartCountCache.inFlight = true;
        try {
            const info = await fetchServerCartCount();
            if (info && typeof info.total === 'number') {
                window._cartCountCache.lastCount = info.total;
                window._cartCountCache.lastFetch = Date.now();
                setDOMCount(info.total);
                // update localStorage copy of cart if returned
                try { localStorage.setItem('cart', JSON.stringify(info.cart || [])); } catch(e) {}
            }
        } finally {
            window._cartCountCache.inFlight = false;
        }
    }

    // Optimistic increment/decrement/set helpers to make UI immediate
    function increment(delta = 1) {
        const cur = typeof window._cartCountCache.lastCount === 'number'
            ? window._cartCountCache.lastCount
            : (countFromLocal() ?? 0);
        const next = Math.max(0, cur + Number(delta || 1));
        window._cartCountCache.lastCount = next;
        window._cartCountCache.lastFetch = Date.now();
        setDOMCount(next);
        // schedule background sync to confirm with server
        scheduleBackgroundSync();
    }

    function decrement(delta = 1) {
        return increment(-Math.abs(delta || 1));
    }

    function setFromCart(cartArray) {
        try {
            const total = Array.isArray(cartArray) ? cartArray.reduce((t, i) => t + (Number(i.quantity) || 0), 0) : 0;
            window._cartCountCache.lastCount = total;
            window._cartCountCache.lastFetch = Date.now();
            try { localStorage.setItem('cart', JSON.stringify(cartArray || [])); } catch(e) {}
            setDOMCount(total);
        } catch (e) { console.warn('setFromCart error', e); }
    }

    // Debounced background authoritative sync
    function scheduleBackgroundSync() {
        try {
            if (window._cartCountCache.pendingSyncTimer) {
                clearTimeout(window._cartCountCache.pendingSyncTimer);
            }
            window._cartCountCache.pendingSyncTimer = setTimeout(async () => {
                window._cartCountCache.pendingSyncTimer = null;
                // only sync when logged in
                if (!isAuth()) return;
                // If already in flight, skip
                if (window._cartCountCache.inFlight) return;
                window._cartCountCache.inFlight = true;
                try {
                    const info = await fetchServerCartCount();
                    if (info && typeof info.total === 'number') {
                        window._cartCountCache.lastCount = info.total;
                        window._cartCountCache.lastFetch = Date.now();
                        setDOMCount(info.total);
                        try { localStorage.setItem('cart', JSON.stringify(info.cart || [])); } catch(e) {}
                    }
                } finally {
                    window._cartCountCache.inFlight = false;
                }
            }, window._cartCountCache.syncDebounceMs);
        } catch (e) { console.warn('scheduleBackgroundSync error', e); }
    }

    // storage/auth listeners to keep in sync cross-tab and when auth changes
    try {
        window.addEventListener('storage', (e) => {
            try {
                if (!e) return;
                if (e.key === 'cart' || e.key === 'giftCart') {
                    // local change -> immediate update from localStorage
                    const local = countFromLocal();
                    if (typeof local === 'number') {
                        window._cartCountCache.lastCount = local;
                        window._cartCountCache.lastFetch = Date.now();
                        setDOMCount(local);
                    }
                }
                if (e.key === 'auth_state' || e.key === 'auth_ping' || e.key === 'userId' || e.key === 'userName') {
                    // auth changed cross-tab -> refresh or hide
                    if (isAuth()) updateCartCount();
                    else {
                        const el = document.querySelector('.cart-count');
                        if (el) el.style.display = 'none';
                        window._cartCountCache.lastCount = null;
                    }
                }
            } catch (err) { console.warn('cartcount storage handler error', err); }
        });

        if (window.AuthSync && typeof window.AuthSync.onChange === 'function') {
            window.AuthSync.onChange((state) => {
                try {
                    if (state && state.loggedIn) updateCartCount();
                    else {
                        const el = document.querySelector('.cart-count');
                        if (el) el.style.display = 'none';
                        window._cartCountCache.lastCount = null;
                    }
                } catch (e) { console.warn('AuthSync cart onChange error', e); }
            });
        }
    } catch (e) { /* ignore */ }

    // initial populate on DOM ready
    document.addEventListener('DOMContentLoaded', () => {
        try {
            updateCartCount();
        } catch (e) { /* ignore */ }
    });

    // expose
    window.updateCartCount = updateCartCount;
    window.updateCartCount._isCartShared = true;

    window.cartCountShared = {
        refresh: updateCartCount,
        increment,
        decrement,
        setFromCart,
        fetchServerCartCount,
        isAuth,
        cache: window._cartCountCache
    };
})();