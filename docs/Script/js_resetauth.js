// ==================== CẤU HÌNH API ====================
window.API_BASE = "https://fn-web.onrender.com"; // Backend

// ==================== HÀM HỖ TRỢ ====================
// Hiển thị lỗi hoặc thông báo
function showMessage(elementId, message, type = "error") {
    const box = document.getElementById(elementId);
    if (box) {
        box.textContent = message;
        box.className = type === "success" ? "form-message success" : "form-message error";
    }
}

// ==================== KIỂM TRA TRẠNG THÁI ĐĂNG NHẬP ====================
async function checkLoginStatus() {
    try {
        const res = await fetch(`${API_BASE}/api/me`, {
            method: "GET",
            credentials: "include"
        });
        const data = await res.json();
        if (data.loggedIn) {
            localStorage.setItem("userName", (data.user.lastName || "").trim());
        } else {
            localStorage.removeItem("userName");
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
            const res = await fetch(`${API_BASE}/api/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ email, firstName, lastName, password })
            });
            const data = await res.json();
            if (data.success) {
                showMessage("register-error", "✅ Đăng ký thành công! Vui lòng đăng nhập.", "success");
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
            const res = await fetch(`${API_BASE}/api/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();

            if (data.success) {
                if (data.user && data.user.lastName) {
                    localStorage.setItem("userName", data.user.lastName.trim());
                }
                if (typeof CyberModal !== "undefined" && CyberModal.close) CyberModal.close();
                window.location.reload(); // reload lại để cập nhật UI
            } else {
                showMessage("login-error", data.error || "❌ Sai email hoặc mật khẩu!");
            }
        } catch (err) {
            console.error(err);
            showMessage("login-error", "❌ Lỗi kết nối server!");
        }
    });
}

// ==================== ĐĂNG XUẤT ====================
async function logout() {
    try {
        await fetch(`${API_BASE}/api/logout`, {
            method: "POST",
            credentials: "include"
        });
        localStorage.removeItem("userName");
        window.location.reload();
    } catch (err) {
        console.error("Lỗi đăng xuất:", err);
    }
}

// ==================== QUÊN MẬT KHẨU ====================
const forgotForm = document.getElementById("forgotForm");
if (forgotForm) {
    forgotForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("forgot-email").value.trim();

        showMessage("forgot-error", "");

        try {
            const res = await fetch(`${API_BASE}/api/forgot-password`, {
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
   GOOGLE LOGIN — BỀN VỮNG VỚI DOM TẢI ĐỘNG
   ======================================================================= */
document.addEventListener("click", (e) => {
    const btn = e.target.closest("#googleLoginBtn-login, #googleLoginBtn-register, #googleLoginBtn-forgot, .google-btn");
    if (!btn) return;
    if (btn.disabled) return;

    try {
        window.location.href = `${API_BASE}/api/auth/google`;
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
            checkLoginStatus();
            if (typeof CyberModal !== "undefined" && CyberModal.close) CyberModal.close();
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (loginStatus === "failed") {
            showMessage("login-error", "❌ Google login thất bại, vui lòng thử lại!");
            window.history.replaceState({}, document.title, window.location.pathname);
        }

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

/* =======================================================================
   FACEBOOK LOGIN — THÊM MỚI
   ======================================================================= */
document.addEventListener("click", (e) => {
    const btn = e.target.closest("#facebookLoginBtn-login, #facebookLoginBtn-register, #facebookLoginBtn-forgot, .facebook-btn");
    if (!btn) return;
    if (btn.disabled) return;

    try {
        window.location.href = `${API_BASE}/api/auth/facebook`;
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
            checkLoginStatus();
            if (typeof CyberModal !== "undefined" && CyberModal.close) CyberModal.close();
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (loginStatus === "failed_fb") {
            showMessage("login-error", "❌ Facebook login thất bại, vui lòng thử lại!");
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    } catch (err) {
        console.error("Lỗi xử lý callback Facebook:", err);
    }
})();
