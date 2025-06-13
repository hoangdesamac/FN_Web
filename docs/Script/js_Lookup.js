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
    const checkDomReady = () => {
        const loginBtn = document.getElementById('loginBtn');
        const popup = document.querySelector('.popup');
        if (!loginBtn || !popup) {
            setTimeout(checkDomReady, 100);
            return;
        }
        if (typeof initializeUser === 'function') {
            console.log('Calling initializeUser on lookup...');
            initializeUser();
        }
    };
    checkDomReady();
});

loadPagePart("HTML/Layout/footer.html", "footer-container");

let allOrders = JSON.parse(localStorage.getItem('orders')) || [];
allOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
const totalOrders = allOrders.length;
allOrders.forEach((order, index) => {
    order.id = `DH-${new Date(order.createdAt).toISOString().split('T')[0].replace(/-/g, '')}-${(totalOrders - index).toString().padStart(4, '0')}`;
});
localStorage.setItem('orders', JSON.stringify(allOrders)); // Lưu lại để đồng bộ

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
    processing: '/transformanimation/orderprocessing.json',
    shipped: '/transformanimation/shippingorder.json',
    completed: '/transformanimation/successful.json'
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
    if (!Array.isArray(ordersToRender)) {
        ordersToRender = [];
    }
    const ordersContainer = document.getElementById('orders-container');
    const emptyOrders = document.getElementById('empty-orders');
    const searchingAnimation = document.getElementById('searching-animation');
// 1. Ẩn kết quả & empty khởi tạo, hiển thị animation
    ordersContainer.innerHTML = '';
    emptyOrders.style.display = 'none';
    searchingAnimation.style.display = 'block';

    ordersContainer.innerHTML = `
        <div class="order-item skeleton">
            <div class="skeleton-header"></div>
            <div class="skeleton-product"></div>
            <div class="skeleton-details"></div>
        </div>
    `;

    setTimeout(() => {
        searchingAnimation.style.display = 'none';// 2. Ẩn animation sau 800ms
        ordersToRender.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const totalOrders = ordersToRender.length;
        console.log('Orders to render:', ordersToRender); // Thêm log để kiểm tra
        ordersToRender.forEach((order, index) => {
            order.id = `DH-${new Date(order.createdAt).toISOString().split('T')[0].replace(/-/g, '')}-${(totalOrders - index).toString().padStart(4, '0')}`;
        });
        localStorage.setItem('orders', JSON.stringify(ordersToRender));
        if (ordersToRender.length === 0) {
            ordersContainer.innerHTML = '';

            // Nếu tất cả đơn hàng thực sự là rỗng => hiển thị khối empty
            if (allOrders.length === 0) {
                emptyOrders.style.display = 'block';
            } else {
                emptyOrders.style.display = 'none';
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
                        { title: 'Đang vận chuyển', time: formattedDate, status: 'completed' },
                        { title: 'Đã hoàn thành', time: 'Hiện tại', status: 'completed' }
                    ];
                    break;
                case 'Đơn hàng đã hủy':
                    statusClass = 'cancelled';
                    lottieAnimation = '/transformanimation/cancelled.json'; // 👈 Nếu có file animation riêng
                    trackingSteps = [
                        { title: 'Đã đặt hàng', time: formattedDate, status: 'completed' },
                        { title: 'Đơn hàng đã hủy', time: 'Hiện tại', status: 'active' }
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
                <div class="order-item ${statusClass}" id="order-item-${index}" data-order-id="${order.id}">
                    <div class="order-front">
                        <button class="btn-reward" onclick="claimReward('${order.id}', event)">
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
                           <p><strong>Địa chỉ:</strong> ${deliveryInfo.address || 'Không có thông tin'}, ${deliveryInfo.ward || ''}, ${deliveryInfo.district || ''}, ${deliveryInfo.province || ''}</p>
                           <p><strong>Phương thức thanh toán:</strong> ${getPaymentMethodText(order.paymentMethod)}</p>
                           ${deliveryInfo.note ? `<p><strong>Ghi chú:</strong> ${deliveryInfo.note}</p>` : ''}
                           <p><strong>Yêu cầu xuất hóa đơn:</strong> ${deliveryInfo.invoiceRequired ? 'Có' : 'Không'}</p>
                        </div>

                        <div class="order-total">Tổng cộng: ${formatCurrency(total)}</div>
                        <div class="order-actions">
                           <button class="btn btn-cancel" onclick="cancelOrder('${order.id}')"><i class='bx bx-trash'></i> Hủy đơn hàng</button>
                           ${!order.deliveryInfo?.invoiceRequired ? '' : `<button class="btn btn-invoice" onclick="exportToPDF('${order.id}')"><i class='bx bx-download'></i> Xuất hóa đơn</button>`}
                           ${order.status === 'Đơn hàng đã hủy' ? `<button class="btn btn-rebuy" onclick="rebuyOrder('${order.id}')"><i class='bx bx-cart'></i> Mua lại đơn</button>` : ''}
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
                    tingSound.volume = 0.7;
                    tingSound.play();
                }
            }, index * 150);

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

    }, 1200);
}
function getPaymentMethodText(method) {
    switch (method) {
        case 'cod': return 'Thanh toán khi nhận hàng (COD)';
        case 'credit': return 'Thẻ tín dụng/Thẻ ghi nợ';
        case 'wallet': return 'Ví điện tử (MoMo, ZaloPay,...)';
        default: return 'Không xác định';
    }
}

function toggleCard(index) {
    const orderItem = document.getElementById(`order-item-${index}`);
    orderItem.classList.toggle('flipped');
    // Phát âm thanh "swish" khi lật thẻ
    const swishSound = document.getElementById('swish-sound');
    swishSound.volume = 0.9;
    swishSound.play();
}

function toggleDetails(index) {
    const details = document.getElementById(`details-${index}`);
    if (details) {
        details.classList.toggle('visible');
    }
}

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

function showRewardPopup(message) {
    const popup = document.getElementById('reward-popup');
    const messageElement = popup.querySelector('p'); // Tìm thẻ <p> trong #reward-popup
    if (messageElement) {
        messageElement.textContent = message; // Cập nhật nội dung thông báo
    }
    popup.style.display = 'flex'; // Hiển thị popup
}

function closeRewardPopup() {
    document.getElementById('reward-popup').style.display = 'none';
}

function reassignAllOrderIds() {
    let orders = JSON.parse(localStorage.getItem('orders')) || [];

    // Sắp xếp từ mới đến cũ (ngày tạo giảm dần)
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Gán lại mã đơn theo thứ tự giảm dần
    orders.forEach((order, index) => {
        const dateStr = new Date(order.createdAt).toISOString().split('T')[0].replace(/-/g, '');
        const newIndex = orders.length - index; // Lớn nhất cho đơn mới nhất
        order.id = `DH-${dateStr}-${newIndex}`;
    });

    localStorage.setItem('orders', JSON.stringify(orders));
}

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
            // Thêm xác nhận trước khi xóa hoàn toàn
            if (confirm('Sau khi xóa hoàn toàn đơn này bạn sẽ không thể tiếp tục mua lại đơn này nữa!')) {
                orders.splice(orderIndex, 1);
                showToast('Đơn hàng đã được xóa hoàn toàn!');
            } else {
                return; // Nếu người dùng chọn Cancel, dừng lại
            }
        } else {
            // Nếu chưa hủy, chuyển trạng thái thành "Đơn hàng đã hủy"
            order.status = 'Đơn hàng đã hủy';
            showToast('Đơn hàng đã được hủy!');
        }

        // Cập nhật lại ID cho các đơn hàng còn lại theo thứ tự giảm dần
        orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const totalOrders = orders.length;
        orders.forEach((order, index) => {
            const dateStr = new Date(order.createdAt).toISOString().split('T')[0].replace(/-/g, '');
            order.id = `DH-${dateStr}-${(totalOrders - index).toString().padStart(4, '0')}`;
        });

        localStorage.setItem('orders', JSON.stringify(orders));
        allOrders = JSON.parse(localStorage.getItem('orders')) || [];
        renderOrders(allOrders);
        updateOrderCount();
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
function generatePDFContent(orderId) {
    const orders = JSON.parse(localStorage.getItem('orders')) || [];
    const orderIndex = orders.findIndex(order => order.id === orderId);
    if (orderIndex === -1) {
        return '<div>Không tìm thấy đơn hàng</div>';
    }
    const order = orders[orderIndex];
    const watermark = createWatermarkCanvas("Bản quyền 3TD Shop");
    const delivery = order.deliveryInfo || {};
    const formattedDate = new Date(order.createdAt).toLocaleString('vi-VN');
    const { points } = calculatePointsAndTier(order);

    // Logo mặc định, bạn có thể thay đổi URL logo của bạn tại đây:
    const logoURL = 'https://yourdomain.com/logo.png';

    // Bảng sản phẩm
    let productRows = '';
    order.items.forEach(item => {
        productRows += `
    <tr>
        <td style="text-align: center;">
            <img src="${item.image}" style="height: 50px;" />
        </td>
        <td style="text-align: left;">${item.name}</td>
        <td style="text-align: center;">${item.quantity}</td>
        <td style="text-align: center;">${formatCurrency(item.price)}</td>
        <td style="text-align: center;">${formatCurrency(item.quantity * item.price)}</td>
    </tr>
`;

    });

    return `
    <div style="
        width: 980px;
        margin: 0 auto;
        font-family: 'Arial';
        font-size: 16px;
        padding: 40px;
        color: #222;
        background-image: url('${watermark}');
        background-repeat: no-repeat;
        background-size: contain;
        background-position: center center;

    ">

        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
         <!-- Logo bên trái -->
            <div style="flex: 1;">
            <img src="Image_Showroom/Slogan_w.jpg" alt="Web3TD Logo" style="height: 70px;">
            </div>
         <!-- Tiêu đề căn giữa -->
        <div style="flex: 2; text-align: center;">
            <h2 style="color: #1e88e5; font-size: 22px; margin: 0;">HÓA ĐƠN BÁN HÀNG</h2>
        </div>
        <!-- Cột phải trống để cân lề -->
        <div style="flex: 1;"></div>
        </div>
        <hr style="margin: 10px 0;">

        <p><strong>Mã đơn:</strong> ${order.id}</p>
        <p><strong>Ngày đặt:</strong> ${formattedDate}</p>
        <p><strong>Trạng thái:</strong> ${order.status}</p>
        <p><strong>Điểm thưởng tích lũy:</strong> ${points} điểm</p>

        <h3 style="margin-top: 30px;">Danh sách sản phẩm</h3>
        <table style="width: 100%; font-size: 15px; border-collapse: collapse;" border="1">
            <thead style="background: #f0f0f0;">
                <tr>
                    <th>Ảnh</th>
                    <th>Tên sản phẩm</th>
                    <th>Số lượng</th>
                    <th>Đơn giá</th>
                    <th>Thành tiền</th>
                </tr>
            </thead>
            <tbody>
                ${productRows}
            </tbody>
        </table>

        <p style="text-align: right; font-weight: bold; margin-top: 10px; font-size: 16px;">
            Tổng cộng: ${formatCurrency(order.total)}
        </p>

        <h3 style="margin-top: 30px;">Thông tin khách hàng</h3>
        <p><strong>Người nhận:</strong> ${delivery.name || 'Không có'}</p>
        <p><strong>Điện thoại:</strong> ${delivery.phone || 'Không có'}</p>
        <p><strong>Địa chỉ:</strong> ${delivery.address || ''}, ${delivery.ward || ''}, ${delivery.district || ''}, ${delivery.province || ''}</p>

        <!-- Hình thức thanh toán + Dấu xác nhận nằm cùng hàng -->
<div style="margin-top: 30px; display: flex; align-items: flex-start; justify-content: space-between;">
    <!-- Bên trái: nội dung thanh toán -->
    <div style="flex: 1;">
        <h3 style="margin: 0 0 10px 0;">Hình thức thanh toán</h3>
        <p style="margin: 0;">${getPaymentMethodText(order.paymentMethod)}</p>
        ${delivery.note ? `<p style="margin: 5px 0;"><strong>Ghi chú:</strong> ${delivery.note}</p>` : ''}
    </div>

    <!-- Bên phải: con dấu -->
    <!-- Dấu xác nhận nâng cao - dạng SVG 2 vòng tròn -->
<div style="width: 180px; height: 180px;">
    <svg viewBox="0 0 180 180" width="100%" height="100%">
        <!-- Vòng tròn lớn -->
        <circle cx="90" cy="90" r="85" stroke="red" stroke-width="4" fill="none" />

        <!-- Vòng tròn nhỏ bên trong -->
        <circle cx="90" cy="90" r="60" stroke="red" stroke-width="2" fill="none" />

        <!-- Text cong theo hình tròn -->
        <defs>
            <path id="circlePath" d="M90,20 a70,70 0 1,1 0,140 a70,70 0 1,1 0,-140" />
        </defs>
        <text fill="red" font-size="12" font-weight="bold">
            <textPath xlink:href="#circlePath" startOffset="50%" text-anchor="middle">
                3TD SHOP • 3TD SHOP • 3TD SHOP • 3TD SHOP • 3TD SHOP • 3TD SHOP  •  •  •
            </textPath>
        </text>

        <!-- Nội dung chính ở trung tâm -->
        <text x="90" y="95" font-size="10" font-weight="bold" fill="red" text-anchor="middle">
            Đơn hàng đã được
        </text>
        <text x="90" y="110" font-size="10" font-weight="bold" fill="red" text-anchor="middle">
            3TD Shop kiểm duyệt!
        </text>
    </svg>
</div>

</div>

        <p style="text-align: center; margin-top: 50px; font-style: italic; color: #888;">
            Cảm ơn quý khách đã mua sắm tại 3TD Shop!
        </p>
       
    </div>
`;

}
function createWatermarkCanvas(text = "Bản quyền 3TD Shop") {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const width = 1600;
    const height = 1200;
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    // Vẽ watermark trung tâm
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(-Math.PI / 4); // -45 độ
    ctx.font = "bold 150px Arial";
    ctx.fillStyle = "rgba(100, 100, 100, 0.4)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 0, 0);
    ctx.restore();

    // Vẽ các watermark phụ nhỏ hơn, góc khác
    ctx.font = "bold 40px Arial";
    ctx.fillStyle = "rgba(150, 150, 150, 0.25)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const angles = [-Math.PI / 6, Math.PI / 6]; // ~-30°, +30°
    for (let a = 0; a < angles.length; a++) {
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.rotate(angles[a]);
        for (let x = -width; x < width * 1.5; x += 500) {
            for (let y = -height; y < height * 1.5; y += 300) {
                ctx.fillText(text, x - width / 2, y - height / 2);
            }
        }
        ctx.restore();
    }

    return canvas.toDataURL();
}

function exportToPDF(orderId) {
    const { jsPDF } = window.jspdf;
    const pdfArea = document.getElementById('pdf-render-area');
    if (!pdfArea) {
        console.error('Không tìm thấy vùng render PDF');
        return;
    }
    const orders = JSON.parse(localStorage.getItem('orders')) || [];
    const orderIndex = orders.findIndex(order => order.id === orderId);
    if (orderIndex === -1) {
        showToast('Không tìm thấy đơn hàng!');
        return;
    }
    pdfArea.innerHTML = generatePDFContent(orderId);
    pdfArea.style.display = 'block';
    html2canvas(pdfArea, {
        scale: 2,
        useCORS: true,
        scrollX: 0,
        scrollY: 0
    }).then(canvas => {
        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const imgProps = pdf.getImageProperties(imgData);
        const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, imgHeight);
        pdf.save(`DonHang_${orders[orderIndex].id}.pdf`);
        pdfArea.style.display = 'none';
    }).catch(error => {
        console.error('Lỗi khi xuất PDF:', error);
        showToast('Xuất PDF thất bại. Vui lòng thử lại.');
        pdfArea.style.display = 'none';
    });
}

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
            price: item.price,
            image: item.image,
            quantity: item.quantity,
            addedAt: new Date().toISOString()
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
    console.log('Sản phẩm từ đơn cũ đã thêm vào giỏ hàng:', cart);

    // Xóa đơn hàng cũ hoàn toàn
    orders.splice(orderIndex, 1);
    console.log('Đơn hàng cũ đã xóa:', orderId);
    localStorage.setItem('orders', JSON.stringify(orders));
    allOrders = JSON.parse(localStorage.getItem('orders')) || [];
    allOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    console.log('allOrders sau khi xóa:', allOrders);

    renderOrders(allOrders);
    showToast(`Đã xóa đơn hàng #${orderId} và thêm sản phẩm vào giỏ hàng! Chuyển đến trang thanh toán...`);
    window.location.href = 'checkout.html';
}

function applyFilters() {
    const productKeyword = document.getElementById('product-keyword')?.value.trim().toLowerCase();
    const startDate = document.getElementById('start-date')?.value;
    const endDate = document.getElementById('end-date')?.value;
    const statusFilter = document.getElementById('status-filter')?.value;

    // Lấy dữ liệu gốc từ allOrders
    let filteredOrders = [...allOrders];

    // Kiểm tra hợp lệ ngày
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

    // Kiểm tra xem có bộ lọc nào được áp dụng không
    const hasFilters = productKeyword || startDate || endDate || (statusFilter && statusFilter !== 'all');

    // Lọc theo trạng thái chỉ khi có bộ lọc cụ thể
    if (hasFilters) {
        if (statusFilter && statusFilter !== 'all') {
            if (statusFilter !== 'Đơn hàng đã hủy') {
                filteredOrders = filteredOrders.filter(order => order.status !== 'Đơn hàng đã hủy');
            }
            filteredOrders = filteredOrders.filter(order => order.status === statusFilter);
        } else if (!statusFilter || statusFilter === 'all') {
            // Nếu không chọn trạng thái cụ thể, không lọc trạng thái "Đơn hàng đã hủy"
        }
    }

    // Lọc theo từ khóa sản phẩm
    if (productKeyword) {
        filteredOrders = filteredOrders.filter(order =>
            order.items.some(item => item.name.toLowerCase().includes(productKeyword))
        );
    }

    // Lọc theo ngày
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

    // Sắp xếp theo ngày giảm dần
    filteredOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Log chi tiết để debug
    console.log(`Filtered from ${allOrders.length} to ${filteredOrders.length} orders. Filters: keyword='${productKeyword}', start=${startDate}, end=${endDate}, status=${statusFilter}`);

    // Không cập nhật allOrders, chỉ gọi renderOrders với filteredOrders
    renderOrders(filteredOrders);
}

// Thêm debounce để tối ưu hiệu suất
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Áp dụng debounce cho sự kiện input của product-keyword
document.addEventListener('DOMContentLoaded', () => {
    allOrders = JSON.parse(localStorage.getItem('orders')) || [];
    allOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    renderOrders(allOrders);

    const productKeywordInput = document.getElementById('product-keyword');
    if (productKeywordInput) {
        productKeywordInput.addEventListener('input', debounce(() => applyFilters(), 300));
    }

    const filterElements = [document.getElementById('start-date'), document.getElementById('end-date'), document.getElementById('status-filter')];
    filterElements.forEach(el => {
        if (el) el.addEventListener('change', applyFilters);
    });
});
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

    const clearAllOrdersBtn = document.getElementById('clear-all-orders');
    if (clearAllOrdersBtn) {
        clearAllOrdersBtn.addEventListener('click', clearAllOrders);
    }
});