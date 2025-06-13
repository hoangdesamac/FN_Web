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

let deliveryInfo = {};
let currentStep = 1;

function showStep(step) {
    document.querySelectorAll('.checkout-step').forEach(stepDiv => stepDiv.style.display = 'none');
    document.getElementById(`step-${step}`).style.display = 'block';
    document.querySelectorAll('.breadcrumb-steps .step').forEach(stepEl => stepEl.classList.remove('active', 'completed'));
    for (let i = 1; i <= 3; i++) {
        const stepEl = document.getElementById(`breadcrumb-step-${i}`);
        if (i < step) stepEl.classList.add('completed');
        else if (i === step) stepEl.classList.add('active');
    }
    currentStep = step;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function initializeCartSystem() {
    refreshCartCache();
    updateCartCount();
    updateOrderCount();
    if (document.getElementById('cart-items-container')) {
        renderCart();
    }


    document.querySelectorAll('.add-to-cart-btn').forEach(button => {
        button.addEventListener('click', function() {
            const productCard = this.closest('.product-card');
            const productId = productCard.getAttribute('data-id');
            const productName = productCard.querySelector('.product-name').textContent;
            const priceText = productCard.querySelector('.product-price strong').textContent;
            const priceValue = parseInt(priceText.replace(/\D/g, ''));
            const productImage = productCard.querySelector('.product-image').getAttribute('src');

            addToCart(productId, productName, priceValue, productImage);
            showNotification(`Đã thêm "${productName}" vào giỏ hàng!`);
        });
    });

    if (!document.getElementById('notification')) {
        createNotificationElement();
    }

    cleanupExpiredItems();
}

let cartCache = null;

function refreshCartCache() {
    cartCache = JSON.parse(localStorage.getItem('cart')) || [];
    return cartCache;
}

function getCart() {
    if (!cartCache) {
        return refreshCartCache();
    }
    return cartCache;
}

function saveCart(cart) {
    localStorage.setItem('cart', JSON.stringify(cart));
    cartCache = cart;
}

function addToCart(productId, productName, price, image) {
    let cart = getCart();
    const existingItemIndex = cart.findIndex(item => item.id === productId);
    animateCartIcon();

    if (existingItemIndex !== -1) {
        cart[existingItemIndex].quantity += 1;
        cart[existingItemIndex].updatedAt = new Date().toISOString();
    } else {
        cart.push({
            id: productId,
            name: productName,
            price: price,
            image: image,
            quantity: 1,
            addedAt: new Date().toISOString()
        });
    }

    saveCart(cart);
    updateCartCount();
}

function animateCartIcon() {
    const cartIcon = document.querySelector('.user-actions .bx-cart, .user-actions .bxs-cart');
    if (cartIcon) {
        cartIcon.classList.add('cart-bounce');
        setTimeout(() => {
            cartIcon.classList.remove('cart-bounce');
        }, 800);
    }
}

function updateCartCount() {
    const cart = getCart();
    const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
    let cartCountElement = document.querySelector('.cart-count');

    if (!cartCountElement) {
        const cartIcon = document.querySelector('.user-actions span:first-child');
        if (cartIcon) {
            cartCountElement = document.createElement('span');
            cartCountElement.className = 'cart-count';
            cartIcon.appendChild(cartCountElement);
        }
    }

    if (cartCountElement) {
        const oldCount = parseInt(cartCountElement.textContent || '0');
        if (oldCount !== cartCount) {
            cartCountElement.classList.add('cart-count-update');
            setTimeout(() => {
                cartCountElement.classList.remove('cart-count-update');
            }, 500);
        }

        cartCountElement.textContent = cartCount;
        cartCountElement.style.display = cartCount > 0 ? 'inline-flex' : 'none';
    }
}

function createNotificationElement() {
    const oldNotification = document.getElementById('notification');
    if (oldNotification) {
        oldNotification.remove();
    }

    const notification = document.createElement('div');
    notification.id = 'notification';
    notification.style.display = 'none';
    document.body.appendChild(notification);
    return notification;
}

function positionNotificationUnderCart() {
    const notification = document.getElementById('notification');
    if (notification) {
        notification.style.zIndex = '9999';
    }
}

function showNotification(message, type = 'success') {
    let notification = document.getElementById('notification');
    if (!notification) {
        notification = createNotificationElement();
    }

    positionNotificationUnderCart();
    let icon = type === 'success' ? '<i class="bx bx-check-circle"></i>' : '<i class="bx bx-error-circle"></i>';
    let actionButton = '';
    if (type === 'success' && message.includes('Đã thêm')) {
        actionButton = `
            <div class="notification-actions">
                <a href="checkout.html" class="view-cart-btn">Xem giỏ hàng</a>
                <button class="continue-btn" onclick="hideNotification()">
                    Tiếp tục mua sắm
                </button>
            </div>
        `;
    }

    notification.innerHTML = `
        <div class="notification-content">
            ${icon}
            <div class="notification-message">${message}</div>
            <button class="notification-close" onclick="hideNotification()">
                <i class="bx bx-x"></i>
            </button>
        </div>
        ${actionButton}
    `;

    notification.className = `notification notification-popup ${type}`;
    notification.style.display = 'block';
    notification.style.animation = 'popupNotification 0.3s cubic-bezier(0.22, 1, 0.36, 1) forwards';

    const autoHideTimeout = setTimeout(() => {
        hideNotification();
    }, 5000);

    const closeBtn = notification.querySelector('.notification-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            clearTimeout(autoHideTimeout);
            hideNotification();
        });
    }
}

function hideNotification() {
    const notification = document.getElementById('notification');
    if (notification) {
        notification.style.animation = 'slideOutNotification 0.3s forwards';
        setTimeout(() => {
            notification.style.display = 'none';
        }, 300);
    }
}

function clearCart() {
    if (confirm('Bạn có chắc chắn muốn xóa tất cả sản phẩm khỏi giỏ hàng?')) {
        saveCart([]);
        if (document.getElementById('cart-items-container')) {
            renderCart();
        }
        updateCartCount();

        const clearCartBtn = document.getElementById('clear-cart');
        if (clearCartBtn) {
            clearCartBtn.style.display = 'none';
        }

        showNotification('Đã xóa tất cả sản phẩm khỏi giỏ hàng', 'success');
    }
}

function updateQuantity(index, change) {
    const cart = getCart();

    if (cart[index]) {
        const cartItems = document.querySelectorAll('.cart-item');
        if (cartItems[index]) {
            cartItems[index].classList.add('quantity-change');
            setTimeout(() => {
                cartItems[index].classList.remove('quantity-change');
            }, 300);
        }

        cart[index].quantity += change;
        cart[index].updatedAt = new Date().toISOString();

        if (cart[index].quantity <= 0) {
            removeItem(index);
            return;
        }

        saveCart(cart);
        renderCart();
        updateCartCount();
    }
}

function removeItem(index) {
    const cart = getCart();

    if (cart[index]) {
        const itemName = cart[index].name;
        const cartItems = document.querySelectorAll('.cart-item');
        if (cartItems[index]) {
            cartItems[index].classList.add('item-removing');
            setTimeout(() => {
                performRemoveItem(index, itemName);
            }, 500);
        } else {
            performRemoveItem(index, itemName);
        }
    }
}

function performRemoveItem(index, itemName) {
    const cart = getCart();
    cart.splice(index, 1);
    saveCart(cart);
    renderCart();
    updateCartCount();
    showNotification(`Đã xóa "${itemName}" khỏi giỏ hàng`, 'success');
}

function cleanupExpiredItems(expiryHours = 72) {
    const cart = getCart();
    const now = new Date();
    let hasExpired = false;

    const cleanedCart = cart.filter(item => {
        const addedAt = new Date(item.addedAt || now);
        const hoursDiff = (now - addedAt) / (1000 * 60 * 60);

        if (hoursDiff > expiryHours) {
            hasExpired = true;
            return false;
        }
        return true;
    });

    if (hasExpired) {
        saveCart(cleanedCart);
        updateCartCount();
        renderCart();
        console.log("Đã xóa các sản phẩm hết hạn từ giỏ hàng");
    }
}

function renderCart() {
    const cartItemsContainer = document.getElementById('cart-items-container');
    const emptyCart = document.getElementById('empty-cart');
    const proceedButton = document.getElementById('proceed-to-step-2');
    const clearCartBtn = document.getElementById('clear-cart');
    const continueBtn = document.getElementById('continue-shopping-btn');
    let cart = JSON.parse(localStorage.getItem('cart')) || []; // Đảm bảo lấy trực tiếp từ localStorage
    if (cartCache) {
        cart = cartCache; // Sử dụng cache nếu đã có
    }

    // Dọn phần tử trùng empty-cart nếu có (chống nhân đôi)
    const emptyCartList = document.querySelectorAll('#empty-cart');
    if (emptyCartList.length > 1) {
        emptyCartList.forEach((el, i) => {
            if (i > 0) el.remove();
        });
    }

    if (cart.length === 0) {
        if (emptyCart) emptyCart.style.display = 'block';
        if (cartItemsContainer) cartItemsContainer.innerHTML = '';
        if (proceedButton) proceedButton.style.display = 'none';
        if (clearCartBtn) clearCartBtn.style.display = 'none';
        if (continueBtn) continueBtn.style.display = 'none';
        return;
    }

    if (emptyCart) emptyCart.style.display = 'none';
    if (proceedButton) proceedButton.style.display = 'block';

    // Tạo lại nội dung giỏ hàng
    if (!cartItemsContainer) return;

    const summaryTemplate = document.getElementById('cart-summary-template');
    if (!summaryTemplate) return;

    const summary = summaryTemplate.content.cloneNode(true);
    const cartItemsSection = summary.querySelector('.cart-items');

    let total = 0;

    cart.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;

        const itemTemplate = document.getElementById('cart-item-template');
        if (!itemTemplate) return;

        const clone = itemTemplate.content.cloneNode(true);
        const cartItem = clone.querySelector('.cart-item');

        const img = cartItem.querySelector('.cart-item__image');
        img.src = item.image;
        img.alt = item.name;

        cartItem.querySelector('.cart-item__name').textContent = item.name;
        cartItem.querySelector('.cart-item__price').textContent = formatCurrency(item.price);
        cartItem.querySelector('.quantity-input').value = item.quantity;
        cartItem.querySelector('.cart-item__total').textContent = formatCurrency(itemTotal);

        cartItem.querySelector('.quantity-btn--decrease').setAttribute('onclick', `updateQuantity(${index}, -1)`);
        cartItem.querySelector('.quantity-btn--increase').setAttribute('onclick', `updateQuantity(${index}, 1)`);
        cartItem.querySelector('.cart-item__remove').setAttribute('onclick', `removeItem(${index})`);

        cartItemsSection.appendChild(cartItem);
    });

    summary.querySelectorAll('.currency-value')[0].textContent = formatCurrency(total);
    if (summary.querySelectorAll('.currency-value')[2])
        summary.querySelectorAll('.currency-value')[2].textContent = formatCurrency(total);

    cartItemsContainer.innerHTML = '';
    cartItemsContainer.appendChild(summary);

    if (clearCartBtn) {
        clearCartBtn.style.display = cart.length > 0 ? 'flex' : 'none';
    }
}


function loadDeliveryInfo() {
    const delivery = JSON.parse(localStorage.getItem('deliveryInfo')) || {};

    if (delivery) {
        const fullNameEl = document.getElementById('recipient-name');
        const phoneEl = document.getElementById('recipient-phone');
        const emailEl = document.getElementById('email');
        const addressEl = document.getElementById('recipient-address');
        const provinceEl = document.getElementById('province');
        const districtEl = document.getElementById('district');
        const wardEl = document.getElementById('ward');
        const noteEl = document.getElementById('note');
        const invoiceCheckbox = document.getElementById('invoice-required');

        if (fullNameEl) fullNameEl.value = delivery.fullName || '';
        if (phoneEl) phoneEl.value = delivery.phoneNumber || '';
        if (emailEl) emailEl.value = delivery.email || '';
        if (addressEl) addressEl.value = delivery.address || '';
        if (provinceEl) provinceEl.value = delivery.province || '';
        if (districtEl) districtEl.value = delivery.district || '';
        if (wardEl) wardEl.value = delivery.ward || '';
        if (noteEl) noteEl.value = delivery.note || '';
        if (invoiceCheckbox) invoiceCheckbox.checked = delivery.invoiceRequested || false;
    }
}

function saveDeliveryInfo() {
    const provinceSelect = document.getElementById('province');
    const districtSelect = document.getElementById('district');
    const wardSelect = document.getElementById('ward');

    deliveryInfo = {
        name: document.getElementById('recipient-name').value.trim(),
        phone: document.getElementById('recipient-phone').value.trim(),
        province: provinceSelect.selectedOptions[0]?.textContent || '',
        district: districtSelect.selectedOptions[0]?.textContent || '',
        ward: wardSelect.selectedOptions[0]?.textContent || '',
        address: document.getElementById('recipient-address').value.trim(),
        note: document.getElementById('note').value.trim(),
        invoiceRequired: document.getElementById('invoice-required').checked
    };

    localStorage.setItem('deliveryInfo', JSON.stringify(deliveryInfo));
}


function validateDeliveryInfo() {
    const name = document.getElementById('recipient-name').value.trim();
    const phone = document.getElementById('recipient-phone').value.trim();
    const province = document.getElementById('province').value;
    const district = document.getElementById('district').value;
    const ward = document.getElementById('ward').value;
    const address = document.getElementById('recipient-address').value.trim();
    const phoneRegex = /^0\d{9}$/;

    if (!name || !phone || !province || !district || !ward || !address) {
        showNotification('Vui lòng điền đầy đủ thông tin giao hàng!', 'error');
        return false;
    }
    if (!phoneRegex.test(phone)) {
        showNotification('Số điện thoại không hợp lệ! Vui lòng nhập lại', 'error');
        return false;
    }
    return true;
}

function renderOrderSummary() {
    const cart = getCart();
    const orderSummary = document.getElementById('order-summary');

    if (cart.length === 0) {
        orderSummary.innerHTML = '<p>Giỏ hàng trống.</p>';
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
        ${productsHTML}
        <div class="order-total">Tổng cộng: ${formatCurrency(total)}</div>
    `;

    const summaryDetails = document.getElementById('summary-details');
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

function renderDeliverySummary() {
    const summary = document.getElementById('delivery-summary');
    summary.innerHTML = `
        <p><strong>Người nhận:</strong> ${deliveryInfo.name}</p>
        <p><strong>Số điện thoại:</strong> ${deliveryInfo.phone}</p>
        <p><strong>Địa chỉ:</strong> ${deliveryInfo.address}, ${deliveryInfo.ward}, ${deliveryInfo.district}, ${deliveryInfo.province}</p>
        ${deliveryInfo.note ? `<p><strong>Ghi chú:</strong> ${deliveryInfo.note}</p>` : ''}
        <p><strong>Yêu cầu xuất hóa đơn:</strong> ${deliveryInfo.invoiceRequired ? 'Có' : 'Không'}</p>
    `;
}

function showConfirmation() {
    if (!validateDeliveryInfo()) {
        return;
    }

    saveDeliveryInfo();
    const cart = getCart();
    if (cart.length === 0) {
        showNotification('Giỏ hàng trống! Vui lòng thêm sản phẩm trước khi thanh toán.', 'error');
        window.location.href = 'index.html';
        return;
    }

    const selectedMethod = document.querySelector('input[name="payment-method"]:checked').value;
    const methodText = {
        cod: 'Thanh toán khi nhận hàng (COD)',

    }[selectedMethod];
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    document.getElementById('modal-summary').innerHTML = `
        <p><strong>Tổng tiền:</strong> ${formatCurrency(total)}</p>
        <p><strong>Phương thức thanh toán:</strong> ${methodText}</p>
        <p><strong>Người nhận:</strong> ${deliveryInfo.name}</p>
        <p><strong>Địa chỉ:</strong> ${deliveryInfo.address}, ${deliveryInfo.ward}, ${deliveryInfo.district}, ${deliveryInfo.province}</p>
        ${deliveryInfo.note ? `<p><strong>Ghi chú:</strong> ${deliveryInfo.note}</p>` : ''}
        <p><strong>Yêu cầu xuất hóa đơn:</strong> ${deliveryInfo.invoiceRequired ? 'Có' : 'Không'}</p>
    `;
    document.getElementById('confirmation-modal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('confirmation-modal').style.display = 'none';
}

function generateOrderId() {
    const orders = JSON.parse(localStorage.getItem('orders')) || [];
    const today = new Date();
    const currentDate = today.toISOString().split('T')[0].replace(/-/g, '');

    const todaysOrders = orders.filter(order => {
        const orderDate = new Date(order.createdAt).toISOString().split('T')[0].replace(/-/g, '');
        return orderDate === currentDate;
    });

    const orderNumber = todaysOrders.length + 1;
    return `DH-${currentDate}-${orderNumber}`;
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
        loop: false,
        autoplay: true,
        path: '/transformanimation/successful.json'
    });
}


function goToLookup() {
    window.location.href = 'lookup.html';
}

function processPayment() {
    closeModal();
    document.getElementById('loading-overlay').style.display = 'flex';
    try {
        lottie.loadAnimation({
            container: document.getElementById('loading-lottie'),
            renderer: 'svg',
            loop: true,
            autoplay: true,
            path: '/transformanimation/processpayment.json'
        });
    } catch (error) {
        console.error("Lỗi khi tải Lottie animation:", error);
    }

    setTimeout(() => {
        const cart = getCart();
        let orders = JSON.parse(localStorage.getItem('orders')) || [];
        orders.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        const orderNumber = orders.length + 1;
        const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const orderId = `DH-${today}-${orderNumber}`;

        const selectedMethod = document.querySelector('input[name="payment-method"]:checked').value;

        const order = {
            id: orderId,
            items: cart,
            total: cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
            status: 'Đơn hàng đang xử lý',
            createdAt: new Date().toISOString(),
            paymentMethod: selectedMethod,
            deliveryInfo: deliveryInfo,
            unseen: true
        };

        orders.push(order);
        localStorage.setItem('orders', JSON.stringify(orders));
        console.log('Đơn hàng mới được tạo từ checkout:', order);

        localStorage.setItem('cart', JSON.stringify([]));
        updateCartCount();
        updateOrderCount();

        // Reset các trường nhập liệu
        const savedInfo = JSON.parse(localStorage.getItem('deliveryInfo')) || {};
        delete savedInfo.name;
        delete savedInfo.phone;
        delete savedInfo.address;
        localStorage.setItem('deliveryInfo', JSON.stringify(savedInfo));
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


function setupRippleEffect() {
    const rippleButton = document.querySelector('.ripple-button');

    if (rippleButton) {
        rippleButton.addEventListener('click', function (e) {
            const circle = document.createElement('span');
            circle.classList.add('ripple');

            const rect = this.getBoundingClientRect();
            circle.style.left = `${e.clientX - rect.left}px`;
            circle.style.top = `${e.clientY - rect.top}px`;

            this.appendChild(circle);

            setTimeout(() => {
                circle.remove();
            }, 500);
        });
    }
}


function setupAddressDropdownsFromTree(data) {
    const provinceSelect = document.getElementById('province');
    const districtSelect = document.getElementById('district');
    const wardSelect = document.getElementById('ward');

    // Kiểm tra sự tồn tại của các phần tử
    if (!provinceSelect || !districtSelect || !wardSelect) return;

    // Bước 1: Load tỉnh/thành phố
    provinceSelect.innerHTML = '<option value="">Chọn tỉnh/thành phố</option>';
    for (const [provinceCode, provinceObj] of Object.entries(data)) {
        const opt = document.createElement('option');
        opt.value = provinceCode;
        opt.textContent = provinceObj.name;
        provinceSelect.appendChild(opt);
    }

    // Bước 2: Khi chọn tỉnh → load quận/huyện
    provinceSelect.addEventListener('change', () => {
        const provinceCode = provinceSelect.value;
        districtSelect.innerHTML = '<option value="">Chọn quận/huyện</option>';
        wardSelect.innerHTML = '<option value="">Chọn phường/xã</option>';

        if (!provinceCode || !data[provinceCode]) return;

        const districts = data[provinceCode]['quan-huyen'];
        for (const [districtCode, districtObj] of Object.entries(districts)) {
            const opt = document.createElement('option');
            opt.value = districtCode;
            opt.textContent = districtObj.name;
            districtSelect.appendChild(opt);
        }
    });

    // Bước 3: Khi chọn quận/huyện → load phường/xã
    districtSelect.addEventListener('change', () => {
        const provinceCode = provinceSelect.value;
        const districtCode = districtSelect.value;
        wardSelect.innerHTML = '<option value="">Chọn phường/xã</option>';

        if (
            !provinceCode ||
            !districtCode ||
            !data[provinceCode] ||
            !data[provinceCode]['quan-huyen'][districtCode]
        ) return;

        const wards = data[provinceCode]['quan-huyen'][districtCode]['xa-phuong'];
        for (const [wardCode, wardObj] of Object.entries(wards)) {
            const opt = document.createElement('option');
            opt.value = wardCode;
            opt.textContent = wardObj.name;
            wardSelect.appendChild(opt);
        }
    });
}




function setupPaymentMethodAnimations() {
    const animations = [
        { containerId: 'lottie-cod', path: '/transformanimation/cod.json' },

    ];

    animations.forEach(animation => {
        lottie.loadAnimation({
            container: document.getElementById(animation.containerId),
            renderer: 'svg',
            loop: true,
            autoplay: true,
            path: animation.path
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initializeCartSystem();
    loadPagePart("HTML/Layout/header.html", "header-container", () => {
        const checkDomReady = () => {
            const loginBtn = document.getElementById('loginBtn');
            const popup = document.querySelector('.popup');
            if (!loginBtn || !popup) {
                setTimeout(checkDomReady, 100);
                return;
            }
            if (typeof initializeUser === 'function') {
                console.log('Calling initializeUser on checkout...');
                initializeUser();
            }
        };
        checkDomReady();
    });
    loadPagePart("HTML/Layout/footer.html", "footer-container");

    renderCart();
    loadDeliveryInfo();
    setupRippleEffect();
    fetch("/FormText/tree.json")
        .then(res => res.json())
        .then(data => {
            setupAddressDropdownsFromTree(data);

        })
        .catch(err => {
            console.error("Lỗi khi tải tree.json:", err);
        });
    setupPaymentMethodAnimations();

    document.querySelectorAll('.method-option').forEach(option => {
        option.addEventListener('click', () => {
            selectMethod(option.dataset.method);
        });
    });
    const proceedStep2Btn = document.getElementById('proceed-to-step-2');
    if (proceedStep2Btn) {
        proceedStep2Btn.addEventListener('click', () => {
            if (getCart().length > 0) {
                showStep(2);
            } else {
                showNotification('Giỏ hàng trống! Vui lòng thêm sản phẩm.', 'error');
            }
        });
    }

    const proceedStep3Btn = document.getElementById('proceed-to-step-3');
    if (proceedStep3Btn) {
        proceedStep3Btn.addEventListener('click', () => {
            if (validateDeliveryInfo()) {
                saveDeliveryInfo();
                renderOrderSummary();
                renderDeliverySummary();
                showStep(3);
            }
        });
    }


    const clearCartBtn = document.getElementById('clear-cart');
    if (clearCartBtn) {
        clearCartBtn.addEventListener('click', clearCart);
    }
});
document.addEventListener('DOMContentLoaded', function () {
    const invoiceCheckbox = document.getElementById('invoice-required');
    const modal = document.getElementById('modal-no-invoice');
    const btnConfirm = document.getElementById('btn-confirm-no-invoice');
    const btnCancel = document.getElementById('btn-cancel-no-invoice');

    if (!invoiceCheckbox) return; // nếu form chưa render

    invoiceCheckbox.checked = true; // luôn mặc định có hóa đơn

    invoiceCheckbox.addEventListener('change', () => {
        if (!invoiceCheckbox.checked) {
            modal.style.display = 'flex';
        }
    });

    btnCancel.addEventListener('click', () => {
        invoiceCheckbox.checked = true;
        modal.style.display = 'none';
    });

    btnConfirm.addEventListener('click', () => {
        modal.style.display = 'none';
        localStorage.setItem('hideInvoiceForOrder', 'true');
    });
});

function selectMethod(method) {
    document.querySelectorAll('.method-option').forEach(opt => opt.classList.remove('selected', 'cod', 'credit', 'wallet'));
    const selected = document.querySelector(`.method-option[data-method="${method}"]`);
    selected.classList.add('selected', method);
    selected.querySelector('input').checked = true;
}

window.addEventListener('storage', function(e) {
    if (e.key === 'cart') {
        refreshCartCache();
        updateCartCount();
        renderCart();
    }
    if (e.key === 'orders') {
        updateOrderCount();
    }
});

window.addEventListener('scroll', function() {
    const cartHeader = document.querySelector('.cart-header');
    if (cartHeader) {
        if (window.scrollY > 20) {
            cartHeader.classList.add('header-shadow');
        } else {
            cartHeader.classList.remove('header-shadow');
        }
    }
});

document.addEventListener('DOMContentLoaded', () => {
    lottie.loadAnimation({
        container: document.getElementById('empty-cart-lottie'),
        renderer: 'svg',
        loop: true,
        autoplay: true,
        path: '/transformanimation/emptycart.json'
    });
});

