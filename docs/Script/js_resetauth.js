window.API_BASE = "https://fn-web.onrender.com"; // Backend

// ====== Hàm kiểm tra trạng thái đăng nhập ======
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

// ========== Đăng ký ==========
const registerForm = document.querySelector('#auth-register form');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = e.target.querySelector('input[placeholder="Email"]').value.trim();
        const firstName = e.target.querySelector('input[placeholder="Họ"]').value.trim();
        const lastName  = e.target.querySelector('input[placeholder="Tên"]').value.trim();
        const password  = e.target.querySelector('input[placeholder="Mật khẩu"]').value.trim();

        let errorBox = document.getElementById("register-error");
        if (!errorBox) {
            errorBox = document.createElement("div");
            errorBox.id = "register-error";
            errorBox.className = "form-message";
            registerForm.appendChild(errorBox);
        }
        errorBox.textContent = "";

        try {
            const res = await fetch(`${API_BASE}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: "include",
                body: JSON.stringify({ email, firstName, lastName, password })
            });
            const data = await res.json();
            if (data.success) {
                errorBox.textContent = "✅ Đăng ký thành công! Vui lòng đăng nhập.";
                errorBox.classList.add("success");
                setTimeout(() => {
                    if (typeof CyberModal !== "undefined") CyberModal.showLogin();
                    errorBox.textContent = "";
                }, 1200);
            } else {
                errorBox.textContent = data.error || "❌ Đăng ký thất bại!";
                errorBox.classList.add("error");
            }
        } catch (err) {
            console.error(err);
            errorBox.textContent = "❌ Lỗi kết nối server!";
            errorBox.classList.add("error");
        }
    });
}

// ========== Đăng nhập ==========
const loginForm = document.querySelector('#auth-login form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = e.target.querySelector('input[placeholder="Email"]').value.trim();
        const password = e.target.querySelector('input[placeholder="Mật khẩu"]').value.trim();

        let errorBox = document.getElementById("login-error");
        if (!errorBox) {
            errorBox = document.createElement("div");
            errorBox.id = "login-error";
            errorBox.className = "form-message";
            loginForm.insertBefore(errorBox, loginForm.querySelector(".text-end"));
        }
        errorBox.textContent = "";

        try {
            const res = await fetch(`${API_BASE}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: "include",
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (data.success) {
                localStorage.setItem("userName", data.user.lastName.trim());
                if (typeof CyberModal !== "undefined") CyberModal.close();
                // 🔄 Reload ngay để mọi thứ đồng bộ
                window.location.reload();
            } else {
                errorBox.textContent = data.error || "Sai email hoặc mật khẩu!";
                errorBox.classList.add("error");
            }
        } catch (err) {
            console.error(err);
            errorBox.textContent = "❌ Lỗi kết nối server!";
            errorBox.classList.add("error");
        }
    });
}

// ✅ Kiểm tra khi load trang
document.addEventListener("DOMContentLoaded", checkLoginStatus);
