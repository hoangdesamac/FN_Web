(() => {
    const originalShowNotification = window.showNotification;
    let autoCloseTimeout = null;
    let isMouseOverPopup = false;
    let justOpened = false;

    function initializeCartPopup() {
        setupCartPopupEvents();
        overrideShowNotification();
        setupDocumentClickHandler();
    }

    function overrideShowNotification() {
        window.showNotification = function(message, type = 'success') {
            if (type === 'success' && message.includes('Đã thêm')) {
                const matches = message.match(/"([^"]+)"/);
                if (matches && matches[1]) {
                    const productName = matches[1];
                    const product = findProductByName(productName);

                    if (product) {
                        const { price, image } = product;
                        showCartPopup(productName, price, image);
                        return;
                    }
                }
            }

            if (originalShowNotification) {
                originalShowNotification(message, type);
            }
        };
    }

    function findProductByName(productName) {
        const products = document.querySelectorAll('.product-card');
        for (const product of products) {
            const name = product.querySelector('.product-name').textContent;
            if (name === productName) {
                return {
                    price: product.querySelector('.product-price strong').textContent,
                    image: product.querySelector('.product-image').src
                };
            }
        }
        return null;
    }

    function setupCartPopupEvents() {
        const popup = document.getElementById('cartPopup');
        if (!popup) return;

        popup.addEventListener('click', (event) => {
            event.stopPropagation();
        });

        // Theo dõi chuột đi vào pop-up
        popup.addEventListener('mouseenter', () => {
            isMouseOverPopup = true;
            if (autoCloseTimeout) {
                clearTimeout(autoCloseTimeout);
                autoCloseTimeout = null;
            }
        });

        // Theo dõi chuột rời khỏi pop-up
        popup.addEventListener('mouseleave', () => {
            isMouseOverPopup = false;
            if (popup.classList.contains('show')) {
                startAutoCloseTimer();
            }
        });
    }

    function setupDocumentClickHandler() {
        document.addEventListener('click', (event) => {
            const popup = document.getElementById('cartPopup');
            if (!popup) return;

            const isPopupVisible = popup.classList.contains('show');
            if (!isPopupVisible) return;

            const isClickInsidePopup = popup.contains(event.target);
            if (!isClickInsidePopup && !justOpened) {
                closeCartPopup();
            }

            justOpened = false;
        });
    }

    function startAutoCloseTimer() {
        if (autoCloseTimeout) {
            clearTimeout(autoCloseTimeout);
        }

        autoCloseTimeout = setTimeout(() => {
            if (!isMouseOverPopup && document.getElementById('cartPopup').classList.contains('show')) {
                closeCartPopup();
            }
        }, 3000);
    }

    function showCartPopup(productName, productPrice, productImage) {
        const popup = document.getElementById('cartPopup');
        if (!popup) return;

        document.getElementById('popupProductName').textContent = productName;
        document.getElementById('popupProductPrice').textContent = productPrice;
        document.getElementById('popupProductImg').src = productImage;

        isMouseOverPopup = false;
        justOpened = true;

        popup.classList.remove('hide');
        popup.classList.add('show');

        startAutoCloseTimer();
    }

    function closeCartPopup() {
        const popup = document.getElementById('cartPopup');
        if (!popup) return;

        popup.classList.remove('show');
        popup.classList.add('hide');

        if (autoCloseTimeout) {
            clearTimeout(autoCloseTimeout);
            autoCloseTimeout = null;
        }
    }

    document.addEventListener('DOMContentLoaded', initializeCartPopup);
    window.closeCartPopup = closeCartPopup;

    document.addEventListener('DOMContentLoaded', () => {
        const addToCartButtons = document.querySelectorAll('.add-to-cart-btn');
        addToCartButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                event.stopPropagation();
            });
        });
    });
})();