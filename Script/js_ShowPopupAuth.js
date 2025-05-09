function showPopup(type) {
    const popup = document.getElementById('popup-container');
    popup.style.display = 'flex';
    document.body.classList.add('modal-open');

    let html = '<div class="modal-wrapper">';
    if (type === 'login') {
        html += `
        <div class="modal-box">
          <span class="modal-close" onclick="closePopupForce()">✕</span>
          <h2><i class='bx bx-log-in-circle'></i>ĐĂNG NHẬP TÀI KHOẢN</h2>
          <form>
            <div class="input-group">
              <i class='bx bx-envelope'></i>
              <input type="email" placeholder="Email" required>
            </div>
            <div class="input-group">
              <i class='bx bx-lock'></i>
              <input type="password" placeholder="Mật khẩu" required>
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
          <form>
            <div class="input-group">
              <i class='bx bx-envelope'></i>
              <input type="email" placeholder="Email" required>
            </div>
            <div class="input-group">
              <i class='bx bx-user'></i>
              <input type="text" placeholder="Họ và tên" required>
            </div>
            <div class="input-group">
              <i class='bx bx-lock'></i>
              <input type="password" placeholder="Mật khẩu" required>
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
          <div class="input-group">
            <i class='bx bx-envelope'></i>
            <input type="email" placeholder="Email khôi phục">
          </div>
          <button class="btn-primary"> KHÔI PHỤC</button>
          <div class="divider">hoặc</div>
          <div class="social-buttons">
            <button class="google"><i class='bx bxl-google'></i> Google</button>
            <button class="facebook"><i class='bx bxl-facebook'></i> Facebook</button>
          </div>
          <div class="footer-text">Quay lại? <a onclick="showPopup('login')">Đăng nhập</a></div>
        </div>`;
    }
    html += '</div>';
    popup.innerHTML = html;
}

function closePopup(event) {
    if (event.target.id === 'popup-container') {
        closePopupForce();
    }
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
        }, 300); // khớp với thời gian animation
    } else {
        popup.style.display = 'none';
        popup.innerHTML = '';
        document.body.classList.remove('modal-open');
    }
}
