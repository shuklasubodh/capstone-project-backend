import express from 'express';
import cors from 'cors';
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const app = express();
app.use(cors());
app.use(express.json());

const sql = neon(process.env.DATABASE_URL || process.env.POSTGRES_URL);

// CREATE Order (Supports member & guest checkout via nullable user_id)
app.post('/api/orders', async (req, res) => {
    try {
        const {
            user_id, order_number, confirmation_token, customer_type,
            customer_name, customer_email, customer_phone, shipping_address,
            subtotal, discount_amount, total, status
        } = req.body;

        if (!order_number || !confirmation_token || !customer_type) {
            return res.status(400).json({ error: 'order_number, confirmation_token, and customer_type are required.' });
        }

        const result = await sql`
      INSERT INTO orders (
        user_id, order_number, confirmation_token, customer_type, 
        customer_name, customer_email, customer_phone, shipping_address, 
        subtotal, discount_amount, total, status, created_at
      )
      VALUES (
        ${user_id || null}, ${order_number}, ${confirmation_token}, ${customer_type}, 
        ${customer_name || null}, ${customer_email || null}, ${customer_phone || null}, 
        ${shipping_address || null}, ${subtotal || 0}, ${discount_amount || 0}, 
        ${total || 0}, ${status || 'pending'}, NOW()
      )
      RETURNING *;
    `;

        res.status(201).json({ message: 'Order created successfully', order: result[0] });
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ error: 'Failed to create order' });
    }
});

// READ All Orders
app.get('/api/orders', async (req, res) => {
    try {
        const orders = await sql`SELECT * FROM orders;`;
        res.status(200).json(orders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// READ Single Order
app.get('/api/orders/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await sql`SELECT * FROM orders WHERE id = ${id};`;

        if (result.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.status(200).json(result[0]);
    } catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({ error: 'Failed to fetch order' });
    }
});

// UPDATE Order Status or Details
app.put('/api/orders/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, shipping_address, total } = req.body;

        const result = await sql`
      UPDATE orders
      SET 
        status = COALESCE(${status}, status),
        shipping_address = COALESCE(${shipping_address}, shipping_address),
        total = COALESCE(${total}, total)
      WHERE id = ${id}
      RETURNING *;
    `;

        if (result.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.status(200).json({ message: 'Order updated successfully', order: result[0] });
    } catch (error) {
        console.error('Error updating order:', error);
        res.status(500).json({ error: 'Failed to update order' });
    }
});

// DELETE Order
app.delete('/api/orders/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await sql`DELETE FROM orders WHERE id = ${id} RETURNING id;`;

        if (result.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.status(200).json({ message: 'Order deleted successfully', id: result[0].id });
    } catch (error) {
        console.error('Error deleting order:', error);
        res.status(500).json({ error: 'Failed to delete order' });
    }
});

if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Orders service running on port ${PORT}`));
}

export default app;