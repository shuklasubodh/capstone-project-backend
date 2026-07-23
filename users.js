import express from 'express';
import cors from 'cors';
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Neon SQL client using your database URL
const sql = neon(process.env.DATABASE_URL || process.env.POSTGRES_URL);

// ==========================================
// 1. CREATE: Add a new user
// ==========================================
app.post('/api/users', async (req, res) => {
  try {
    const { 
      full_name, 
      email, 
      password_hash, 
      membership_tier, 
      discount_percentage 
    } = req.body;

    if (!full_name || !email || !password_hash) {
      return res.status(400).json({ error: 'full_name, email, and password_hash are required.' });
    }

    // Execute Neon tag template query
    const result = await sql`
      INSERT INTO users (
        full_name, 
        email, 
        password_hash, 
        membership_tier, 
        discount_percentage, 
        created_at, 
        updated_at
      )
      VALUES (
        ${full_name}, 
        ${email}, 
        ${password_hash}, 
        ${membership_tier || null}, 
        ${discount_percentage || null}, 
        NOW(), 
        NOW()
      )
      RETURNING *;
    `;

    res.status(201).json({ message: 'User created successfully', user: result[0] });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// ==========================================
// 2. READ: Get all users
// ==========================================
app.get('/api/users', async (req, res) => {
  try {
    const users = await sql`
      SELECT id, full_name, email, membership_tier, discount_percentage, created_at, updated_at 
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
    const result = await sql`
      SELECT id, full_name, email, membership_tier, discount_percentage, created_at, updated_at 
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
      password_hash, 
      membership_tier, 
      discount_percentage 
    } = req.body;

    const result = await sql`
      UPDATE users
      SET 
        full_name = COALESCE(${full_name}, full_name),
        email = COALESCE(${email}, email),
        password_hash = COALESCE(${password_hash}, password_hash),
        membership_tier = COALESCE(${membership_tier}, membership_tier),
        discount_percentage = COALESCE(${discount_percentage}, discount_percentage),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *;
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({ message: 'User updated successfully', user: result[0] });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// ==========================================
// 4. DELETE: Delete user by ID
// ==========================================
app.delete('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

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
    res.status(500).json({ error: 'Failed to delete user' });
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