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

export default app;