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

// Helper: trung tâm xác thực (dùng AuthSync nếu có)
function isAuth() {
    try {
        if (window.AuthSync && typeof window.AuthSync.isLoggedIn === 'function') {
            return window.AuthSync.isLoggedIn();
        }
    } catch (e) { /* ignore */ }
    return !!localStorage.getItem('userName');
}

// ================= Giỏ hàng & đơn hàng =================
function initCartCountEffect() {
    updateCartCount();
}

// 🛒 Giỏ hàng
function updateCartCount() {
    if (window.cartCountShared && typeof window.cartCountShared.refresh === 'function') {
        window.cartCountShared.refresh();
        return;
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
        const modal = document.getElementById("cyber-auth-modal");
        if (modal) {
            modal.style.display = "flex";
            this.showLogin();
        } else {
            console.warn('CyberModal: modal element not found');
        }
    },
    close() {
        const modal = document.getElementById("cyber-auth-modal");
        if (modal) modal.style.display = "none";
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
// Use AuthSync if present to avoid duplicate /api/me calls and race condition
// This function mirrors minimal compatibility keys used across your codebase.
async function fetchUserInfo() {
    try {
        if (window.AuthSync && typeof window.AuthSync.getState === 'function') {
            const st = window.AuthSync.getState();
            if (st && st.loggedIn && st.user) {
                const dataUser = st.user;
                // Mirror compatibility keys (write empty string if missing to avoid stale values)
                try {
                    localStorage.setItem('userName', (dataUser.lastName || '').trim());
                    localStorage.setItem('firstName', (dataUser.firstName || '').trim());
                    localStorage.setItem('lastName', (dataUser.lastName || '').trim());
                    localStorage.setItem('email', dataUser.email || "");
                    localStorage.setItem('userId', dataUser.id || "");
                    if (dataUser.avatar_url) {
                        localStorage.setItem('avatarUrl', dataUser.avatar_url);
                    } else {
                        localStorage.removeItem('avatarUrl');
                    }
                } catch (e) {
                    console.warn('fetchUserInfo localStorage mirror error', e);
                }
                return;
            } else {
                // clear compatibility keys to avoid stale header
                ['userName','firstName','lastName','email','userId','avatarUrl'].forEach(k => localStorage.removeItem(k));
                return;
            }
        }

        // Fallback: legacy /api/me fetch
        const res = await fetch(`${window.API_BASE}/api/me`, {
            method: "GET",
            credentials: "include"
        });
        const data = await res.json();
        if (data && data.loggedIn && data.user) {
            try {
                localStorage.setItem('userName', (data.user.lastName || '').trim());
                localStorage.setItem('firstName', (data.user.firstName || "").trim());
                localStorage.setItem('lastName', (data.user.lastName || "").trim());
                localStorage.setItem('email', data.user.email || "");
                localStorage.setItem('userId', data.user.id || "");
                if (data.user.avatar_url) {
                    localStorage.setItem('avatarUrl', data.user.avatar_url);
                } else {
                    localStorage.removeItem('avatarUrl');
                }
            } catch (e) {
                console.warn('fetchUserInfo localStorage set error', e);
            }
        } else {
            ['userName','firstName','lastName','email','userId','avatarUrl'].forEach(k => localStorage.removeItem(k));
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
    const avatarUrl = localStorage.getItem('avatarUrl');
    const fullName = `${firstName} ${lastName}`.trim() || lastName || firstName || "Người dùng";

    let userAction = document.querySelector('.cyber-action .bx-user-circle')?.closest('.cyber-action');
    if (!userAction) {
        // Try fallback selector for alternate header markup
        userAction = document.querySelector('.cyber-action.user') || document.querySelector('.cyber-user-action');
    }
    if (!userAction) return;

    // Replace node to remove old event handlers reliably
    const newUserAction = userAction.cloneNode(false);
    newUserAction.className = userAction.className;
    userAction.parentNode.replaceChild(newUserAction, userAction);
    userAction = newUserAction;

    if (fullName !== "Người dùng") {
        const shortName = fullName.length > 14 ? fullName.slice(0, 14) + "..." : fullName;
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
                    <div class="dropdown-item" id="profileLink"> Thông tin cá nhân</div>
                    <div class="dropdown-item" id="logoutBtn"> Đăng xuất</div>
                </div>
            </div>
        `;

        const userMenu = userAction.querySelector('.user-menu');
        if (userMenu) {
            userMenu.addEventListener('mouseenter', () => userMenu.classList.add('show'));
            userMenu.addEventListener('mouseleave', () => userMenu.classList.remove('show'));
        }

        const profileEl = document.getElementById("profileLink");
        if (profileEl) {
            profileEl.addEventListener("click", () => {
                window.location.href = "profile.html";
            });
        }

        const logoutEl = document.getElementById("logoutBtn");
        if (logoutEl) {
            logoutEl.addEventListener("click", async () => {
                try {
                    await fetch(`${window.API_BASE}/api/logout`, {
                        method: "POST",
                        credentials: "include"
                    });
                    // Use AuthSync.clear() to avoid clearing unrelated keys like cart/gift
                    if (window.AuthSync && typeof window.AuthSync.clear === 'function') {
                        window.AuthSync.clear();
                    } else {
                        // fallback: remove only auth-related keys
                        ['userName','firstName','lastName','email','userId','avatarUrl'].forEach(k => localStorage.removeItem(k));
                    }
                    updateCartCount();
                    window.location.reload();
                } catch (err) {
                    console.error("Lỗi đăng xuất:", err);
                }
            });
        }

    } else {
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

// ================= Xử lý click icon giỏ hàng =================
function initCartIconClick() {
    const cartLink = document.querySelector('a.cyber-action[href="resetcheckout.html"]');
    if (!cartLink) return;

    cartLink.addEventListener('click', (e) => {
        e.preventDefault();

        const logged = isAuth();
        const cart = JSON.parse(localStorage.getItem('cart')) || [];
        const giftCart = JSON.parse(localStorage.getItem('giftCart')) || [];
        const cartCount = cart.reduce((t, i) => t + (i.quantity || 1), 0) +
            giftCart.reduce((t, g) => t + (g.quantity || 0), 0);

        if (!logged) {
            if (cartCount > 0) {
                CyberModal.open?.();
                if (typeof showNotification === "function") {
                    showNotification("Vui lòng đăng nhập để xem giỏ hàng!", "info");
                }
            } else {
                window.location.href = 'resetcheckout.html';
            }
            return;
        }
        window.location.href = 'resetcheckout.html';
    });
}

// ================= Xử lý click icon đơn hàng =================
function initOrderIconClick() {
    const orderLink = document.querySelector('a.cyber-action[href="resetlookup.html"]');
    if (!orderLink) return;

    orderLink.addEventListener('click', (e) => {
        e.preventDefault();

        const logged = isAuth();
        if (!logged) {
            CyberModal.open?.();
            if (typeof showNotification === "function") {
                showNotification("Vui lòng đăng nhập để xem đơn hàng!", "info");
            }
            return;
        }
        window.location.href = 'resetlookup.html';
    });
}

// ================= Đồng bộ header khi trạng thái đăng nhập thay đổi =================
// Listen legacy event
window.addEventListener('user:login', async () => {
    await fetchUserInfo();
    updateUserDisplay();
    updateCartCount();
    updateOrderCount();
});

// If AuthSync exists, listen to its onChange to keep header in sync (preferred)
if (window.AuthSync && typeof window.AuthSync.onChange === 'function') {
    window.AuthSync.onChange(async (state) => {
        try {
            if (state && state.loggedIn) {
                // fetchUserInfo will use AuthSync to populate compatibility keys
                await fetchUserInfo();
            } else {
                // clear local auth keys
                ['userName','firstName','lastName','email','userId','avatarUrl'].forEach(k => localStorage.removeItem(k));
            }
            updateUserDisplay();
            updateCartCount();
            updateOrderCount();
        } catch (e) {
            console.warn('AuthSync.onChange handler error', e);
        }
    });
}

// Also listen to the custom auth:changed event in case other scripts dispatch it
window.addEventListener('auth:changed', async (ev) => {
    try {
        const state = ev && ev.detail ? ev.detail : null;
        if (state && state.loggedIn) {
            await fetchUserInfo();
        } else if (!state) {
            // If no detail, still try to refresh header keys from AuthSync
            if (window.AuthSync && typeof window.AuthSync.getState === 'function') {
                const st = window.AuthSync.getState();
                if (st && st.loggedIn) await fetchUserInfo();
            }
        } else {
            ['userName','firstName','lastName','email','userId','avatarUrl'].forEach(k => localStorage.removeItem(k));
        }
        updateUserDisplay();
    } catch (e) {
        console.warn('auth:changed handler error', e);
    }
});

// ================= Khi load trang =================
document.addEventListener("DOMContentLoaded", async () => {
    // Prefer AuthSync state (fast, in-memory). If not available, fetch user info directly.
    try {
        if (window.AuthSync && typeof window.AuthSync.getState === 'function') {
            const st = window.AuthSync.getState();
            if (st && st.loggedIn) {
                await fetchUserInfo();
            } else {
                // If there's an in-flight refresh, wait a little for it so header doesn't show stale unauth state.
                if (typeof window.AuthSync.waitUntilReady === 'function') {
                    await window.AuthSync.waitUntilReady(1200);
                } else if (typeof window.AuthSync.refresh === 'function') {
                    // best-effort non-blocking refresh (do not throw)
                    try { await Promise.race([window.AuthSync.refresh(), new Promise(r => setTimeout(r, 800))]); } catch (e) { /* ignore */ }
                }
                // After waiting, attempt to populate header
                await fetchUserInfo();
            }
        } else {
            // legacy: try to fetch user info
            await fetchUserInfo();
        }
    } catch (e) {
        console.warn('Header initial auth sync error (ignored):', e);
    } finally {
        updateUserDisplay();
        updateCartCount();
        updateOrderCount();
    }
});

// ================= Ensure header sync after AuthSync ready =================
// This IIFE waits for AuthSync (if present) to finish any in-flight refresh, then ensures header is updated.
// It covers cases where header loads before AuthSync completes, avoiding stale "Xin chào" text.
(async function ensureHeaderSyncAfterAuth() {
    try {
        if (window.AuthSync) {
            // Prefer waitUntilReady (non-blocking soft wait), fallback to refresh
            if (typeof window.AuthSync.waitUntilReady === 'function') {
                await window.AuthSync.waitUntilReady(2000); // 2s soft wait
            } else if (typeof window.AuthSync.refresh === 'function') {
                try {
                    await window.AuthSync.refresh();
                } catch (e) { /* ignore */ }
            }
        } else {
            // small grace delay for legacy auth scripts to run
            await new Promise(r => setTimeout(r, 200));
        }
    } catch (e) { /* ignore */ }

    try {
        await fetchUserInfo();
    } catch (e) { /* ignore */ }

    try {
        updateUserDisplay();
    } catch (e) { /* ignore */ }
})();

// ================= Init toàn bộ header =================
function initHeader() {
    initHeaderScrollEffect();
    initBannerHeaderWrapper();
    initCartCountEffect();
    updateOrderCount();
    initHexagonBackground();
    initCategoryDropdown();
    initResponsiveHandler();
    initCartIconClick();
    initOrderIconClick();
}