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
function isAuthFast() {
    try {
        if (window.AuthSync && typeof window.AuthSync.isLoggedIn === 'function') {
            return window.AuthSync.isLoggedIn();
        }
    } catch (e) { /* ignore */ }
    return !!localStorage.getItem('userName') || !!localStorage.getItem('userId');
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

// ================= Utils auth-aware =================
async function tryAuthSyncRefreshWithTimeout(timeoutMs = 1500) {
    if (!window.AuthSync) return null;
    try {
        // prefer refresh() (which returns state)
        if (typeof window.AuthSync.refresh === 'function') {
            const p = window.AuthSync.refresh();
            const res = await Promise.race([
                p,
                new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs))
            ]);
            return res || window.AuthSync.getState && window.AuthSync.getState();
        }
        // fallback to waitUntilReady if present
        if (typeof window.AuthSync.waitUntilReady === 'function') {
            await window.AuthSync.waitUntilReady(timeoutMs);
            return window.AuthSync.getState && window.AuthSync.getState();
        }
    } catch (e) {
        // soft-fail: return whatever in-memory state we have
        try { return window.AuthSync.getState && window.AuthSync.getState(); } catch (ee) { return null; }
    }
    return window.AuthSync.getState && window.AuthSync.getState();
}

// Returns canonical auth state object { loggedIn, user } or null
async function getCanonicalAuthState() {
    try {
        if (window.AuthSync) {
            // Try fast in-memory first
            if (typeof window.AuthSync.getState === 'function') {
                const st = window.AuthSync.getState();
                if (st && typeof st.loggedIn !== 'undefined') return st;
            }
            // Otherwise attempt a refresh with timeout to get authoritative result
            const r = await tryAuthSyncRefreshWithTimeout(1600);
            if (r && typeof r.loggedIn !== 'undefined') return r;
        }

        // Fallback to reading legacy localStorage compatibility keys quickly (no network)
        if (localStorage.getItem('userId') || localStorage.getItem('userName') || localStorage.getItem('firstName')) {
            return {
                loggedIn: true,
                user: {
                    id: localStorage.getItem('userId') || null,
                    email: localStorage.getItem('email') || null,
                    firstName: localStorage.getItem('firstName') || null,
                    lastName: localStorage.getItem('lastName') || null,
                    avatar_url: localStorage.getItem('avatarUrl') || null
                }
            };
        }

        // Last resort: direct /api/me (slow). Use only when absolutely necessary
        try {
            const res = await fetch(`${(window.API_BASE || '').replace(/\/$/, '')}/api/me`, {
                method: 'GET',
                credentials: 'include'
            });
            if (!res.ok) return { loggedIn: false };
            const data = await res.json();
            if (data && data.loggedIn) return data;
            return { loggedIn: false };
        } catch (e) {
            return { loggedIn: false };
        }
    } catch (err) {
        return { loggedIn: false };
    }
}

// Mirror compatibility keys to localStorage (small helper)
function mirrorCompatibilityKeysToLocal(user) {
    try {
        if (!user) {
            ['userName','firstName','lastName','email','userId','avatarUrl'].forEach(k => localStorage.removeItem(k));
            return;
        }
        if (user.lastName) localStorage.setItem('userName', (user.lastName || '').trim());
        if (user.firstName) localStorage.setItem('firstName', (user.firstName || '').trim());
        if (user.lastName) localStorage.setItem('lastName', (user.lastName || '').trim());
        if (user.email) localStorage.setItem('email', user.email || "");
        if (user.id) localStorage.setItem('userId', String(user.id || ""));
        if (user.avatar_url) localStorage.setItem('avatarUrl', user.avatar_url || "");
        else localStorage.removeItem('avatarUrl');
    } catch (e) { console.warn('mirrorCompatibilityKeysToLocal error', e); }
}

// ================= Hàm lấy info user (ưu tiên AuthSync) =================
async function fetchUserInfoCanonical() {
    try {
        const st = await getCanonicalAuthState();
        if (st && st.loggedIn && st.user) {
            // mirror to localStorage for legacy scripts (non-destructive)
            mirrorCompatibilityKeysToLocal(st.user);
            return { loggedIn: true, user: st.user };
        } else {
            // ensure local compatibility keys are cleared when logged out
            ['userName','firstName','lastName','email','userId','avatarUrl'].forEach(k => localStorage.removeItem(k));
            return { loggedIn: false };
        }
    } catch (err) {
        console.error('fetchUserInfoCanonical error:', err);
        return { loggedIn: false };
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

// ================= Update hiển thị user sử dụng canonical state =================
function renderUserActionFromState(state) {
    const firstName = state?.user?.firstName || "";
    const lastName = state?.user?.lastName || "";
    const avatarUrl = state?.user?.avatar_url;
    const fullName = `${firstName} ${lastName}`.trim() || lastName || firstName;

    let userAction = document.querySelector('.cyber-action .bx-user-circle')?.closest('.cyber-action');
    if (!userAction) return;

    const newUserAction = userAction.cloneNode(false);
    newUserAction.className = userAction.className;
    userAction.parentNode.replaceChild(newUserAction, userAction);
    userAction = newUserAction;

    if (state && state.loggedIn && fullName) {
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
        userMenu.addEventListener('mouseenter', () => userMenu.classList.add('show'));
        userMenu.addEventListener('mouseleave', () => userMenu.classList.remove('show'));

        document.getElementById("profileLink").addEventListener("click", () => {
            window.location.href = "profile.html";
        });

        document.getElementById("logoutBtn").addEventListener("click", async () => {
            try {
                await fetch(`${window.API_BASE}/api/logout`, {
                    method: "POST",
                    credentials: "include"
                });
                if (window.AuthSync && typeof window.AuthSync.clear === 'function') {
                    window.AuthSync.clear();
                } else {
                    ['userName','firstName','lastName','email','userId','avatarUrl'].forEach(k => localStorage.removeItem(k));
                }
                updateCartCount();
                window.location.reload();
            } catch (err) {
                console.error("Lỗi đăng xuất:", err);
            }
        });

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

// Wrapper: fetch canonical state and render
async function updateUserDisplay() {
    try {
        const st = await fetchUserInfoCanonical();
        renderUserActionFromState(st);
    } catch (err) {
        console.warn('updateUserDisplay error:', err);
    }
}

// ================= Xử lý click icon giỏ hàng =================
function initCartIconClick() {
    const cartLink = document.querySelector('a.cyber-action[href="resetcheckout.html"]');
    if (!cartLink) return;

    cartLink.addEventListener('click', (e) => {
        e.preventDefault();

        const logged = isAuthFast();
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

        const logged = isAuthFast();
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
    await updateUserDisplay();
    updateCartCount();
    updateOrderCount();
});

// If AuthSync exists, listen to its onChange to keep header in sync (preferred)
if (window.AuthSync && typeof window.AuthSync.onChange === 'function') {
    window.AuthSync.onChange(async (state) => {
        try {
            // mirror compatibility keys if logged in
            if (state && state.loggedIn) mirrorCompatibilityKeysToLocal(state.user);
            else ['userName','firstName','lastName','email','userId','avatarUrl'].forEach(k => localStorage.removeItem(k));

            // render header and counts
            renderUserActionFromState(state || { loggedIn: false });
            updateCartCount();
            updateOrderCount();
        } catch (e) {
            console.warn('AuthSync.onChange handler error (header):', e);
        }
    });
}

// Also listen to cross-tab storage changes on auth_state/auth_ping for old browsers
window.addEventListener('storage', (ev) => {
    try {
        if (!ev || !ev.key) return;
        if (ev.key === 'auth_state' || ev.key === 'auth_ping' || ev.key === 'userName' || ev.key === 'userId') {
            // gentle update (non-blocking)
            setTimeout(() => {
                updateUserDisplay().catch(()=>{});
                updateCartCount();
                updateOrderCount();
            }, 50);
        }
    } catch (e) { /* ignore */ }
});

// ================= Khi load trang =================
document.addEventListener("DOMContentLoaded", async () => {
    // Strategy:
    // 1) Prefer to wait for AuthSync.refresh() (authoritative) with soft timeout.
    // 2) Then fetch user info canonical and render header.
    // 3) If still appears logged-out but AuthSync reports loggedIn, retry a couple of times (handles slow redirects/cookies).

    try {
        if (window.AuthSync) {
            // Try to get authoritative state (soft wait)
            try {
                await tryAuthSyncRefreshWithTimeout(1600);
            } catch (e) { /* ignore */ }
        }
    } catch (err) {
        console.warn('AuthSync initial wait error (non-fatal):', err);
    }

    await updateUserDisplay();
    updateCartCount();
    updateOrderCount();

    // If header still shows logged-out (compat keys not set) but AuthSync says loggedIn -> retry shortly
    (async function retryIfInconsistent(attempts = 3, delayMs = 400) {
        for (let i = 0; i < attempts; i++) {
            try {
                const st = window.AuthSync && typeof window.AuthSync.getState === 'function'
                    ? window.AuthSync.getState()
                    : null;
                const localHas = !!(localStorage.getItem('userName') || localStorage.getItem('firstName') || localStorage.getItem('userId'));
                if (st && st.loggedIn && !localHas) {
                    // mirror keys and re-render
                    mirrorCompatibilityKeysToLocal(st.user);
                    renderUserActionFromState(st);
                    updateCartCount();
                    updateOrderCount();
                    return;
                }
                // if no AuthSync or everything consistent -> stop
                if (!window.AuthSync || (st && typeof st.loggedIn !== 'undefined' && st.loggedIn === !!localHas)) return;
            } catch (e) {
                // ignore and continue retry
            }
            await new Promise(r => setTimeout(r, delayMs));
        }
    })();
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
    initCartIconClick();
    initOrderIconClick();
}