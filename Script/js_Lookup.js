async function loadPagePart(url, containerId, callback = null) {
    try {
        const response = await fetch(url);
        const html = await response.text();
        const container = document.getElementById(containerId);
        container.innerHTML = html;

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        const scripts = tempDiv.querySelectorAll('script');
        scripts.forEach(oldScript => {
            const src = oldScript.src;
            if (src && document.querySelector(`script[src="${src}"]`)) return;
            const newScript = document.createElement('script');
            if (src) {
                newScript.src = src;
                newScript.defer = true;
            } else {
                newScript.textContent = oldScript.textContent;
            }
            document.body.appendChild(newScript);
        });

        if (typeof callback === 'function') callback();
    } catch (error) {
        console.error(`Lỗi khi tải ${url}:`, error);
    }
}

loadPagePart("HTML/Layout/header.html", "header-container", () => {
    if (typeof updateCartCount === 'function') {
        setTimeout(updateCartCount, 300);
    }
    if (typeof initializeMenuSystem === 'function') {
        setTimeout(initializeMenuSystem, 300);
    }
    updateOrderCount();
});

loadPagePart("HTML/Layout/footer.html", "footer-container");

let allOrders = [];

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

// Mã Lottie animation cho từng trạng thái
const lottieAnimations = {
    processing: 'https://assets5.lottiefiles.com/packages/lf20_iarrbpvk.json',
    shipped: 'https://assets5.lottiefiles.com/packages/lf20_ztmeoccu.json',
    completed: 'https://assets5.lottiefiles.com/packages/lf20_jbrw3haz.json'
};

// Hàm tính điểm thưởng
function calculatePointsAndTier(order) {
    const points = Math.floor(order.total / 10000);
    return { points };
}

// Hàm tính điểm giao hàng đúng hẹn
function calculateDeliveryScore(order) {
    return order.status === 'Đơn hàng đã hoàn thành' ? 100 : 50;
}

function renderOrders(ordersToRender) {
    const ordersContainer = document.getElementById('orders-container');
    const emptyOrders = document.getElementById('empty-orders');

    ordersContainer.innerHTML = `
        <div class="order-item skeleton">
            <div class="skeleton-header"></div>
            <div class="skeleton-product"></div>
            <div class="skeleton-details"></div>
        </div>
    `;

    setTimeout(() => {
        if (ordersToRender.length === 0) {
            emptyOrders.style.display = 'block';
            ordersContainer.innerHTML = '';
            showToast('Không tìm thấy đơn hàng!');
            return;
        }

        emptyOrders.style.display = 'none';
        ordersContainer.innerHTML = '';

        // Tìm đơn hàng mới nhất có unseen: true để phát âm thanh
        const newOrder = ordersToRender.find(order => order.unseen === true);
        if (newOrder) {
            const newCardSound = document.getElementById('newcard-sound');
            newCardSound.volume = 0.7;
            newCardSound.play();
        }

        ordersToRender.forEach((order, index) => {
            const orderCard = document.createElement('div');
            orderCard.className = 'order-card';

            const total = order.total;
            let productsHTML = '';
            const firstItem = order.items[0];

            order.items.forEach(item => {
                productsHTML += `
                    <div class="order-product">
                        <img src="${item.image}" alt="${item.name}">
                        <div class="order-product-info">
                            <p class="order-product-name">${item.name} (x${item.quantity})</p>
                            <p class="order-product-price">${formatCurrency(item.price)}</p>
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

            const orderId = order.id;
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
                        { title: 'Đang vận chuyển', time: staggeredDate, status: 'completed' },
                        { title: 'Đã hoàn thành', time: 'Hiện tại', status: 'completed' }
                    ];
                    break;
            }

            const { points } = calculatePointsAndTier(order);
            const deliveryScore = calculateDeliveryScore(order);

            let trackingTimelineHTML = `
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

            // Thêm chấm đỏ nếu đơn hàng có unseen: true
            const unseenIndicator = order.unseen ? '<span class="unseen-indicator"></span>' : '';

            orderCard.innerHTML = `
                <div class="order-item ${statusClass}" id="order-item-${index}">
                    <div class="order-front">
                        <button class="btn-reward" onclick="claimReward(${index}, event)">
                            <i class='bx bx-gift'></i> Nhận thưởng
                        </button>
                        <div class="order-profile">
                            <img src="${firstItem.image}" alt="Avatar" class="order-avatar">
                            <div>
                                <h3>
                                    <span class="order-number-circle">${orderId}${unseenIndicator}</span>
                                </h3>
                                <div class="points-badge">
                                  <i class='bx bx-medal'></i> ${points} điểm
                                </div>
                            </div>
                        </div>
                        <div class="order-status ${statusClass}">
                            <div class="lottie-container">
                                <lottie-player src="${lottieAnimation}" background="transparent" speed="1" style="width: 30px; height: 30px;" loop autoplay></lottie-player>
                            </div>
                            ${order.status}
                        </div>
                        ${trackingTimelineHTML}
                        <div class="order-total">Tổng cộng: ${formatCurrency(total)}</div>
                        <div class="flip-hint">Nhấn để xem chi tiết sản phẩm</div>
                    </div>
                    <div class="order-back">
                        <h3>Chi tiết đơn hàng #${orderId}</h3>
                        <div class="order-products">${productsHTML}</div>
                        <div class="order-delivery-info">
                            <h4><i class='bx bx-map'></i> Thông tin giao hàng</h4>
                            <p><strong>Người nhận:</strong> ${deliveryInfo.name || 'Không có thông tin'}</p>
                            <p><strong>Số điện thoại:</strong> ${deliveryInfo.phone || 'Không có thông tin'}</p>
                            <p><strong>Địa chỉ:</strong> ${deliveryInfo.address || 'Không có thông tin'}</p>
                        </div>
                        <div class="order-total">Tổng cộng: ${formatCurrency(total)}</div>
                        <div class="order-actions">
                            <button class="btn btn-cancel" onclick="cancelOrder(${index})">Hủy đơn hàng</button>
                            <button class="btn btn-invoice" onclick="downloadInvoice(${index})"><i class='bx bx-download'></i> Tải hóa đơn</button>
                        </div>
                    </div>
                </div>
            `;

            ordersContainer.appendChild(orderCard);

            // Áp dụng hiệu ứng slide-in
            setTimeout(() => {
                orderCard.classList.add('slide-in');
                // Phát âm thanh "ting" nếu đơn hàng hoàn thành
                if (order.status === 'Đơn hàng đã hoàn thành') {
                    const tingSound = document.getElementById('ting-sound');
                    tingSound.volume = 0.7; // Âm lượng thấp
                    tingSound.play();
                }
            }, index * 150); // Trễ để tạo hiệu ứng tuần tự

            // Cấu hình sự kiện nhấp chuột để lật thẻ
            const orderItem = document.getElementById(`order-item-${index}`);
            orderItem.addEventListener('click', function(e) {
                if (!e.target.closest('.order-actions') && !e.target.closest('.btn-reward')) {
                    toggleCard(index);
                    if (order.unseen) {
                        order.unseen = false;
                        let orders = JSON.parse(localStorage.getItem('orders')) || [];
                        orders = orders.map(o => o.id === order.id ? { ...o, unseen: false } : o);
                        localStorage.setItem('orders', JSON.stringify(orders));

                        // Xóa chấm đỏ trong DOM
                        const unseenDot = orderItem.querySelector('.unseen-indicator');
                        if (unseenDot) unseenDot.remove();
                    }
                }
            });
        });
    }, 500);
}

function toggleCard(index) {
    const orderItem = document.getElementById(`order-item-${index}`);
    orderItem.classList.toggle('flipped');
    // Phát âm thanh "swish" khi lật thẻ
    const swishSound = document.getElementById('swish-sound');
    swishSound.volume = 0.9; // Âm lượng cực nhỏ
    swishSound.play();
}

function toggleDetails(index) {
    const details = document.getElementById(`details-${index}`);
    if (details) {
        details.classList.toggle('visible');
    }
}

function claimReward(index, event) {
    event.stopPropagation();
    const order = allOrders[index];
    if (order.status !== 'Đơn hàng đã hoàn thành') {
        showRewardPopup();
        return;
    }
    showToast('Bạn đã nhận được thưởng cho đơn hàng này!');
}

function showRewardPopup() {
    document.getElementById('reward-popup').style.display = 'flex';
}

function closeRewardPopup() {
    document.getElementById('reward-popup').style.display = 'none';
}

function cancelOrder(index) {
    if (confirm('Bạn có chắc muốn hủy đơn hàng này?')) {
        let orders = JSON.parse(localStorage.getItem('orders')) || [];
        orders.splice(index, 1);
        localStorage.setItem('orders', JSON.stringify(orders));
        allOrders = orders;
        renderOrders(orders);
        updateOrderCount();
        showToast('Đơn hàng đã được hủy!');
    }
}

function downloadInvoice(index) {
    const order = allOrders[index];
    const { points } = calculatePointsAndTier(order);
    const invoiceContent = `
        Hóa đơn #${order.id}
        Ngày đặt: ${new Date(order.createdAt).toLocaleString('vi-VN')}
        Trạng thái: ${order.status}
        Điểm tích lũy: ${points}
        Sản phẩm:
        ${order.items.map(item => `${item.name} (x${item.quantity}) - ${formatCurrency(item.price)}`).join('\n')}
        Tổng cộng: ${formatCurrency(order.total)}
        Thông tin giao hàng:
        Người nhận: ${order.deliveryInfo.name || 'Không có thông tin'}
        Số điện thoại: ${order.deliveryInfo.phone || 'Không có thông tin'}
        Địa chỉ: ${order.deliveryInfo.address || 'Không có thông tin'}
    `;
    const blob = new Blob([invoiceContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice_${order.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

function searchOrder() {
    const productKeyword = document.getElementById('product-keyword').value.trim().toLowerCase();
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;

    let filteredOrders = allOrders;

    if (productKeyword) {
        filteredOrders = filteredOrders.filter(order =>
            order.items.some(item => item.name.toLowerCase().includes(productKeyword))
        );
    }

    if (startDate) {
        filteredOrders = filteredOrders.filter(order =>
            new Date(order.createdAt) >= new Date(startDate)
        );
    }

    if (endDate) {
        filteredOrders = filteredOrders.filter(order =>
            new Date(order.createdAt) <= new Date(endDate)
        );
    }

    renderOrders(filteredOrders);
}

function filterOrders() {
    const statusFilter = document.getElementById('status-filter').value;
    let filteredOrders = allOrders;

    if (statusFilter !== 'all') {
        filteredOrders = allOrders.filter(order => order.status === statusFilter);
    }

    renderOrders(filteredOrders);
}

function formatCurrency(amount) {
    return amount.toLocaleString('vi-VN') + '₫';
}

function updateOrderCount() {
    const orders = JSON.parse(localStorage.getItem('orders')) || [];
    const orderCountElement = document.querySelector('.order-count');
    if (orderCountElement) {
        orderCountElement.textContent = orders.length;
        orderCountElement.style.display = orders.length > 0 ? 'inline-flex' : 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    allOrders = JSON.parse(localStorage.getItem('orders')) || [];
    allOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    renderOrders(allOrders);
});