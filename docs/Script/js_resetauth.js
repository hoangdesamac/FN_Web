// ==================== HÀM HỖ TRỢ ====================
// Hiển thị lỗi hoặc thông báo
function showMessage(elementId, message, type = "error") {
    const box = document.getElementById(elementId);
    if (box) {
        box.textContent = message;
        box.className = type === "success" ? "form-message success" : "form-message error";
    }
}

// Đồng bộ giỏ hàng từ localStorage lên server
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

// Helper: xử lý hành động cần làm *sau* khi đã login (cùng-tab hoặc OAuth redirect)
async function processAfterLoginNoReload() {
    try {
        // 1) Update local user info from server
        if (typeof checkLoginStatus === 'function') {
            await checkLoginStatus();
        } else if (typeof fetchUserInfo === 'function') {
            await fetchUserInfo();
        }

        // 2) Đồng bộ giỏ hàng từ local -> server (nếu cần)
        try { await syncCartToServer(); } catch (e) { /* ignore */ }

        // 3) Cập nhật hiển thị header
        if (typeof updateUserDisplay === 'function') updateUserDisplay();
        if (typeof updateCartCount === 'function') updateCartCount();
        if (typeof updateOrderCount === 'function') updateOrderCount();

        // 4) Thông báo cho các script trong cùng tab (ví dụ resetproduct.js sẽ process pendingAction)
        try { window.dispatchEvent(new Event('user:login')); } catch (err) { console.warn('dispatch user:login failed', err); }

        // 5) Nếu có pendingAction lưu trong localStorage thì gọi hàm xử lý (nếu định nghĩa)
        if (typeof processPendingAction === 'function') {
            try { await processPendingAction(); } catch (err) { console.warn('processPendingAction error', err); }
        }
    } catch (err) {
        console.error('processAfterLoginNoReload error:', err);
    }
}

// ==================== KIỂM TRA TRẠNG THÁI ĐĂNG NHẬP ====================
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
            // syncCartToServer sẽ được gọi bởi processAfterLoginNoReload khi cần
        } else {
            // Xóa thông tin user nếu chưa đăng nhập
            localStorage.removeItem("userId");
            localStorage.removeItem("firstName");
            localStorage.removeItem("lastName");
            localStorage.removeItem("email");
            localStorage.removeItem("userName");
            localStorage.removeItem("avatarUrl");
        }

        if (typeof updateUserDisplay === "function") {
            updateUserDisplay();
        }
    } catch (err) {
        console.error("Lỗi kiểm tra đăng nhập:", err);
    }
}

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
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("login-email").value.trim();
        const password = document.getElementById("login-password").value.trim();

        showMessage("login-error", "");

        try {
            const res = await fetch(`${window.API_BASE}/api/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();

            if (data.success && data.user) {
                // Lưu vào localStorage ngay khi login
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

                // 🔓 Mở khoá giỏ hàng khi login thành công
                localStorage.removeItem("cartLocked");

                // Kiểm tra và thêm sản phẩm tạm sau đăng nhập
                const pendingItem = JSON.parse(localStorage.getItem('pendingCartItem'));
                if (pendingItem) {
                    addToCart(pendingItem.id, pendingItem.name, pendingItem.originalPrice, pendingItem.salePrice, pendingItem.discountPercent, pendingItem.image);
                    localStorage.removeItem('pendingCartItem');
                    showMessage("login-error", `Đã thêm "${pendingItem.name}" vào giỏ hàng sau khi đăng nhập!`, "success");
                }

                // Đồng bộ giỏ hàng sau đăng nhập
                await syncCartToServer();

                // Đóng modal nếu có
                if (typeof CyberModal !== "undefined" && CyberModal.close) CyberModal.close();
                if (typeof updateUserDisplay === "function") {
                    updateUserDisplay();
                }

                // Notify other scripts in same tab to process pendingAction and refresh UI
                try {
                    window.dispatchEvent(new Event('user:login'));
                } catch (err) {
                    console.warn('Không thể dispatch user:login event', err);
                }

                // --- Thay vì reload toàn trang, xử lý cập nhật header & pending action, và redirect nếu có redirect lưu trước đó ---
                const postLoginRedirect = localStorage.getItem('postLoginRedirect');
                // Thực hiện xử lý không reload
                await processAfterLoginNoReload();

                // Nếu có redirect về trang ban đầu thì chuyển hướng, còn không giữ nguyên trang hiện tại
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
        // Lưu trang hiện tại để redirect về sau OAuth (nếu có)
        try { localStorage.setItem('postLoginRedirect', window.location.href); } catch (err) { /* ignore */ }

        window.location.href = `${window.API_BASE}/api/auth/google`;
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

            // Lấy thông tin và đồng bộ
            // Thực hiện xử lý không reload: checkLoginStatus + sync + update header + process pending
            processAfterLoginNoReload().then(() => {
                if (typeof CyberModal !== "undefined" && CyberModal.close) CyberModal.close();

                const postLoginRedirect = localStorage.getItem('postLoginRedirect');
                if (postLoginRedirect && postLoginRedirect !== window.location.href) {
                    localStorage.removeItem('postLoginRedirect');
                    window.location.href = postLoginRedirect;
                    return;
                } else if (postLoginRedirect) {
                    localStorage.removeItem('postLoginRedirect');
                }
                // Nếu không có redirect, chỉ cập nhật UI (đã thực hiện ở processAfterLoginNoReload)
            }).catch(err => {
                console.warn('Sync cart failed after Google OAuth:', err);
                if (typeof CyberModal !== "undefined" && CyberModal.close) CyberModal.close();
                try { window.dispatchEvent(new Event('user:login')); } catch (e) {}
            });

            // Xóa query param login khỏi URL để tránh xử lý lại khi reload/nhấn F5
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (loginStatus === "failed") {
            showMessage("login-error", "❌ Google login thất bại, vui lòng thử lại!");
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        // Always update check login on load
        checkLoginStatus();

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
        // Lưu trang hiện tại để redirect về sau OAuth (nếu có)
        try { localStorage.setItem('postLoginRedirect', window.location.href); } catch (err) { /* ignore */ }

        window.location.href = `${window.API_BASE}/api/auth/facebook`;
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

                const postLoginRedirect = localStorage.getItem('postLoginRedirect');
                if (postLoginRedirect && postLoginRedirect !== window.location.href) {
                    localStorage.removeItem('postLoginRedirect');
                    window.location.href = postLoginRedirect;
                    return;
                } else if (postLoginRedirect) {
                    localStorage.removeItem('postLoginRedirect');
                }
            }).catch(err => {
                console.warn('Sync cart failed after Facebook OAuth:', err);
                if (typeof CyberModal !== "undefined" && CyberModal.close) CyberModal.close();
                try { window.dispatchEvent(new Event('user:login')); } catch (e) {}
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