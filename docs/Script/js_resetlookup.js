// Load page parts
function loadPagePart(url, selector, callback = null, executeScripts = true) {
    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error(`Lỗi HTTP! Trạng thái: ${response.status}`);
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
                    let scriptsLoaded = 0;

                    if (scripts.length === 0 && typeof callback === 'function') {
                        callback();
                    }

                    scripts.forEach(oldScript => {
                        const newScript = document.createElement('script');

                        if (oldScript.src) {
                            newScript.src = oldScript.src;
                            newScript.defer = true;

                            newScript.onload = () => {
                                scriptsLoaded++;
                                if (scriptsLoaded === scripts.length && typeof callback === 'function') {
                                    callback();
                                }
                            };

                            document.body.appendChild(newScript);
                        } else {
                            newScript.textContent = oldScript.textContent;
                            document.body.appendChild(newScript);
                            scriptsLoaded++;
                            if (scriptsLoaded === scripts.length && typeof callback === 'function') {
                                callback();
                            }
                        }
                    });
                } else if (typeof callback === 'function') {
                    callback();
                }
            }
        })
        .catch(error => console.error(`Lỗi khi tải ${url}:`, error));
}

function isLoggedIn() {
    try {
        if (window.AuthSync && typeof window.AuthSync.isLoggedIn === 'function') {
            return window.AuthSync.isLoggedIn();
        }
    } catch (e) { /* ignore */ }
    // fallback to legacy keys
    return !!localStorage.getItem('userId') || !!localStorage.getItem('userName');
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    // === Load HEADER ===
    loadPagePart("HTML/Layout/resetheader.html", "#header-container", () => {
        initHeader();
        const checkDomReady = () => {
            const loginBtn = document.getElementById('loginBtn');
            const popup = document.querySelector('.popup');

            if (!loginBtn || !popup) {
                setTimeout(checkDomReady, 100); // Tiếp tục đợi DOM sẵn sàng
                return;
            }

            if (typeof initializeUser === 'function') {
                console.log('✅ initializeUser() ready.');
                initializeUser();
            }
        };
        checkDomReady();
    });

    // === Load FOOTER ===
    loadPagePart("HTML/Layout/resetfooter.html", "#footer-container");

    // === Khởi tạo Flatpickr cho các input date ===
    initializeFlatpickr('start-date', '.start-date-icon');
    initializeFlatpickr('end-date', '.end-date-icon');

    // === Gắn các event lọc dữ liệu ===
    const productKeywordInput = document.getElementById('product-keyword');
    if (productKeywordInput) {
        productKeywordInput.addEventListener('input', debounce(applyFilters, 300));
    }

    const filterElements = [
        document.getElementById('start-date'),
        document.getElementById('end-date'),
        document.getElementById('status-filter')
    ];

    filterElements.forEach(el => {
        if (el) el.addEventListener('change', applyFilters);
    });
});


// Lottie animations
const lottieAnimations = {
    processing: '/transformanimation/orderprocessing.json',
    shipped: '/transformanimation/shippingorder.json',
    completed: '/transformanimation/successful.json',
    cancelled: '/transformanimation/cancelled.json'
};

// Show toast notification
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }, 100);
}

// Calculate points and tier
function calculatePointsAndTier(order) {
    const points = Math.floor(order.total / 10000);
    return { points };
}

// Calculate delivery score
function calculateDeliveryScore(order) {
    return order.status === 'Đơn hàng đã hoàn thành' ? 100 : 50;
}

// Format currency
function formatCurrency(amount) {
    if (typeof amount !== 'number' || isNaN(amount)) return '0₫';
    return amount.toLocaleString('vi-VN') + '₫';
}

// Get payment method text
function getPaymentMethodText(method) {
    const key = String(method || '').toLowerCase();
    const map = {
        cod: 'Thanh toán khi nhận hàng (COD)',
        cash: 'Thanh toán tiền mặt khi nhận hàng',
        card: 'Thẻ tín dụng/Thẻ ghi nợ',
        credit: 'Thẻ tín dụng/Thẻ ghi nợ',
        debit: 'Thẻ tín dụng/Thẻ ghi nợ',
        wallet: 'Ví điện tử (MoMo, ZaloPay,...)',
        momo: 'Ví điện tử MoMo',
        zalopay: 'Ví điện tử ZaloPay',
        vnpay: 'Ví điện tử VNPay',
        bank: 'Chuyển khoản ngân hàng',
        qr: 'Quét mã QR'
    };
    if (!key) return 'Không xác định';
    return map[key] || method || 'Không xác định';
}

function getServerGifts() {
    try { return JSON.parse(localStorage.getItem('serverGifts') || '[]'); } catch { return []; }
}
function setServerGifts(gifts) {
    try { localStorage.setItem('serverGifts', JSON.stringify(Array.isArray(gifts) ? gifts : [])); } catch {}
}

// Render orders
async function renderOrders(ordersToRender) {
    const ordersContainer = document.getElementById('orders-container');
    const emptyOrders = document.getElementById('empty-orders');
    const searchingAnimation = document.getElementById('searching-animation');

    ordersContainer.innerHTML = '';
    emptyOrders.classList.add('d-none');
    searchingAnimation.classList.remove('d-none');

    // Skeleton loading
    ordersContainer.innerHTML = `
        <div class="order-item skeleton p-3 rounded">
          <div class="skeleton-header bg-light mb-3" style="height: 40px;"></div>
          <div class="skeleton-product bg-light mb-3" style="height: 70px;"></div>
          <div class="skeleton-details bg-light" style="height: 100px;"></div>
        </div>
    `;

    setTimeout(() => {
        searchingAnimation.classList.add('d-none');
        ordersToRender.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        if (ordersToRender.length === 0) {
            ordersContainer.innerHTML = '';

            if (serverOrders.length === 0) {
                emptyOrders.classList.remove('d-none'); // Không có đơn nào thật
                ordersContainer.classList.remove('d-none');
            } else {
                emptyOrders.classList.add('d-none'); // Có đơn thật nhưng lọc không khớp
                ordersContainer.classList.add('d-none');
                showToast("Không tìm thấy đơn hàng phù hợp.");
            }

            updateOrderCount();
            return;
        } else {
            ordersContainer.classList.remove('d-none');
            emptyOrders.classList.add('d-none');
        }

        ordersContainer.innerHTML = '';

        // Nếu có đơn unseen → phát âm thanh
        const newOrder = ordersToRender.find(order => order.unseen === true);
        if (newOrder) {
            const newCardSound = document.getElementById('newcard-sound');
            if (newCardSound) {
                newCardSound.volume = 0.7;
                newCardSound.play();
            }
        }

        ordersToRender.forEach((order, index) => {
            const orderCard = document.createElement('div');
            orderCard.className = 'order-card';

            const total = order.total;
            const firstItem = order.items[0];
            let productsHTML = '';

            // Render từng sản phẩm trong đơn
            order.items.forEach(item => {
                productsHTML += `
                  <div class="order-product d-flex align-items-center mb-2">
                    <img src="${item.image}" alt="${item.name}" class="me-3">
                    <div class="order-product-info">
                      <p class="order-product-name">${item.name} (x${item.quantity})</p>
                      <div class="price-section">
                        <span class="original-price me-2">${formatCurrency(item.originalPrice)}</span>
                        <span class="sale-price">${formatCurrency(item.salePrice)}</span>
                        <span class="discount-badge badge bg-danger ms-2">
                           -${item.discountPercent !== undefined
                    ? item.discountPercent
                    : Math.round(100 - (item.salePrice / item.originalPrice * 100))
                }%
                        </span>
                      </div>
                    </div>
                  </div>
                `;
            });

            const createdAt = new Date(order.createdAt);
            const formattedDate = createdAt.toLocaleString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });

            const deliveryInfo = order.deliveryInfo || {};
            let statusClass = '';
            let lottieAnimation = '';
            let trackingSteps = [];

            // Mapping trạng thái
            switch (order.status) {
                case 'Đơn hàng đang xử lý':
                    statusClass = 'processing';
                    lottieAnimation = lottieAnimations.processing;
                    trackingSteps = [
                        { title: 'Đã đặt hàng', time: formattedDate, status: 'completed' },
                        { title: 'Đang xử lý', time: 'Hiện tại', status: 'active' },
                        { title: 'Đang vận chuyển', time: 'Chưa bắt đầu', status: 'pending' },
                        { title: 'Đã hoàn thành', time: 'Chưa bắt đầu', status: 'pending' }
                    ];
                    break;
                case 'Đơn hàng đang được vận chuyển':
                    statusClass = 'shipped';
                    lottieAnimation = lottieAnimations.shipped;
                    trackingSteps = [
                        { title: 'Đã đặt hàng', time: formattedDate, status: 'completed' },
                        { title: 'Đang xử lý', time: formattedDate, status: 'completed' },
                        { title: 'Đang vận chuyển', time: 'Hiện tại', status: 'active' },
                        { title: 'Đã hoàn thành', time: 'Chưa bắt đầu', status: 'pending' }
                    ];
                    break;
                case 'Đơn hàng đã hoàn thành':
                    statusClass = 'completed';
                    lottieAnimation = lottieAnimations.completed;
                    const completedTimeFmt = order.completedAt
                        ? new Date(order.completedAt).toLocaleString('vi-VN')
                        : 'Hiện tại';
                    trackingSteps = [
                        { title: 'Đã đặt hàng', time: formattedDate, status: 'completed' },
                        { title: 'Đang xử lý', time: formattedDate, status: 'completed' },
                        { title: 'Đang vận chuyển', time: formattedDate, status: 'completed' },
                        { title: 'Đã hoàn thành', time: completedTimeFmt, status: 'completed' }
                    ];
                    break;
                case 'Đơn hàng đã hủy':
                    statusClass = 'cancelled';
                    lottieAnimation = lottieAnimations.cancelled;
                    trackingSteps = [
                        { title: 'Đã đặt hàng', time: formattedDate, status: 'completed' },
                        { title: 'Đơn hàng đã hủy', time: 'Hiện tại', status: 'active' }
                    ];
                    break;
            }

            const { points } = calculatePointsAndTier(order);

            const trackingTimelineHTML = `
                <div class="tracking-timeline">
                  ${trackingSteps.map((step, i) => `
                    <div class="tracking-step ${step.status}">
                      <div class="step-icon">${i + 1}</div>
                      <div class="step-content">
                        <div class="step-title">${step.title}</div>
                        <div class="step-time">${step.time}</div>
                      </div>
                    </div>
                  `).join('')}
                </div>
            `;

            const unseenIndicator = order.unseen ? '<span class="unseen-indicator"></span>' : '';
            const rewardBtnHTML = (() => {
                if (order.status !== 'Đơn hàng đã hoàn thành') {
                    return `<button class="btn btn-reward" onclick="claimReward(${order.id}, event)">
               <i class='bx bx-gift'></i> Nhận thưởng
             </button>`;
                }
                if (order.rewardClaimed) {
                    return `<button class="btn btn-reward claimed" onclick="event.stopPropagation();" disabled>
               <i class='bx bx-medal'></i> ĐÃ NHẬN (${order.rewardPoints || Math.floor(order.total/10000)}đ)
             </button>`;
                }
                return `<button class="btn btn-reward" onclick="claimReward(${order.id}, event)">
            <i class='bx bx-gift'></i> Nhận thưởng
          </button>`;
            })();
            const receiveBtnHTML = (order.status === 'Đơn hàng đang được vận chuyển')
                ? `<button class="btn btn-success btn-sm mb-2" onclick="openReceiveModal(${order.id}, event)">
         <i class='bx bx-check-circle'></i> ĐÃ NHẬN ĐƯỢC HÀNG
       </button>`
                : '';

            // Render card
            orderCard.innerHTML = `
                <div class="order-item ${statusClass}" id="order-item-${index}" data-order-id="${order.id}">
                  <div class="order-front">
                     ${rewardBtnHTML}
                     ${receiveBtnHTML}
                    <div class="order-profile">
                      <div class="order-avatar-wrapper">
                        <img src="${firstItem.image}" alt="Avatar" class="order-avatar">
                      </div>
                      <div>
                        <h3 class="order-number-circle">${order.orderCode}${unseenIndicator}</h3>
                        <div class="points-badge">
                          <i class='bx bx-medal'></i> ${points} điểm
                        </div>
                      </div>
                    </div>
                    <div class="order-status ${statusClass}">
                      <lottie-player src="${lottieAnimation}" background="transparent" speed="1"
                        style="width: 30px; height: 30px;" loop autoplay></lottie-player>
                      ${order.status}
                    </div>
                    ${trackingTimelineHTML}
                    ${order.completedAt ? `<div class="mt-2 small text-info">Hoàn thành lúc: ${new Date(order.completedAt).toLocaleString('vi-VN')}</div>` : ''}
                    <div class="flip-hint">Nhấn để xem chi tiết sản phẩm</div>
                  </div>
                  <div class="order-back">
                    <h3>Chi tiết đơn hàng #${order.orderCode}</h3>
                    <div class="order-products">${productsHTML}</div>
                    <div class="order-delivery-info">
                      <h4><i class='bx bx-map'></i> Thông tin giao hàng</h4>
                      <p><strong>Người nhận:</strong> ${deliveryInfo.name || 'Không có thông tin'}</p>
                      <p><strong>SĐT:</strong> ${deliveryInfo.phone || 'Không có thông tin'}</p>
                      <p><strong>Địa chỉ:</strong> ${deliveryInfo.address || ''}, ${deliveryInfo.ward || ''}, ${deliveryInfo.district || ''}, ${deliveryInfo.province || ''}</p>
                      <p><strong>Thanh toán:</strong> ${getPaymentMethodText(order.paymentMethod)}</p>
                      ${deliveryInfo.note ? `<p><strong>Ghi chú:</strong> ${deliveryInfo.note}</p>` : ''}
                      <p><strong>Xuất HĐ:</strong> ${deliveryInfo.invoiceRequired ? 'Có' : 'Không'}</p>
                    </div>
                    <div class="order-total">Tổng cộng: ${formatCurrency(total)}</div>
                    <div class="order-actions d-flex gap-2">
                      <button class="btn btn-cancel" onclick="cancelOrder(${order.id})"><i class='bx bx-trash'></i> Hủy đơn</button>
                      ${!deliveryInfo.invoiceRequired ? '' : `<button class="btn btn-invoice" onclick="exportToPDF(${order.id})"><i class='bx bx-download'></i> Xuất đơn</button>`}
                      ${order.status === 'Đơn hàng đã hủy' ? `<button class="btn btn-rebuy" onclick="rebuyOrder(${order.id})"><i class='bx bx-cart'></i> Mua lại</button>` : ''}
                    </div>
                  </div>
                </div>
            `;

            ordersContainer.appendChild(orderCard);

            // Animation
            setTimeout(() => {
                orderCard.classList.add('slide-in');
                if (order.status === 'Đơn hàng đã hoàn thành') {
                    const tingSound = document.getElementById('ting-sound');
                    if (tingSound) {
                        tingSound.volume = 0.7;
                        tingSound.play();
                    }
                }
            }, index * 150);

            // Event flip + unseen sync
            const orderItem = document.getElementById(`order-item-${index}`);
            orderItem.addEventListener('click', async function (e) {
                if (!e.target.closest('.order-actions') && !e.target.closest('.btn-reward')) {
                    toggleCard(index);

                    if (order.unseen) {
                        order.unseen = false;
                        serverOrders = serverOrders.map(o =>
                            o.id === order.id ? { ...o, unseen: false } : o
                        );

                        try {
                            await fetch(`${window.API_BASE}/api/orders/${order.id}`, {
                                method: "PATCH",
                                headers: {
                                    "Content-Type": "application/json"
                                },
                                credentials: "include",
                                body: JSON.stringify({ unseen: false })
                            });
                        } catch (err) {
                            console.error("❌ Lỗi đồng bộ unseen:", err);
                        }

                        const unseenDot = orderItem.querySelector('.unseen-indicator');
                        if (unseenDot) unseenDot.remove();
                    }
                }
            });
        });

        // ✅ Update số lượng trên header
        updateOrderCount();
    }, 1200);
}


// Toggle card
function toggleCard(index) {
    const orderItem = document.getElementById(`order-item-${index}`);
    orderItem.classList.toggle('flipped');
    const swishSound = document.getElementById('swish-sound');
    swishSound.volume = 0.9;
    swishSound.play();
}

// Claim reward
async function claimReward(orderId, event) {
    event?.stopPropagation();
    const order = serverOrders.find(o => o.id === orderId);
    if (!order) return showToast('Không tìm thấy đơn');

    // Chưa tới trạng thái vận chuyển hoặc hoàn thành
    if (order.status === 'Đơn hàng đang xử lý') {
        showRewardPopup('Đơn đang xử lý. Chờ duyệt để nhận thưởng sau.');
        return;
    }
    if (order.status === 'Đơn hàng đang được vận chuyển') {
        showRewardPopup('Hãy xác nhận đã nhận hàng để tiếp tục nhận thưởng.');
        return;
    }
    if (order.status === 'Đơn hàng đã hủy') {
        showRewardPopup('Đơn đã bị hủy – không thể nhận thưởng.');
        return;
    }

    // Đã hoàn thành
    if (order.status === 'Đơn hàng đã hoàn thành') {
        if (order.rewardClaimed) {
            showRewardPopup('Bạn đã nhận thưởng đơn này rồi!');
            return;
        }
        const reviewed = await hasReviewed(order.id);
        if (!reviewed) {
            // Chưa review -> buộc review trước
            showReviewPrompt(order);
            return;
        }
        // ĐÃ review -> thực sự claim
        await performClaim(order.id);
    }
}

function ensureReceiveModal() {
    if (document.getElementById('receiveConfirmModal')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = `
    <div class="modal fade" id="receiveConfirmModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content bg-dark text-light">
          <div class="modal-header">
            <h5 class="modal-title"><i class='bx bx-package text-info'></i> Xác nhận giao hàng</h5>
            <button class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <p>Bạn đã nhận được hàng hay chưa?</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Chưa (Quay lại)</button>
            <button class="btn btn-success btn-sm" id="btnConfirmReceived">ĐÃ NHẬN</button>
          </div>
        </div>
      </div>
    </div>`;
    document.body.appendChild(wrap);
}
let _pendingReceiveOrderId = null;
function openReceiveModal(orderId, ev) {
    ev?.stopPropagation();
    _pendingReceiveOrderId = orderId;
    ensureReceiveModal();
    const m = new bootstrap.Modal(document.getElementById('receiveConfirmModal'));
    m.show();
    document.getElementById('btnConfirmReceived').onclick = async () => {
        try {
            await markOrderCompleted(_pendingReceiveOrderId);
            m.hide();
        } catch(e) {
            showToast('Không cập nhật được trạng thái!');
        }
    };
}
async function markOrderCompleted(orderId) {
    if (!orderId) return;
    try {
        const r = await fetch(`${window.API_BASE}/api/orders/${orderId}`, {
            method:'PATCH',
            headers:{'Content-Type':'application/json'},
            credentials:'include',
            body: JSON.stringify({ status: 'Đơn hàng đã hoàn thành' })
        });
        const data = await r.json();
        if (data.success) {
            showToast('Đơn đã chuyển sang HOÀN THÀNH!');
            await fetchOrdersFromServer();
        } else {
            showToast(data.error || 'Không cập nhật được đơn!');
        }
    } catch(err){
        console.error(err);
        showToast('Lỗi mạng khi cập nhật đơn!');
    }
}

// NEW: kiểm tra đã review đơn hàng chưa
async function hasReviewed(orderId) {
    try {
        const r = await fetch(`${window.API_BASE}/api/orders/${orderId}/reviewed`, {credentials:'include'});
        const data = await r.json();
        return !!(data && data.success && data.reviewed);
    } catch {
        return false;
    }
}

function showReviewPrompt(order) {
    // Tạo modal nếu chưa có
    if (!document.getElementById('reviewPromptModal')) {
        const div = document.createElement('div');
        div.innerHTML = `
      <div class="modal fade" id="reviewPromptModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content bg-dark text-light">
            <div class="modal-header">
              <h5 class="modal-title"><i class="fa fa-gift text-warning"></i> Nhận thưởng</h5>
              <button class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <p class="mb-0">Đánh giá sản phẩm bạn vừa mua ngay để nhận điểm thưởng!</p>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Để sau</button>
              <button class="btn btn-success btn-sm" id="btnGoReview">Đánh giá ngay</button>
            </div>
          </div>
        </div>
      </div>`;
        document.body.appendChild(div);
    }
    const m = new bootstrap.Modal(document.getElementById('reviewPromptModal'));
    m.show();

    document.getElementById('btnGoReview').onclick = () => {
        m.hide();
        // Chọn ngẫu nhiên 1 product trong order (bỏ quà)
        const normals = order.items.filter(it => !it.isGift);
        if (!normals.length) {
            showToast('Không tìm thấy sản phẩm để đánh giá.');
            return;
        }
        const pick = normals[Math.floor(Math.random()*normals.length)];
        // Chuyển sang trang product, kèm query review=1 để auto mở tab đánh giá
        window.location.href = `resetproduct.html?id=${encodeURIComponent(pick.id)}&review=1&order=${order.id}`;
    };
}

async function performClaim(orderId) {
    try {
        const r = await fetch(`${window.API_BASE}/api/orders/${orderId}/claim-reward`, {
            method:'POST', credentials:'include'
        });
        const data = await r.json();
        if (data.success) {
            showToast(`+${data.rewardPoints} điểm! Tổng: ${data.totalPoints}`);
            // Tải lại danh sách đơn để cập nhật trạng thái rewardClaimed
            await fetchOrdersFromServer();
            // Cập nhật điểm tài khoản (nếu AuthSync có)
            if (window.AuthSync && typeof window.AuthSync.refresh === 'function') {
                try { await window.AuthSync.refresh(); } catch(e) {}
            }
            // Hiệu ứng nhấn mạnh nút vừa claim (sau khi render xong)
            setTimeout(() => {
                const el = document.querySelector(`.order-item[data-order-id="${orderId}"] .btn-reward.claimed`);
                if (el) {
                    el.classList.add('pulse-once');
                    setTimeout(() => el.classList.remove('pulse-once'), 1500);
                }
            }, 500);
        } else {
            showToast(data.error || 'Không claim được');
        }
    } catch {
        showToast('Lỗi mạng khi claim thưởng');
    }
}

// Show reward popup
function showRewardPopup(message) {
    const popup = document.getElementById('reward-popup');
    const messageElement = popup.querySelector('p');
    if (messageElement) messageElement.textContent = message;
    popup.classList.remove('d-none');
}

// Close reward popup
function closeRewardPopup() {
    document.getElementById('reward-popup').classList.add('d-none');
}

// Helper: try to refresh cart count via shared module, fallback to legacy updateCartCount if missing
async function _refreshCartCountFromSharedOrFallback() {
    try {
        if (window.cartCountShared && typeof window.cartCountShared.refresh === 'function') {
            await window.cartCountShared.refresh();
            return;
        }
    } catch (err) {
        console.warn('cartCountShared.refresh() failed:', err);
    }
    try { if (typeof updateCartCount === 'function') updateCartCount(); } catch (e) {}
}

// Cancel order
// ==================== HỦY HOẶC XOÁ ĐƠN ====================
async function cancelOrder(orderId) {
    if (!orderId) return;

    try {
        const order = serverOrders.find(o => o.id === orderId);

        if (!order) {
            showToast("❌ Không tìm thấy đơn hàng!");
            return;
        }

        // 🔹 Nếu đơn đã hủy → cho phép xóa hẳn
        if (order.status === "Đơn hàng đã hủy") {
            if (confirm(`Sau khi xóa đơn #${orderId}, bạn sẽ không thể mua lại nữa.\nBạn chắc chắn muốn xoá?`)) {
                const res = await fetch(`${window.API_BASE}/api/orders/${orderId}`, {
                    method: "DELETE",
                    credentials: "include"
                });
                const data = await res.json();

                if (data.success) {
                    showToast(`✅ Đơn hàng #${orderId} đã được xoá hoàn toàn!`);
                    await fetchOrdersFromServer();
                } else {
                    showToast(`❌ Không thể xoá đơn: ${data.error || "Lỗi server"}`);
                }
            }
            return;
        }

        // 🔹 Nếu chưa hủy → cập nhật status = "Đơn hàng đã hủy"
        if (confirm(`Bạn có chắc muốn hủy đơn hàng #${orderId}?`)) {
            const res = await fetch(`${window.API_BASE}/api/orders/${orderId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ status: "Đơn hàng đã hủy" })
            });

            const data = await res.json();
            if (data.success) {
                showToast(`✅ Đơn hàng #${orderId} đã được hủy!`);
                await fetchOrdersFromServer();
            } else {
                showToast(`❌ Không thể hủy đơn: ${data.error || "Lỗi server"}`);
            }
        }
    } catch (err) {
        console.error("❌ Lỗi cancelOrder:", err);
        showToast("Có lỗi xảy ra khi hủy đơn hàng!");
    }
}

async function rebuyOrder(orderId) {
    if (!orderId) return;

    try {
        const order = serverOrders.find(o => o.id === orderId);
        if (!order) {
            showToast("❌ Không tìm thấy đơn hàng!");
            return;
        }

        let lastServerCart = null;
        let lastServerGifts = null;

        // Thêm từng item của đơn vào giỏ trên server (BỎ QUA QUÀ)
        for (const item of order.items) {
            if (item.isGift) continue; // ⛔ Không thêm quà vào giỏ, server sẽ tự tính lại

            try {
                const payload = {
                    id: item.productId || item.id,
                    name: item.name,
                    originalPrice: item.originalPrice,
                    salePrice: item.salePrice,
                    discountPercent:
                        item.discountPercent !== undefined
                            ? item.discountPercent
                            : (item.originalPrice ? Math.round(100 - (item.salePrice / item.originalPrice * 100)) : 0),
                    image: item.image,
                    quantity: item.quantity || 1
                };

                const res = await fetch(`${window.API_BASE}/api/cart`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify(payload)
                });

                const data = await res.json();
                if (!data || !data.success) {
                    console.warn(`⚠️ Không thể thêm ${item.name}: ${data && data.error ? data.error : 'Lỗi'}`);
                } else {
                    if (Array.isArray(data.cart)) lastServerCart = data.cart;
                    if (Array.isArray(data.gifts)) lastServerGifts = data.gifts;
                }
            } catch (err) {
                console.error(`❌ Lỗi khi thêm sản phẩm ${item.name}:`, err);
            }
        }

        let message = `✅ Đã thêm sản phẩm từ đơn #${orderId} vào giỏ hàng!`;
        if (confirm(`Bạn có muốn xóa đơn hàng #${orderId} sau khi mua lại không?`)) {
            try {
                const delRes = await fetch(`${window.API_BASE}/api/orders/${orderId}`, {
                    method: "DELETE",
                    credentials: "include"
                });
                const delData = await delRes.json();
                if (delData && delData.success) {
                    message = `✅ Đã mua lại và xoá đơn hàng #${orderId}!`;
                    await fetchOrdersFromServer();
                } else {
                    message = `❌ Không thể xoá đơn: ${delData && delData.error ? delData.error : "Lỗi server"}`;
                }
            } catch (err) {
                console.error("❌ Lỗi khi xoá đơn:", err);
                message = "⚠️ Đã mua lại đơn nhưng không thể xoá đơn!";
            }
        }
        showToast(message);

        // Đồng bộ badge/cart/gifts theo authoritative — CHỈ cart cho badge
        try {
            if (lastServerCart) {
                try { localStorage.setItem('cart', JSON.stringify(lastServerCart)); } catch (e) {}
                if (lastServerGifts) setServerGifts(lastServerGifts);

                if (window.cartCountShared && typeof window.cartCountShared.setFromCart === 'function') {
                    window.cartCountShared.setFromCart(lastServerCart); // KHÔNG gộp gifts
                } else {
                    await _refreshCartCountFromSharedOrFallback();
                }
            } else {
                // Không có cart authoritative từ vòng lặp → gọi GET /api/cart và cập nhật
                try {
                    const cartRes = await fetch(`${window.API_BASE}/api/cart`, { method: "GET", credentials: "include" });
                    const cartData = await cartRes.json();
                    if (cartRes.ok && cartData && cartData.success) {
                        const serverCart = cartData.cart || [];
                        const gifts = cartData.gifts || [];
                        try { localStorage.setItem('cart', JSON.stringify(serverCart)); } catch (e) {}
                        setServerGifts(gifts);

                        if (window.cartCountShared && typeof window.cartCountShared.setFromCart === 'function') {
                            window.cartCountShared.setFromCart(serverCart); // KHÔNG gộp gifts
                        } else {
                            await _refreshCartCountFromSharedOrFallback();
                        }
                    } else {
                        await _refreshCartCountFromSharedOrFallback();
                    }
                } catch (err) {
                    console.warn("⚠️ Fallback GET /api/cart failed:", err);
                    await _refreshCartCountFromSharedOrFallback();
                }
            }
        } catch (err) {
            console.warn("⚠️ Không thể đồng bộ giỏ:", err);
            await _refreshCartCountFromSharedOrFallback();
        }

        // Redirect tới checkout
        window.location.href = "resetcheckout.html";
    } catch (err) {
        console.error("❌ Lỗi rebuyOrder:", err);
        showToast("Có lỗi xảy ra khi mua lại đơn hàng!");
    }
}

async function toBase64Image(url) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (err) {
        console.warn('Không thể tải logo:', url, err);
        return null;
    }
}

// Export to PDF
// ✅ Hàm phụ: Tạo watermark lớn (xoay 45°) dưới dạng image base64
function createFullWatermarkBase64() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const width = 1200;   // Toàn trang A4, đủ lớn
    const height = 1700;

    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    // === Lặp watermark con ===
    const stepX = 300;
    const stepY = 200;

    ctx.font = 'bold 40px Arial';
    ctx.fillStyle = 'rgba(0,0,0,0.1)'; // Màu đen nhạt cho watermark con

    for (let x = 0; x < width; x += stepX) {
        for (let y = 0; y < height; y += stepY) {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate((-30 * Math.PI) / 180);
            ctx.fillText('3TD SHOP', 0, 0);
            ctx.restore();
        }
    }

    // === Watermark lớn trung tâm ===
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate((-45 * Math.PI) / 180);
    ctx.font = 'bold 120px Arial';
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; // Đậm hơn
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('3TD SHOP', 0, 0);
    ctx.restore();

    return canvas.toDataURL();
}
function createApprovalSealBase64() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const size = 400;
    const center = size / 2;
    canvas.width = size;
    canvas.height = size;

    ctx.clearRect(0, 0, size, size);

    // Vòng ngoài
    ctx.beginPath();
    ctx.arc(center, center, 180, 0, 2 * Math.PI);
    ctx.strokeStyle = '#E53935'; // Đỏ tươi
    ctx.lineWidth = 5;
    ctx.stroke();

    // Vòng trong
    ctx.beginPath();
    ctx.arc(center, center, 140, 0, 2 * Math.PI);
    ctx.strokeStyle = '#E53935';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Text vòng ngoài
    const text = '3TD SHOP • 3TD SHOP • 3TD SHOP • ';
    ctx.font = 'bold 22px Arial'; // Tăng lên ~5-10px
    ctx.fillStyle = '#E53935';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const radius = 160;
    const angleStep = (2 * Math.PI) / text.length;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const angle = i * angleStep - Math.PI / 2;

        ctx.save();
        ctx.translate(
            center + radius * Math.cos(angle),
            center + radius * Math.sin(angle)
        );
        ctx.rotate(angle + Math.PI / 2);
        ctx.fillText(char, 0, 0);
        ctx.restore();
    }

    // Text trung tâm
    ctx.font = 'bold 25px Arial'; // Tăng size ~5px
    ctx.fillStyle = 'red';
    ctx.fillText('Đơn hàng đã được', center, center - 12);
    ctx.fillText('3TD Shop kiểm duyệt!', center, center + 15);

    return canvas.toDataURL();
}

// ✅ Hàm chính: Xuất PDF với watermark trung tâm + watermark con
async function exportToPDF(orderId) {
    const order = serverOrders.find(o => o.id === orderId);
    if (!order) {
        showToast('❌ Không tìm thấy đơn hàng!');
        return;
    }

    const delivery = order.deliveryInfo || {};
    const formattedDate = new Date(order.createdAt).toLocaleString('vi-VN');
    const { points } = calculatePointsAndTier(order);

    function proxifyImageURL(url) {
        if (!url) return null;
        if (/^https?:\/\//i.test(url)) {
            return `https://images.weserv.nl/?url=${encodeURIComponent(url.replace(/^https?:\/\//, ''))}`;
        }
        return null;
    }

    // === Flatten sản phẩm (bundle/normal) ===
    const flatItems = [];
    order.items.forEach(item => {
        if (item.isBundle && Array.isArray(item.parts)) {
            flatItems.push({ ...item, _isBundleHeader: true });
            item.parts.forEach(part => {
                flatItems.push({
                    ...part,
                    _isBundlePart: true,
                    bundleName: item.name,
                    quantity: part.quantity ?? 1,
                    originalPrice: part.originalPrice ?? part.price ?? 0,
                    salePrice: part.salePrice ?? part.price ?? 0,
                    image: part.image || item.image || 'Images/Logo.jpg',
                    discountPercent: part.discountPercent ?? 0
                });
            });
        } else {
            flatItems.push({
                ...item,
                quantity: item.quantity ?? 1,
                originalPrice: item.originalPrice ?? item.price ?? 0,
                salePrice: item.salePrice ?? item.price ?? 0,
                image: item.image || 'Images/Logo.jpg',
                discountPercent: item.discountPercent ?? 0
            });
        }
    });

    // === Convert ảnh sản phẩm sang base64 ===
    const productImages = [];
    for (const item of flatItems) {
        if (item._isBundleHeader) {
            productImages.push(null);
            continue;
        }
        try {
            let imgUrl = item.image;
            imgUrl = /^https?:\/\//i.test(imgUrl) ? proxifyImageURL(item.image) : item.image;

            if (!imgUrl) {
                productImages.push(undefined);
                continue;
            }

            const res = await fetch(imgUrl, { mode: 'cors' });
            const blob = await res.blob();
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
            productImages.push(base64);
        } catch {
            productImages.push(undefined);
        }
    }

    // === Bảng sản phẩm ===
    const productTable = [
        [
            { text: 'Ảnh', bold: true, alignment: 'center' },
            { text: 'Tên sản phẩm', bold: true },
            { text: 'SL', bold: true, alignment: 'center' },
            { text: 'Giá gốc', bold: true, alignment: 'center' },
            { text: 'Giảm giá', bold: true, alignment: 'center' },
            { text: 'Giá ưu đãi', bold: true, alignment: 'center' },
            { text: 'Thành tiền', bold: true, alignment: 'center' }
        ],
        ...flatItems.map((item, i) => {
            if (item._isBundleHeader) {
                return [
                    { text: '', border: [false, false, false, false] },
                    { text: `🖥️ ${item.name} (PC tự build)`, colSpan: 6, bold: true, fillColor: '#e3f2fd', color: '#1976d2' },
                    {}, {}, {}, {}, {}
                ];
            } else if (item._isBundlePart) {
                return [
                    productImages[i] ? { image: productImages[i], width: 32, height: 32 } : '',
                    { text: '↳ ' + item.name, italics: true },
                    { text: item.quantity.toString(), alignment: 'center' },
                    { text: formatCurrency(item.originalPrice), alignment: 'center' },
                    { text: `${item.discountPercent}%`, alignment: 'center' },
                    { text: formatCurrency(item.salePrice), alignment: 'center' },
                    { text: formatCurrency(item.salePrice * item.quantity), alignment: 'center' }
                ];
            } else {
                return [
                    productImages[i] ? { image: productImages[i], width: 40, height: 40 } : 'Không ảnh',
                    { text: item.name },
                    { text: item.quantity.toString(), alignment: 'center' },
                    { text: formatCurrency(item.originalPrice), alignment: 'center' },
                    { text: `${item.discountPercent}%`, alignment: 'center' },
                    { text: formatCurrency(item.salePrice), alignment: 'center' },
                    { text: formatCurrency(item.salePrice * item.quantity), alignment: 'center' }
                ];
            }
        })
    ];

    // === Logo, watermark, con dấu ===
    const logoBase64 = await toBase64Image("Image_Showroom/Slogan_w.jpg").catch(() => null);
    const fullWatermarkBase64 = await createFullWatermarkBase64();
    const sealBase64 = await createApprovalSealBase64();

    // === Chính sách đổi trả (bullet) ===
    const policyContent = [
        { text: 'Lưu ý:', bold: true, color: '#e53935', margin: [0, 5, 0, 5] },
        { text: '• Đổi trả trong 14 ngày kể từ ngày nhận hàng nếu phát hiện lỗi kỹ thuật do nhà sản xuất.' },
        { text: '• Báo ngay trong 1 ngày kể từ lúc nhận hàng nếu có rơi, vỡ, hư hỏng, ẩm ướt, sự cố khi vận chuyển.' },
        { text: '• Cung cấp video mở hộp, hóa đơn, tem bảo hành, giữ nguyên bao bì để được hỗ trợ.' },
        { text: '• Yêu cầu đổi trả phải được 3TD Shop xác nhận trước khi gửi lại sản phẩm.' }
    ];

    // === Định nghĩa PDF ===
    const docDefinition = {
        content: [
            {
                columns: [
                    logoBase64 ? { image: logoBase64, width: 80 } : { text: '', width: 80 },
                    { text: 'HÓA ĐƠN BÁN HÀNG', style: 'header', alignment: 'center', width: '*' },
                    { text: '', width: 80 }
                ]
            },
            { text: '\n' },
            { text: `Mã đơn: ${order.orderCode || order.id}` },
            { text: `Ngày đặt: ${formattedDate}` },
            { text: `Trạng thái: ${order.status}` },
            { text: `Điểm thưởng tích lũy: ${points} điểm` },
            { text: '\nDanh sách sản phẩm:', style: 'subheader' },
            {
                table: {
                    headerRows: 1,
                    dontBreakRows: true,
                    widths: [50, '*', 30, 60, 50, 60, 60],
                    body: productTable
                }
            },
            {
                text: `\nTổng cộng: ${formatCurrency(order.total)}`,
                alignment: 'right',
                bold: true,
                color: 'red',
                fontSize: 12
            },
            { text: '\nThông tin khách hàng:', style: 'subheader' },
            { text: `Người nhận: ${delivery.name || 'Không có'}` },
            { text: `Điện thoại: ${delivery.phone || 'Không có'}` },
            { text: `Địa chỉ: ${delivery.address || ''}, ${delivery.ward || ''}, ${delivery.district || ''}, ${delivery.province || ''}` },
            { text: `Phương thức thanh toán: ${getPaymentMethodText(order.paymentMethod)}` },
            delivery.note ? { text: `Ghi chú: ${delivery.note}` } : null,
            { text: '\n' },
            ...policyContent,
            { text: '\nCảm ơn quý khách đã mua sắm tại 3TD Shop!', italics: true, alignment: 'center' },
            sealBase64 ? { image: sealBase64, width: 100, alignment: 'right', margin: [0, 10, 0, 0] } : null
        ].filter(Boolean),
        styles: {
            header: { fontSize: 18, bold: true, color: '#1e88e5' },
            subheader: { fontSize: 15, bold: true, margin: [0, 10, 0, 5] }
        },
        defaultStyle: { font: 'Roboto', fontSize: 10 },
        pageSize: 'A4',
        pageMargins: [40, 60, 40, 60],
        background: (currentPage, pageSize) => ({
            image: fullWatermarkBase64,
            width: pageSize.width,
            height: pageSize.height,
            opacity: 0.08,
            absolutePosition: { x: 0, y: 0 }
        })
    };

    pdfMake.createPdf(docDefinition).download(`DonHang_${order.orderCode || order.id}.pdf`);
}






// Apply filters
function applyFilters() {
    const productKeyword = document.getElementById('product-keyword')?.value.trim().toLowerCase();
    const startDate = document.getElementById('start-date')?.value;
    const endDate = document.getElementById('end-date')?.value;
    const statusFilter = document.getElementById('status-filter')?.value;

    let filteredOrders = [...serverOrders];
    if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (start > end) {
            showToast('Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc!');
            return;
        }
        if (isNaN(start) || isNaN(end)) {
            showToast('Ngày không hợp lệ!');
            return;
        }
    }

    if (statusFilter && statusFilter !== 'all') {
        filteredOrders = filteredOrders.filter(order => order.status === statusFilter);
    }

    if (productKeyword) {
        filteredOrders = filteredOrders.filter(order =>
            order.items.some(item => item.name.toLowerCase().includes(productKeyword))
        );
    }

    if (startDate) {
        filteredOrders = filteredOrders.filter(order => new Date(order.createdAt) >= new Date(startDate));
    }
    if (endDate) {
        filteredOrders = filteredOrders.filter(order => new Date(order.createdAt) <= new Date(endDate));
    }

    renderOrders(filteredOrders);
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Event listeners
document.addEventListener('DOMContentLoaded', async () => {
    // Cập nhật trạng thái AuthSync (nếu có), nhưng KHÔNG mở modal tự động
    if (window.AuthSync && typeof window.AuthSync.refresh === 'function') {
        try { await window.AuthSync.refresh(); } catch (e) { /* ignore */ }
    } else {
        await new Promise(r => setTimeout(r, 200));
    }

    if (!isLoggedIn()) {
        // Chưa đăng nhập: render trạng thái rỗng và vẫn cho người dùng thao tác/lọc UI
        serverOrders = [];
        renderOrders([]);
        updateOrderCount();
    } else {
        // Đã đăng nhập: tải đơn hàng
        await fetchOrdersFromServer();
    }

    // Gắn bộ lọc (idempotent-safe)
    const productKeywordInput = document.getElementById('product-keyword');
    if (productKeywordInput && !productKeywordInput._lookupBound) {
        productKeywordInput.addEventListener('input', debounce(applyFilters, 300));
        productKeywordInput._lookupBound = true;
    }

    const filterElements = [
        document.getElementById('start-date'),
        document.getElementById('end-date'),
        document.getElementById('status-filter')
    ];
    filterElements.forEach(el => {
        if (el && !el._lookupBound) {
            el.addEventListener('change', applyFilters);
            el._lookupBound = true;
        }
    });
});

// ---------- NEW: react to cross-tab / AuthSync auth state changes ----------
if (window.AuthSync && typeof window.AuthSync.onChange === 'function') {
    window.AuthSync.onChange(async (state) => {
        try {
            if (state && state.loggedIn) {
                await fetchOrdersFromServer();
            } else {
                // Đăng xuất: không mở modal, chỉ làm trống danh sách
                serverOrders = [];
                renderOrders([]);
                updateOrderCount();
            }
        } catch (err) {
            console.warn("AuthSync onChange handler error:", err);
        }
    });
}

let serverOrders = []; // đặt ở đầu file
async function fetchOrdersFromServer() {
    try {
        const res = await fetch(`${window.API_BASE}/api/orders`, {
            method: "GET",
            credentials: "include"
        });
        const data = await res.json();
        if (data.success) {
            serverOrders = data.orders;
            renderOrders(serverOrders);
        } else {
            console.warn("⚠️ Không lấy được orders:", data.error);
            serverOrders = [];
            renderOrders([]);
        }
    } catch (err) {
        console.error("❌ Lỗi fetch orders:", err);
        serverOrders = [];
        renderOrders([]);
    }
}

/**
 * Hàm khởi tạo datepicker Flatpickr cho các input ngày
 * @param {string} inputId - ID của input cần gắn Flatpickr
 * @param {string} iconSelector - CSS selector của icon trigger
 */
function initializeFlatpickr(inputId, iconSelector) {
    if (typeof flatpickr === 'undefined') {
        console.warn('Flatpickr chưa được load!');
        return;
    }

    const input = document.getElementById(inputId);
    const icon = document.querySelector(iconSelector);

    if (!input) {
        console.warn(`Không tìm thấy input #${inputId}`);
        return;
    }

    // Khởi tạo Flatpickr
    const fp = flatpickr(`#${inputId}`, {
        dateFormat: "Y-m-d",
        allowInput: true
    });

    // Nếu có icon thì thêm sự kiện click
    if (icon) {
        icon.addEventListener('click', () => {
            fp.open();
        });
    }
}

