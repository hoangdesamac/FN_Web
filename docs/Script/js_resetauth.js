const API_BASE = "https://fn-web.onrender.com"; // Link Render backend

/* ========== Đăng ký ========== */
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
                body: JSON.stringify({ email, firstName, lastName, password })
            });
            const data = await res.json();
            if (data.success) {
                alert('✅ Đăng ký thành công! Bạn có thể đăng nhập.');
                if (typeof CyberModal !== "undefined") {
                    CyberModal.showLogin(); // Chuyển sang form đăng nhập
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

/* ========== Đăng nhập ========== */
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
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (data.success) {
                localStorage.setItem('authToken', data.token);
                alert('✅ Đăng nhập thành công!');
                if (typeof CyberModal !== "undefined") {
                    CyberModal.close(); // Đóng modal sau đăng nhập
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
