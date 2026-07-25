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
// 1. CREATE: Add a new category
// ==========================================
app.post('/api/categories', async (req, res) => {
  try {
    const { name, slug } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ error: 'Name and slug are required.' });
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
    res.status(500).json({ error: 'Failed to create category' });
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
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// ==========================================
// 4. DELETE: Delete category by ID
// ==========================================
app.delete('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;

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
    res.status(500).json({ error: 'Failed to delete category' });
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