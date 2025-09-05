// ==================== HÀM HỖ TRỢ ====================

// Hiển thị lỗi hoặc thông báo
function showMessage(elementId, message, type = "error") {
    const box = document.getElementById(elementId);
    if (box) {
        box.textContent = message;
        box.className = type === "success" ? "form-message success" : "form-message error";
    }
}

// Lưu thông tin user vào localStorage
function saveUserInfo(user) {
    localStorage.setItem("userId", user.id || "");
    localStorage.setItem("firstName", (user.firstName || "").trim());
    localStorage.setItem("lastName", (user.lastName || "").trim());
    localStorage.setItem("email", user.email || "");
    localStorage.setItem("userName", (user.lastName || "").trim());
    user.avatar_url
        ? localStorage.setItem("avatarUrl", user.avatar_url)
        : localStorage.removeItem("avatarUrl");
    localStorage.removeItem("cartLocked");
}

// Xóa thông tin user khi chưa đăng nhập
function clearUserInfo() {
    ["userId", "firstName", "lastName", "email", "userName", "avatarUrl"]
        .forEach(k => localStorage.removeItem(k));
}

// Cập nhật URL mà không reload
function replaceCleanUrl(url) {
    try { window.history.replaceState({}, document.title, url); } catch {}
}

// Đồng bộ giỏ hàng từ localStorage lên server
async function syncCartToServer() {
    try {
        const cart = JSON.parse(localStorage.getItem("cart")) || [];
        for (const item of cart) {
            await fetch(`${window.API_BASE}/api/cart`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(item),
            });
        }
        const res = await fetch(`${window.API_BASE}/api/cart`, {
            method: "GET",
            credentials: "include",
        });
        const data = await res.json();
        if (data.success) {
            localStorage.setItem("cart", JSON.stringify(data.cart));
            updateCartCount?.();
        }
    } catch (err) {
        console.error("Lỗi đồng bộ giỏ hàng:", err);
    }
}

// ==================== LOGIN/LOGOUT HANDLERS ====================

// Xử lý sau khi login mà KHÔNG reload
async function processAfterLoginNoReload() {
    try {
        await syncCartToServer();
        await refreshHeaderUI(); // Đồng bộ UI ngay lập tức

        try { window.dispatchEvent(new Event("user:login")); } catch {}

        if (typeof processPendingAction === "function") {
            try { await processPendingAction(); } catch {}
        }
    } catch (err) {
        console.error("processAfterLoginNoReload error:", err);
    }
}

// ==================== KIỂM TRA TRẠNG THÁI ĐĂNG NHẬP ====================
async function checkLoginStatus() {
    try {
        const res = await fetch(`${window.API_BASE}/api/me`, {
            method: "GET",
            credentials: "include",
        });
        const data = await res.json();
        if (data.loggedIn && data.user) {
            saveUserInfo(data.user);
        } else {
            clearUserInfo();
        }
        await refreshHeaderUI();
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
        const lastName = document.getElementById("register-lastname").value.trim();
        const password = document.getElementById("register-password").value.trim();

        showMessage("register-error", "");

        try {
            const res = await fetch(`${window.API_BASE}/api/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ email, firstName, lastName, password }),
            });
            const data = await res.json();
            if (data.success) {
                showMessage("register-error", "✅ Đăng ký thành công! Vui lòng đăng nhập.", "success");
                const pendingItem = JSON.parse(localStorage.getItem("pendingCartItem"));
                if (pendingItem) {
                    addToCart(
                        pendingItem.id, pendingItem.name, pendingItem.originalPrice,
                        pendingItem.salePrice, pendingItem.discountPercent, pendingItem.image
                    );
                    localStorage.removeItem("pendingCartItem");
                }
                setTimeout(() => CyberModal?.showLogin?.(), 1500);
            } else {
                showMessage("register-error", data.error || "❌ Đăng ký thất bại!");
            }
        } catch {
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
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();
            if (data.success && data.user) {
                saveUserInfo(data.user);

                const pendingItem = JSON.parse(localStorage.getItem("pendingCartItem"));
                if (pendingItem) {
                    addToCart(
                        pendingItem.id, pendingItem.name, pendingItem.originalPrice,
                        pendingItem.salePrice, pendingItem.discountPercent, pendingItem.image
                    );
                    localStorage.removeItem("pendingCartItem");
                }

                await syncCartToServer();
                CyberModal?.close?.();

                const redirect = localStorage.getItem("postLoginRedirect");
                if (redirect) {
                    localStorage.removeItem("postLoginRedirect");
                    try {
                        const url = new URL(redirect, window.location.origin);
                        let cleanUrl = `${url.pathname}?id=${url.searchParams.get("id")}`;
                        if (url.searchParams.get("type")) cleanUrl += `&type=${url.searchParams.get("type")}`;
                        replaceCleanUrl(cleanUrl);
                    } catch {}
                }

                await processAfterLoginNoReload();
            } else {
                showMessage("login-error", data.error || "❌ Sai email hoặc mật khẩu!");
            }
        } catch {
            showMessage("login-error", "❌ Lỗi kết nối server!");
        }
    });
}

// ==================== OAUTH POPUP ====================
function startOAuth(provider) {
    try {
        localStorage.setItem("postLoginRedirect", window.location.href);
        const popup = window.open(
            `${window.API_BASE}/api/auth/${provider}`,
            `${provider}Login`,
            "width=600,height=700"
        );

        const timer = setInterval(async () => {
            if (!popup || popup.closed) {
                clearInterval(timer);
                await processAfterLoginNoReload();
                CyberModal?.close?.();

                const redirect = localStorage.getItem("postLoginRedirect");
                if (redirect) {
                    localStorage.removeItem("postLoginRedirect");
                    const url = new URL(redirect);
                    replaceCleanUrl(url.pathname + url.search);
                }
            }
        }, 500);
    } catch {
        showMessage("login-error", `❌ Không thể mở ${provider} Login, vui lòng thử lại!`);
    }
}

document.addEventListener("click", (e) => {
    if (e.target.closest("#googleLoginBtn-login, #googleLoginBtn-register, #googleLoginBtn-forgot, .google-btn")) startOAuth("google");
    if (e.target.closest("#facebookLoginBtn-login, #facebookLoginBtn-register, #facebookLoginBtn-forgot, .facebook-btn")) startOAuth("facebook");
});

// ==================== AUTO LOGIN CHECK ====================
document.addEventListener("DOMContentLoaded", checkLoginStatus);
