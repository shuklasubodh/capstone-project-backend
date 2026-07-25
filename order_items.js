import express from 'express';
import cors from 'cors';
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const app = express();
app.use(cors());
app.use(express.json());

const sql = neon(process.env.DATABASE_URL || process.env.POSTGRES_URL);

// CREATE Order Item (Stores historical snapshot of product name, SKU, and unit price)
app.post('/api/order-items', async (req, res) => {
    try {
        const { order_id, product_id, sku, product_name, unit_price, quantity, line_total } = req.body;

        if (!order_id || !product_id || !sku || !product_name || unit_price === undefined || !quantity) {
            return res.status(400).json({ error: 'order_id, product_id, sku, product_name, unit_price, and quantity are required.' });
        }

        const calculatedLineTotal = line_total ?? (unit_price * quantity);

        const result = await sql`
            INSERT INTO order_items (
                order_id, product_id, sku, product_name, unit_price, quantity, line_total
            )
            VALUES (
                ${order_id}, ${product_id}, ${sku}, ${product_name}, ${unit_price}, ${quantity}, ${calculatedLineTotal}
            )
            RETURNING *;
        `;

        res.status(201).json({ message: 'Order item added successfully', order_item: result[0] });
    } catch (error) {
        console.error('Error adding order item:', error);
        res.status(500).json({ error: 'Failed to add order item' });
    }
});

// READ All Order Items
app.get('/api/order-items', async (req, res) => {
    try {
        const items = await sql`SELECT * FROM order_items;`;
        res.status(200).json(items);
    } catch (error) {
        console.error('Error fetching all order items:', error);
        res.status(500).json({ error: 'Failed to fetch order items' });
    }
});

// READ Order Items by Order ID
app.get('/api/order-items/order/:order_id', async (req, res) => {
    try {
        const { order_id } = req.params;
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