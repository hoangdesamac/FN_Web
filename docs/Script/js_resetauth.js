const API_BASE = "https://fn-web.onrender.com"; // Link Render backend

document.addEventListener('DOMContentLoaded', () => {
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
                    CyberModal.showLogin(); // ✅ Dùng hàm của header.js
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
                    CyberModal.close(); // ✅ Dùng hàm của header.js
                    // Có thể load lại trang hoặc hiển thị thông tin người dùng
                } else {
                    alert('❌ ' + data.error);
                }
            } catch (err) {
                console.error(err);
                alert('❌ Lỗi kết nối server!');
            }
        });
    }
});
