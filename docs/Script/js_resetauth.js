// ==================== HỖ TRỢ ====================
// Hiển thị lỗi hoặc thông báo
function showMessage(elementId, message, type = "error") {
    const box = document.getElementById(elementId);
    if (box) {
        box.textContent = message;
        box.className = type === "success" ? "form-message success" : "form-message error";
    }
}

// ==================== Cross-tab auth broadcast (BroadcastChannel with localStorage fallback) ====================
const authChannel = (() => {
    try {
        return new BroadcastChannel('fn_auth_channel');
    } catch (e) {
        return null;
    }
})();

function broadcastAuthEvent(payload) {
    try {
        if (authChannel) {
            authChannel.postMessage(payload);
        } else {
            // fallback: short-lived localStorage key to trigger storage event
            localStorage.setItem('fn_auth_event', JSON.stringify({ ...payload, t: Date.now() }));
            setTimeout(() => {
                try { localStorage.removeItem('fn_auth_event'); } catch (e) { /* ignore */ }
            }, 500);
        }
    } catch (err) {
        console.warn('broadcastAuthEvent failed', err);
    }
}

function handleIncomingAuthEvent(ev) {
    let data = ev;
    // storage event shape: { key, newValue }
    if (ev && ev.key === 'fn_auth_event' && ev.newValue) {
        try { data = JSON.parse(ev.newValue); } catch (e) { return; }
    }
    if (!data || !data.type) return;

    if (data.type === 'login') {
        // update UI & localStorage from payload if provided, otherwise re-check session
        if (data.user) {
            setAuthLocals(data.user);
            try { window.dispatchEvent(new Event('user:login')); } catch (e) {}
        } else {
            // no user payload → ask server
            processAfterLoginNoReload().catch(() => {});
        }
    } else if (data.type === 'logout') {
        clearAuthLocals();
        try { window.dispatchEvent(new Event('user:logout')); } catch (e) {}
    } else if (data.type === 'refresh') {
        // re-sync from server
        processAfterLoginNoReload().catch(() => {});
    }
}

if (authChannel) {
    authChannel.onmessage = (m) => handleIncomingAuthEvent(m.data);
} else {
    window.addEventListener('storage', handleIncomingAuthEvent);
}

// ==================== localStorage helpers for auth ====================
function setAuthLocals(user) {
    try {
        if (!user) return;
        localStorage.setItem("userId", user.id || "");
        localStorage.setItem("firstName", (user.firstName || "").trim());
        localStorage.setItem("lastName", (user.lastName || "").trim());
        localStorage.setItem("email", user.email || "");
        // prefer lastName or firstName as display name fallback
        localStorage.setItem("userName", (user.lastName || user.firstName || "").trim());
        if (user.avatar_url) localStorage.setItem("avatarUrl", user.avatar_url);
        else localStorage.removeItem("avatarUrl");
        localStorage.removeItem("cartLocked");
    } catch (err) {
        console.warn('setAuthLocals error', err);
    }
}

function clearAuthLocals() {
    try {
        localStorage.removeItem("userId");
        localStorage.removeItem("firstName");
        localStorage.removeItem("lastName");
        localStorage.removeItem("email");
        localStorage.removeItem("userName");
        localStorage.removeItem("avatarUrl");
        localStorage.removeItem("cartLocked");
    } catch (err) {
        console.warn('clearAuthLocals error', err);
    }
}

// ==================== Đồng bộ giỏ hàng từ localStorage lên server ====================
async function syncCartToServer() {
    try {
        const cart = JSON.parse(localStorage.getItem('cart')) || [];
        for (const item of cart) {
            await fetch(`${window.API_BASE}/api/cart`, {
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
                    quantity: item.quantity || 1
                })
            });
        }
        // Sau khi đồng bộ, lấy giỏ hàng từ server để cập nhật localStorage
        const res = await fetch(`${window.API_BASE}/api/cart`, {
            method: 'GET',
            credentials: 'include'
        });
        const data = await res.json();
        if (data.success) {
            localStorage.setItem('cart', JSON.stringify(data.cart));
            if (typeof updateCartCount === 'function') {
                updateCartCount();
            }
        }
    } catch (err) {
        console.error('Lỗi đồng bộ giỏ hàng:', err);
    }
}

// ==================== NEW: processAfterLoginNoReload using server /api/session-sync ====================
// This function returns a Promise that resolves when session sync completes.
// It calls server /api/session-sync which should return a single atomic payload with user, cart, orders, addresses.
async function processAfterLoginNoReload() {
    try {
        // call the atomic session-sync endpoint to get fresh user, cart, orders, addresses
        const res = await fetch(`${window.API_BASE}/api/session-sync`, {
            method: 'GET',
            credentials: 'include'
        });

        // If 401/403 or not ok, fallback to /api/me and return accordingly
        if (!res.ok) {
            // fallback: try /api/me to at least update user info (non-atomic)
            try {
                const meRes = await fetch(`${window.API_BASE}/api/me`, { credentials: 'include' });
                const meData = await meRes.json();
                if (meData && meData.loggedIn && meData.user) {
                    setAuthLocals(meData.user);
                    if (typeof updateUserDisplay === 'function') updateUserDisplay();
                    broadcastAuthEvent({ type: 'login', user: meData.user });
                } else {
                    clearAuthLocals();
                    broadcastAuthEvent({ type: 'logout' });
                }
            } catch (e) {
                console.warn('Fallback /api/me failed', e);
            }
            // still reject to allow caller to handle
            throw new Error('session-sync failed');
        }

        const data = await res.json();

        if (!data || !data.success) {
            // server responded but no payload
            // cleanup local and return
            clearAuthLocals();
            if (typeof updateUserDisplay === 'function') updateUserDisplay();
            return data;
        }

        // 1) Update user info (server is source of truth)
        if (data.user) {
            setAuthLocals(data.user);
        }

        // 2) Update cart in localStorage from server
        if (Array.isArray(data.cart)) {
            try { localStorage.setItem('cart', JSON.stringify(data.cart)); } catch (e) { /* ignore */ }
        }

        // 3) Update orders / addresses caches if present
        if (Array.isArray(data.orders)) {
            try { localStorage.setItem('orders', JSON.stringify(data.orders)); } catch (e) {}
        }
        if (Array.isArray(data.addresses)) {
            try { localStorage.setItem('addresses', JSON.stringify(data.addresses)); } catch (e) {}
        }

        // 4) Update UI immediately
        if (typeof updateUserDisplay === 'function') updateUserDisplay();
        if (typeof updateCartCount === 'function') updateCartCount();
        if (typeof updateOrderCount === 'function') updateOrderCount();

        // 5) Broadcast login to other tabs
        broadcastAuthEvent({ type: 'login', user: data.user || null });

        // 6) Process pending actions (if any)
        if (typeof processPendingAction === 'function') {
            try { await processPendingAction(); } catch (err) { console.warn('processPendingAction error', err); }
        }

        return data;
    } catch (err) {
        console.error('processAfterLoginNoReload error:', err);
        throw err;
    }
}

// ==================== KIỂM TRA TRẠNG THÁI ĐĂNG NHẬP (returns value) ====================
async function checkLoginStatus() {
    try {
        const res = await fetch(`${window.API_BASE}/api/me`, {
            method: "GET",
            credentials: "include"
        });
        const data = await res.json();

        if (data.loggedIn && data.user) {
            // Lưu thông tin cần thiết vào localStorage
            localStorage.setItem("userId", data.user.id || "");
            localStorage.setItem("firstName", (data.user.firstName || "").trim());
            localStorage.setItem("lastName", (data.user.lastName || "").trim());
            localStorage.setItem("email", data.user.email || "");
            localStorage.setItem("userName", (data.user.lastName || "").trim());
            if (data.user.avatar_url) {
                localStorage.setItem("avatarUrl", data.user.avatar_url);
            } else {
                localStorage.removeItem("avatarUrl");
            }

            // 🔓 Mở khoá giỏ hàng khi đã đăng nhập
            localStorage.removeItem("cartLocked");
            if (typeof updateUserDisplay === "function") updateUserDisplay();
            return { loggedIn: true, user: data.user };
        } else {
            // Xóa thông tin user nếu chưa đăng nhập
            clearAuthLocals();
            if (typeof updateUserDisplay === "function") updateUserDisplay();
            return { loggedIn: false };
        }
    } catch (err) {
        console.error("Lỗi kiểm tra đăng nhập:", err);
        return { loggedIn: false, error: err.message };
    }
}

// ==================== ĐỒNG BỘ HÓA ĐĂNG NHẬP GIỮA CÁC SCRIPT ====================
// Lắng nghe sự kiện login để cập nhật lại UI & trạng thái trên toàn bộ các script
window.addEventListener('user:login', () => {
    // Prefer atomic sync; ignore errors
    processAfterLoginNoReload().catch(() => {});
});

// Also ensure other modules can react to auth changes
window.addEventListener('user:logout', () => {
    clearAuthLocals();
    if (typeof updateUserDisplay === 'function') updateUserDisplay();
    if (typeof updateCartCount === 'function') updateCartCount();
    if (typeof updateOrderCount === 'function') updateOrderCount();
});

// ==================== ĐĂNG KÝ ====================
const registerForm = document.getElementById("registerForm");
if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("register-email").value.trim();
        const firstName = document.getElementById("register-firstname").value.trim();
        const lastName  = document.getElementById("register-lastname").value.trim();
        const password  = document.getElementById("register-password").value.trim();

        showMessage("register-error", "");

        try {
            const res = await fetch(`${window.API_BASE}/api/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ email, firstName, lastName, password })
            });
            const data = await res.json();
            if (data.success) {
                showMessage("register-error", "✅ Đăng ký thành công! Vui lòng đăng nhập.", "success");
                // Kiểm tra và thêm sản phẩm tạm sau đăng ký
                const pendingItem = JSON.parse(localStorage.getItem('pendingCartItem'));
                if (pendingItem) {
                    addToCart(pendingItem.id, pendingItem.name, pendingItem.originalPrice, pendingItem.salePrice, pendingItem.discountPercent, pendingItem.image);
                    localStorage.removeItem('pendingCartItem');
                    showMessage("register-error", `Đã thêm "${pendingItem.name}" vào giỏ hàng sau khi đăng ký!`, "success");
                }
                // Cập nhật UI header
                if (typeof updateUserDisplay === "function") {
                    updateUserDisplay();
                }
                setTimeout(() => {
                    if (typeof CyberModal !== "undefined" && CyberModal.showLogin) CyberModal.showLogin();
                    showMessage("register-error", "");
                }, 1500);
            } else {
                showMessage("register-error", data.error || "❌ Đăng ký thất bại!");
            }
        } catch (err) {
            console.error(err);
            showMessage("register-error", "❌ Lỗi kết nối server!");
        }
    });
}

// ==================== ĐĂNG NHẬP ====================
const loginForm = document.getElementById("loginForm");
if (loginForm) {
    document.addEventListener('submit', async function (e) {
        const form = e.target;
        if (!form || form.id !== 'loginForm') return;
        e.preventDefault();

        const email = document.getElementById("login-email")?.value.trim() || '';
        const password = document.getElementById("login-password")?.value.trim() || '';

        showMessage("login-error", "");

        try {
            const res = await fetch(`${window.API_BASE}/api/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();

            if (data.success) {
                if (data.user) {
                    setAuthLocals(data.user);
                    if (typeof updateUserDisplay === "function") updateUserDisplay();
                }

                try {
                    await processAfterLoginNoReload();
                } catch (err) {
                    console.warn('session-sync failed after login, falling back to syncCartToServer', err);
                    try { await syncCartToServer(); } catch (e) { /* ignore */ }
                }

                if (typeof CyberModal !== "undefined" && CyberModal.close) CyberModal.close();

                try { window.dispatchEvent(new Event('user:login')); } catch (err) { console.warn('dispatch user:login failed', err); }
                broadcastAuthEvent({ type: 'login', user: data.user || null });

                const postLoginRedirect = localStorage.getItem('postLoginRedirect');
                if (postLoginRedirect && postLoginRedirect !== window.location.href) {
                    localStorage.removeItem('postLoginRedirect');
                    window.location.href = postLoginRedirect;
                    return;
                } else if (postLoginRedirect) {
                    localStorage.removeItem('postLoginRedirect');
                }
            } else {
                showMessage("login-error", data.error || "❌ Sai email hoặc mật khẩu!");
            }
        } catch (err) {
            console.error(err);
            showMessage("login-error", "❌ Lỗi kết nối server!");
        }
    });
}

// ==================== QUÊN MẬT KHẨU ====================
const forgotForm = document.getElementById("forgotForm");
if (forgotForm) {
    forgotForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("forgot-email").value.trim();

        showMessage("forgot-error", "");

        try {
            const res = await fetch(`${window.API_BASE}/api/forgot-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email })
            });
            const data = await res.json();

            if (data.success) {
                showMessage("forgot-error", "✅ Vui lòng kiểm tra email để đặt lại mật khẩu!", "success");
            } else {
                showMessage("forgot-error", data.error || "❌ Không thể gửi yêu cầu!");
            }
        } catch (err) {
            console.error(err);
            showMessage("forgot-error", "❌ Lỗi kết nối server!");
        }
    });
}

/* =======================================================================
   GOOGLE LOGIN
   ======================================================================= */
document.addEventListener("click", (e) => {
    const btn = e.target.closest("#googleLoginBtn-login, #googleLoginBtn-register, #googleLoginBtn-forgot, .google-btn");
    if (!btn) return;
    if (btn.disabled) return;

    try {
        // Truyền state là URL hiện tại để backend redirect đúng trang sau OAuth
        window.location.href = `${window.API_BASE}/api/auth/google?state=${encodeURIComponent(window.location.href)}`;
    } catch (err) {
        console.error("Không thể chuyển sang Google OAuth:", err);
        showMessage("login-error", "❌ Không thể mở Google Login, vui lòng thử lại!");
    }
});

(function handleGoogleCallbackAndAutoOpen() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const loginStatus = urlParams.get("login");

        if (loginStatus === "google") {
            // 🔓 Mở khoá giỏ hàng
            localStorage.removeItem("cartLocked");

            // Lấy thông tin và đồng bộ (awaitable)
            processAfterLoginNoReload().then(() => {
                if (typeof CyberModal !== "undefined" && CyberModal.close) CyberModal.close();
            }).catch(err => {
                console.warn('Sync session failed after Google OAuth:', err);
                // fallback to basic check to update UI
                checkLoginStatus().then(() => {
                    try { window.dispatchEvent(new Event('user:login')); } catch (e) {}
                });
                if (typeof CyberModal !== "undefined" && CyberModal.close) CyberModal.close();
            });

            // Xóa query param login khỏi URL để tránh xử lý lại khi reload/nhấn F5
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (loginStatus === "failed") {
            showMessage("login-error", "❌ Google login thất bại, vui lòng thử lại!");
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        // Always update check login on load (non-blocking)
        checkLoginStatus().catch(() => {});

        if (localStorage.getItem("showLoginAfterReset") === "true") {
            localStorage.removeItem("showLoginAfterReset");
            const openLoginModal = () => {
                if (typeof CyberModal !== "undefined" && typeof CyberModal.open === "function") {
                    CyberModal.open();
                } else {
                    setTimeout(openLoginModal, 200);
                }
            };
            openLoginModal();
        }
    } catch (err) {
        console.error("Lỗi xử lý callback Google/auto open:", err);
    }
})();

/* ========================================================================
   FACEBOOK LOGIN
   ======================================================================= */
document.addEventListener("click", (e) => {
    const btn = e.target.closest("#facebookLoginBtn-login, #facebookLoginBtn-register, #facebookLoginBtn-forgot, .facebook-btn");
    if (!btn) return;
    if (btn.disabled) return;

    try {
        // Truyền state là URL hiện tại để backend redirect đúng trang sau OAuth
        window.location.href = `${window.API_BASE}/api/auth/facebook?state=${encodeURIComponent(window.location.href)}`;
    } catch (err) {
        console.error("Không thể chuyển sang Facebook OAuth:", err);
        showMessage("login-error", "❌ Không thể mở Facebook Login, vui lòng thử lại!");
    }
});

(function handleFacebookCallback() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const loginStatus = urlParams.get("login");

        if (loginStatus === "facebook") {
            // 🔓 Mở khoá giỏ hàng
            localStorage.removeItem("cartLocked");

            // Thực hiện xử lý không reload
            processAfterLoginNoReload().then(() => {
                if (typeof CyberModal !== "undefined" && CyberModal.close) CyberModal.close();
            }).catch(err => {
                console.warn('Sync session failed after Facebook OAuth:', err);
                checkLoginStatus().then(() => {
                    try { window.dispatchEvent(new Event('user:login')); } catch (e) {}
                });
                if (typeof CyberModal !== "undefined" && CyberModal.close) CyberModal.close();
            });

            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (loginStatus === "failed") {
            showMessage("login-error", "❌ Facebook login thất bại, vui lòng thử lại!");
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    } catch (err) {
        console.error("Lỗi xử lý callback Facebook:", err);
    }
})();

// ==================== Logout helper (call when user logs out) ====================
async function doLogoutClientSide() {
    try {
        // Call server to clear cookie
        await fetch(`${window.API_BASE}/api/logout`, {
            method: 'POST',
            credentials: 'include'
        });
    } catch (err) {
        console.warn('Server logout request failed (client will still clear UI):', err);
    } finally {
        // Clear locally and notify other tabs
        clearAuthLocals();
        broadcastAuthEvent({ type: 'logout' });
        try { window.dispatchEvent(new Event('user:logout')); } catch (e) {}
    }
}

// Expose functions for other scripts
window.fnAuth = {
    processAfterLoginNoReload,
    checkLoginStatus,
    syncCartToServer,
    doLogoutClientSide,
    broadcastAuthEvent
};

// ==================== End of file ====================