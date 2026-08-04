import jwt from 'jsonwebtoken';

export const authenticateToken = (req, res, next) => {
  const authorization = req.get('authorization');

  if (!authorization) {
    return res.status(401).json({ error: 'Authorization token is required.' });
  }

  const [scheme, token, ...extraParts] = authorization.trim().split(/\s+/);

  if (scheme?.toLowerCase() !== 'bearer' || !token || extraParts.length > 0) {
    return res.status(401).json({
      error: 'Authorization header must use the Bearer token scheme.',
    });
  }

  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not configured.');
    return res.status(500).json({ error: 'Authentication service is not configured.' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
    });
    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({ error: 'Token expired.' });
    }

    return res.status(403).json({ error: 'Invalid token.' });
  }
};

export default authenticateToken;
