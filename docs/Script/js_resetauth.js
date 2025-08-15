// auth.js
const API_BASE = "https://fn-web.onrender.com"; // Link Render backend

/* ========== Đăng ký ========== */
document.querySelector('#auth-register form').addEventListener('submit', async (e) => {
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
            switchToLogin();
        } else {
            alert('❌ ' + data.error);
        }
    } catch (err) {
        console.error(err);
        alert('❌ Lỗi kết nối server!');
    }
});

/* ========== Đăng nhập ========== */
document.querySelector('#auth-login form').addEventListener('submit', async (e) => {
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
            closeCyberModal();
            // Có thể load lại trang hoặc hiển thị thông tin người dùng
        } else {
            alert('❌ ' + data.error);
        }
    } catch (err) {
        console.error(err);
        alert('❌ Lỗi kết nối server!');
    }
});

/* ========== Chuyển qua lại giữa các form ========== */
function switchToLogin() {
    document.getElementById('auth-login').classList.remove('d-none');
    document.getElementById('auth-register').classList.add('d-none');
    document.getElementById('auth-forgot').classList.add('d-none');
}
function switchToRegister() {
    document.getElementById('auth-login').classList.add('d-none');
    document.getElementById('auth-register').classList.remove('d-none');
    document.getElementById('auth-forgot').classList.add('d-none');
}
function switchToForgot() {
    document.getElementById('auth-login').classList.add('d-none');
    document.getElementById('auth-register').classList.add('d-none');
    document.getElementById('auth-forgot').classList.remove('d-none');
}

/* ========== Đóng modal ========== */
function closeCyberModal() {
    document.getElementById('cyber-auth-modal').style.display = 'none';
}
