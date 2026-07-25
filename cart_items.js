import express from 'express';
import cors from 'cors';
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const app = express();
app.use(cors());
app.use(express.json());

const sql = neon(process.env.DATABASE_URL || process.env.POSTGRES_URL);

const isPositiveInteger = (value) =>
  Number.isSafeInteger(Number(value)) && Number(value) > 0;

// CREATE: Add a product to a cart.
app.post('/api/cart-items', async (req, res) => {
  try {
    const { cart_id, product_id, quantity = 1 } = req.body;

    if (!cart_id || !product_id) {
      return res.status(400).json({
        error: 'cart_id and product_id are required.',
      });
    }

    if (
      !isPositiveInteger(cart_id) ||
      !isPositiveInteger(product_id) ||
      !isPositiveInteger(quantity)
    ) {
      return res.status(400).json({
        error: 'cart_id, product_id, and quantity must be positive integers.',
      });
    }

    const result = await sql`
      INSERT INTO cart_items (
        cart_id,
        product_id,
        quantity,
        created_at,
        updated_at
      )
      VALUES (${cart_id}, ${product_id}, ${quantity}, NOW(), NOW())
      RETURNING *;
    `;

    res.status(201).json({
      message: 'Cart item created successfully',
      cart_item: result[0],
    });
  } catch (error) {
    console.error('Error creating cart item:', error);
    res.status(error.code === '23503' ? 400 : 500).json({
      error: error.code === '23503'
        ? 'The specified cart or product does not exist.'
        : 'Failed to create cart item',
    });
  }
});

// READ: Get all cart items. Filter a cart with ?cart_id=1.
app.get('/api/cart-items', async (req, res) => {
  try {
    const { cart_id } = req.query;

    if (cart_id && !isPositiveInteger(cart_id)) {
      return res.status(400).json({ error: 'cart_id must be a positive integer.' });
    }

    const items = await sql`
      SELECT id, cart_id, product_id, quantity, created_at, updated_at
      FROM cart_items
      WHERE (${cart_id || null}::bigint IS NULL OR cart_id = ${cart_id || null})
      ORDER BY created_at;
    `;

    res.status(200).json(items);
  } catch (error) {
    console.error('Error fetching cart items:', error);
    res.status(500).json({ error: 'Failed to fetch cart items' });
  }
});

// READ: Get one cart item by ID.
app.get('/api/cart-items/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!isPositiveInteger(id)) {
      return res.status(400).json({ error: 'Cart item id must be a positive integer.' });
    }

    const result = await sql`
      SELECT id, cart_id, product_id, quantity, created_at, updated_at
      FROM cart_items
      WHERE id = ${id};
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Cart item not found' });
    }

    res.status(200).json(result[0]);
  } catch (error) {
    console.error('Error fetching cart item:', error);
    res.status(500).json({ error: 'Failed to fetch cart item' });
  }
});

// UPDATE: Change a cart item's product or quantity.
app.put('/api/cart-items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { product_id, quantity } = req.body;

    if (!isPositiveInteger(id)) {
      return res.status(400).json({ error: 'Cart item id must be a positive integer.' });
    }

    if (product_id === undefined && quantity === undefined) {
      return res.status(400).json({
        error: 'product_id or quantity is required.',
      });
    }

    if (
      (product_id !== undefined && !isPositiveInteger(product_id)) ||
      (quantity !== undefined && !isPositiveInteger(quantity))
    ) {
      return res.status(400).json({
        error: 'product_id and quantity must be positive integers.',
      });
    }

    const result = await sql`
      UPDATE cart_items
      SET
        product_id = COALESCE(${product_id ?? null}, product_id),
        quantity = COALESCE(${quantity ?? null}, quantity),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *;
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Cart item not found' });
    }

    res.status(200).json({
      message: 'Cart item updated successfully',
      cart_item: result[0],
    });
  } catch (error) {
    console.error('Error updating cart item:', error);
    res.status(error.code === '23503' ? 400 : 500).json({
      error: error.code === '23503'
        ? 'The specified product does not exist.'
        : 'Failed to update cart item',
    });
  }
});

// DELETE: Remove one item from a cart.
app.delete('/api/cart-items/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!isPositiveInteger(id)) {
      return res.status(400).json({ error: 'Cart item id must be a positive integer.' });
    }

    const result = await sql`
      DELETE FROM cart_items
      WHERE id = ${id}
      RETURNING id;
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Cart item not found' });
    }

    res.status(200).json({
      message: 'Cart item deleted successfully',
      id: result[0].id,
    });
  } catch (error) {
    console.error('Error deleting cart item:', error);
    res.status(500).json({ error: 'Failed to delete cart item' });
  }
});

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Cart items server running on port ${PORT}`);
  });
}

export default app;
