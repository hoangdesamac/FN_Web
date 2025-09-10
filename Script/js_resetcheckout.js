// Cart and Checkout System - Server-driven gifts
class CartCheckoutSystem {
  constructor() {
    this.apiBaseUrl = '/api';
    this.userId = 'anonymous'; // In a real app, this would come from authentication
    this.cart = [];
    this.gifts = [];
    this.total = 0;
    this.selectedCart = [];
  }

  // Initialize cart system
  async initializeCartSystem() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/cart?userId=${this.userId}`);
      const data = await response.json();
      
      if (data.success) {
        this.cart = data.cart || [];
        this.gifts = data.gifts || [];
        this.total = data.total || 0;
        
        // Persist server gifts to localStorage for UI reuse
        localStorage.setItem('giftCart', JSON.stringify(this.gifts));
        
        // Update UI
        this.updateCartDisplay();
        this.updateGiftVisibility();
        this.updateCartBadge();
      }
    } catch (error) {
      console.error('Error initializing cart system:', error);
    }
  }

  // Add item to cart
  async addToCart(productData) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/cart`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...productData,
          userId: this.userId
        })
      });

      const data = await response.json();
      
      if (data.success) {
        this.cart = data.cart || [];
        this.gifts = data.gifts || [];
        this.total = data.total || 0;
        
        // Update localStorage with server gifts
        localStorage.setItem('giftCart', JSON.stringify(this.gifts));
        
        // Update UI
        this.updateCartDisplay();
        this.updateGiftVisibility();
        this.updateCartBadge();
        
        return true;
      } else {
        console.error('Error adding to cart:', data.error);
        return false;
      }
    } catch (error) {
      console.error('Error adding to cart:', error);
      return false;
    }
  }

  // Update quantity of cart item
  async updateQuantity(productId, quantity) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/cart/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quantity,
          userId: this.userId
        })
      });

      const data = await response.json();
      
      if (data.success) {
        this.cart = data.cart || [];
        this.gifts = data.gifts || [];
        this.total = data.total || 0;
        
        // Update localStorage with server gifts
        localStorage.setItem('giftCart', JSON.stringify(this.gifts));
        
        // Update UI
        this.updateCartDisplay();
        this.updateGiftVisibility();
        this.updateCartBadge();
        
        return true;
      } else {
        console.error('Error updating quantity:', data.error);
        return false;
      }
    } catch (error) {
      console.error('Error updating quantity:', error);
      return false;
    }
  }

  // Remove item from cart
  async removeItem(productId) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/cart/${productId}?userId=${this.userId}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      
      if (data.success) {
        this.cart = data.cart || [];
        this.gifts = data.gifts || [];
        this.total = data.total || 0;
        
        // Update localStorage with server gifts
        localStorage.setItem('giftCart', JSON.stringify(this.gifts));
        
        // Update UI
        this.updateCartDisplay();
        this.updateGiftVisibility();
        this.updateCartBadge();
        
        return true;
      } else {
        console.error('Error removing item:', data.error);
        return false;
      }
    } catch (error) {
      console.error('Error removing item:', error);
      return false;
    }
  }

  // Clear entire cart
  async clearCart() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/cart?userId=${this.userId}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      
      if (data.success) {
        this.cart = data.cart || [];
        this.gifts = data.gifts || [];
        this.total = data.total || 0;
        
        // Update localStorage with server gifts
        localStorage.setItem('giftCart', JSON.stringify(this.gifts));
        
        // Update UI
        this.updateCartDisplay();
        this.updateGiftVisibility();
        this.updateCartBadge();
        
        return true;
      } else {
        console.error('Error clearing cart:', data.error);
        return false;
      }
    } catch (error) {
      console.error('Error clearing cart:', error);
      return false;
    }
  }

  // Validate gift cart on load - simplified since server now owns gifts
  validateGiftCartOnLoad() {
    // Server now owns gifts, so we just load them from localStorage if available
    const storedGifts = localStorage.getItem('giftCart');
    if (storedGifts) {
      try {
        this.gifts = JSON.parse(storedGifts);
        this.updateGiftVisibility();
      } catch (error) {
        console.error('Error parsing stored gifts:', error);
        this.gifts = [];
      }
    }
  }

  // Update gift visibility - only depends on gift availability
  updateGiftVisibility() {
    const giftSection = document.querySelector('.gift-section');
    const giftItems = document.querySelector('.gift-items');
    
    if (this.gifts && this.gifts.length > 0) {
      if (giftSection) giftSection.style.display = 'block';
      if (giftItems) {
        giftItems.innerHTML = this.renderGiftItems();
      }
    } else {
      if (giftSection) giftSection.style.display = 'none';
      if (giftItems) giftItems.innerHTML = '';
    }
  }

  // Render gift items HTML
  renderGiftItems() {
    if (!this.gifts || this.gifts.length === 0) return '';
    
    return this.gifts.map(gift => `
      <div class="gift-item" data-gift-id="${gift.id}">
        <div class="gift-image">
          <img src="${gift.image}" alt="${gift.name}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNmMGYwZjAiLz48dGV4dCB4PSI1MCIgeT0iNTUiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkdpZnQ8L3RleHQ+PC9zdmc+'">
        </div>
        <div class="gift-info">
          <h4 class="gift-name">${gift.name}</h4>
          <div class="gift-price">
            <span class="original-price">${this.formatPrice(gift.originalPrice)}</span>
            <span class="discount-badge">MIỄN PHÍ</span>
          </div>
          <div class="gift-quantity">Số lượng: ${gift.quantity}</div>
        </div>
        <div class="gift-badge">🎁</div>
      </div>
    `).join('');
  }

  // Update cart display
  updateCartDisplay() {
    const cartItems = document.querySelector('.cart-items');
    if (cartItems) {
      cartItems.innerHTML = this.renderCartItems();
    }
    
    const cartTotal = document.querySelector('.cart-total');
    if (cartTotal) {
      cartTotal.textContent = this.formatPrice(this.total);
    }
  }

  // Render cart items HTML
  renderCartItems() {
    if (!this.cart || this.cart.length === 0) {
      return '<div class="empty-cart">Giỏ hàng của bạn đang trống</div>';
    }
    
    return this.cart.map(item => `
      <div class="cart-item" data-product-id="${item.productId}">
        <div class="item-image">
          <img src="${item.image}" alt="${item.name}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNmMGYwZjAiLz48dGV4dCB4PSI1MCIgeT0iNTUiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiPlByb2R1Y3Q8L3RleHQ+PC9zdmc+'">
        </div>
        <div class="item-info">
          <h4 class="item-name">${item.name}</h4>
          <div class="item-price">
            ${item.discountPercent > 0 ? 
              `<span class="original-price">${this.formatPrice(item.originalPrice)}</span>
               <span class="sale-price">${this.formatPrice(item.salePrice)}</span>
               <span class="discount-badge">-${item.discountPercent}%</span>` :
              `<span class="sale-price">${this.formatPrice(item.salePrice)}</span>`
            }
          </div>
        </div>
        <div class="item-controls">
          <div class="quantity-controls">
            <button class="quantity-btn minus" onclick="cartSystem.updateQuantity('${item.productId}', ${item.quantity - 1})">-</button>
            <span class="quantity">${item.quantity}</span>
            <button class="quantity-btn plus" onclick="cartSystem.updateQuantity('${item.productId}', ${item.quantity + 1})">+</button>
          </div>
          <button class="remove-btn" onclick="cartSystem.removeItem('${item.productId}')">Xóa</button>
        </div>
      </div>
    `).join('');
  }

  // Update cart badge
  updateCartBadge() {
    const totalItems = this.cart.reduce((sum, item) => sum + item.quantity, 0);
    const giftCount = this.gifts.length;
    
    // Use cartCountShared if available for badge counting
    if (window.cartCountShared) {
      window.cartCountShared.setFromCart(this.mergeCartAndGifts());
    }
    
    // Update cart badge elements
    const cartBadges = document.querySelectorAll('.cart-badge, .cart-count');
    cartBadges.forEach(badge => {
      const totalCount = totalItems + giftCount;
      badge.textContent = totalCount;
      badge.style.display = totalCount > 0 ? 'block' : 'none';
    });
  }

  // Merge cart and gifts for badge counting
  mergeCartAndGifts() {
    return [...this.cart, ...this.gifts];
  }

  // Proceed to step 2 - store only selected normal items
  proceedToStep2() {
    // Get selected items (exclude gifts)
    const selectedItems = this.getSelectedItems();
    this.selectedCart = selectedItems.filter(item => !item.isGift);
    
    // Store selected cart without gifts
    localStorage.setItem('selectedCart', JSON.stringify(this.selectedCart));
    
    // Navigate to checkout
    this.showCheckoutStep(2);
  }

  // Get selected items from UI
  getSelectedItems() {
    const selectedItems = [];
    const checkboxes = document.querySelectorAll('.cart-item input[type="checkbox"]:checked');
    
    checkboxes.forEach(checkbox => {
      const productId = checkbox.closest('.cart-item').getAttribute('data-product-id');
      const item = this.cart.find(item => item.productId === productId);
      if (item) {
        selectedItems.push(item);
      }
    });
    
    return selectedItems;
  }

  // Render order summary with gift preview
  async renderOrderSummary() {
    const selectedItems = JSON.parse(localStorage.getItem('selectedCart') || '[]');
    
    // Call server to preview gifts for selected items
    try {
      const response = await fetch(`${this.apiBaseUrl}/gifts/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items: selectedItems })
      });

      const data = await response.json();
      
      if (data.success) {
        const previewGifts = data.gifts || [];
        
        // Render order summary with items and gift preview
        const orderSummary = document.querySelector('.order-summary');
        if (orderSummary) {
          orderSummary.innerHTML = this.renderOrderSummaryHTML(selectedItems, previewGifts);
        }
      }
    } catch (error) {
      console.error('Error fetching gift preview:', error);
    }
  }

  // Render order summary HTML
  renderOrderSummaryHTML(items, gifts) {
    const itemsTotal = this.calculateTotal(items);
    
    let html = `
      <div class="order-section">
        <h3>Sản phẩm đã chọn</h3>
        <div class="order-items">
          ${items.map(item => `
            <div class="order-item">
              <img src="${item.image}" alt="${item.name}">
              <div class="item-details">
                <h4>${item.name}</h4>
                <div class="item-price">${this.formatPrice(item.salePrice)} x ${item.quantity}</div>
              </div>
              <div class="item-total">${this.formatPrice(item.salePrice * item.quantity)}</div>
            </div>
          `).join('')}
        </div>
        <div class="section-total">Tổng tiền: ${this.formatPrice(itemsTotal)}</div>
      </div>
    `;
    
    if (gifts.length > 0) {
      html += `
        <div class="order-section gifts-preview">
          <h3>🎁 Sản phẩm tặng kèm</h3>
          <div class="order-gifts">
            ${gifts.map(gift => `
              <div class="order-gift">
                <img src="${gift.image}" alt="${gift.name}">
                <div class="gift-details">
                  <h4>${gift.name}</h4>
                  <div class="gift-price">
                    <span class="original-price">${this.formatPrice(gift.originalPrice)}</span>
                    <span class="free-badge">MIỄN PHÍ</span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
    
    html += `
      <div class="order-total">
        <div class="total-line">
          <span>Tổng thanh toán:</span>
          <span class="total-amount">${this.formatPrice(itemsTotal)}</span>
        </div>
      </div>
    `;
    
    return html;
  }

  // Process payment - send only selected normal items
  async processPayment(paymentData) {
    const selectedItems = JSON.parse(localStorage.getItem('selectedCart') || '[]');
    
    try {
      const response = await fetch(`${this.apiBaseUrl}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: selectedItems, // Send only normal items, server will compute gifts
          paymentInfo: paymentData,
          userId: this.userId
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // Clear local giftCart as server will recalculate
        localStorage.removeItem('giftCart');
        localStorage.removeItem('selectedCart');
        
        // Refresh cart from server
        await this.initializeCartSystem();
        
        return {
          success: true,
          orderId: data.orderId,
          orderItems: data.orderItems,
          total: data.total
        };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      return { success: false, error: 'Network error' };
    }
  }

  // Show checkout step
  showCheckoutStep(step) {
    const steps = document.querySelectorAll('.checkout-step');
    steps.forEach((stepEl, index) => {
      stepEl.style.display = (index + 1) === step ? 'block' : 'none';
    });
    
    if (step === 2) {
      this.renderOrderSummary();
    }
  }

  // Calculate total
  calculateTotal(items) {
    return items.reduce((sum, item) => sum + (item.salePrice * item.quantity), 0);
  }

  // Format price
  formatPrice(price) {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  }
}

// Shared cart count functionality
const cartCountShared = {
  setFromCart: function(mergedCart) {
    const totalCount = mergedCart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    this.updateBadges(totalCount);
  },
  
  updateBadges: function(count) {
    const badges = document.querySelectorAll('.cart-badge, .cart-count');
    badges.forEach(badge => {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'block' : 'none';
    });
  }
};

// Global cart system instance
const cartSystem = new CartCheckoutSystem();

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  cartSystem.initializeCartSystem();
  cartSystem.validateGiftCartOnLoad();
});

// Export for global use
window.cartSystem = cartSystem;
window.cartCountShared = cartCountShared;