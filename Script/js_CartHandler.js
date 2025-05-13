// js_CartHandler.js
/**
 * Hệ thống quản lý giỏ hàng QD Shop
 * Phiên bản cải tiến với hiệu ứng UX và quản lý bộ nhớ tối ưu
 */

// Cache giỏ hàng để tối ưu hiệu suất
let cartCache = null;

/**
 * Khởi tạo hệ thống giỏ hàng
 */
function initializeCartSystem() {
    console.log("Initializing cart system...");

    // Khởi tạo giỏ hàng từ localStorage
    refreshCartCache();

    // Cập nhật số lượng sản phẩm trên biểu tượng giỏ hàng
    updateCartCount();
    // Cập nhật số lượng sản phẩm được thanh toán trên biểu tượng tra cứu đơn hàng
    updateOrderCount();

    // Thêm sự kiện cho các nút "Thêm vào giỏ"
    // Thêm vào giỏ hàng:
    document.querySelectorAll('.add-to-cart-btn').forEach(button => {
        button.addEventListener('click', function() {
            const productCard = this.closest('.product-card');
            const productId = productCard.getAttribute('data-id');
            const productName = productCard.querySelector('.product-name').textContent;
            const priceText = productCard.querySelector('.product-price strong').textContent;
            const priceValue = parseInt(priceText.replace(/\D/g, ''));

            const rawSrc = productCard.querySelector('.product-image').getAttribute('src');
            const fileName = rawSrc.split('/').pop(); // Lấy tên ảnh từ đường dẫn
            const productImage = 'Images/' + fileName;

            addToCart(productId, productName, priceValue, productImage);
            showNotification(`Đã thêm "${productName}" vào giỏ hàng!`);
        });
    });


    // Tạo phần tử thông báo nếu chưa có
    if (!document.getElementById('notification')) {
        createNotificationElement();
    }


    // Dọn dẹp sản phẩm hết hạn
    cleanupExpiredItems();
}

/**
 * Làm mới cache giỏ hàng từ localStorage
 */
function refreshCartCache() {
    cartCache = JSON.parse(localStorage.getItem('cart')) || [];
    return cartCache;
}

/**
 * Lấy giỏ hàng từ cache hoặc localStorage
 */
function getCart() {
    if (!cartCache) {
        return refreshCartCache();
    }
    return cartCache;
}

/**
 * Lưu giỏ hàng vào localStorage và cập nhật cache
 */
function saveCart(cart) {
    localStorage.setItem('cart', JSON.stringify(cart));
    cartCache = cart;
}

/**
 * Thêm sản phẩm vào giỏ hàng
 * @param {string} productId - ID sản phẩm
 * @param {string} productName - Tên sản phẩm
 * @param {number} price - Giá sản phẩm
 * @param {string} image - URL hình ảnh sản phẩm
 */
function addToCart(productId, productName, price, image) {
    let cart = getCart();

    // Kiểm tra xem sản phẩm đã có trong giỏ hàng chưa
    const existingItemIndex = cart.findIndex(item => item.id === productId);

    // Tạo hiệu ứng trên biểu tượng giỏ hàng
    animateCartIcon();

    if (existingItemIndex !== -1) {
        // Nếu đã có, tăng số lượng
        cart[existingItemIndex].quantity += 1;
        cart[existingItemIndex].updatedAt = new Date().toISOString();
    } else {
        // Nếu chưa có, thêm mới
        cart.push({
            id: productId,
            name: productName,
            price: price,
            image: image,
            quantity: 1,
            addedAt: new Date().toISOString()
        });
    }

    // Lưu giỏ hàng vào localStorage
    saveCart(cart);

    // Cập nhật số lượng hiển thị
    updateCartCount();
}

/**
 * Tạo hiệu ứng bounce trên biểu tượng giỏ hàng
 */
function animateCartIcon() {
    const cartIcon = document.querySelector('.user-actions .bx-cart, .user-actions .bxs-cart');
    if (cartIcon) {
        cartIcon.classList.add('cart-bounce');
        setTimeout(() => {
            cartIcon.classList.remove('cart-bounce');
        }, 800);
    }
}

/**
 * Cập nhật số lượng hiển thị trên biểu tượng giỏ hàng
 */
function updateCartCount() {
    const cart = getCart();
    const cartCount = cart.reduce((total, item) => total + item.quantity, 0);

    // Tìm hoặc tạo phần tử hiển thị số lượng
    let cartCountElement = document.querySelector('.cart-count');

    if (!cartCountElement) {
        // Nếu không tìm thấy, tạo mới và thêm vào bên cạnh biểu tượng giỏ hàng
        const cartIcon = document.querySelector('.user-actions span:first-child');
        if (cartIcon) {
            cartCountElement = document.createElement('span');
            cartCountElement.className = 'cart-count';
            cartIcon.appendChild(cartCountElement);
        }
    }

    if (cartCountElement) {
        // Thêm animation khi số lượng thay đổi
        const oldCount = parseInt(cartCountElement.textContent || '0');
        if (oldCount !== cartCount) {
            cartCountElement.classList.add('cart-count-update');
            setTimeout(() => {
                cartCountElement.classList.remove('cart-count-update');
            }, 500);
        }

        cartCountElement.textContent = cartCount;

        // Ẩn số 0 nếu giỏ hàng trống
        if (cartCount === 0) {
            cartCountElement.style.display = 'none';
        } else {
            cartCountElement.style.display = 'inline-flex';
        }
    }
}

/**
 * Tạo phần tử thông báo
 */
function createNotificationElement() {
    // Xóa thông báo cũ nếu đã tồn tại
    const oldNotification = document.getElementById('notification');
    if (oldNotification) {
        oldNotification.remove();
    }

    const notification = document.createElement('div');
    notification.id = 'notification';
    notification.style.display = 'none';

    // Thêm vào DOM
    document.body.appendChild(notification);

    return notification;
}

/**
 * Định vị thông báo ở góc dưới bên phải màn hình
 * Chỉ cần đảm bảo z-index và các thuộc tính cần thiết khác nếu có
 */
function positionNotificationUnderCart() {
    const notification = document.getElementById('notification');
    if (notification) {
        // Chỉ cần đảm bảo z-index và các thuộc tính tối thiểu
        notification.style.zIndex = '9999';
    }
}

/**
 * Hiển thị thông báo cho người dùng
 * @param {string} message - Nội dung thông báo
 * @param {string} type - Loại thông báo ('success' hoặc 'error')
 */
function showNotification(message, type = 'success') {
    let notification = document.getElementById('notification');
    if (!notification) {
        notification = createNotificationElement();
    }

    // Cập nhật vị trí (nếu cần)
    positionNotificationUnderCart();

    // Thêm icon dựa vào loại thông báo
    let icon = type === 'success' ? '<i class="bx bx-check-circle"></i>' : '<i class="bx bx-error-circle"></i>';

    // Thêm nút xem giỏ hàng nếu là thông báo thêm sản phẩm thành công
    let actionButton = '';
    if (type === 'success' && message.includes('Đã thêm')) {
        actionButton = `
            <div class="notification-actions">
                <a href="../HTML/Layout/cart.html" class="view-cart-btn">Xem giỏ hàng</a>
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

    // Hiệu ứng hiển thị
    notification.style.display = 'block';
    notification.style.animation = 'none';
    setTimeout(() => {
        notification.style.animation = 'popupNotification 0.3s cubic-bezier(0.22, 1, 0.36, 1) forwards';
    }, 10);

    // Tự động ẩn sau 5 giây
    const autoHideTimeout = setTimeout(() => {
        hideNotification();
    }, 5000);

    // Thêm sự kiện cho nút đóng
    const closeBtn = notification.querySelector('.notification-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            clearTimeout(autoHideTimeout);
            hideNotification();
        });
    }
}

/**
 * Ẩn thông báo với hiệu ứng
 */
function hideNotification() {
    const notification = document.getElementById('notification');
    if (notification) {
        notification.style.animation = 'slideOutNotification 0.3s forwards';
        setTimeout(() => {
            notification.style.display = 'none';
        }, 300);
    }
}

/**
 * Xóa toàn bộ giỏ hàng
 */
function clearCart() {
    if (confirm('Bạn có chắc chắn muốn xóa tất cả sản phẩm khỏi giỏ hàng?')) {
        saveCart([]);

        // Nếu đang ở trang giỏ hàng
        if (typeof renderCart === 'function') {
            renderCart();
        }

        updateCartCount();
        showNotification('Đã xóa tất cả sản phẩm khỏi giỏ hàng', 'success');
    }
}

/**
 * Cập nhật số lượng sản phẩm trong giỏ hàng
 * @param {number} index - Vị trí sản phẩm trong giỏ hàng
 * @param {number} change - Giá trị thay đổi (+1 hoặc -1)
 */
function updateQuantity(index, change) {
    const cart = getCart();

    if (cart[index]) {
        // Hiệu ứng animation
        const cartItems = document.querySelectorAll('.cart-item');
        if (cartItems[index]) {
            cartItems[index].classList.add('quantity-change');
            setTimeout(() => {
                cartItems[index].classList.remove('quantity-change');
            }, 300);
        }

        cart[index].quantity += change;
        cart[index].updatedAt = new Date().toISOString(); // Cập nhật thời gian sửa đổi

        if (cart[index].quantity <= 0) {
            removeItem(index);
            return;
        }

        saveCart(cart);

        // Nếu đang ở trang giỏ hàng
        if (typeof renderCart === 'function') {
            renderCart();
        }

        updateCartCount();
    }
}

/**
 * Xóa sản phẩm khỏi giỏ hàng
 * @param {number} index - Vị trí sản phẩm trong giỏ hàng
 */
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

/**
 * Thực hiện việc xóa sản phẩm khỏi giỏ hàng
 * @param {number} index - Vị trí sản phẩm trong giỏ hàng
 * @param {string} itemName - Tên sản phẩm để hiển thị thông báo
 */
function performRemoveItem(index, itemName) {
    const cart = getCart();
    cart.splice(index, 1);
    saveCart(cart);

    if (typeof renderCart === 'function') {
        renderCart();
    }

    updateCartCount();
    showNotification(`Đã xóa "${itemName}" khỏi giỏ hàng`, 'success');
}

/**
 * Dọn dẹp các sản phẩm đã hết hạn trong giỏ hàng
 * @param {number} expiryHours - Số giờ trước khi sản phẩm được coi là hết hạn
 */
function cleanupExpiredItems(expiryHours = 72) { // Mặc định 3 ngày
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
        if (typeof renderCart === 'function') {
            renderCart();
        }
        console.log("Đã xóa các sản phẩm hết hạn từ giỏ hàng");
    }
}

/**
 * Lưu giỏ hàng hiện tại vào danh sách yêu thích
 * @returns {boolean} - Kết quả (thành công/thất bại)
 */
function saveCartAsWishlist() {
    const cart = getCart();

    if (cart.length > 0) {
        // Tạo một wishlist mới với ngày lưu
        const wishlist = {
            items: cart,
            savedAt: new Date().toISOString(),
            name: `Giỏ hàng ${new Date().toLocaleDateString('vi-VN')}`
        };

        // Lấy danh sách wishlist cũ nếu có
        const savedWishlists = JSON.parse(localStorage.getItem('wishlists')) || [];
        savedWishlists.push(wishlist);

        // Lưu lại danh sách wishlist
        localStorage.setItem('wishlists', JSON.stringify(savedWishlists));

        showNotification('Đã lưu giỏ hàng vào danh sách yêu thích', 'success');
        return true;
    } else {
        showNotification('Không thể lưu vì giỏ hàng đang trống', 'error');
        return false;
    }
}

/**
 * Format số tiền thành định dạng tiền Việt Nam
 * @param {number} amount - Số tiền cần định dạng
 * @returns {string} - Chuỗi đã định dạng
 */
function formatCurrency(amount) {
    return amount.toLocaleString('vi-VN') + '₫';
}

/**
 * Di chuyển sản phẩm lên đầu hoặc cuối giỏ hàng
 * @param {number} index - Vị trí sản phẩm trong giỏ hàng
 * @param {string} position - Vị trí mới ('top' hoặc 'bottom')
 */
function moveItem(index, position = 'top') {
    const cart = getCart();

    if (index >= 0 && index < cart.length) {
        const item = cart.splice(index, 1)[0];

        if (position === 'top') {
            cart.unshift(item);
        } else if (position === 'bottom') {
            cart.push(item);
        }

        saveCart(cart);

        if (typeof renderCart === 'function') {
            renderCart();
        }
    }
}

/**
 * Nhân đôi số lượng sản phẩm trong giỏ hàng
 * @param {number} index - Vị trí sản phẩm trong giỏ hàng
 */
function duplicateItem(index) {
    const cart = getCart();

    if (index >= 0 && index < cart.length) {
        const newItem = {...cart[index]};
        newItem.addedAt = new Date().toISOString();
        cart.splice(index + 1, 0, newItem);

        saveCart(cart);

        if (typeof renderCart === 'function') {
            renderCart();
        }

        updateCartCount();
        showNotification(`Đã nhân đôi "${newItem.name}" trong giỏ hàng`, 'success');
    }
}

// Theo dõi sự thay đổi giỏ hàng để đồng bộ giữa các tab
window.addEventListener('storage', function(e) {
    if (e.key === 'cart') {
        refreshCartCache(); // Reset cache
        updateCartCount();

        // Nếu đang ở trang giỏ hàng, cập nhật giao diện
        if (typeof renderCart === 'function') {
            renderCart();
        }
    }
    if (e.key === 'orders') {
        updateOrderCount();
    }
});

// Thêm hiệu ứng shadow cho header khi cuộn
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

// Khởi tạo hệ thống khi trang được tải
document.addEventListener('DOMContentLoaded', function() {
    // Khởi tạo hệ thống
    initializeCartSystem();

    // Tìm nút clear-cart và khởi tạo sự kiện (nếu có)
    const clearCartBtn = document.getElementById('clear-cart');
    if (clearCartBtn) {
        clearCartBtn.addEventListener('click', clearCart);

        // Cập nhật trạng thái hiển thị của nút
        const cart = getCart();
        clearCartBtn.style.display = cart.length > 0 ? 'flex' : 'none';
    }
});