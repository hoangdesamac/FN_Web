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

let deliveryInfo = {};

function toggleAccordion(id) {
    const body = document.getElementById(id);
    body.classList.toggle('visible');
}

function selectMethod(method) {
    document.querySelectorAll('.method-option').forEach(opt => opt.classList.remove('selected', 'cod', 'credit', 'wallet'));
    const selected = document.querySelector(`.method-option[data-method="${method}"]`);
    selected.classList.add('selected', method);
    selected.querySelector('input').checked = true;
}

function loadDeliveryInfo() {
    const savedInfo = JSON.parse(localStorage.getItem('deliveryInfo')) || {};
    document.getElementById('recipient-name').value = savedInfo.name || '';
    document.getElementById('recipient-phone').value = savedInfo.phone || '';
    document.getElementById('recipient-address').value = savedInfo.address || '';
}

function saveDeliveryInfo() {
    deliveryInfo = {
        name: document.getElementById('recipient-name').value.trim(),
        phone: document.getElementById('recipient-phone').value.trim(),
        address: document.getElementById('recipient-address').value.trim(),
    };
    localStorage.setItem('deliveryInfo', JSON.stringify(deliveryInfo));
}

function validateDeliveryInfo() {
    const name = document.getElementById('recipient-name').value.trim();
    const phone = document.getElementById('recipient-phone').value.trim();
    const address = document.getElementById('recipient-address').value.trim();
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!name || !phone || !address) {
        showNotification('Vui lòng điền đầy đủ thông tin giao hàng!', 'error');
        return false;
    }
    if (!phoneRegex.test(phone)) {
        showNotification('Số điện thoại không hợp lệ! Vui lòng nhập định dạng quốc tế (VD: +84...)', 'error');
        return false;
    }
    return true;
}

function renderOrderSummary() {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const orderSummary = document.getElementById('order-summary');
    const summaryDetails = document.getElementById('summary-details');

    if (cart.length === 0) {
        orderSummary.innerHTML = '<p>Giỏ hàng trống.</p>';
        summaryDetails.innerHTML = '<p>Không có sản phẩm để thanh toán.</p>';
        document.getElementById('payment-btn').disabled = true;
        return;
    }

    let productsHTML = '';
    cart.forEach(item => {
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

    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    orderSummary.innerHTML = `
        <h3>Chi tiết đơn hàng</h3>
        ${productsHTML}
        <div class="order-total">Tổng cộng: ${formatCurrency(total)}</div>
    `;

    summaryDetails.innerHTML = `
        <div class="summary-row">
            <span>Tạm tính:</span>
            <span>${formatCurrency(total)}</span>
        </div>
        <div class="summary-row">
            <span>Phí vận chuyển:</span>
            <span>Miễn phí</span>
        </div>
        <div class="summary-row total">
            <span>Tổng cộng:</span>
            <span>${formatCurrency(total)}</span>
        </div>
    `;
}

function showConfirmation() {
    if (!validateDeliveryInfo()) {
        return;
    }

    saveDeliveryInfo();
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    if (cart.length === 0) {
        showNotification('Giỏ hàng trống! Vui lòng thêm sản phẩm trước khi thanh toán.', 'error');
        window.location.href = 'resetindex.html';
        return;
    }

    const selectedMethod = document.querySelector('input[name="payment-method"]:checked').value;
    const methodText = {
        cod: 'Thanh toán khi nhận hàng (COD)',
        credit: 'Thẻ tín dụng/Thẻ ghi nợ',
        wallet: 'Ví điện tử (MoMo, ZaloPay,...)'
    }[selectedMethod];
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    document.getElementById('modal-summary').innerHTML = `
        <p><strong>Tổng tiền:</strong> ${formatCurrency(total)}</p>
        <p><strong>Phương thức thanh toán:</strong> ${methodText}</p>
        <p><strong>Người nhận:</strong> ${deliveryInfo.name}</p>
        <p><strong>Địa chỉ:</strong> ${deliveryInfo.address}</p>
    `;
    document.getElementById('confirmation-modal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('confirmation-modal').style.display = 'none';
}

function generateOrderId() {
    const orders = JSON.parse(localStorage.getItem('orders')) || [];
    const currentDate = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const orderCountToday = orders.filter(order => {
        const orderDate = new Date(order.createdAt).toISOString().split('T')[0].replace(/-/g, '');
        return orderDate === currentDate;
    }).length + 1;
    const seq = orderCountToday.toString().padStart(4, '0');
    return `DH-${currentDate}-${seq}-${orderCountToday}`;
}

function showSuccessModal() {
    document.getElementById('success-modal').style.display = 'flex';
    confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
    });
    lottie.loadAnimation({
        container: document.getElementById('success-lottie'),
        renderer: 'svg',
        loop: true,
        autoplay: true,
        path: 'https://assets.lottiefiles.com/packages/lf20_jwd4rzxx.json' // Waving hand animation
    });
}

function goToLookup() {
    window.location.href = 'lookup.html';
    // Âm thanh sẽ được phát trong js_Lookup.js khi trang tra cứu tải xong
}

function processPayment() {
    closeModal();
    document.getElementById('loading-overlay').style.display = 'flex';
    lottie.loadAnimation({
        container: document.getElementById('loading-lottie'),
        renderer: 'svg',
        loop: true,
        autoplay: true,
        path: 'https://assets.lottiefiles.com/packages/lf20_8gmd4b3u.json' // Cute spinner
    });

    setTimeout(() => {
        const cart = JSON.parse(localStorage.getItem('cart')) || [];
        const orders = JSON.parse(localStorage.getItem('orders')) || [];
        const orderId = generateOrderId();
        const selectedMethod = document.querySelector('input[name="payment-method"]:checked').value;

        const order = {
            id: orderId,
            items: cart,
            total: cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
            status: 'Đơn hàng đang xử lý',
            createdAt: new Date().toISOString(),
            paymentMethod: selectedMethod,
            deliveryInfo: deliveryInfo,
            unseen: true // Đánh dấu đơn hàng mới là chưa đọc
        };

        orders.push(order);
        localStorage.setItem('orders', JSON.stringify(orders));
        localStorage.setItem('cart', JSON.stringify([]));
        updateCartCount();
        updateOrderCount();

        document.getElementById('loading-overlay').style.display = 'none';
        showSuccessModal();
    }, 2000);
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

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `<div class="notification-message">${message}</div>`;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOutNotification 0.4s ease-in forwards';
        setTimeout(() => notification.remove(), 380);
    }, 3000);
}

function setupPhoneValidation() {
    const phoneInput = document.getElementById('recipient-phone');
    phoneInput.addEventListener('input', () => {
        let value = phoneInput.value.trim();
        if (!value.startsWith('+')) {
            if (value.startsWith('0')) {
                value = '+84' + value.slice(1);
            } else {
                value = '+84' + value;
            }
            phoneInput.value = value;
        }
    });
}

function setupRippleEffect() {
    const button = document.getElementById('payment-btn');
    button.addEventListener('click', (e) => {
        const ripple = document.createElement('span');
        ripple.className = 'ripple-btn';
        button.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    renderOrderSummary();
    loadDeliveryInfo();
    setupPhoneValidation();
    setupRippleEffect();

    document.querySelectorAll('.method-option').forEach(option => {
        option.addEventListener('click', () => {
            selectMethod(option.dataset.method);
        });
    });
});