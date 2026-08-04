import express from 'express';
import cors from 'cors';
import { neon } from '@neondatabase/serverless';
import { authenticateToken } from './authenticateToken.js';
import 'dotenv/config';

const app = express();
app.use(cors());
app.use(express.json());
app.use(authenticateToken);

// Initialize Neon SQL client using your database URL
const sql = neon(process.env.DATABASE_URL || process.env.POSTGRES_URL);

const isPositiveInteger = (value) =>
  Number.isSafeInteger(Number(value)) && Number(value) > 0;

// ==========================================
// 1. CREATE: Add a new category
// ==========================================
//Categories
app.post('/api/categories', async (req, res) => {
  try {
    const { name, slug } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ error: 'Name and slug are required.' });
    }

    if (name.length > 255 || slug.length > 255) {
      return res.status(400).json({ error: 'Name and slug must not exceed 255 characters.' });
    }

    // Execute Neon tag template query
    const result = await sql`
      INSERT INTO categories (
        name, 
        slug, 
        created_at
      )
      VALUES (
        ${name}, 
        ${slug}, 
        NOW()
      )
      RETURNING *;
    `;

    res.status(201).json({ message: 'Category created successfully', category: result[0] });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(error.code === '23505' ? 409 : 500).json({
      error: error.code === '23505' ? 'A category with this slug already exists.' : 'Failed to create category'
    });
  }
});

// ==========================================
// 2. READ: Get all categories
// ==========================================
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await sql`
      SELECT id, name, slug, created_at 
      FROM categories;
    `;
    res.status(200).json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// ==========================================
// 2b. READ: Get single category by ID
// ==========================================
app.get('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!isPositiveInteger(id)) {
      return res.status(400).json({ error: 'Category id must be a positive integer.' });
    }

    const result = await sql`
      SELECT id, name, slug, created_at 
      FROM categories 
      WHERE id = ${id};
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.status(200).json(result[0]);
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
});

// ==========================================
// 3. UPDATE: Update category by ID
// ==========================================
app.put('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug } = req.body;

    if (!isPositiveInteger(id)) {
      return res.status(400).json({ error: 'Category id must be a positive integer.' });
    }

    if ((name && name.length > 255) || (slug && slug.length > 255)) {
      return res.status(400).json({ error: 'Name and slug must not exceed 255 characters.' });
    }

    const result = await sql`
      UPDATE categories
      SET 
        name = COALESCE(${name}, name),
        slug = COALESCE(${slug}, slug)
      WHERE id = ${id}
      RETURNING *;
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.status(200).json({ message: 'Category updated successfully', category: result[0] });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(error.code === '23505' ? 409 : 500).json({
      error: error.code === '23505' ? 'A category with this slug already exists.' : 'Failed to update category'
    });
  }
});

// ==========================================
// 4. DELETE: Delete category by ID
// ==========================================
app.delete('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!isPositiveInteger(id)) {
      return res.status(400).json({ error: 'Category id must be a positive integer.' });
    }

    const result = await sql`
      DELETE FROM categories 
      WHERE id = ${id} 
      RETURNING id;
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.status(200).json({ message: 'Category deleted successfully', id: result[0].id });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(error.code === '23503' ? 409 : 500).json({
      error: error.code === '23503'
        ? 'This category still contains products.'
        : 'Failed to delete category'
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
