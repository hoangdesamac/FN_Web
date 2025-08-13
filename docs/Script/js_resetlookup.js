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

    // === Các phần xử lý riêng của lookup ===
    renderOrders(JSON.parse(localStorage.getItem('orders')) || []);

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
    return amount.toLocaleString('vi-VN') + '₫';
}

// Get payment method text
function getPaymentMethodText(method) {
    switch (method) {
        case 'cod': return 'Thanh toán khi nhận hàng (COD)';
        case 'credit': return 'Thẻ tín dụng/Thẻ ghi nợ';
        case 'wallet': return 'Ví điện tử (MoMo, ZaloPay,...)';
        default: return 'Không xác định';
    }
}

// Render orders
function renderOrders(ordersToRender) {
    const ordersContainer = document.getElementById('orders-container');
    const emptyOrders = document.getElementById('empty-orders');
    const searchingAnimation = document.getElementById('searching-animation');

    ordersContainer.innerHTML = '';
    emptyOrders.classList.add('d-none');
    searchingAnimation.classList.remove('d-none');

    // Skeleton
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

            const allOrders = JSON.parse(localStorage.getItem('orders')) || [];
            if (allOrders.length === 0) {
                // Không có đơn hàng thật → Show emptyOrders
                emptyOrders.classList.remove('d-none');
                ordersContainer.classList.remove('d-none');
            } else {
                // Có đơn hàng nhưng lọc không khớp → Ẩn hết!
                emptyOrders.classList.add('d-none');
                ordersContainer.classList.add('d-none');

                const productKeyword = document.getElementById('product-keyword')?.value.trim();
                const statusFilter = document.getElementById('status-filter')?.value;
                const startDate = document.getElementById('start-date')?.value;
                const endDate = document.getElementById('end-date')?.value;

                let message = 'Không tìm thấy đơn hàng phù hợp';
                if (statusFilter && statusFilter !== 'all') {
                    message += ` với trạng thái "${statusFilter}"`;
                }
                if (productKeyword) {
                    message += `, tên chứa "${productKeyword}"`;
                }
                if (startDate || endDate) {
                    message += ` trong khoảng `;
                    if (startDate) message += `từ ${startDate} `;
                    if (endDate) message += `đến ${endDate}`;
                }
                message += '.';
                showToast(message);
            }

            updateOrderCount();
            return;
        } else {
            // ✅ Khi tìm thấy → bật hiển thị lại!
            ordersContainer.classList.remove('d-none');
            emptyOrders.classList.add('d-none');
        }


        ordersContainer.innerHTML = '';
        const newOrder = ordersToRender.find(order => order.unseen === true);
        if (newOrder) {
            const newCardSound = document.getElementById('newcard-sound');
            if (newCardSound) {
                newCardSound.volume = 0.7;
                newCardSound.play();
            }
        }

        let localOrdersChanged = false;

        ordersToRender.forEach((order, index) => {
            const orderCard = document.createElement('div');
            orderCard.className = 'order-card';
            const total = order.total;
            let productsHTML = '';
            const firstItem = order.items[0];

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
                    trackingSteps = [
                        { title: 'Đã đặt hàng', time: formattedDate, status: 'completed' },
                        { title: 'Đang xử lý', time: formattedDate, status: 'completed' },
                        { title: 'Đang vận chuyển', time: formattedDate, status: 'completed' },
                        { title: 'Đã hoàn thành', time: 'Hiện tại', status: 'completed' }
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

            orderCard.innerHTML = `
        <div class="order-item ${statusClass}" id="order-item-${index}" data-order-id="${order.id}">
          <div class="order-front">
            <button class="btn btn-reward" onclick="claimReward('${order.id}', event)">
              <i class='bx bx-gift'></i> Nhận thưởng
            </button>
            <div class="order-profile">
              <div class="order-avatar-wrapper">
                <img src="${firstItem.image}" alt="Avatar" class="order-avatar">
              </div>
              <div>
                <h3 class="order-number-circle">${order.id}${unseenIndicator}</h3>
                <div class="points-badge">
                  <i class='bx bx-medal'></i> ${points} điểm
                </div>
              </div>
            </div>
            <div class="order-status ${statusClass}">
              <lottie-player src="${lottieAnimation}" background="transparent" speed="1" style="width: 30px; height: 30px;" loop autoplay></lottie-player>
              ${order.status}
            </div>
            ${trackingTimelineHTML}
            <div class="flip-hint">Nhấn để xem chi tiết sản phẩm</div>
          </div>
          <div class="order-back">
            <h3>Chi tiết đơn hàng #${order.id}</h3>
            <div class="order-products">${productsHTML}</div>
            <div class="order-delivery-info">
              <h4><i class='bx bx-map'></i> Thông tin giao hàng</h4>
              <p><strong>Người nhận:</strong> ${deliveryInfo.name || 'Không có thông tin'}</p>
              <p><strong>Số điện thoại:</strong> ${deliveryInfo.phone || 'Không có thông tin'}</p>
              <p><strong>Địa chỉ:</strong> ${deliveryInfo.address || ''}, ${deliveryInfo.ward || ''}, ${deliveryInfo.district || ''}, ${deliveryInfo.province || ''}</p>
              <p><strong>Phương thức thanh toán:</strong> ${getPaymentMethodText(order.paymentMethod)}</p>
              ${deliveryInfo.note ? `<p><strong>Ghi chú:</strong> ${deliveryInfo.note}</p>` : ''}
              <p><strong>Yêu cầu xuất hóa đơn:</strong> ${deliveryInfo.invoiceRequired ? 'Có' : 'Không'}</p>
            </div>
            <div class="order-total">Tổng cộng: ${formatCurrency(total)}</div>
            <div class="order-actions d-flex gap-2">
              <button class="btn btn-cancel" onclick="cancelOrder('${order.id}')"><i class='bx bx-trash'></i> Hủy đơn hàng</button>
              ${!deliveryInfo.invoiceRequired ? '' : `<button class="btn btn-invoice" onclick="exportToPDF('${order.id}')"><i class='bx bx-download'></i> Xuất hóa đơn</button>`}
              ${order.status === 'Đơn hàng đã hủy' ? `<button class="btn btn-rebuy" onclick="rebuyOrder('${order.id}')"><i class='bx bx-cart'></i> Mua lại đơn</button>` : ''}
            </div>
          </div>
        </div>
      `;

            ordersContainer.appendChild(orderCard);

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

            const orderItem = document.getElementById(`order-item-${index}`);
            orderItem.addEventListener('click', function(e) {
                if (!e.target.closest('.order-actions') && !e.target.closest('.btn-reward')) {
                    toggleCard(index);
                    if (order.unseen) {
                        order.unseen = false;
                        localOrdersChanged = true;
                        let orders = JSON.parse(localStorage.getItem('orders')) || [];
                        orders = orders.map(o => o.id === order.id ? { ...o, unseen: false } : o);
                        localStorage.setItem('orders', JSON.stringify(orders));
                        const unseenDot = orderItem.querySelector('.unseen-indicator');
                        if (unseenDot) unseenDot.remove();
                    }
                }
            });
        });

        // ✅ Sau toàn bộ: update số lượng trên header
        if (localOrdersChanged) {
            const orders = JSON.parse(localStorage.getItem('orders')) || [];
            localStorage.setItem('orders', JSON.stringify(orders));
        }
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
function claimReward(orderId, event) {
    event.stopPropagation();
    const orders = JSON.parse(localStorage.getItem('orders')) || [];
    const orderIndex = orders.findIndex(order => order.id === orderId);
    if (orderIndex === -1) {
        showToast('Không tìm thấy đơn hàng!');
        return;
    }
    const order = orders[orderIndex];
    if (order.status === 'Đơn hàng đã hủy') {
        showRewardPopup('Đơn hàng đã bị hủy, tiến hành mua lại và hoàn tất các thủ tục để nhận phần thưởng này!');
        return;
    }
    if (order.status !== 'Đơn hàng đã hoàn thành') {
        showRewardPopup('Hoàn tất nhận hàng để tiến hành nhận thưởng');
        return;
    }
    showToast('Bạn đã nhận được thưởng cho đơn hàng này!');
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

// Cancel order
function cancelOrder(orderId) {
    if (confirm('Bạn có chắc muốn hủy đơn hàng này?')) {
        let orders = JSON.parse(localStorage.getItem('orders')) || [];
        const orderIndex = orders.findIndex(order => order.id === orderId);

        if (orderIndex === -1) {
            showToast('Không tìm thấy đơn hàng!');
            return;
        }

        const order = orders[orderIndex];
        if (order.status === 'Đơn hàng đã hủy') {
            if (confirm('Sau khi xóa hoàn toàn đơn này bạn sẽ không thể tiếp tục mua lại đơn này nữa!')) {
                orders.splice(orderIndex, 1);
                showToast('Đơn hàng đã được xóa hoàn toàn!');
            } else {
                return;
            }
        } else {
            order.status = 'Đơn hàng đã hủy';
            showToast('Đơn hàng đã được hủy!');
        }

        orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        localStorage.setItem('orders', JSON.stringify(orders));
        renderOrders(orders);
        updateOrderCount();
    }
}

// Rebuy order
function rebuyOrder(orderId) {
    let orders = JSON.parse(localStorage.getItem('orders')) || [];
    const orderIndex = orders.findIndex(order => order.id === orderId);

    if (orderIndex === -1) {
        showToast('Không tìm thấy đơn hàng!');
        return;
    }

    const order = orders[orderIndex];
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    order.items.forEach(item => {
        const cartItem = {
            id: item.id || `${order.id}-${item.name}-${Date.now()}`,
            name: item.name,
            originalPrice: item.originalPrice,
            salePrice: item.salePrice,
            discountPercent: item.discountPercent !== undefined
                ? item.discountPercent
                : Math.round(100 - (item.salePrice / item.originalPrice * 100)),
            image: item.image,
            quantity: item.quantity,
            addedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        const existingItemIndex = cart.findIndex(cartItem => cartItem.id === item.id);
        if (existingItemIndex !== -1) {
            cart[existingItemIndex].quantity += item.quantity;
            cart[existingItemIndex].updatedAt = new Date().toISOString();
        } else {
            cart.push(cartItem);
        }
    });
    localStorage.setItem('cart', JSON.stringify(cart));
    orders.splice(orderIndex, 1);
    localStorage.setItem('orders', JSON.stringify(orders));
    renderOrders(orders);
    showToast(`Đã xóa đơn hàng #${orderId} và thêm sản phẩm vào giỏ hàng! Chuyển đến trang thanh toán...`);
    setTimeout(() => window.location.href = 'resetcheckout.html', 800);
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
    const orders = JSON.parse(localStorage.getItem('orders')) || [];
    const order = orders.find(o => o.id === orderId);
    if (!order) {
        showToast('Không tìm thấy đơn hàng!');
        return;
    }

    const delivery = order.deliveryInfo || {};
    const formattedDate = new Date(order.createdAt).toLocaleString('vi-VN');
    const { points } = calculatePointsAndTier(order);

    function proxifyImageURL(url) {
        return `https://images.weserv.nl/?url=${encodeURIComponent(url.replace(/^https?:\/\//, ''))}`;
    }

    // === Convert product images to base64 ===
    const productImages = await Promise.all(
        order.items.map(async item => {
            const proxiedURL = proxifyImageURL(item.image);
            try {
                const response = await fetch(proxiedURL, { mode: 'cors' });
                const blob = await response.blob();
                return await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            } catch (err) {
                console.warn('Không thể lấy ảnh qua proxy:', item.image, err);
                return null;
            }
        })
    );

    // === Table rows ===
    const productTable = [
        [
            { text: 'Ảnh', bold: true, alignment: 'center' },
            { text: 'Tên sản phẩm', bold: true, alignment: 'left' },
            { text: 'SL', bold: true, alignment: 'center' },
            { text: 'Giá gốc', bold: true, alignment: 'center' },
            { text: 'Giảm giá', bold: true, alignment: 'center' },
            { text: 'Giá ưu đãi', bold: true, alignment: 'center' },
            { text: 'Thành tiền', bold: true, alignment: 'center' }
        ],
        ...order.items.map((item, i) => [
            item.image ? { image: productImages[i], width: 40, height: 40, alignment: 'center' } : 'Không ảnh',
            { text: item.name, alignment: 'left' }, // Cột này bạn có thể alignment: 'left'
            { text: item.quantity.toString(), alignment: 'center' },
            { text: formatCurrency(item.originalPrice), alignment: 'center' },
            { text: `${item.discountPercent !== undefined
                    ? item.discountPercent
                    : Math.round(100 - (item.salePrice / item.originalPrice * 100))
                }%`, alignment: 'center' },
            { text: formatCurrency(item.salePrice), alignment: 'center' },
            { text: formatCurrency(item.quantity * item.salePrice), alignment: 'center' }
        ])
    ];

    // === Logo Base64 ===
    const logoBase64 = await toBase64Image("Image_Showroom/Slogan_w.jpg");

    // === Watermark toàn trang ===
    const fullWatermarkBase64 = createFullWatermarkBase64();

    const docDefinition = {
        content: [
            {
                columns: [
                    logoBase64 ? { image: logoBase64, width: 80 } : { text: '', width: 80 },
                    {
                        text: 'HÓA ĐƠN BÁN HÀNG',
                        style: 'header',
                        alignment: 'center',
                        width: '*'
                    },
                    { text: '', width: 80 }
                ]
            },
            { text: '\n' },
            { text: `Mã đơn: ${order.id}` },
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
                bold: true
            },
            { text: '\nThông tin khách hàng:', style: 'subheader' },
            { text: `Người nhận: ${delivery.name || 'Không có'}` },
            { text: `Điện thoại: ${delivery.phone || 'Không có'}` },
            {
                text: `Địa chỉ: ${delivery.address || ''}, ${delivery.ward || ''}, ${delivery.district || ''}, ${delivery.province || ''}`
            },
            { text: `Phương thức thanh toán: ${getPaymentMethodText(order.paymentMethod)}` },
            delivery.note ? { text: `Ghi chú: ${delivery.note}` } : null,
            { text: '\nCảm ơn quý khách đã mua sắm tại 3TD Shop!', italics: true, alignment: 'center', color: 'black' },
            {
                image: createApprovalSealBase64(),
                width: 100,
                alignment: 'right',
                margin: [0, 10, 0, 0]
            }
        ],
        styles: {
            header: { fontSize: 18, bold: true, color: '#1e88e5' },
            subheader: { fontSize: 15, bold: true, margin: [0, 10, 0, 5] }
        },
        defaultStyle: {
            font: 'Roboto',
            fontSize: 10
        },
        pageSize: 'A4',
        pageMargins: [40, 60, 40, 60],
        background: function (currentPage, pageSize) {
            return {
                image: fullWatermarkBase64,
                width: pageSize.width,
                height: pageSize.height,
                opacity: 1, // base64 có opacity sẵn
                absolutePosition: { x: 0, y: 0 }
            };
        }
    };

    pdfMake.createPdf(docDefinition).download(`DonHang_${order.id}.pdf`);
}


// Apply filters
function applyFilters() {
    const productKeyword = document.getElementById('product-keyword')?.value.trim().toLowerCase();
    const startDate = document.getElementById('start-date')?.value;
    const endDate = document.getElementById('end-date')?.value;
    const statusFilter = document.getElementById('status-filter')?.value;

    let filteredOrders = JSON.parse(localStorage.getItem('orders')) || [];

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
document.addEventListener('DOMContentLoaded', () => {
    const productKeywordInput = document.getElementById('product-keyword');
    if (productKeywordInput) {
        productKeywordInput.addEventListener('input', debounce(applyFilters, 300));
    }

    const filterElements = [document.getElementById('start-date'), document.getElementById('end-date'), document.getElementById('status-filter')];
    filterElements.forEach(el => {
        if (el) el.addEventListener('change', applyFilters);
    });
});

// Update order count
function updateOrderCount() {
    const orders = JSON.parse(localStorage.getItem('orders')) || [];
    const orderCountElement = document.querySelector('.order-count');
    if (orderCountElement) {
        orderCountElement.textContent = orders.length;
        orderCountElement.style.display = orders.length > 0 ? 'inline-flex' : 'none';
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

