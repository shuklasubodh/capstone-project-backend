import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import { neon } from '@neondatabase/serverless';
import { authenticateToken } from './authenticateToken.js';
import { authorizeAdmin } from './authorizeAdmin.js';
import { normalizeMembershipTier } from './membershipTier.js';
import 'dotenv/config';

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Neon SQL client using your database URL
const sql = neon(process.env.DATABASE_URL || process.env.POSTGRES_URL);

const isPositiveInteger = (value) =>
  Number.isSafeInteger(Number(value)) && Number(value) > 0;

const isValidPassword = (value) =>
  typeof value === 'string' && value.length >= 8 && Buffer.byteLength(value, 'utf8') <= 72;

const saltRounds = (() => {
  const configured = Number(process.env.BCRYPT_SALT_ROUNDS || 12);
  return Number.isInteger(configured) && configured >= 10 && configured <= 14
    ? configured
    : 12;
})();

// ==========================================
// 1. CREATE: Add a new user
// ==========================================
app.post('/api/users', async (req, res) => {
  try {
    const { 
      full_name, 
      email, 
      password,
      membership_tier, 
      discount_percentage,
      is_admin
    } = req.body;

    if (!full_name || !email || !password || !membership_tier) {
      return res.status(400).json({
        error: 'full_name, email, password, and membership_tier are required.'
      });
    }

    if (typeof membership_tier !== 'string') {
      return res.status(400).json({ error: 'membership_tier must be a string.' });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({
        error: 'password must be at least 8 characters and at most 72 UTF-8 bytes.',
      });
    }

    if (is_admin !== undefined && typeof is_admin !== 'boolean') {
      return res.status(400).json({ error: 'is_admin must be a boolean.' });
    }

    if (
      full_name.length > 255 ||
      email.length > 255 ||
      membership_tier.length > 50
    ) {
      return res.status(400).json({ error: 'One or more user fields exceed the schema limits.' });
    }

    if (
      discount_percentage != null &&
      (!Number.isFinite(Number(discount_percentage)) ||
        Number(discount_percentage) < 0 ||
        Number(discount_percentage) > 100)
    ) {
      return res.status(400).json({ error: 'discount_percentage must be between 0 and 100.' });
    }

    const passwordHash = await bcrypt.hash(password, saltRounds);
    const normalizedMembershipTier = normalizeMembershipTier(membership_tier);

    // Execute Neon tag template query
    const result = await sql`
      INSERT INTO users (
        full_name, 
        email, 
        password_hash, 
        membership_tier, 
        discount_percentage,
        is_admin,
        created_at, 
        updated_at
      )
      VALUES (
        ${full_name}, 
        ${email}, 
        ${passwordHash},
        ${normalizedMembershipTier},
        ${discount_percentage ?? null},
        ${is_admin ?? false},
        NOW(), 
        NOW()
      )
      RETURNING id, full_name, email, membership_tier, discount_percentage, is_admin, created_at, updated_at;
    `;

    res.status(201).json({ message: 'User created successfully', user: result[0] });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(error.code === '23505' ? 409 : 500).json({
      error: error.code === '23505' ? 'A user with this email already exists.' : 'Failed to create user'
    });
  }
});

// Every user-management endpoint below registration requires an administrator JWT.
app.use(authenticateToken, authorizeAdmin);

// ==========================================
// 2. READ: Get all users
// ==========================================
app.get('/api/users', async (req, res) => {
  try {
    const users = await sql`
      SELECT id, full_name, email, membership_tier, discount_percentage, is_admin, created_at, updated_at
      FROM users;
    `;
    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ==========================================
// 2b. READ: Get single user by ID
// ==========================================
app.get('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!isPositiveInteger(id)) {
      return res.status(400).json({ error: 'User id must be a positive integer.' });
    }

    const result = await sql`
      SELECT id, full_name, email, membership_tier, discount_percentage, is_admin, created_at, updated_at
      FROM users
      WHERE id = ${id};
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json(result[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ==========================================
// 3. UPDATE: Update user by ID
// ==========================================
app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      full_name, 
      email, 
      password,
      membership_tier, 
      discount_percentage,
      is_admin
    } = req.body;

    if (!isPositiveInteger(id)) {
      return res.status(400).json({ error: 'User id must be a positive integer.' });
    }

    if (is_admin !== undefined && typeof is_admin !== 'boolean') {
      return res.status(400).json({ error: 'is_admin must be a boolean.' });
    }

    if (membership_tier !== undefined && typeof membership_tier !== 'string') {
      return res.status(400).json({ error: 'membership_tier must be a string.' });
    }

    if (password !== undefined && !isValidPassword(password)) {
      return res.status(400).json({
        error: 'password must be at least 8 characters and at most 72 UTF-8 bytes.',
      });
    }

    if (
      discount_percentage !== undefined &&
      (!Number.isFinite(Number(discount_percentage)) ||
        Number(discount_percentage) < 0 ||
        Number(discount_percentage) > 100)
    ) {
      return res.status(400).json({ error: 'discount_percentage must be between 0 and 100.' });
    }

    const passwordHash = password === undefined
      ? null
      : await bcrypt.hash(password, saltRounds);
    const normalizedMembershipTier = membership_tier === undefined
      ? null
      : normalizeMembershipTier(membership_tier);

    const result = await sql`
      UPDATE users
      SET 
        full_name = COALESCE(${full_name}, full_name),
        email = COALESCE(${email}, email),
        password_hash = COALESCE(${passwordHash}, password_hash),
        membership_tier = COALESCE(${normalizedMembershipTier}, membership_tier),
        discount_percentage = COALESCE(${discount_percentage}, discount_percentage),
        is_admin = COALESCE(${is_admin}, is_admin),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, full_name, email, membership_tier, discount_percentage, is_admin, created_at, updated_at;
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({ message: 'User updated successfully', user: result[0] });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(error.code === '23505' ? 409 : 500).json({
      error: error.code === '23505' ? 'A user with this email already exists.' : 'Failed to update user'
    });
  }
});

// ==========================================
// 4. DELETE: Delete user by ID
// ==========================================
app.delete('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!isPositiveInteger(id)) {
      return res.status(400).json({ error: 'User id must be a positive integer.' });
    }

    const result = await sql`
      DELETE FROM users 
      WHERE id = ${id} 
      RETURNING id;
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({ message: 'User deleted successfully', id: result[0].id });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(error.code === '23503' ? 409 : 500).json({
      error: error.code === '23503'
        ? 'This user is still referenced by a cart or order.'
        : 'Failed to delete user'
    });
  }
});

// Start Server locally
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}


export default app;
