function initMegaMenuHover() {
    const menuPairs = [
        ["menu-laptop", "mega-laptop"],
        ["menu-laptop-gaming", "mega-laptop-gaming"],
        ["menu-pc-gvn", "mega-pc-gvn"],
        ["menu-main-cpu-vga", "mega-main-cpu-vga"],
        ["menu-case-psu-cooler", "mega-case-psu-cooler"],
        ["menu-storage", "mega-storage"],
        ["menu-audio", "mega-audio"],
        ["menu-monitor", "mega-monitor"],
        ["menu-keyboard", "mega-keyboard"],
        ["menu-mouse", "mega-mouse"],
        ["menu-headphone", "mega-headphone"],
        ["menu-chair", "mega-chair"],
        ["menu-network", "mega-network"],
        ["menu-handheld", "mega-handheld"],
        ["menu-phukien", "mega-phukien"],
        ["menu-dichvu", "mega-dichvu"],
    ];

    menuPairs.forEach(([menuId, megaId]) => {
        const trigger = document.getElementById(menuId);
        const mega = document.getElementById(megaId);
        let inside = false;

        if (trigger && mega) {
            trigger.addEventListener("mouseenter", () => mega.style.display = "block");
            trigger.addEventListener("mouseleave", () => {
                setTimeout(() => { if (!inside) mega.style.display = "none"; }, 150);
            });
            mega.addEventListener("mouseenter", () => {
                inside = true;
                mega.style.display = "block";
            });
            mega.addEventListener("mouseleave", () => {
                inside = false;
                mega.style.display = "none";
            });
        }
    });
}

function initSidebarHeightSync() {
    const sidebar = document.querySelector(".cyber-sidebar");
    const megaMenu = document.getElementById("mega-laptop");

    function syncHeight() {
        if (sidebar && megaMenu) {
            const sidebarHeight = sidebar.offsetHeight;
            megaMenu.style.minHeight = sidebarHeight + "px";
        }
    }

    syncHeight();
    window.addEventListener('resize', syncHeight);
}

function initCountdownTimer() {
    // Khởi tạo biến endTime toàn cục, chỉ tính 1 lần!
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + 10 * 60 * 60 * 1000);

    function updateTimer() {
        const now = new Date();
        const timeDiff = endTime - now;

        if (timeDiff <= 0) {
            document.getElementById('hours').textContent = '00';
            document.getElementById('minutes').textContent = '00';
            document.getElementById('seconds').textContent = '00';
            clearInterval(timerInterval); // Dừng luôn interval
            return;
        }

        const hours = Math.floor(timeDiff / (1000 * 60 * 60));
        const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

        document.getElementById('hours').textContent = String(hours).padStart(2, '0');
        document.getElementById('minutes').textContent = String(minutes).padStart(2, '0');
        document.getElementById('seconds').textContent = String(seconds).padStart(2, '0');
    }

    const timerInterval = setInterval(updateTimer, 1000);
    updateTimer();
}

function initFlashSaleCarousel() {
    const carouselEl = document.querySelector('#flashSaleCarousel');
    if (!carouselEl) return;

    const carousel = new bootstrap.Carousel(carouselEl, {
        interval: 8000,
        pause: 'hover',
        ride: 'carousel'
    });

    carouselEl.addEventListener('touchstart', () => {
        carousel.pause();
        console.log('Paused by touch!');
    });

    carouselEl.addEventListener('touchend', () => {
        carousel.cycle();
        console.log('Cycle after touchend!');
    });
}

// ✅ Hàm tổng để gọi lại sau khi load xong main content
function initMainContent() {
    initMegaMenuHover();
    initSidebarHeightSync();
    initCountdownTimer();
    initFlashSaleCarousel();
}

