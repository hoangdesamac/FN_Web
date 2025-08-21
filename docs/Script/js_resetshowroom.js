// ======================= JS RESET SHOWROOM =======================
// 👉 Nội dung cho các modal
const benefitModalContent = {
    'Giữ xe miễn phí': {
        title: 'Giữ xe miễn phí',
        description: 'Tại 3TD SHOP, chúng tôi cung cấp dịch vụ giữ xe hoàn toàn miễn phí cho khách hàng. Bạn có thể yên tâm để xe an toàn trong bãi đỗ rộng rãi, được giám sát 24/7, giúp bạn thoải mái trải nghiệm mua sắm mà không lo lắng về phương tiện của mình.'
    },
    'Wifi miễn phí': {
        title: 'Wifi miễn phí',
        description: 'Kết nối không giới hạn với Wifi tốc độ cao miễn phí tại tất cả các showroom 3TD SHOP. Dù bạn muốn kiểm tra thông tin sản phẩm, chia sẻ trải nghiệm hay lướt web, chúng tôi đảm bảo bạn luôn được kết nối mượt mà.'
    },
    'Trải nghiệm sản phẩm miễn phí': {
        title: 'Trải nghiệm sản phẩm miễn phí',
        description: 'Hãy tự tay khám phá những sản phẩm công nghệ đỉnh cao tại showroom! 3TD SHOP cung cấp không gian trải nghiệm miễn phí, nơi bạn có thể thử nghiệm các thiết bị trước khi quyết định mua, đảm bảo sự hài lòng tuyệt đối.'
    },
    'Tư vấn chuyên sâu': {
        title: 'Tư vấn chuyên sâu',
        description: 'Đội ngũ chuyên viên của 3TD SHOP luôn sẵn sàng hỗ trợ bạn với kiến thức chuyên môn sâu rộng. Từ việc chọn sản phẩm phù hợp đến giải đáp mọi thắc mắc, chúng tôi cam kết mang đến trải nghiệm tư vấn cá nhân hóa và tận tâm.'
    },
    'Sản phẩm chính hãng 100%': {
        title: 'Sản phẩm chính hãng 100%',
        description: 'Mọi sản phẩm tại 3TD SHOP đều được cam kết chính hãng 100%, đi kèm bảo hành đầy đủ từ nhà sản xuất. Mua sắm với sự an tâm, chất lượng và uy tín luôn là ưu tiên hàng đầu của chúng tôi.'
    },
    'Chính sách trả góp': {
        title: 'Chính sách trả góp',
        description: 'Sở hữu sản phẩm mơ ước chưa bao giờ dễ dàng đến thế! Với chính sách trả góp linh hoạt, lãi suất hấp dẫn và thủ tục đơn giản, 3TD SHOP giúp bạn sở hữu công nghệ đỉnh cao mà không lo gánh nặng tài chính.'
    },
    'Thanh toán dễ dàng': {
        title: 'Thanh toán dễ dàng',
        description: 'Chúng tôi hỗ trợ nhiều phương thức thanh toán tiện lợi như tiền mặt, thẻ ngân hàng, ví điện tử và chuyển khoản. Quy trình thanh toán nhanh chóng, an toàn, giúp bạn tiết kiệm thời gian và tận hưởng trải nghiệm mua sắm mượt mà.'
    },
    'Giao hàng tận nhà': {
        title: 'Giao hàng tận nhà',
        description: 'Không cần đến showroom, 3TD SHOP mang sản phẩm đến tận cửa nhà bạn! Dịch vụ giao hàng nhanh chóng, an toàn và đúng hẹn, đảm bảo sản phẩm đến tay bạn trong tình trạng hoàn hảo.'
    }
};

// 👉 Tạo và hiển thị modal
function showBenefitModal(benefitText) {
    const content = benefitModalContent[benefitText];
    if (!content) return;

    const modal = $(`
        <div class="modal fade" id="benefitModal" tabindex="-1" aria-labelledby="benefitModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content" style="background: linear-gradient(135deg, #1a1a2e, #16213e); color: #fff; border-radius: 12px;">
                    <div class="modal-header" style="border-bottom: 1px solid #00f2ff;">
                        <h5 class="modal-title" id="benefitModalLabel">${content.title}</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body" style="font-size: 1.1rem; line-height: 1.6;">
                        ${content.description}
                    </div>
                </div>
            </div>
        </div>
    `);

    $('body').append(modal);
    modal.modal('show');
    modal.on('hidden.bs.modal', function () {
        modal.remove();
    });
}

// 👉 Hiệu ứng particles nổi
function createParticle() {
    const particle = $('<div class="particle"></div>').css({
        position: 'fixed',
        width: '2px',
        height: '2px',
        background: '#00f2ff',
        left: Math.random() * window.innerWidth + 'px',
        top: window.innerHeight + 'px',
        'pointer-events': 'none',
        'z-index': '1',
        'box-shadow': '0 0 10px #00f2ff'
    });
    $('body').append(particle);
    particle.animate({
        top: '-10px',
        left: '+=' + (Math.random() * 200 - 100) + 'px'
    }, {
        duration: 8000,
        easing: 'linear',
        complete: function () { particle.remove(); }
    });
}
function initParticles() { setInterval(createParticle, 3000); }

// 👉 Hiệu ứng hover/click trên benefit items
function initBenefitItemEffects() {
    $('.benefit-item').hover(
        function () { $(this).addClass('benefit-hover'); },
        function () { $(this).removeClass('benefit-hover'); }
    );
    $('.benefit-item').click(function () {
        $(this).addClass('benefit-clicked');
        setTimeout(() => $(this).removeClass('benefit-clicked'), 200);
        const benefitText = $(this).find('div').text().trim();
        showBenefitModal(benefitText);
    });
}

// 👉 Animation khi cuộn tới benefit
function initIntersectionObserver() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => { if (entry.isIntersecting) entry.target.style.animationPlayState = 'running'; });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    $('.benefit-item').each(function () { observer.observe(this); });
}

// 👉 Toggle map
function initMapToggleLogic() {
    $('.navigation-toggle-btn').click(function () {
        $(this).closest('.store-card').find('.map-frame').slideToggle(300);
    });
}

// 👉 Navigation button feedback
function initNavigationButtonLogic() {
    $('.navigation-btn').click(function () {
        const storeName = $(this).closest('.store-card').find('.store-name').text().trim();
        console.log('Navigate to:', storeName);
        $(this).addClass('clicked');
        setTimeout(() => $(this).removeClass('clicked'), 300);
    });
}

// 👉 Hotline
function initHotlineLogic() {
    $('.hotline-btn').click(function (e) {
        e.preventDefault();
        $(this).addClass('animate__pulse');
        setTimeout(() => {
            $(this).removeClass('animate__pulse');
            window.location.href = 'contact.html';
        }, 200);
    });
}

// 👉 Delay animation từng store-card
function initStoreCardAnimations() {
    $('.store-card').each(function (index) {
        $(this).css('animation-delay', (index * 0.2) + 's');
    });
}

// 👉 Intro video
function initIntroVideoLogic() {
    const video = document.getElementById("introVideo");
    const introContainer = document.querySelector(".video-banner-container");
    const showroomIntro = document.getElementById("showroomIntro");
    if (!video || !introContainer || !showroomIntro) return;

    introContainer.classList.remove("fade-out", "d-none");
    showroomIntro.classList.add("d-none");
    showroomIntro.classList.remove("show");
    video.currentTime = 0;

    setTimeout(() => {
        video.play().catch(() => {
            const resumePlayback = () => {
                video.play();
                document.removeEventListener("click", resumePlayback);
                document.removeEventListener("keydown", resumePlayback);
            };
            document.addEventListener("click", resumePlayback);
            document.addEventListener("keydown", resumePlayback);
        });
    }, 300);

    video.addEventListener("ended", function () {
        introContainer.classList.add("fade-out");
        setTimeout(() => {
            introContainer.classList.add("d-none");
            showroomIntro.classList.remove("d-none");
            requestAnimationFrame(() => showroomIntro.classList.add("show"));
        }, 1000);
    });
}

// ======================= Loader đồng bộ với checkout.js =======================
function loadPagePart(url, selector, callback = null, executeScripts = true) {
    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
            return response.text();
        })
        .then(data => {
            const container = document.querySelector(selector);
            if (container) {
                container.innerHTML = data;
                if (executeScripts) {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = data;
                    const scripts = tempDiv.querySelectorAll('script');
                    scripts.forEach(oldScript => {
                        const newScript = document.createElement('script');
                        if (oldScript.src) {
                            if (!document.querySelector(`script[src="${oldScript.src}"]`)) {
                                newScript.src = oldScript.src;
                                newScript.defer = true;
                                document.body.appendChild(newScript);
                            }
                        } else {
                            newScript.textContent = oldScript.textContent;
                            document.body.appendChild(newScript);
                        }
                    });
                }
                if (typeof callback === 'function') callback();
            }
        })
        .catch(error => console.error(`Lỗi khi tải ${url}:`, error));
}

// 📌 MAIN LOADER
function initShowroomPage() {
    initParticles();
    initBenefitItemEffects();
    initIntersectionObserver();
    initHotlineLogic();
    initNavigationButtonLogic();
    initMapToggleLogic();
    initStoreCardAnimations();
    initIntroVideoLogic();
}

document.addEventListener("DOMContentLoaded", function () {
    // Header
    loadPagePart("HTML/Layout/resetheader.html", "#header-container", () => {
        if (typeof initHeader === 'function') initHeader();
        if (typeof initializeUser === 'function') initializeUser();
    });

    // Footer
    loadPagePart("HTML/Layout/resetfooter.html", "#footer-container", () => {
        if (typeof initFooter === 'function') initFooter();
    });

    // Gọi showroom logic
    initShowroomPage();
});
