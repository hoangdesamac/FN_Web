function loadPagePart(url, selector, callback = null, executeScripts = true) {
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Lỗi HTTP! Trạng thái: ${response.status}`);
            }
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

                if (typeof callback === 'function') {
                    callback();
                }
            }
        })
        .catch(error => {
            console.error(`Lỗi khi tải ${url}:`, error);
        });
}

let deliveryInfo = {};
let currentStep = 1;

function showStep(step) {
    document.querySelectorAll('.checkout-step').forEach(stepDiv => stepDiv.classList.add('d-none'));
    document.getElementById(`step-${step}`).classList.remove('d-none');
    document.querySelectorAll('.breadcrumb-steps .step').forEach(stepEl => {
        stepEl.classList.remove('active', 'completed');
    });
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

    // Logic cho nút "Mua ngay"
    document.querySelectorAll('.buy-button').forEach(button => {
        button.addEventListener('click', function () {
            const productCard = this.closest('.product-card');
            if (!productCard) {
                showNotification('Không tìm thấy thông tin sản phẩm!', 'error');
                return;
            }

            const productId = productCard.getAttribute('data-id') || `prod_${Date.now()}`;
            const productName = productCard.querySelector('.product-name')?.textContent.trim() || 'Sản phẩm không tên';
            const originalPriceText = productCard.querySelector('.original-price')?.textContent || '0';
            const salePriceText = productCard.querySelector('.sale-price')?.textContent || originalPriceText;
            const originalPrice = parseInt(originalPriceText.replace(/\D/g, '')) || 0;
            const salePrice = parseInt(salePriceText.replace(/\D/g, '')) || originalPrice;
            const discountPercentText = productCard.querySelector('.discount-badge')?.textContent || '0%';
            const discountPercent = parseInt(discountPercentText.replace(/[^0-9]/g, '')) || 0;
            const productImage = productCard.querySelector('.product-image img')?.src || '';

            addToCart(productId, productName, originalPrice, salePrice, discountPercent, productImage);
            showNotification(`Đã thêm "${productName}" vào giỏ hàng!`, 'success');
        });
    });

    if (!document.getElementById('notification')) {
        createNotificationElement();
    }

    cleanupExpiredItems();
}

let cartCache = null;
let selectedItems = [];

function handleSelectItem(checkbox, index) {
    const cart = getCart();
    const item = cart[index];
    const cartItemDiv = checkbox.closest('.cart-item');

    if (checkbox.checked) {
        if (!selectedItems.includes(item.id)) {
            selectedItems.push(item.id);
        }
        cartItemDiv.classList.add('selected-item');
    } else {
        selectedItems = selectedItems.filter(id => id !== item.id);
        cartItemDiv.classList.remove('selected-item');
    }

    // ✅ Cập nhật selectedCart trong localStorage
    const selected = cart.filter(item => selectedItems.includes(item.id));
    localStorage.setItem('selectedCart', JSON.stringify(selected));

    // ✅ Đồng bộ lại trạng thái của "Chọn tất cả"
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    if (selectAllCheckbox) {
        const allChecked = cart.length > 0 && cart.every(item => selectedItems.includes(item.id));
        selectAllCheckbox.checked = allChecked;
    }
}


function handleSelectAllToggle(checked) {
    const cart = getCart();
    selectedItems = checked ? cart.map(item => item.id) : [];

    const selected = cart.filter(item => selectedItems.includes(item.id));
    localStorage.setItem('selectedCart', JSON.stringify(selected));

    document.querySelectorAll('.cart-item').forEach((itemDiv, index) => {
        const checkbox = itemDiv.querySelector('.select-checkbox');
        if (checkbox) checkbox.checked = checked;

        if (checked) {
            itemDiv.classList.add('selected-item');
        } else {
            itemDiv.classList.remove('selected-item');
        }
    });
}

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

function addToCart(productId, productName, originalPrice, salePrice, discountPercent, image) {
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
            originalPrice: originalPrice,
            salePrice: salePrice,
            discountPercent: discountPercent,
            image: image,
            quantity: 1,
            addedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    }

    saveCart(cart);
    updateCartCount();
    renderCart();
}

function animateCartIcon() {
    const cartIcon = document.querySelector('.user-actions .fa-cart-shopping');
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
        const cartIcon = document.querySelector('.user-actions .fa-cart-shopping')?.parentElement;
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
    notification.className = 'notification';
    notification.style.display = 'none';
    document.body.appendChild(notification);
    return notification;
}

function showNotification(message = 'Đã thêm sản phẩm vào giỏ hàng!') {
    let notification = document.getElementById('notification-modal');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification-modal';
        notification.className = 'notification-modal';
        document.body.appendChild(notification);
    }

    notification.innerHTML = `
        <div class="notification-modal-content d-flex align-items-center gap-2">
            <i class="fa fa-check-circle text-success fs-4"></i>
            <span class="text-light">${message}</span>
        </div>
    `;

    notification.style.display = 'flex';
    notification.style.animation = 'fadeInSlide 0.3s ease forwards';

    setTimeout(() => {
        notification.style.animation = 'fadeOutSlide 0.3s ease forwards';
        setTimeout(() => {
            notification.style.display = 'none';
        }, 300);
    }, 3000);
}

function clearCart() {
    if (confirm('Bạn có chắc chắn muốn xóa tất cả sản phẩm khỏi giỏ hàng?')) {
        saveCart([]);
        renderCart();
        updateCartCount();
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
    let cart = getCart();

    if (cart.length === 0) {
        if (emptyCart) emptyCart.classList.remove('d-none');
        if (cartItemsContainer) {
            cartItemsContainer.classList.add('d-none'); // Ẩn khung sản phẩm
            cartItemsContainer.innerHTML = '';
        }
        const selectAllWrapper = document.querySelector('.select-all-wrapper');
        if (selectAllWrapper) {
            selectAllWrapper.classList.add('d-none');
        }
        const cartSummary = document.querySelector('.cart-summary');
        if (cartSummary) cartSummary.classList.add('d-none'); // Ẩn khung tóm tắt
        if (proceedButton) proceedButton.classList.add('d-none');
        if (clearCartBtn) clearCartBtn.classList.add('d-none');
        if (continueBtn) continueBtn.classList.remove('d-none');
        updateCartSummary(0);
        return;
    }

    if (emptyCart) emptyCart.classList.add('d-none');
    if (proceedButton) proceedButton.classList.remove('d-none');
    if (clearCartBtn) clearCartBtn.classList.remove('d-none');
    if (continueBtn) continueBtn.classList.remove('d-none');


    let total = 0;
    let cartItemsHTML = '';

    cart.forEach((item, index) => {
        const itemTotal = item.salePrice * item.quantity;
        total += itemTotal;

        cartItemsHTML += `
    <div class="cart-item d-flex align-items-start p-3 mb-3 rounded position-relative" data-index="${index}">
        <input type="checkbox" class="form-check-input select-checkbox position-absolute" style="top: 10px; left: 10px;" onchange="handleSelectItem(this, ${index})">
        <img src="${item.image}" alt="${item.name}" class="cart-item__image me-3" style="width: 80px; height: 80px; object-fit: cover;">
        <div class="cart-item__info flex-grow-1">
            <h5 class="cart-item__name">${item.name}</h5>
            <div class="price-section">
                <span class="original-price me-2">${formatCurrency(item.originalPrice)}</span>
                <span class="sale-price">${formatCurrency(item.salePrice)}</span>
                <span class="discount-badge badge bg-danger ms-2">-${item.discountPercent}%</span>
            </div>
        </div>
        <div class="cart-item__quantity d-flex align-items-center">
            <button class="quantity-btn quantity-btn--decrease" onclick="updateQuantity(${index}, -1)">
                <i class="fa fa-minus"></i>
            </button>
            <input type="number" class="quantity-input" value="${item.quantity}" readonly>
            <button class="quantity-btn quantity-btn--increase" onclick="updateQuantity(${index}, 1)">
                <i class="fa fa-plus"></i>
            </button>
        </div>
        <div class="cart-item__total ms-3" style="margin-top: 6px;">${formatCurrency(item.salePrice * item.quantity)}</div>
        <button class="cart-item__remove ms-3" onclick="removeItem(${index})">
            <i class="fa fa-trash"></i>
        </button>
    </div>
`;

    });

    if (cartItemsContainer) {
        cartItemsContainer.innerHTML = cartItemsHTML;
    }
    // ✅ Khôi phục trạng thái tick sau khi render lại
    const savedSelected = JSON.parse(localStorage.getItem('selectedCart')) || [];
    selectedItems = savedSelected.map(item => item.id);

    document.querySelectorAll('.cart-item').forEach((itemDiv, index) => {
        const cart = getCart();
        const item = cart[index];
        const checkbox = itemDiv.querySelector('.select-checkbox');
        if (selectedItems.includes(item.id)) {
            checkbox.checked = true;
            itemDiv.classList.add('selected-item');
        }
    });

    updateCartSummary(total);
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    if (selectAllCheckbox) {
        const allChecked = cart.length > 0 && cart.every(item => selectedItems.includes(item.id));
        selectAllCheckbox.checked = allChecked;
    }
}

function updateCartSummary(total) {
    const summaryRows = document.querySelectorAll('.cart-summary__rows .currency-value');
    const shippingFee = total >= 500000 ? 0 : 30000; // Miễn phí vận chuyển cho đơn từ 500.000₫
    if (summaryRows.length >= 3) {
        summaryRows[0].textContent = formatCurrency(total);
        summaryRows[1].textContent = shippingFee === 0 ? 'Miễn phí' : formatCurrency(shippingFee);
        summaryRows[2].textContent = formatCurrency(total + shippingFee);
    }
}

function loadDeliveryInfo() {
    const delivery = JSON.parse(localStorage.getItem('deliveryInfo')) || {};

    const fullNameEl = document.getElementById('recipient-name');
    const phoneEl = document.getElementById('recipient-phone');
    const addressEl = document.getElementById('recipient-address');
    const provinceEl = document.getElementById('province');
    const districtEl = document.getElementById('district');
    const wardEl = document.getElementById('ward');
    const noteEl = document.getElementById('note');
    const invoiceCheckbox = document.getElementById('invoice-required');

    if (fullNameEl) fullNameEl.value = delivery.name || '';
    if (phoneEl) phoneEl.value = delivery.phone || '';
    if (addressEl) addressEl.value = delivery.address || '';
    if (provinceEl) provinceEl.value = delivery.province || '';
    if (districtEl) districtEl.value = delivery.district || '';
    if (wardEl) wardEl.value = delivery.ward || '';
    if (noteEl) noteEl.value = delivery.note || '';
    if (invoiceCheckbox) invoiceCheckbox.checked = delivery.invoiceRequired || true;
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
    const nameEl = document.getElementById('recipient-name');
    const phoneEl = document.getElementById('recipient-phone');
    const provinceEl = document.getElementById('province');
    const districtEl = document.getElementById('district');
    const wardEl = document.getElementById('ward');
    const addressEl = document.getElementById('recipient-address');

    // Reset viền trước
    [nameEl, phoneEl, provinceEl, districtEl, wardEl, addressEl].forEach(el => el.classList.remove('input-invalid'));

    let isValid = true;

    // Kiểm tra từng ô nhập
    if (!nameEl.value.trim()) {
        nameEl.classList.add('input-invalid');
        isValid = false;
    }

    const phone = phoneEl.value.trim();
    const phoneRegex = /^0\d{9}$/;
    if (!phone || !phoneRegex.test(phone)) {
        phoneEl.classList.add('input-invalid');
        isValid = false;
    }

    if (!provinceEl.value) {
        provinceEl.classList.add('input-invalid');
        isValid = false;
    }

    if (!districtEl.value) {
        districtEl.classList.add('input-invalid');
        isValid = false;
    }

    if (!wardEl.value) {
        wardEl.classList.add('input-invalid');
        isValid = false;
    }

    if (!addressEl.value.trim()) {
        addressEl.classList.add('input-invalid');
        isValid = false;
    }

    if (!isValid) {
        showNotification('Vui lòng điền đầy đủ thông tin giao hàng hợp lệ!', 'error');
    }

    return isValid;
}

function renderOrderSummary() {
    const cart = JSON.parse(localStorage.getItem('selectedCart')) || [];
    const orderSummary = document.getElementById('order-summary');

    if (cart.length === 0) {
        orderSummary.innerHTML = '<p>Giỏ hàng trống.</p>';
        document.getElementById('payment-btn').disabled = true;
        return;
    }

    let productsHTML = '';
    let total = 0;

    cart.forEach(item => {
        const itemTotal = item.salePrice * item.quantity;
        total += itemTotal;
        productsHTML += `
            <div class="order-product d-flex align-items-center p-3 mb-2 rounded">
                <img src="${item.image}" alt="${item.name}" class="me-3" style="width: 60px; height: 60px; object-fit: cover; background: white">
                <div class="order-product-info flex-grow-1">
                    <h5 class="order-product-name">${item.name} (x${item.quantity})</h5>
                    <div class="price-section">
                        <span class="original-price me-2">${formatCurrency(item.originalPrice)}</span>
                        <span class="sale-price">${formatCurrency(item.salePrice)}</span>
                        <span class="discount-badge badge bg-danger ms-2">-${item.discountPercent}%</span>
                    </div>
                </div>
            </div>
        `;
    });

    orderSummary.innerHTML = `
        ${productsHTML}
        <div class="order-total mt-3">Tổng cộng: ${formatCurrency(total)}</div>
    `;
}

function renderDeliverySummary() {
    const summary = document.getElementById('delivery-summary');
    summary.innerHTML = `
        <p><strong>Họ và tên:</strong> ${deliveryInfo.name}</p>
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
    const cart = JSON.parse(localStorage.getItem('selectedCart')) || [];
    if (cart.length === 0) {
        showNotification('Không có sản phẩm nào được chọn!', 'error');
        showStep(1);
        return;
    }

    const selectedMethod = document.querySelector('input[name="payment-method"]:checked')?.value;
    if (!selectedMethod) {
        showNotification('Vui lòng chọn phương thức thanh toán!', 'error');
        return;
    }

    const methodText = {
        cod: 'Thanh toán khi nhận hàng (COD)'
    }[selectedMethod];
    const total = cart.reduce((sum, item) => sum + item.salePrice * item.quantity, 0);
    document.getElementById('modal-summary').innerHTML = `
        <p><strong>Tổng tiền:</strong> ${formatCurrency(total)}</p>
        <p><strong>Phương thức thanh toán:</strong> ${methodText}</p>
        <p><strong>Họ và tên:</strong> ${deliveryInfo.name}</p>
        <p><strong>Địa chỉ:</strong> ${deliveryInfo.address}, ${deliveryInfo.ward}, ${deliveryInfo.district}, ${deliveryInfo.province}</p>
        ${deliveryInfo.note ? `<p><strong>Ghi chú:</strong> ${deliveryInfo.note}</p>` : ''}
        <p><strong>Yêu cầu xuất hóa đơn:</strong> ${deliveryInfo.invoiceRequired ? 'Có' : 'Không'}</p>
    `;

    const modal = new bootstrap.Modal(document.getElementById('confirmation-modal'));
    modal.show();
}

function closeModal() {
    const modalEl = document.getElementById('confirmation-modal');
    const modal = bootstrap.Modal.getInstance(modalEl);

    if (modal) {
        modal.hide();
    }

    setTimeout(() => {
        const backdrop = document.querySelector('.modal-backdrop');
        if (backdrop) backdrop.remove();

        document.body.classList.remove('modal-open');
        document.body.style.overflow = 'auto'; // ✅ fix chuẩn
        document.body.style.paddingRight = '';
    }, 500);
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
    const modal = new bootstrap.Modal(document.getElementById('success-modal'));
    modal.show();

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
    window.location.href = 'resetlookup.html';
}

function processPayment() {
    closeModal();
    const loadingModal = new bootstrap.Modal(document.getElementById('loading-overlay'));
    loadingModal.show();

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
        const cart = JSON.parse(localStorage.getItem('selectedCart')) || [];
        let orders = JSON.parse(localStorage.getItem('orders')) || [];
        orders.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        const orderId = generateOrderId();

        const selectedMethod = document.querySelector('input[name="payment-method"]:checked').value;

        const order = {
            id: orderId,
            items: cart,
            total: cart.reduce((sum, item) => sum + item.salePrice * item.quantity, 0),
            status: 'Đơn hàng đang xử lý',
            createdAt: new Date().toISOString(),
            paymentMethod: selectedMethod,
            deliveryInfo: deliveryInfo,
            unseen: true
        };

        orders.push(order);
        localStorage.setItem('orders', JSON.stringify(orders));
        console.log('Đơn hàng mới được tạo từ checkout:', order);

        let fullCart = JSON.parse(localStorage.getItem('cart')) || [];
        const remaining = fullCart.filter(item => !cart.find(selected => selected.id === item.id));
        localStorage.setItem('cart', JSON.stringify(remaining));
        updateCartCount();
        localStorage.removeItem('selectedCart');
        selectedItems = [];
        updateOrderCount();

        const savedInfo = JSON.parse(localStorage.getItem('deliveryInfo')) || {};
        delete savedInfo.name;
        delete savedInfo.phone;
        delete savedInfo.address;
        localStorage.setItem('deliveryInfo', JSON.stringify(savedInfo));

        loadingModal.hide();
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

function setupAddressDropdownsFromTree(data) {
    const provinceSelect = document.getElementById('province');
    const districtSelect = document.getElementById('district');
    const wardSelect = document.getElementById('ward');

    if (!provinceSelect || !districtSelect || !wardSelect) return;

    provinceSelect.innerHTML = '<option value="">Chọn tỉnh/thành phố</option>';
    for (const [provinceCode, provinceObj] of Object.entries(data)) {
        const opt = document.createElement('option');
        opt.value = provinceCode;
        opt.textContent = provinceObj.name;
        provinceSelect.appendChild(opt);
    }


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
        { containerId: 'lottie-cod', path: '/transformanimation/cod.json' }
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

document.addEventListener("DOMContentLoaded", function () {
    initializeCartSystem();
    loadPagePart("HTML/Layout/resetheader.html", "#header-container", () => {
        initHeader();
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

    loadPagePart("HTML/Layout/resetfooter.html", "#footer-container", () => {
        if (typeof initFooter === 'function') initFooter();
    });

    renderCart();
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', () => {
            const checked = selectAllCheckbox.checked;
            handleSelectAllToggle(checked);
        });
    }

    loadDeliveryInfo();

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
            const cart = getCart();
            const selected = cart.filter(item => selectedItems.includes(item.id));

            if (selected.length === 0) {
                showNotification('Vui lòng chọn ít nhất một sản phẩm để tiếp tục!', 'error');
                return;
            }

            // ✅ Lưu danh sách sản phẩm đã chọn vào localStorage
            localStorage.setItem('selectedCart', JSON.stringify(selected));

            // Chuyển sang bước 2
            showStep(2);
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

    const paymentBtn = document.getElementById('payment-btn');
    if (paymentBtn) {
        paymentBtn.addEventListener('click', showConfirmation);
    }
    // Bắt sự kiện mở modal điều khoản sử dụng
    const termsLink = document.getElementById('terms-link');
    if (termsLink) {
        termsLink.addEventListener('click', () => {
            const termsModal = new bootstrap.Modal(document.getElementById('terms-modal'));
            termsModal.show();
        });
    }


    lottie.loadAnimation({
        container: document.getElementById('empty-cart-lottie'),
        renderer: 'svg',
        loop: true,
        autoplay: true,
        path: '/transformanimation/emptycart.json'
    });
});

function selectMethod(method) {
    document.querySelectorAll('.method-option').forEach(opt => opt.classList.remove('selected', 'cod'));
    const selected = document.querySelector(`.method-option[data-method="${method}"]`);
    if (selected) {
        selected.classList.add('selected', method);
        selected.querySelector('input').checked = true;
    }
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