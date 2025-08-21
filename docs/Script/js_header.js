// ================= Hiệu ứng header khi scroll =================
function initHeaderScrollEffect() {
    const header = document.querySelector('.cyber-header');
    if (!header) return;

    window.addEventListener('scroll', () => {
        header.classList.toggle('scrolled', window.scrollY > 50);
    });
}

function initBannerHeaderWrapper() {
    const wrapper = document.getElementById('header-wrapper');
    if (!wrapper) return;

    window.addEventListener('scroll', () => {
        if (window.scrollY > 100) {
            wrapper.classList.add('hide-banner');
        } else {
            wrapper.classList.remove('hide-banner');
        }
    });
}

// ================= Giỏ hàng & đơn hàng =================
function initCartCountEffect() {
    updateCartCount();
}

function updateOrderCount() {
    const orders = JSON.parse(localStorage.getItem('orders')) || [];
    const orderCountElement = document.querySelector('.order-count');
    if (orderCountElement) {
        orderCountElement.textContent = orders.length;
        orderCountElement.style.display = orders.length > 0 ? 'inline-flex' : 'none';
    }
}

// ================= Nền hexagon động =================
function initHexagonBackground() {
    const hexContainer = document.querySelector('.hex-container');
    if (!hexContainer) return;

    for (let i = 0; i < 15; i++) {
        const hex = document.createElement('div');
        hex.classList.add('hex');
        hex.style.left = Math.random() * 100 + '%';
        hex.style.animationDelay = Math.random() * 10 + 's';
        hex.style.width = Math.random() * 30 + 10 + 'px';
        hex.style.height = Math.random() * 30 + 10 + 'px';
        hexContainer.appendChild(hex);
    }
}

// ================= Dropdown danh mục =================
function initCategoryDropdown() {
    const categoryBtn = document.querySelector('.cyber-category-btn');
    const categoriesDropdown = document.querySelector('.cyber-categories-dropdown');
    if (!categoryBtn || !categoriesDropdown) return;

    categoryBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        categoriesDropdown.classList.toggle('active');
    });

    document.addEventListener('click', function (event) {
        if (!categoryBtn.contains(event.target) && !categoriesDropdown.contains(event.target)) {
            categoriesDropdown.classList.remove('active');
        }
    });
}

// ================= Responsive search =================
function initResponsiveHandler() {
    const searchContainer = document.querySelector('.cyber-search');
    if (!searchContainer) return;

    function updateLayout() {
        searchContainer.style.maxWidth = window.innerWidth <= 768 ? '100%' : '500px';
    }

    updateLayout();
    window.addEventListener('resize', updateLayout);
}

// ================= Modal login/register/forgot =================
const CyberModal = {
    open() {
        document.getElementById("cyber-auth-modal").style.display = "flex";
        this.showLogin();
    },
    close() {
        document.getElementById("cyber-auth-modal").style.display = "none";
    },
    hideAll() {
        document.getElementById("auth-login")?.classList.add("d-none");
        document.getElementById("auth-register")?.classList.add("d-none");
        document.getElementById("auth-forgot")?.classList.add("d-none");
    },
    showLogin() {
        this.hideAll();
        document.getElementById("auth-login")?.classList.remove("d-none");
    },
    showRegister() {
        this.hideAll();
        document.getElementById("auth-register")?.classList.remove("d-none");
    },
    showForgot() {
        this.hideAll();
        document.getElementById("auth-forgot")?.classList.remove("d-none");
    }
};

function switchToRegister() { CyberModal.showRegister(); }
function switchToLogin() { CyberModal.showLogin(); }
function switchToForgot() { CyberModal.showForgot(); }
function closeCyberModal() { CyberModal.close(); }

// ================= User login state =================
const API_BASE = window.API_BASE || "https://fn-web.onrender.com";

async function fetchUserInfo() {
    try {
        const res = await fetch(`${API_BASE}/api/me`, {
            method: "GET",
            credentials: "include"
        });
        const data = await res.json();
        if (data.loggedIn) {
            localStorage.setItem('userName', data.user.lastName.trim());
            if (data.user.avatar_url) {
                localStorage.setItem('avatarUrl', data.user.avatar_url);
            } else {
                localStorage.removeItem('avatarUrl');
            }
        } else {
            localStorage.removeItem('userName');
            localStorage.removeItem('avatarUrl');
        }
    } catch (err) {
        console.error("Lỗi lấy thông tin user:", err);
    }
}

// ================= Hàm tạo avatar ngẫu nhiên =================
function generateRandomAvatar(name) {
    const colors = ["#ff4757", "#1e90ff", "#2ed573", "#ffa502", "#eccc68", "#3742fa", "#ff6b81"];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const initial = name ? name.charAt(0).toUpperCase() : "?";

    return `
        <div class="avatar-generated" style="
            background:${color};
            color:#fff;
            font-weight:600;
            width:32px;height:32px;
            display:flex;align-items:center;justify-content:center;
            border-radius:50%;font-size:14px;
        ">
            ${initial}
        </div>
    `;
}

// ================= Update hiển thị user =================
function updateUserDisplay() {
    const firstName = localStorage.getItem('firstName') || "";
    const lastName = localStorage.getItem('lastName') || "";
    const email = localStorage.getItem('email') || "";
    const avatarUrl = localStorage.getItem('avatarUrl');
    const fullName = `${firstName} ${lastName}`.trim() || lastName || firstName || "Người dùng";

    let userAction = document.querySelector('.cyber-action .bx-user-circle')?.closest('.cyber-action');
    if (!userAction) return;

    // Giữ nguyên class cũ khi clone
    const newUserAction = userAction.cloneNode(false);
    newUserAction.className = userAction.className;
    userAction.parentNode.replaceChild(newUserAction, userAction);
    userAction = newUserAction;

    if (fullName !== "Người dùng") {
        // ✅ Đã login
        const shortName = fullName.length > 14 ? fullName.slice(0, 14) + "..." : fullName;

        // Avatar (server → random fallback)
        const avatarHTML = avatarUrl
            ? `<img src="${avatarUrl}" alt="avatar" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">`
            : generateRandomAvatar(firstName || lastName);

        userAction.innerHTML = `
            <div class="user-menu">
                ${avatarHTML}
                <div class="user-info">
                    <div style="font-size: 10px; opacity: 0.8;">Xin chào</div>
                    <div style="font-size: 12px; font-weight: 600;" title="${fullName}">${shortName}</div>
                </div>
                <div class="user-dropdown">
                    <div class="dropdown-item" id="profileLink">👤 Thông tin cá nhân</div>
                    <div class="dropdown-item" id="logoutBtn">🚪 Đăng xuất</div>
                </div>
            </div>
        `;

        // Hover dropdown
        const userMenu = userAction.querySelector('.user-menu');
        userMenu.addEventListener('mouseenter', () => userMenu.classList.add('show'));
        userMenu.addEventListener('mouseleave', () => userMenu.classList.remove('show'));

        // Link đến trang profile
        document.getElementById("profileLink").addEventListener("click", () => {
            window.location.href = "profile.html";
        });

        // Logout
        document.getElementById("logoutBtn").addEventListener("click", async () => {
            await fetch(`${API_BASE}/api/logout`, {
                method: "POST",
                credentials: "include"
            });
            localStorage.clear();
            window.location.reload();
        });

    } else {
        // ❌ Chưa login
        userAction.innerHTML = `
            <i class="bx bx-user-circle action-icon"></i>
            <div class="action-text">
                <div style="font-size: 10px; opacity: 0.8;">Đăng</div>
                <div style="font-size: 12px; font-weight: 600;">nhập</div>
            </div>
        `;
        userAction.addEventListener("click", () => CyberModal.open());
    }
}


// ================= Khi load trang =================
document.addEventListener("DOMContentLoaded", async () => {
    await fetchUserInfo();
    updateUserDisplay();
});

// ================= Init toàn bộ header =================
function initHeader() {
    initHeaderScrollEffect();
    initBannerHeaderWrapper();
    initCartCountEffect();
    updateOrderCount();
    initHexagonBackground();
    initCategoryDropdown();
    initResponsiveHandler();
}
