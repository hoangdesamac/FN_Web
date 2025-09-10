const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.static('HTML'));

// PostgreSQL connection (using environment variables or defaults for development)
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'fn_web',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

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

// Database initialization
async function initializeDatabase() {
  try {
    // Create cart_items table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cart_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) NOT NULL DEFAULT 'anonymous',
        product_id VARCHAR(255) NOT NULL,
        name VARCHAR(500) NOT NULL,
        image VARCHAR(1000),
        original_price DECIMAL(12,2) NOT NULL,
        sale_price DECIMAL(12,2) NOT NULL,
        discount_percent INTEGER DEFAULT 0,
        quantity INTEGER NOT NULL DEFAULT 1,
        is_gift BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create orders table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) NOT NULL DEFAULT 'anonymous',
        items JSONB NOT NULL,
        total_amount DECIMAL(12,2) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Database tables initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
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
    .filter(item => !item.isGift && !item.is_gift)
    .reduce((total, item) => {
      const price = item.salePrice || item.sale_price || 0;
      const quantity = item.quantity || 1;
      return total + (price * quantity);
    }, 0);
}

// Get cart with computed gifts
async function getCartWithGifts(userId = 'anonymous') {
  try {
    // Get non-gift items from database
    const result = await pool.query(
      'SELECT * FROM cart_items WHERE user_id = $1 AND is_gift = FALSE ORDER BY created_at',
      [userId]
    );
    
    const cartItems = result.rows.map(row => ({
      id: row.id,
      productId: row.product_id,
      name: row.name,
      image: row.image,
      originalPrice: parseFloat(row.original_price),
      salePrice: parseFloat(row.sale_price),
      discountPercent: row.discount_percent,
      quantity: row.quantity,
      isGift: row.is_gift
    }));

    const total = calculateCartTotal(cartItems);
    const gifts = computeGifts(total);

    return { cart: cartItems, gifts, total };
  } catch (error) {
    console.error('Error getting cart with gifts:', error);
    throw error;
  }
}

// API Routes

// GET /api/cart - Get cart with computed gifts
app.get('/api/cart', async (req, res) => {
  try {
    const userId = req.query.userId || 'anonymous';
    const { cart, gifts, total } = await getCartWithGifts(userId);
    
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
app.post('/api/cart', async (req, res) => {
  try {
    const { productId, name, image, originalPrice, salePrice, discountPercent, quantity = 1 } = req.body;
    const userId = req.body.userId || 'anonymous';

    if (!productId || !name || originalPrice === undefined || salePrice === undefined) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Check if item already exists
    const existingItem = await pool.query(
      'SELECT * FROM cart_items WHERE user_id = $1 AND product_id = $2 AND is_gift = FALSE',
      [userId, productId]
    );

    if (existingItem.rows.length > 0) {
      // Update quantity
      const newQuantity = existingItem.rows[0].quantity + quantity;
      await pool.query(
        'UPDATE cart_items SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newQuantity, existingItem.rows[0].id]
      );
    } else {
      // Insert new item
      await pool.query(
        `INSERT INTO cart_items (user_id, product_id, name, image, original_price, sale_price, discount_percent, quantity, is_gift)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE)`,
        [userId, productId, name, image, originalPrice, salePrice, discountPercent || 0, quantity]
      );
    }

    const { cart, gifts, total } = await getCartWithGifts(userId);
    
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
app.put('/api/cart/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;
    const userId = req.body.userId || 'anonymous';

    if (quantity === undefined || quantity < 0) {
      return res.status(400).json({ success: false, error: 'Invalid quantity' });
    }

    if (quantity === 0) {
      // Remove item if quantity is 0
      await pool.query(
        'DELETE FROM cart_items WHERE user_id = $1 AND product_id = $2 AND is_gift = FALSE',
        [userId, productId]
      );
    } else {
      // Update quantity
      await pool.query(
        'UPDATE cart_items SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND product_id = $3 AND is_gift = FALSE',
        [quantity, userId, productId]
      );
    }

    const { cart, gifts, total } = await getCartWithGifts(userId);
    
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
app.delete('/api/cart/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.query.userId || 'anonymous';

    await pool.query(
      'DELETE FROM cart_items WHERE user_id = $1 AND product_id = $2 AND is_gift = FALSE',
      [userId, productId]
    );

    const { cart, gifts, total } = await getCartWithGifts(userId);
    
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
app.delete('/api/cart', async (req, res) => {
  try {
    const userId = req.query.userId || 'anonymous';

    await pool.query(
      'DELETE FROM cart_items WHERE user_id = $1 AND is_gift = FALSE',
      [userId]
    );

    const { cart, gifts, total } = await getCartWithGifts(userId);
    
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
app.post('/api/cart/bulk-delete', async (req, res) => {
  try {
    const { productIds } = req.body;
    const userId = req.body.userId || 'anonymous';

    if (!Array.isArray(productIds)) {
      return res.status(400).json({ success: false, error: 'productIds must be an array' });
    }

    if (productIds.length > 0) {
      const placeholders = productIds.map((_, index) => `$${index + 2}`).join(',');
      await pool.query(
        `DELETE FROM cart_items WHERE user_id = $1 AND product_id IN (${placeholders}) AND is_gift = FALSE`,
        [userId, ...productIds]
      );
    }

    const { cart, gifts, total } = await getCartWithGifts(userId);
    
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
app.post('/api/gifts/preview', async (req, res) => {
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
app.post('/api/orders', async (req, res) => {
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

    // Store order in database
    await pool.query(
      'INSERT INTO orders (id, user_id, items, total_amount) VALUES ($1, $2, $3, $4)',
      [orderId, userId, JSON.stringify(orderItems), total]
    );

    // Remove only non-gift items from cart (keep gift computation for remaining items)
    const productIds = nonGiftItems.map(item => item.productId || item.id);
    if (productIds.length > 0) {
      const placeholders = productIds.map((_, index) => `$${index + 2}`).join(',');
      await pool.query(
        `DELETE FROM cart_items WHERE user_id = $1 AND product_id IN (${placeholders}) AND is_gift = FALSE`,
        [userId, ...productIds]
      );
    }

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
app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  await initializeDatabase();
  console.log(`Gift catalog loaded with ${giftCatalog.length} items`);
  console.log('Gift tiers configured:', GIFT_TIERS);
});

module.exports = app;