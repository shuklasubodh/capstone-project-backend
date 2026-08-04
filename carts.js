import express from 'express';
import cors from 'cors';
import { neon } from '@neondatabase/serverless';
import { authenticateToken } from './authenticateToken.js';
import 'dotenv/config';

const app = express();
app.use(cors());
app.use(express.json());
app.use(authenticateToken);

const sql = neon(process.env.DATABASE_URL || process.env.POSTGRES_URL);

const isPositiveInteger = (value) =>
  Number.isSafeInteger(Number(value)) && Number(value) > 0;

const isValidSessionToken = (value) =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  value.length <= 255;

// CREATE: Add a cart for either a registered user or a guest session.
app.post('/api/carts', async (req, res) => {
  try {
    const { user_id, session_token } = req.body;

    if (!user_id && !session_token) {
      return res.status(400).json({
        error: 'Either user_id or session_token is required.',
      });
    }

    if (user_id && session_token) {
      return res.status(400).json({
        error: 'Provide user_id or session_token, not both.',
      });
    }

    if (user_id && !isPositiveInteger(user_id)) {
      return res.status(400).json({ error: 'user_id must be a positive integer.' });
    }

    if (session_token && !isValidSessionToken(session_token)) {
      return res.status(400).json({
        error: 'session_token must be a non-empty string of at most 255 characters.',
      });
    }

    const result = await sql`
      INSERT INTO carts (user_id, session_token, created_at, updated_at)
      VALUES (${user_id || null}, ${session_token || null}, NOW(), NOW())
      RETURNING *;
    `;

    res.status(201).json({
      message: 'Cart created successfully',
      cart: result[0],
    });
  } catch (error) {
    console.error('Error creating cart:', error);
    res.status(error.code === '23503' ? 400 : 500).json({
      error: error.code === '23503' ? 'The specified user does not exist.' : 'Failed to create cart',
    });
  }
});

// READ: Get all carts. Optional filters: ?user_id=1 or ?session_token=abc.
app.get('/api/carts', async (req, res) => {
  try {
    const { user_id, session_token } = req.query;

    if (user_id && !isPositiveInteger(user_id)) {
      return res.status(400).json({ error: 'user_id must be a positive integer.' });
    }

    if (session_token && !isValidSessionToken(session_token)) {
      return res.status(400).json({
        error: 'session_token must be a non-empty string of at most 255 characters.',
      });
    }

    const carts = await sql`
      SELECT id, user_id, session_token, created_at, updated_at
      FROM carts
      WHERE (${user_id || null}::bigint IS NULL OR user_id = ${user_id || null})
        AND (${session_token || null}::varchar IS NULL OR session_token = ${session_token || null})
      ORDER BY created_at DESC;
    `;

    res.status(200).json(carts);
  } catch (error) {
    console.error('Error fetching carts:', error);
    res.status(500).json({ error: 'Failed to fetch carts' });
  }
});

// READ: Get one cart and its current items.
app.get('/api/carts/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!isPositiveInteger(id)) {
      return res.status(400).json({ error: 'Cart id must be a positive integer.' });
    }

    const carts = await sql`
      SELECT id, user_id, session_token, created_at, updated_at
      FROM carts
      WHERE id = ${id};
    `;

    if (carts.length === 0) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    const items = await sql`
      SELECT
        ci.id,
        ci.cart_id,
        ci.product_id,
        ci.quantity,
        ci.created_at,
        ci.updated_at
      FROM cart_items ci
      WHERE ci.cart_id = ${id}
      ORDER BY ci.created_at;
    `;

    res.status(200).json({ ...carts[0], items });
  } catch (error) {
    console.error('Error fetching cart:', error);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

// UPDATE: Change the registered user or guest session associated with a cart.
app.put('/api/carts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, session_token } = req.body;

    if (!isPositiveInteger(id)) {
      return res.status(400).json({ error: 'Cart id must be a positive integer.' });
    }

    if (user_id === undefined && session_token === undefined) {
      return res.status(400).json({
        error: 'user_id or session_token is required.',
      });
    }

    if (user_id != null && !isPositiveInteger(user_id)) {
      return res.status(400).json({ error: 'user_id must be a positive integer.' });
    }

    if (session_token != null && !isValidSessionToken(session_token)) {
      return res.status(400).json({
        error: 'session_token must be a non-empty string of at most 255 characters.',
      });
    }

    const current = await sql`
      SELECT user_id, session_token
      FROM carts
      WHERE id = ${id};
    `;

    if (current.length === 0) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    const nextUserId =
      user_id !== undefined ? user_id : current[0].user_id;
    const nextSessionToken =
      session_token !== undefined
        ? session_token
        : current[0].session_token;

    if (
      (!nextUserId && !nextSessionToken) ||
      (nextUserId && nextSessionToken)
    ) {
      return res.status(400).json({
        error: 'A cart must have either user_id or session_token, but not both.',
      });
    }

    const result = await sql`
      UPDATE carts
      SET
        user_id = ${nextUserId || null},
        session_token = ${nextSessionToken || null},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *;
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    res.status(200).json({
      message: 'Cart updated successfully',
      cart: result[0],
    });
  } catch (error) {
    console.error('Error updating cart:', error);
    res.status(error.code === '23503' ? 400 : 500).json({
      error: error.code === '23503' ? 'The specified user does not exist.' : 'Failed to update cart',
    });
  }
});

// DELETE: Delete a cart.
app.delete('/api/carts/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!isPositiveInteger(id)) {
      return res.status(400).json({ error: 'Cart id must be a positive integer.' });
    }

    const result = await sql`
      DELETE FROM carts
      WHERE id = ${id}
      RETURNING id;
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    res.status(200).json({
      message: 'Cart deleted successfully',
      id: result[0].id,
    });
  } catch (error) {
    console.error('Error deleting cart:', error);
    res.status(error.code === '23503' ? 409 : 500).json({
      error: error.code === '23503'
        ? 'Delete the cart items before deleting this cart.'
        : 'Failed to delete cart',
    });
  }
});

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Carts server running on port ${PORT}`);
  });
}

export default app;
