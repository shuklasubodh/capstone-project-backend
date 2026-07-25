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

const databaseError = (error, fallback) => {
    if (error.code === '23503') {
        return { status: 400, message: 'The specified user does not exist.' };
    }
    if (error.code === '23505') {
        return { status: 409, message: 'The order code or authentication token already exists.' };
    }
    return { status: 500, message: fallback };
};

// CREATE Order (Supports member & guest checkout via nullable user_id)
app.post('/api/orders', async (req, res) => {
    try {
        const {
            user_id, order_code, auth_token, customer_type,
            customer_name, customer_email, customer_phone, shipping_address,
            subtotal_amount, discount_amount, total_amount, status
        } = req.body;

        if (!order_code || !auth_token || !customer_type) {
            return res.status(400).json({
                error: 'order_code, auth_token, and customer_type are required.'
            });
        }

        if (user_id != null && !isPositiveInteger(user_id)) {
            return res.status(400).json({ error: 'user_id must be a positive integer.' });
        }

        if (
            typeof order_code !== 'string' || order_code.length > 100 ||
            typeof auth_token !== 'string' || auth_token.length > 255 ||
            typeof customer_type !== 'string' || customer_type.length > 50
        ) {
            return res.status(400).json({ error: 'One or more order fields exceed the schema limits.' });
        }

        if (
            !isNonNegativeMoney(subtotal_amount ?? 0) ||
            !isNonNegativeMoney(discount_amount ?? 0) ||
            !isNonNegativeMoney(total_amount ?? 0)
        ) {
            return res.status(400).json({ error: 'Order amounts must be valid non-negative monetary values.' });
        }

        const result = await sql`
	      INSERT INTO orders (
	        user_id, order_code, auth_token, customer_type,
	        customer_name, customer_email, customer_phone, shipping_address,
	        subtotal_amount, discount_amount, total_amount, status, created_at
	      )
	      VALUES (
	        ${user_id || null}, ${order_code}, ${auth_token}, ${customer_type},
	        ${customer_name || null}, ${customer_email || null}, ${customer_phone || null},
	        ${shipping_address || null}, ${subtotal_amount ?? 0}, ${discount_amount ?? 0},
	        ${total_amount ?? 0}, ${status || 'pending'}, NOW()
	      )
      RETURNING *;
    `;

        res.status(201).json({ message: 'Order created successfully', order: result[0] });
    } catch (error) {
        console.error('Error creating order:', error);
        const response = databaseError(error, 'Failed to create order');
        res.status(response.status).json({ error: response.message });
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

        if (!isPositiveInteger(id)) {
            return res.status(400).json({ error: 'Order id must be a positive integer.' });
        }

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
        const { status, shipping_address, total_amount } = req.body;

        if (!isPositiveInteger(id)) {
            return res.status(400).json({ error: 'Order id must be a positive integer.' });
        }

        if (total_amount !== undefined && !isNonNegativeMoney(total_amount)) {
            return res.status(400).json({ error: 'total_amount must be a valid non-negative monetary value.' });
        }

        const result = await sql`
      UPDATE orders
      SET 
	        status = COALESCE(${status}, status),
	        shipping_address = COALESCE(${shipping_address}, shipping_address),
	        total_amount = COALESCE(${total_amount}, total_amount)
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

        if (!isPositiveInteger(id)) {
            return res.status(400).json({ error: 'Order id must be a positive integer.' });
        }

        const result = await sql`DELETE FROM orders WHERE id = ${id} RETURNING id;`;

        if (result.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.status(200).json({ message: 'Order deleted successfully', id: result[0].id });
    } catch (error) {
        console.error('Error deleting order:', error);
        res.status(error.code === '23503' ? 409 : 500).json({
            error: error.code === '23503'
                ? 'Delete the order items before deleting this order.'
                : 'Failed to delete order'
        });
    }
});

if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Orders service running on port ${PORT}`));
}

export default app;
