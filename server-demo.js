const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// app.use(helmet()); // Disabled for demo
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.static('.'));

// In-memory storage for demo purposes
let cartItems = new Map(); // userId -> items array
let orders = new Map(); // orderId -> order object

// Gift configuration - configurable tiers
const GIFT_TIERS = [
  {
    minAmount: 5000000, // 5 million VND
    maxGifts: 2,
    priceRange: { min: 500000, max: 3000000 } // 500k - 3M VND
  },
  {
    minAmount: 3000000, // 3 million VND  
    maxGifts: 1,
    priceRange: { min: 300000, max: 1500000 } // 300k - 1.5M VND
  },
  {
    minAmount: 1000000, // 1 million VND
    maxGifts: 1,
    priceRange: { min: 100000, max: 800000 } // 100k - 800k VND
  }
];

// Load gift catalog
let giftCatalog = [];
try {
  // Try primary path first
  const primaryPath = path.join(__dirname, 'pc-part-dataset', 'processed', 'givaAway.json');
  if (fs.existsSync(primaryPath)) {
    giftCatalog = JSON.parse(fs.readFileSync(primaryPath, 'utf8'));
    console.log('Loaded gift catalog from primary path:', primaryPath);
  } else {
    // Fallback to root givaAway.json
    const fallbackPath = path.join(__dirname, 'givaAway.json');
    giftCatalog = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
    console.log('Loaded gift catalog from fallback path:', fallbackPath);
  }
} catch (error) {
  console.error('Error loading gift catalog:', error);
  giftCatalog = [];
}

// Gift computation logic
function computeGifts(cartTotal) {
  if (!giftCatalog.length) return [];
  
  // Find applicable tier
  const applicableTier = GIFT_TIERS.find(tier => cartTotal >= tier.minAmount);
  if (!applicableTier) return [];

  // Filter gifts within price range
  const eligibleGifts = giftCatalog.filter(gift => 
    gift.originalPrice >= applicableTier.priceRange.min && 
    gift.originalPrice <= applicableTier.priceRange.max
  );

  if (!eligibleGifts.length) return [];

  // Randomly select gifts
  const selectedGifts = [];
  const giftCount = Math.min(applicableTier.maxGifts, eligibleGifts.length);
  
  for (let i = 0; i < giftCount; i++) {
    const randomIndex = Math.floor(Math.random() * eligibleGifts.length);
    const selectedGift = eligibleGifts.splice(randomIndex, 1)[0];
    
    selectedGifts.push({
      id: selectedGift.id,
      name: selectedGift.name,
      image: selectedGift.image,
      originalPrice: selectedGift.originalPrice,
      salePrice: 0,
      discountPercent: 100,
      quantity: 1,
      isGift: true
    });
  }

  return selectedGifts;
}

// Calculate cart total (excluding gifts)
function calculateCartTotal(items) {
  return items
    .filter(item => !item.isGift)
    .reduce((total, item) => {
      const price = item.salePrice || 0;
      const quantity = item.quantity || 1;
      return total + (price * quantity);
    }, 0);
}

// Get cart with computed gifts
function getCartWithGifts(userId = 'anonymous') {
  // Get non-gift items from storage
  const userCart = cartItems.get(userId) || [];
  const cart = userCart.filter(item => !item.isGift);

  const total = calculateCartTotal(cart);
  const gifts = computeGifts(total);

  return { cart, gifts, total };
}

// API Routes

// GET /api/cart - Get cart with computed gifts
app.get('/api/cart', (req, res) => {
  try {
    const userId = req.query.userId || 'anonymous';
    const { cart, gifts, total } = getCartWithGifts(userId);
    
    res.json({
      success: true,
      cart,
      gifts,
      total
    });
  } catch (error) {
    console.error('Error fetching cart:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/cart - Add item to cart
app.post('/api/cart', (req, res) => {
  try {
    const { productId, name, image, originalPrice, salePrice, discountPercent, quantity = 1 } = req.body;
    const userId = req.body.userId || 'anonymous';

    if (!productId || !name || originalPrice === undefined || salePrice === undefined) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Get user cart
    let userCart = cartItems.get(userId) || [];
    
    // Check if item already exists
    const existingItemIndex = userCart.findIndex(item => 
      item.productId === productId && !item.isGift
    );

    if (existingItemIndex !== -1) {
      // Update quantity
      userCart[existingItemIndex].quantity += quantity;
    } else {
      // Add new item
      const newItem = {
        id: uuidv4(),
        productId,
        name,
        image,
        originalPrice,
        salePrice,
        discountPercent: discountPercent || 0,
        quantity,
        isGift: false
      };
      userCart.push(newItem);
    }

    // Save updated cart
    cartItems.set(userId, userCart);

    const { cart, gifts, total } = getCartWithGifts(userId);
    
    res.json({
      success: true,
      cart,
      gifts,
      total
    });
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /api/cart/:productId - Update cart item quantity
app.put('/api/cart/:productId', (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;
    const userId = req.body.userId || 'anonymous';

    if (quantity === undefined || quantity < 0) {
      return res.status(400).json({ success: false, error: 'Invalid quantity' });
    }

    // Get user cart
    let userCart = cartItems.get(userId) || [];

    if (quantity === 0) {
      // Remove item
      userCart = userCart.filter(item => !(item.productId === productId && !item.isGift));
    } else {
      // Update quantity
      const itemIndex = userCart.findIndex(item => 
        item.productId === productId && !item.isGift
      );
      if (itemIndex !== -1) {
        userCart[itemIndex].quantity = quantity;
      }
    }

    // Save updated cart
    cartItems.set(userId, userCart);

    const { cart, gifts, total } = getCartWithGifts(userId);
    
    res.json({
      success: true,
      cart,
      gifts,
      total
    });
  } catch (error) {
    console.error('Error updating cart item:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// DELETE /api/cart/:productId - Remove specific item
app.delete('/api/cart/:productId', (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.query.userId || 'anonymous';

    // Get user cart
    let userCart = cartItems.get(userId) || [];
    
    // Remove item
    userCart = userCart.filter(item => !(item.productId === productId && !item.isGift));
    
    // Save updated cart
    cartItems.set(userId, userCart);

    const { cart, gifts, total } = getCartWithGifts(userId);
    
    res.json({
      success: true,
      cart,
      gifts,
      total
    });
  } catch (error) {
    console.error('Error removing cart item:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// DELETE /api/cart - Clear entire cart
app.delete('/api/cart', (req, res) => {
  try {
    const userId = req.query.userId || 'anonymous';

    // Clear cart (keep only gifts which would be recalculated anyway)
    cartItems.set(userId, []);

    const { cart, gifts, total } = getCartWithGifts(userId);
    
    res.json({
      success: true,
      cart,
      gifts,
      total
    });
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/cart/bulk-delete - Remove multiple items
app.post('/api/cart/bulk-delete', (req, res) => {
  try {
    const { productIds } = req.body;
    const userId = req.body.userId || 'anonymous';

    if (!Array.isArray(productIds)) {
      return res.status(400).json({ success: false, error: 'productIds must be an array' });
    }

    // Get user cart
    let userCart = cartItems.get(userId) || [];
    
    // Remove items
    userCart = userCart.filter(item => 
      !(productIds.includes(item.productId) && !item.isGift)
    );
    
    // Save updated cart
    cartItems.set(userId, userCart);

    const { cart, gifts, total } = getCartWithGifts(userId);
    
    res.json({
      success: true,
      cart,
      gifts,
      total
    });
  } catch (error) {
    console.error('Error bulk deleting cart items:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/gifts/preview - Preview gifts for given items
app.post('/api/gifts/preview', (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, error: 'items must be an array' });
    }

    // Calculate total excluding gifts
    const total = calculateCartTotal(items);
    const gifts = computeGifts(total);

    res.json({
      success: true,
      gifts
    });
  } catch (error) {
    console.error('Error previewing gifts:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/orders - Create order with server-computed gifts
app.post('/api/orders', (req, res) => {
  try {
    const { items, paymentInfo } = req.body;
    const userId = req.body.userId || 'anonymous';

    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, error: 'items must be an array' });
    }

    // Calculate total and compute gifts from provided items (ignore client-provided gifts)
    const nonGiftItems = items.filter(item => !item.isGift);
    const total = calculateCartTotal(nonGiftItems);
    const serverGifts = computeGifts(total);

    // Combine items with server-computed gifts
    const orderItems = [...nonGiftItems, ...serverGifts];
    const orderId = uuidv4();

    // Store order
    orders.set(orderId, {
      id: orderId,
      userId,
      items: orderItems,
      total,
      paymentInfo,
      status: 'pending',
      createdAt: new Date().toISOString()
    });

    // Remove ordered items from cart
    let userCart = cartItems.get(userId) || [];
    const productIds = nonGiftItems.map(item => item.productId || item.id);
    userCart = userCart.filter(item => 
      !(productIds.includes(item.productId) && !item.isGift)
    );
    cartItems.set(userId, userCart);

    res.json({
      success: true,
      orderId,
      orderItems,
      total
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Gift catalog loaded with ${giftCatalog.length} items`);
  console.log('Gift tiers configured:', GIFT_TIERS);
  console.log('Demo mode: Using in-memory storage');
});

module.exports = app;