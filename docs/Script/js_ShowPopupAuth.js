// Hàm thiết lập cookie
function setCookie(name, value, days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value}; expires=${date.toUTCString()}; path=/`;
}

// Hàm lấy cookie
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

// Khai báo currentUser
window.currentUser = null;

function initializeUser() {
    const token = getCookie('authToken');
    if (token) {
        fetch('http://localhost:3000/api/verify-token', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(response => response.json())
            .then(data => {
                if (data.user && data.user.name) {
                    window.currentUser = data.user;
                } else {
                    window.currentUser = null;
                }
                updatePopupContent();
                updateHeader();
            })
            .catch(error => {
                console.error('Error verifying token:', error);
                window.currentUser = null;
                updatePopupContent();
                updateHeader();
            });
    } else {
        window.currentUser = null;
        updatePopupContent();
        updateHeader();
    }
}

function showPopup(type) {
    const popup = document.getElementById('popup-container');
    if (!popup) {
        console.error('Popup container (#popup-container) not found!');
        return;
    }
    popup.style.display = 'flex';
    document.body.classList.add('modal-open');

    let html = '<div class="modal-wrapper">';
    if (type === 'login') {
        html += `
        <div class="modal-box">
          <span class="modal-close" onclick="closePopupForce()">✕</span>
          <h2><i class='bx bx-log-in-circle'></i>ĐĂNG NHẬP TÀI KHOẢN</h2>
          <form onsubmit="handleLogin(event)">
            <div class="input-group">
              <i class='bx bx-envelope'></i>
              <input type="email" id="login-email" placeholder="Email" required>
            </div>
            <div class="input-group">
              <i class='bx bx-lock'></i>
              <input type="password" id="login-password" placeholder="Mật khẩu" required>
            </div>
            <div class="link-text"><a onclick="showPopup('forgot')">Quên mật khẩu?</a></div>
            <button type="submit" class="btn-primary">ĐĂNG NHẬP</button>
          </form>
          <div class="divider">hoặc</div>
          <div class="social-buttons">
            <button class="google"><i class='bx bxl-google'></i> Google</button>
            <button class="facebook"><i class='bx bxl-facebook'></i> Facebook</button>
          </div>
          <div class="footer-text">Chưa có tài khoản? <a onclick="showPopup('register')">Đăng ký</a></div>
        </div>`;
    } else if (type === 'register') {
        html += `
        <div class="modal-box">
          <span class="modal-close" onclick="closePopupForce()">✕</span>
          <h2><i class='bx bx-user-plus'></i>ĐĂNG KÝ TÀI KHOẢN</h2>
          <form onsubmit="handleRegister(event)">
            <div class="input-group">
              <i class='bx bx-envelope'></i>
              <input type="email" id="register-email" placeholder="Email" required>
            </div>
            <div class="input-group">
              <i class='bx bx-user'></i>
              <input type="text" id="register-name" placeholder="Họ và tên" required>
            </div>
            <div class="input-group">
              <i class='bx bx-lock'></i>
              <input type="password" id="register-password" placeholder="Mật khẩu" required>
            </div>
            <button type="submit" class="btn-primary">TẠO TÀI KHOẢN</button>
          </form>
          <div class="divider">hoặc</div>
          <div class="social-buttons">
            <button class="google"><i class='bx bxl-google'></i> Google</button>
            <button class="facebook"><i class='bx bxl-facebook'></i> Facebook</button>
          </div>
          <div class="footer-text">Đã có tài khoản? <a onclick="showPopup('login')">Đăng nhập</a></div>
        </div>`;
    } else if (type === 'forgot') {
        html += `
        <div class="modal-box">
          <span class="modal-close" onclick="closePopupForce()">✕</span>
          <h2><i class='bx bx-key'></i>KHÔI PHỤC MẬT KHẨU</h2>
          <form id="forgot-form" onsubmit="handleForgotPassword(event)">
            <div class="input-group">
              <i class='bx bx-envelope'></i>
              <input type="email" id="forgot-email" placeholder="Email khôi phục" required>
            </div>
            <button type="submit" class="btn-primary">KHÔI PHỤC</button>
          </form>
          <div id="reset-form" style="display: none;">
            <form onsubmit="handleResetPassword(event)">
              <div class="input-group">
                <i class='bx bx-lock'></i>
                <input type="text" id="reset-token" placeholder="Nhập mã khôi phục" required>
              </div>
              <div class="input-group">
                <i class='bx bx-lock'></i>
                <input type="password" id="new-password" placeholder="Mật khẩu mới" required>
              </div>
              <button type="submit" class="btn-primary">ĐẶT LẠI MẬT KHẨU</button>
            </form>
          </div>
          <div class="footer-text">Quay lại? <a onclick="showPopup('login')">Đăng nhập</a></div>
        </div>`;
    }
    html += '</div>';
    popup.innerHTML = html;
}

function closePopup(event) {
    // Không làm gì cả, tránh đóng popup khi click ra ngoài
}

function closePopupForce() {
    const popup = document.getElementById('popup-container');
    const wrapper = popup.querySelector('.modal-wrapper');
    if (wrapper) {
        wrapper.classList.add('fade-out');
        setTimeout(() => {
            popup.style.display = 'none';
            popup.innerHTML = '';
            document.body.classList.remove('modal-open');
        }, 300);
    } else {
        popup.style.display = 'none';
        popup.innerHTML = '';
        document.body.classList.remove('modal-open');
    }
}

async function handleRegister(event) {
    event.preventDefault();
    const email = document.getElementById('register-email').value;
    const name = document.getElementById('register-name').value;
    const password = document.getElementById('register-password').value;

    try {
        const response = await fetch('http://localhost:3000/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, name, password })
        });

        const data = await response.json();
        if (response.ok) {
            alert(data.message);
            showPopup('login');
        } else {
            alert(data.message);
        }
    } catch (error) {
        alert('Lỗi kết nối server!');
        console.error('Lỗi:', error);
    }
}

async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await fetch('http://localhost:3000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        if (response.ok) {
            window.currentUser = data.user;
            if (window.currentUser && window.currentUser.name) {
                setCookie('authToken', data.token, 7); // Lưu token vào cookie
                closePopupForce();
                updatePopupContent();
                updateHeader();
                alert(data.message);
            } else {
                alert('Dữ liệu người dùng không hợp lệ từ server!');
            }
        } else {
            alert(data.message);
        }
    } catch (error) {
        alert('Lỗi kết nối server!');
        console.error('Lỗi:', error);
    }
}

async function handleForgotPassword(event) {
    event.preventDefault();
    const email = document.getElementById('forgot-email').value;
    const forgotForm = document.getElementById('forgot-form');
    const resetForm = document.getElementById('reset-form');

    try {
        const response = await fetch('http://localhost:3000/api/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const data = await response.json();
        alert(data.message);
        if (response.ok) {
            forgotForm.style.display = 'none';
            resetForm.style.display = 'block';
        }
    } catch (error) {
        alert('Lỗi kết nối server!');
        console.error('Lỗi:', error);
    }
}

async function handleResetPassword(event) {
    event.preventDefault();
    const email = document.getElementById('forgot-email').value;
    const resetToken = document.getElementById('reset-token').value;
    const newPassword = document.getElementById('new-password').value;

    try {
        const response = await fetch('http://localhost:3000/api/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, resetToken, newPassword })
        });

        const data = await response.json();
        alert(data.message);
        if (response.ok) {
            showPopup('login');
        }
    } catch (error) {
        alert('Lỗi kết nối server!');
        console.error('Lỗi:', error);
    }
}

function handleLogout() {
    window.currentUser = null;
    setCookie('authToken', '', -1); // Xóa cookie
    closePopupForce();
    updatePopupContent();
    updateHeader();
}

function updatePopupContent() {
    const popup = document.querySelector('.popup');
    if (!popup) {
        console.error('.popup element not found!');
        return;
    }
    if (window.currentUser && window.currentUser.name) {
        popup.innerHTML = `
            <h3><i class='bx bx-user'></i>Xin chào, ${window.currentUser.name}</h3>
            <button class="btn" onclick="handleLogout()">ĐĂNG XUẤT</button>
        `;
    } else {
        popup.innerHTML = `
            <h3><i class='bx bx-happy'></i> Xin chào, vui lòng đăng nhập!</h3>
            <button class="btn" onclick="showPopup('login')">
              <i class='bx bxs-user'></i> Đăng nhập
            </button>
            <button class="btn" onclick="showPopup('register')">
              <i class='bx bxs-user-plus'></i> Đăng ký
            </button>
        `;
    }
}

function updateHeader() {
    const loginBtn = document.getElementById('loginBtn');
    if (!loginBtn) {
        console.error('#loginBtn element not found!');
        return;
    }
    if (window.currentUser && window.currentUser.name) {
        loginBtn.innerHTML = `<i class='bx bx-user'></i><span class="login-text">${window.currentUser.name}</span>`;
        loginBtn.onclick = () => showPopup('login');
    } else {
        loginBtn.innerHTML = `<i class='bx bx-user'></i><span class="login-text">Tài khoản</span>`;
        loginBtn.onclick = () => showPopup('login');
    }
}