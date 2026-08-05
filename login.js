import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const app = express();
app.use(cors());
app.use(express.json());

const sql = neon(process.env.DATABASE_URL || process.env.POSTGRES_URL);
const dummyPasswordHash = '$2b$12$LDsiy0OXSfQuIs/5flWBrO8Z9sN7//OAtZrs/v5sGeTxYM5h2RwGO';

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      return res.status(400).json({ error: 'email and password are required.' });
    }

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not configured.');
      return res.status(500).json({ error: 'Authentication service is not configured.' });
    }

    const result = await sql`
      SELECT id, full_name, email, password_hash, membership_tier, discount_percentage, is_admin
      FROM users
      WHERE LOWER(email) = LOWER(${email.trim()})
      LIMIT 1;
    `;

    const user = result[0];
    const passwordHash = typeof user?.password_hash === 'string'
      ? user.password_hash
      : dummyPasswordHash;
    const passwordMatches = await bcrypt.compare(password, passwordHash);

    if (!user || !passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const expiresIn = process.env.JWT_EXPIRES_IN || '1h';
    const token = jwt.sign(
      {
        id: user.id,
        name: user.full_name,
        email: user.email,
        membership_tier: user.membership_tier,
        is_admin: user.is_admin,
      },
      process.env.JWT_SECRET,
      { algorithm: 'HS256', expiresIn },
    );

    return res.status(200).json({
      message: 'Login successful',
      token,
      expires_in: expiresIn,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        membership_tier: user.membership_tier,
        discount_percentage: user.discount_percentage,
        is_admin: user.is_admin,
      },
    });
  } catch (error) {
    console.error('Error logging in:', error);
    return res.status(500).json({ error: 'Failed to log in' });
  }
});

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Login server running on port ${PORT}`);
  });
}

export default app;
