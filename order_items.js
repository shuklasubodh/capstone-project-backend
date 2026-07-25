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

const isNonNegativeMoney = (value) => {
    const amount = Number(value);
    return Number.isFinite(amount) && amount >= 0 && amount <= 9999999999.99;
};

// CREATE Order Item (Stores historical snapshot of product name, SKU, and unit price)
app.post('/api/order-items', async (req, res) => {
    try {
        const { order_id, product_id, sku, product_title, unit_price, quantity, subtotal } = req.body;

        if (!order_id || !product_id || !sku || !product_title || unit_price === undefined || !quantity) {
            return res.status(400).json({
                error: 'order_id, product_id, sku, product_title, unit_price, and quantity are required.'
            });
        }

        if (
            !isPositiveInteger(order_id) ||
            !isPositiveInteger(product_id) ||
            !isPositiveInteger(quantity)
        ) {
            return res.status(400).json({
                error: 'order_id, product_id, and quantity must be positive integers.'
            });
        }

        if (!isNonNegativeMoney(unit_price)) {
            return res.status(400).json({ error: 'unit_price must be a valid non-negative monetary value.' });
        }

        if (
            typeof sku !== 'string' || sku.length > 100 ||
            typeof product_title !== 'string' || product_title.length > 255
        ) {
            return res.status(400).json({ error: 'sku or product_title exceeds the schema limit.' });
        }

        const calculatedSubtotal = subtotal ?? (
            Math.round(Number(unit_price) * Number(quantity) * 100) / 100
        );

        if (!isNonNegativeMoney(calculatedSubtotal)) {
            return res.status(400).json({ error: 'subtotal must be a valid non-negative monetary value.' });
        }

        const result = await sql`
	      INSERT INTO order_items (
	        order_id, product_id, sku, product_title, unit_price, quantity, subtotal
	      )
	      VALUES (
	        ${order_id}, ${product_id}, ${sku}, ${product_title}, ${unit_price}, ${quantity}, ${calculatedSubtotal}
	      )
      RETURNING *;
    `;

        res.status(201).json({ message: 'Order item added successfully', order_item: result[0] });
    } catch (error) {
        console.error('Error adding order item:', error);
        res.status(error.code === '23503' ? 400 : 500).json({
            error: error.code === '23503'
                ? 'The specified order or product does not exist.'
                : 'Failed to add order item'
        });
    }
});

// READ Order Items by Order ID
app.get('/api/order-items/order/:order_id', async (req, res) => {
    try {
        const { order_id } = req.params;

        if (!isPositiveInteger(order_id)) {
            return res.status(400).json({ error: 'order_id must be a positive integer.' });
        }

        const items = await sql`SELECT * FROM order_items WHERE order_id = ${order_id};`;
        res.status(200).json(items);
    } catch (error) {
        console.error('Error fetching order items:', error);
        res.status(500).json({ error: 'Failed to fetch order items' });
    }
});

// DELETE Order Item
app.delete('/api/order-items/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (!isPositiveInteger(id)) {
            return res.status(400).json({ error: 'Order item id must be a positive integer.' });
        }

        const result = await sql`DELETE FROM order_items WHERE id = ${id} RETURNING id;`;

        if (result.length === 0) {
            return res.status(404).json({ error: 'Order item not found' });
        }

        res.status(200).json({ message: 'Order item deleted successfully', id: result[0].id });
    } catch (error) {
        console.error('Error deleting order item:', error);
        res.status(500).json({ error: 'Failed to delete order item' });
    }
});

if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Order Items service running on port ${PORT}`));
}

export default app;
