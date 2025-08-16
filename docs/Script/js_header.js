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

    let lastScrollY = window.scrollY;

    window.addEventListener('scroll', () => {
        if (window.scrollY > 100) {
            wrapper.classList.add('hide-banner');
        } else {
            wrapper.classList.remove('hide-banner');
        }
        lastScrollY = window.scrollY;
    });
}

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

function initResponsiveHandler() {
    const searchContainer = document.querySelector('.cyber-search');
    if (!searchContainer) return;

    function updateLayout() {
        searchContainer.style.maxWidth = window.innerWidth <= 768 ? '100%' : '500px';
    }

    updateLayout();
    window.addEventListener('resize', updateLayout);
}

function initLoginModalTrigger() {
    const loginAction = document.querySelector('.cyber-action .bx-user-circle')?.closest('.cyber-action');
    if (loginAction) {
        loginAction.addEventListener('click', () => CyberModal.open());
    }
}

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

function switchToRegister() {
    CyberModal.showRegister();
}
function switchToLogin() {
    CyberModal.showLogin();
}
function switchToForgot() {
    CyberModal.showForgot();
}
function closeCyberModal() {
    CyberModal.close();
}

// ====== API gọi để lấy tên user ======
async function fetchUserInfo() {
    try {
        const res = await fetch(`${window.API_BASE}/api/me`, {
            method: "GET",
            credentials: "include"
        });
        const data = await res.json();
        if (data.loggedIn) {
            localStorage.setItem('userName', data.user.lastName.trim());
        } else {
            localStorage.removeItem('userName');
        }
    } catch (err) {
        console.error("Lỗi lấy thông tin user:", err);
    }
}

// ====== Cập nhật hiển thị tên và menu ======
function updateUserDisplay() {
    const userName = localStorage.getItem('userName');
    const userAction = document.querySelector('.cyber-action .bx-user-circle')?.closest('.cyber-action');

    if (userName && userAction) {
        const shortName = userName.length > 12 ? userName.slice(0, 12) + "..." : userName;
        userAction.innerHTML = `
            <div class="user-menu">
                <div class="user-info">
                    <div style="font-size: 10px; opacity: 0.8;">Xin chào</div>
                    <div style="font-size: 12px; font-weight: 600;" title="${userName}">${shortName}</div>
                </div>
                <div class="user-dropdown">
                    <button id="logoutBtn" class="logout-btn">Đăng xuất</button>
                </div>
            </div>
        `;

        // Hover dropdown
        const userMenu = userAction.querySelector('.user-menu');
        userMenu.addEventListener('mouseenter', () => {
            userMenu.classList.add('show');
        });
        userMenu.addEventListener('mouseleave', () => {
            userMenu.classList.remove('show');
        });

        // Logout click
        document.getElementById("logoutBtn").addEventListener("click", async () => {
            await fetch(`${API_BASE}/api/logout`, {
                method: "POST",
                credentials: "include"
            });
            localStorage.removeItem("userName");
            location.reload();
        });
    }
}

// ✅ Khi trang load thì kiểm tra và cập nhật ngay
document.addEventListener("DOMContentLoaded", async () => {
    await fetchUserInfo();
    updateUserDisplay();
});

// ✅ Hàm tổng chạy toàn bộ sau khi header đã load vào DOM
function initHeader() {
    initHeaderScrollEffect();
    initBannerHeaderWrapper();
    initCartCountEffect();
    updateOrderCount();
    initHexagonBackground();
    initCategoryDropdown();
    initResponsiveHandler();
    initLoginModalTrigger();
    updateUserDisplay();
}
