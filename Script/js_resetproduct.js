// Product System - Simplified without client-side gift logic
class ProductSystem {
  constructor() {
    this.apiBaseUrl = '/api';
    this.userId = 'anonymous';
  }

  // Initialize product system
  initializeProductSystem() {
    this.setupEventListeners();
    this.loadGiftCartFromStorage(); // Keep reading server-populated gifts
  }

  // Setup event listeners
  setupEventListeners() {
    // Bundle checkbox change handler - simplified
    const bundleCheckboxes = document.querySelectorAll('.bundle-checkbox');
    bundleCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        this.handleBundleChange(e);
      });
    });

    // Buy now buttons
    const buyNowButtons = document.querySelectorAll('.buy-now-btn');
    buyNowButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        this.handleBuyNow(e);
      });
    });

    // Add to cart buttons
    const addToCartButtons = document.querySelectorAll('.add-to-cart-btn');
    addToCartButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        this.handleAddToCart(e);
      });
    });
  }

  // Handle bundle checkbox change - removed gift logic
  handleBundleChange(event) {
    const checkbox = event.target;
    const bundleContainer = checkbox.closest('.bundle-container');
    
    if (!bundleContainer) return;

    // Update bundle pricing display
    this.updateBundlePricing(bundleContainer);
    
    // Update bundle total
    this.updateBundleTotal();
    
    // No more gift requirement storage or checkComboGift calls
    // Server will handle all gift logic
  }

  // Update bundle pricing display
  updateBundlePricing(bundleContainer) {
    const checkbox = bundleContainer.querySelector('.bundle-checkbox');
    const priceDisplay = bundleContainer.querySelector('.bundle-price');
    const originalPrice = parseFloat(bundleContainer.dataset.originalPrice || 0);
    const bundlePrice = parseFloat(bundleContainer.dataset.bundlePrice || 0);
    
    if (checkbox.checked) {
      priceDisplay.innerHTML = `
        <span class="original-price">${this.formatPrice(originalPrice)}</span>
        <span class="bundle-price">${this.formatPrice(bundlePrice)}</span>
        <span class="savings">Tiết kiệm: ${this.formatPrice(originalPrice - bundlePrice)}</span>
      `;
    } else {
      priceDisplay.innerHTML = `<span class="price">${this.formatPrice(originalPrice)}</span>`;
    }
  }

  // Update bundle total
  updateBundleTotal() {
    const selectedBundles = document.querySelectorAll('.bundle-checkbox:checked');
    let total = 0;
    
    selectedBundles.forEach(checkbox => {
      const container = checkbox.closest('.bundle-container');
      const price = parseFloat(container.dataset.bundlePrice || container.dataset.originalPrice || 0);
      total += price;
    });
    
    const totalDisplay = document.querySelector('.bundle-total');
    if (totalDisplay) {
      totalDisplay.textContent = this.formatPrice(total);
    }
  }

  // Handle add to cart - simplified without gifts
  async handleAddToCart(event) {
    event.preventDefault();
    
    const button = event.target;
    const productContainer = button.closest('.product-container');
    
    if (!productContainer) return;

    const productData = this.extractProductData(productContainer);
    if (!productData) return;

    // Add to cart via server
    const success = await window.cartSystem.addToCart(productData);
    
    if (success) {
      this.showAddToCartSuccess(button);
    } else {
      this.showAddToCartError(button);
    }
  }

  // Handle buy now - simplified without gift construction
  async handleBuyNow(event) {
    event.preventDefault();
    
    const button = event.target;
    const productContainer = button.closest('.product-container');
    
    if (!productContainer) return;

    const productData = this.extractProductData(productContainer);
    if (!productData) return;

    // Add to cart first (server will handle gifts)
    const success = await window.cartSystem.addToCart(productData);
    
    if (success) {
      // Pass empty gift list - rely entirely on server gifts
      this.handleBuyNowImmediate(productData, []);
    } else {
      this.showAddToCartError(button);
    }
  }

  // Handle immediate buy now - simplified
  handleBuyNowImmediate(productData, gifts) {
    // Store product for checkout
    const checkoutData = {
      items: [productData],
      gifts: gifts, // Will be empty, server handles gifts
      total: productData.salePrice * (productData.quantity || 1)
    };
    
    localStorage.setItem('selectedCart', JSON.stringify(checkoutData.items));
    
    // Redirect to checkout
    window.location.href = '/checkout.html';
  }

  // Extract product data from DOM
  extractProductData(container) {
    const productId = container.dataset.productId;
    const name = container.querySelector('.product-name')?.textContent;
    const image = container.querySelector('.product-image img')?.src;
    const originalPrice = parseFloat(container.dataset.originalPrice || 0);
    const salePrice = parseFloat(container.dataset.salePrice || originalPrice);
    const discountPercent = parseInt(container.dataset.discountPercent || 0);
    const quantityInput = container.querySelector('.quantity-input');
    const quantity = quantityInput ? parseInt(quantityInput.value) || 1 : 1;

    if (!productId || !name || !originalPrice) {
      console.error('Missing required product data');
      return null;
    }

    return {
      productId,
      name,
      image,
      originalPrice,
      salePrice,
      discountPercent,
      quantity
    };
  }

  // Load gift cart from storage (server-populated)
  loadGiftCartFromStorage() {
    const storedGifts = localStorage.getItem('giftCart');
    if (storedGifts) {
      try {
        const gifts = JSON.parse(storedGifts);
        this.updateCartBadgeWithGifts(gifts);
      } catch (error) {
        console.error('Error parsing stored gifts:', error);
      }
    }
  }

  // Update cart badge with gifts
  updateCartBadgeWithGifts(gifts) {
    if (window.cartCountShared && gifts.length > 0) {
      // Add gifts to cart count
      const currentCart = JSON.parse(localStorage.getItem('cart') || '[]');
      const mergedCart = [...currentCart, ...gifts];
      window.cartCountShared.setFromCart(mergedCart);
    }
  }

  // Show add to cart success
  showAddToCartSuccess(button) {
    const originalText = button.textContent;
    button.textContent = 'Đã thêm!';
    button.classList.add('success');
    button.disabled = true;
    
    setTimeout(() => {
      button.textContent = originalText;
      button.classList.remove('success');
      button.disabled = false;
    }, 2000);
  }

  // Show add to cart error
  showAddToCartError(button) {
    const originalText = button.textContent;
    button.textContent = 'Lỗi!';
    button.classList.add('error');
    
    setTimeout(() => {
      button.textContent = originalText;
      button.classList.remove('error');
    }, 2000);
  }

  // Format price
  formatPrice(price) {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  }

  // Product page initialization
  initializeProductPage() {
    // No more validateGiftOnProductPage() calls
    // Just initialize basic product functionality
    this.initializeProductSystem();
    this.setupProductImageGallery();
    this.setupProductOptions();
  }

  // Setup product image gallery
  setupProductImageGallery() {
    const thumbnails = document.querySelectorAll('.product-thumbnail');
    const mainImage = document.querySelector('.product-main-image');
    
    thumbnails.forEach(thumbnail => {
      thumbnail.addEventListener('click', (e) => {
        const newSrc = e.target.src;
        if (mainImage) {
          mainImage.src = newSrc;
        }
        
        // Update active thumbnail
        thumbnails.forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
      });
    });
  }

  // Setup product options (color, size, etc.)
  setupProductOptions() {
    const optionButtons = document.querySelectorAll('.product-option-btn');
    
    optionButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const optionGroup = e.target.closest('.product-option-group');
        if (!optionGroup) return;
        
        // Remove active from siblings
        const siblings = optionGroup.querySelectorAll('.product-option-btn');
        siblings.forEach(sibling => sibling.classList.remove('active'));
        
        // Add active to clicked button
        e.target.classList.add('active');
        
        // Update product data if needed
        this.updateProductDataFromOptions();
      });
    });
  }

  // Update product data based on selected options
  updateProductDataFromOptions() {
    const selectedOptions = {};
    const optionGroups = document.querySelectorAll('.product-option-group');
    
    optionGroups.forEach(group => {
      const optionType = group.dataset.optionType;
      const selectedOption = group.querySelector('.product-option-btn.active');
      
      if (selectedOption) {
        selectedOptions[optionType] = {
          value: selectedOption.dataset.value,
          priceModifier: parseFloat(selectedOption.dataset.priceModifier || 0)
        };
      }
    });
    
    // Update price display based on options
    this.updatePriceFromOptions(selectedOptions);
  }

  // Update price display from options
  updatePriceFromOptions(options) {
    const basePrice = parseFloat(document.querySelector('.product-container')?.dataset.salePrice || 0);
    let totalModifier = 0;
    
    Object.values(options).forEach(option => {
      totalModifier += option.priceModifier;
    });
    
    const finalPrice = basePrice + totalModifier;
    const priceDisplay = document.querySelector('.product-price .current-price');
    
    if (priceDisplay) {
      priceDisplay.textContent = this.formatPrice(finalPrice);
    }
    
    // Update product container data
    const container = document.querySelector('.product-container');
    if (container) {
      container.dataset.salePrice = finalPrice;
    }
  }
}

// Global product system instance
const productSystem = new ProductSystem();

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  productSystem.initializeProductPage();
});

// Header load event - no more gift validation
document.addEventListener('headerLoaded', function() {
  // Just load cart badge with stored gifts
  productSystem.loadGiftCartFromStorage();
});

// Export for global use
window.productSystem = productSystem;