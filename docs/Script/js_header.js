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

// Helper: nhanh kiểm tra auth (AuthSync ưu tiên)
async function isAuthFast() {
    try {
        if (window.AuthSync && typeof window.AuthSync.getState === 'function') {
            const st = window.AuthSync.getState();
            if (st && typeof st.loggedIn !== 'undefined') return !!st.loggedIn;
        }
        if (window.AuthSync) {
            try {
                if (typeof window.AuthSync.waitUntilReady === 'function') {
                    await Promise.race([
                        window.AuthSync.waitUntilReady(800),
                        new Promise(resolve => setTimeout(resolve, 800))
                    ]);
                    const st2 = window.AuthSync.getState ? window.AuthSync.getState() : null;
                    if (st2 && typeof st2.loggedIn !== 'undefined') return !!st2.loggedIn;
                } else if (typeof window.AuthSync.refresh === 'function') {
                    const p = window.AuthSync.refresh();
                    await Promise.race([p, new Promise(resolve => setTimeout(resolve, 800))]);
                    const st3 = window.AuthSync.getState ? window.AuthSync.getState() : null;
                    if (st3 && typeof st3.loggedIn !== 'undefined') return !!st3.loggedIn;
                }
            } catch (e) {
                console.warn('isAuthFast: AuthSync quick check failed', e);
            }
        }
    } catch (e) {
        console.warn('isAuthFast unexpected error', e);
    }
    try {
        return !!localStorage.getItem('userName') || !!localStorage.getItem('userId');
    } catch (e) {
        return false;
    }
}

// ================= Giỏ hàng & đơn hàng =================
function initCartCountEffect() {
    updateCartCount();
}
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
    const megaWrapper = document.querySelector('.xnavmega-wrapper');

    if (!categoryBtn || !categoriesDropdown) return;

    // Lấy / tạo dim layer
    let dimLayer = document.getElementById('xnavmega-dim-layer');
    if (!dimLayer) {
        dimLayer = document.createElement('div');
        dimLayer.id = 'xnavmega-dim-layer';
        document.body.appendChild(dimLayer);
    }

    function hideDim() {
        dimLayer.classList.remove('active');
    }
    function showDim() {
        dimLayer.classList.add('active');
    }

    function closeAllMenus() {
        categoriesDropdown.classList.remove('active');
        hideDim();
        if (megaWrapper) {
            megaWrapper.classList.remove('xnavmega-has-open');
            megaWrapper.querySelectorAll('.xnavmega-panel').forEach(p => {
                p.classList.remove('xnavmega-visible');
            });
        }
        document.querySelectorAll('.xnavmega-trigger').forEach(t => t.classList.remove('xnavmega-active'));
    }

    categoryBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const willOpen = !categoriesDropdown.classList.contains('active');
        if (!willOpen) {
            closeAllMenus();
        } else {
            categoriesDropdown.classList.add('active');
            showDim();
        }
    });

    // Click nền tối → đóng
    dimLayer.addEventListener('click', () => {
        closeAllMenus();
    });

    document.addEventListener('click', function (event) {
        if (!categoryBtn.contains(event.target) &&
            !categoriesDropdown.contains(event.target) &&
            !(megaWrapper && megaWrapper.contains(event.target))) {
            closeAllMenus();
        }
    });

    // ESC để đóng
    document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') closeAllMenus();
    });
}
// ================= XNAV MEGA MENU HEADER (NEW) =================
function initXNavMegaMenu() {
    const dropdown = document.querySelector('.cyber-categories-dropdown');
    const wrapper = document.querySelector('.xnavmega-wrapper');
    const triggers = document.querySelectorAll('.xnavmega-trigger');
    const panels = document.querySelectorAll('.xnavmega-panel');
    if (!dropdown || !wrapper || triggers.length === 0 || panels.length === 0) return;
    const dimLayer = document.getElementById('xnavmega-dim-layer');
    if (dimLayer) dimLayer.style.background = 'rgba(0,0,0,0.60)';

    function hideAllPanels() {
        panels.forEach(p => p.classList.remove('xnavmega-visible'));
        triggers.forEach(t => t.classList.remove('xnavmega-active'));
        wrapper.classList.remove('xnavmega-has-open');
    }

    function showPanel(id, triggerEl) {
        if (!dropdown.classList.contains('active')) return; // chỉ hoạt động khi dropdown đang mở
        let found = false;
        panels.forEach(p => {
            if (p.id === id) {
                p.classList.add('xnavmega-visible');
                found = true;
            } else {
                p.classList.remove('xnavmega-visible');
            }
        });
        if (!found) return;
        triggers.forEach(t => t.classList.remove('xnavmega-active'));
        triggerEl.classList.add('xnavmega-active');
        wrapper.classList.add('xnavmega-has-open');
    }

    // Hover hoặc focus vào trigger để mở panel
    triggers.forEach(tr => {
        const targetId = tr.dataset.xnavmegaTarget;
        tr.addEventListener('mouseenter', () => showPanel(targetId, tr));
        tr.addEventListener('focus', () => showPanel(targetId, tr));
        // Click cũng cho mở (support mobile desktop click)
        tr.addEventListener('click', (e) => {
            e.preventDefault();
            if (tr.classList.contains('xnavmega-active')) {
                // Toggle tắt panel nếu click lại cùng mục
                hideAllPanels();
            } else {
                showPanel(targetId, tr);
            }
        });
    });

    // Rời khỏi toàn bộ vùng (dropdown + mega wrapper) thì ẩn panel (giữ dropdown hay tắt?)
    const safeArea = [dropdown, wrapper];
    document.addEventListener('mousemove', (ev) => {
        // Nếu dropdown không mở thì bỏ qua
        if (!dropdown.classList.contains('active')) return;
        const inside = safeArea.some(el => el.contains(ev.target));
        if (!inside) {
            hideAllPanels();
        }
    });

    // Khi dropdown tự đóng (do click ngoài) → ẩn panel (phòng trường hợp wrapper còn class)
    const observer = new MutationObserver(() => {
        if (!dropdown.classList.contains('active')) {
            hideAllPanels();
        }
    });
    observer.observe(dropdown, { attributes: true, attributeFilter: ['class'] });
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

// ================= Small helpers for auth sync =================
async function waitForAuthSyncPresence(timeoutMs = 3000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (window.AuthSync) return true;
        await new Promise(r => setTimeout(r, 80));
    }
    return !!window.AuthSync;
}

async function tryAuthSyncRefreshWithTimeout(timeoutMs = 1500) {
    if (!window.AuthSync) return null;
    try {
        if (typeof window.AuthSync.refresh === 'function') {
            const p = window.AuthSync.refresh();
            const res = await Promise.race([
                p,
                new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs))
            ]);
            return res || (window.AuthSync.getState ? window.AuthSync.getState() : null);
        }
        if (typeof window.AuthSync.waitUntilReady === 'function') {
            await window.AuthSync.waitUntilReady(timeoutMs);
            return window.AuthSync.getState ? window.AuthSync.getState() : null;
        }
    } catch (e) {
        try { return window.AuthSync.getState ? window.AuthSync.getState() : null; } catch (ee) { return null; }
    }
    return window.AuthSync.getState ? window.AuthSync.getState() : null;
}

async function getCanonicalAuthState() {
    try {
        if (window.AuthSync) {
            const st = window.AuthSync.getState ? window.AuthSync.getState() : null;
            if (st && typeof st.loggedIn !== 'undefined') return st;
            const r = await tryAuthSyncRefreshWithTimeout(1600);
            if (r && typeof r.loggedIn !== 'undefined') return r;
        }
        if (localStorage.getItem('userId') || localStorage.getItem('userName')) {
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
        try {
            const res = await fetch(`${(window.API_BASE || '').replace(/\/$/, '')}/api/me`, {
                method: 'GET',
                credentials: 'include'
            });
            if (!res.ok) return { loggedIn: false };
            const data = await res.json();
            return data && data.loggedIn ? data : { loggedIn: false };
        } catch (e) {
            return { loggedIn: false };
        }
    } catch (err) {
        return { loggedIn: false };
    }
}

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

async function updateUserDisplay() {
    try {
        const st = await getCanonicalAuthState();
        if (st && st.loggedIn && st.user) mirrorCompatibilityKeysToLocal(st.user);
        renderUserActionFromState(st);
    } catch (err) {
        console.warn('updateUserDisplay error:', err);
    }
}

// ================= Xử lý click icon giỏ hàng =================
function initCartIconClick() {
    const cartLink = document.querySelector('a.cyber-action[href="resetcheckout.html"]');
    if (!cartLink) return;

    cartLink.addEventListener('click', async (e) => {
        e.preventDefault();

        let logged = false;
        try {
            logged = await isAuthFast(); // isAuthFast là async
        } catch (_) {
            logged = !!(localStorage.getItem('userName') || localStorage.getItem('userId'));
        }

        if (!logged) {
            // Nhấn icon trên Header khi chưa login → mở modal (theo yêu cầu)
            if (typeof CyberModal !== 'undefined' && CyberModal.open) CyberModal.open();
            if (typeof showNotification === "function") {
                showNotification("Bạn cần đăng nhập để xem giỏ hàng!", "info");
            }
            return;
        }

        // Đã đăng nhập → điều hướng bình thường
        window.location.href = 'resetcheckout.html';
    });
}

// ================= Xử lý click icon đơn hàng =================
function initOrderIconClick() {
    const orderLink = document.querySelector('a.cyber-action[href="resetlookup.html"]');
    if (!orderLink) return;

    orderLink.addEventListener('click', async (e) => {
        e.preventDefault();

        let logged = false;
        try {
            logged = await isAuthFast();
        } catch (_) {
            logged = !!(localStorage.getItem('userName') || localStorage.getItem('userId'));
        }

        if (!logged) {
            // Nhấn icon trên Header khi chưa login → mở modal (theo yêu cầu)
            if (typeof CyberModal !== 'undefined' && CyberModal.open) CyberModal.open();
            if (typeof showNotification === "function") {
                showNotification("Bạn cần đăng nhập để xem đơn hàng!", "info");
            }
            return;
        }

        // Đã đăng nhập → điều hướng
        window.location.href = 'resetlookup.html';
    });
}

// ================= Đồng bộ header khi trạng thái đăng nhập thay đổi =================
window.addEventListener('user:login', async () => {
    await updateUserDisplay();
    updateCartCount();
    updateOrderCount();
});

if (window.AuthSync && typeof window.AuthSync.onChange === 'function') {
    window.AuthSync.onChange((state) => {
        try {
            if (state && state.loggedIn) mirrorCompatibilityKeysToLocal(state.user);
            else ['userName','firstName','lastName','email','userId','avatarUrl'].forEach(k => localStorage.removeItem(k));
            renderUserActionFromState(state || { loggedIn: false });
            updateCartCount();
            updateOrderCount();
        } catch (e) { console.warn('AuthSync.onChange handler error (header):', e); }
    });
}

window.addEventListener('auth:changed', (ev) => {
    try {
        const st = ev?.detail;
        if (st && st.loggedIn && st.user) mirrorCompatibilityKeysToLocal(st.user);
        renderUserActionFromState(st || { loggedIn: false });
        updateCartCount();
        updateOrderCount();
    } catch (e) { /* ignore */ }
});

window.addEventListener('storage', (ev) => {
    try {
        if (!ev || !ev.key) return;
        if (['auth_state','auth_ping','userName','userId'].includes(ev.key)) {
            setTimeout(() => {
                updateUserDisplay().catch(()=>{});
                updateCartCount();
                updateOrderCount();
            }, 40);
        }
    } catch (e) {}
});

// ================= Khi load trang =================
document.addEventListener("DOMContentLoaded", async () => {
    await waitForAuthSyncPresence(2500);
    if (window.AuthSync) {
        try { await tryAuthSyncRefreshWithTimeout(1600); } catch (e) { /* ignore */ }
    }
    await updateUserDisplay();
    updateCartCount();
    updateOrderCount();

    (async function retryIfInconsistent(attempts = 3, delayMs = 400) {
        for (let i = 0; i < attempts; i++) {
            try {
                const st = window.AuthSync && typeof window.AuthSync.getState === 'function' ? window.AuthSync.getState() : null;
                const localHas = !!(localStorage.getItem('userName') || localStorage.getItem('firstName') || localStorage.getItem('userId'));
                if (st && st.loggedIn && !localHas) {
                    mirrorCompatibilityKeysToLocal(st.user);
                    renderUserActionFromState(st);
                    updateCartCount();
                    updateOrderCount();
                    return;
                }
                if (!window.AuthSync || (st && typeof st.loggedIn !== 'undefined' && st.loggedIn === !!localHas)) return;
            } catch (e) { /* continue */ }
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
    initXNavMegaMenu();

    try {
        if (typeof updateUserDisplay === 'function') {
            const maybe = updateUserDisplay();
            if (maybe && typeof maybe.then === 'function') {
                maybe.catch(()=>{});
            }
        }
    } catch (e) { /* ignore */ }
}