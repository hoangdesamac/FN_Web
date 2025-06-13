function initHeaderScrollEffect() {
    const header = document.querySelector('.cyber-header');
    if (!header) return;

    window.addEventListener('scroll', () => {
        header.classList.toggle('scrolled', window.scrollY > 50);
    });
}

function initCartCountEffect() {
    const cartCount = document.querySelector('.cart-count');
    if (!cartCount) return;

    setInterval(() => {
        if (Math.random() > 0.7) {
            const count = Math.floor(Math.random() * 5) + 1;
            cartCount.textContent = count;
            cartCount.style.transform = 'scale(1.3)';
            setTimeout(() => {
                cartCount.style.transform = 'scale(1)';
            }, 300);
        }
    }, 3000);
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

// ✅ Hàm tổng chạy toàn bộ sau khi header đã load vào DOM
function initHeader() {
    initHeaderScrollEffect();
    initCartCountEffect();
    initHexagonBackground();
    initCategoryDropdown();
    initResponsiveHandler();
    initLoginModalTrigger();
}
