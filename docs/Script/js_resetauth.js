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
            localStorage.setItem("userName", data.user.lastName.trim());
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
                    if (typeof CyberModal !== "undefined") CyberModal.showLogin();
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
                if (typeof CyberModal !== "undefined") CyberModal.close();
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

// ==================== GOOGLE LOGIN ====================
document.addEventListener("DOMContentLoaded", () => {
    // Gắn event cho cả 3 nút Google
    const googleButtons = [
        document.getElementById("googleLoginBtn-login"),
        document.getElementById("googleLoginBtn-register"),
        document.getElementById("googleLoginBtn-forgot")
    ];
    googleButtons.forEach(btn => {
        if (btn) {
            btn.addEventListener("click", () => {
                window.location.href = `${API_BASE}/api/auth/google`;
            });
        }
    });

    // ✅ Kiểm tra redirect kết quả từ Google callback
    const urlParams = new URLSearchParams(window.location.search);
    const loginStatus = urlParams.get("login");
    if (loginStatus === "google") {
        // Google login thành công
        checkLoginStatus();
        if (typeof CyberModal !== "undefined") CyberModal.close();
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (loginStatus === "failed") {
        showMessage("login-error", "❌ Google login thất bại, vui lòng thử lại!");
        window.history.replaceState({}, document.title, window.location.pathname);
    }
});

// ==================== AUTO CHECK LOGIN + TỰ MỞ MODAL SAU RESET ====================
document.addEventListener("DOMContentLoaded", () => {
    checkLoginStatus();

    // ✅ Nếu vừa reset mật khẩu xong → tự mở modal đăng nhập
    if (localStorage.getItem("showLoginAfterReset") === "true") {
        localStorage.removeItem("showLoginAfterReset");

        const openLoginModal = () => {
            if (typeof CyberModal !== "undefined" && typeof CyberModal.open === "function") {
                CyberModal.open(); // ✅ mở modal + show login luôn
            } else {
                setTimeout(openLoginModal, 200);
            }
        };
        openLoginModal();
    }
});
