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
// 1. CREATE: Add a new product
// ==========================================
app.post('/api/products', async (req, res) => {
  try {
    const { 
      category_id, 
      sku, 
      title, 
      description, 
      unit_price, 
      image_url, 
      is_active 
    } = req.body;

    // Required fields check based on schema constraints
    if (!sku || !title || unit_price === undefined) {
      return res.status(400).json({ error: 'sku, title, and unit_price are required.' });
    }

    // Execute Neon tag template query
    const result = await sql`
      INSERT INTO products (
        category_id, 
        sku, 
        title, 
        description, 
        unit_price, 
        image_url, 
        is_active, 
        created_at, 
        updated_at
      )
      VALUES (
        ${category_id || null}, 
        ${sku}, 
        ${title}, 
        ${description || null}, 
        ${unit_price}, 
        ${image_url || null}, 
        ${is_active !== undefined ? is_active : true}, 
        NOW(), 
        NOW()
      )
      RETURNING *;
    `;

    res.status(201).json({ message: 'Product created successfully', product: result[0] });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// ==========================================
// 2. READ: Get all products
// ==========================================
app.get('/api/products', async (req, res) => {
  try {
    const products = await sql`
      SELECT id, category_id, sku, title, description, unit_price, image_url, is_active, created_at, updated_at 
      FROM products;
    `;
    res.status(200).json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// ==========================================
// 2b. READ: Get single product by ID
// ==========================================
app.get('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await sql`
      SELECT id, category_id, sku, title, description, unit_price, image_url, is_active, created_at, updated_at 
      FROM products 
      WHERE id = ${id};
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.status(200).json(result[0]);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// ==========================================
// 3. UPDATE: Update product by ID
// ==========================================
app.put('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      category_id, 
      sku, 
      title, 
      description, 
      unit_price, 
      image_url, 
      is_active 
    } = req.body;

    const result = await sql`
      UPDATE products
      SET 
        category_id = COALESCE(${category_id}, category_id),
        sku = COALESCE(${sku}, sku),
        title = COALESCE(${title}, title),
        description = COALESCE(${description}, description),
        unit_price = COALESCE(${unit_price}, unit_price),
        image_url = COALESCE(${image_url}, image_url),
        is_active = COALESCE(${is_active}, is_active),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *;
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.status(200).json({ message: 'Product updated successfully', product: result[0] });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// ==========================================
// 4. DELETE: Delete product by ID
// ==========================================
app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await sql`
      DELETE FROM products 
      WHERE id = ${id} 
      RETURNING id;
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.status(200).json({ message: 'Product deleted successfully', id: result[0].id });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product' });
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