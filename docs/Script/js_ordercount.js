// Shared order count helper (throttle + auth-aware + cross-tab sync)
(function () {
    if (window.updateOrderCount && window.updateOrderCount._isShared) return;

    // Helper: kiểm tra trạng thái đăng nhập (AuthSync ưu tiên)
    function isAuth() {
        try {
            if (window.AuthSync && typeof window.AuthSync.isLoggedIn === 'function') {
                return window.AuthSync.isLoggedIn();
            }
        } catch (e) { /* ignore */ }
        // fallback legacy keys
        return !!(localStorage.getItem('userId') || localStorage.getItem('userName'));
    }

    window._orderCountCache = window._orderCountCache || {
        lastCount: null,
        lastFetch: 0,
        inFlight: false,
        minInterval: 3000 // ms
    };

    async function _fetchOrderCount() {
        try {
            const res = await fetch(`${window.API_BASE}/api/orders`, {
                method: "GET",
                credentials: "include"
            });
            // Nếu server trả 401/403 -> không log lỗi nặng, coi như chưa đăng nhập
            if (res.status === 401 || res.status === 403) return null;
            const data = await res.json();
            if (data && data.success) {
                return Array.isArray(data.orders) ? data.orders.length : 0;
            } else {
                console.warn('updateOrderCount: API trả lỗi', data && data.error);
                return null;
            }
        } catch (err) {
            console.warn('updateOrderCount fetch error:', err);
            return null;
        }
    }

    async function updateOrderCount() {
        const orderCountElement = document.querySelector('.order-count');
        if (!orderCountElement) return;

        // Nếu chưa login -> ẩn và clear cache
        if (!isAuth()) {
            orderCountElement.style.display = 'none';
            window._orderCountCache.lastCount = null;
            return;
        }

        // Nếu đã có fetch đang chạy -> dùng cache hiện có (không ẩn)
        if (window._orderCountCache.inFlight) {
            if (typeof window._orderCountCache.lastCount === 'number') {
                const c = window._orderCountCache.lastCount;
                orderCountElement.textContent = c;
                orderCountElement.style.display = c > 0 ? 'inline-flex' : 'none';
            }
            return;
        }

        const now = Date.now();
        // Nếu fetch gần đây -> dùng cache
        if (now - window._orderCountCache.lastFetch < window._orderCountCache.minInterval &&
            typeof window._orderCountCache.lastCount === 'number') {
            const c = window._orderCountCache.lastCount;
            orderCountElement.textContent = c;
            orderCountElement.style.display = c > 0 ? 'inline-flex' : 'none';
            return;
        }

        // Bắt đầu fetch (không ẩn UI trước để tránh flicker)
        window._orderCountCache.inFlight = true;
        try {
            const count = await _fetchOrderCount();
            if (typeof count === 'number') {
                window._orderCountCache.lastCount = count;
                window._orderCountCache.lastFetch = Date.now();
                orderCountElement.textContent = count;
                orderCountElement.style.display = count > 0 ? 'inline-flex' : 'none';
            } else {
                // nếu null (401 hoặc lỗi) -> giữ trạng thái hiện tại, hoặc ẩn nếu server báo không auth
                if (!isAuth()) {
                    orderCountElement.style.display = 'none';
                }
            }
        } finally {
            window._orderCountCache.inFlight = false;
        }
    }

    // Expose
    window.updateOrderCount = updateOrderCount;
    window.updateOrderCount._isShared = true;

    // Sync khi auth thay đổi (AuthSync) — gọi update/hide tương ứng
    try {
        if (window.AuthSync && typeof window.AuthSync.onChange === 'function') {
            window.AuthSync.onChange((state) => {
                try {
                    if (state && state.loggedIn) {
                        // khi login -> update ngay
                        updateOrderCount();
                    } else {
                        // khi logout -> ẩn ngay và clear cache
                        const el = document.querySelector('.order-count');
                        if (el) el.style.display = 'none';
                        window._orderCountCache.lastCount = null;
                    }
                } catch (e) { console.warn('AuthSync.onChange handler error', e); }
            });
        }
    } catch (e) { /* ignore */ }

    // Cross-tab: lắng nghe storage -> nếu user keys hoặc orders thay đổi thì update
    window.addEventListener('storage', function (e) {
        try {
            if (!e) return;
            // Nếu user login/logout thay đổi -> gọi update/hide
            if (e.key === 'userId' || e.key === 'userName') {
                if (localStorage.getItem('userId') || localStorage.getItem('userName')) {
                    updateOrderCount();
                } else {
                    const el = document.querySelector('.order-count');
                    if (el) el.style.display = 'none';
                    window._orderCountCache.lastCount = null;
                }
            }
            // Nếu orders dữ liệu (nếu bạn lưu/đẩy key 'orders' across tabs) -> update
            if (e.key === 'orders') {
                updateOrderCount();
            }
        } catch (err) {
            console.warn('ordercount storage handler error', err);
        }
    });

    // Optional: try initial sync if DOM ready and user logged in
    document.addEventListener('DOMContentLoaded', () => {
        try {
            if (isAuth()) {
                updateOrderCount();
            } else {
                const el = document.querySelector('.order-count');
                if (el) el.style.display = 'none';
            }
        } catch (e) { /* ignore */ }
    });

    // small helper for manual control/tests
    window.orderCountShared = {
        refresh: updateOrderCount,
        cache: window._orderCountCache,
        isAuth
    };
})();