const API_BASE = "https://fn-web.onrender.com"; // Backend

// ====== Hàm kiểm tra trạng thái đăng nhập ======
async function checkLoginStatus() {
    try {
        const res = await fetch(`${API_BASE}/api/me`, {
            method: "GET",
            credentials: "include" // Gửi cookie
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
        const lastName = e.target.querySelector('input[placeholder="Tên"]').value.trim();
        const password = e.target.querySelector('input[placeholder="Mật khẩu"]').value.trim();

        try {
            const res = await fetch(`${API_BASE}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: "include",
                body: JSON.stringify({ email, firstName, lastName, password })
            });
            const data = await res.json();
            if (data.success) {
                alert('✅ Đăng ký thành công! Bạn có thể đăng nhập.');
                if (typeof CyberModal !== "undefined") {
                    CyberModal.showLogin();
                }
            } else {
                alert('❌ ' + data.error);
            }
        } catch (err) {
            console.error(err);
            alert('❌ Lỗi kết nối server!');
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

        try {
            const res = await fetch(`${API_BASE}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: "include", // Nhận cookie session
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (data.success) {
                alert('✅ Đăng nhập thành công!');
                if (typeof CyberModal !== "undefined") {
                    CyberModal.close();
                }
                await checkLoginStatus(); // Cập nhật tên ngay
            } else {
                alert('❌ ' + data.error);
            }
        } catch (err) {
            console.error(err);
            alert('❌ Lỗi kết nối server!');
        }
    });
}

// ✅ Kiểm tra khi load trang
document.addEventListener("DOMContentLoaded", checkLoginStatus);
