const jwt = require('jsonwebtoken');

// Generate a secure fallback for development only
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be set in production environment');
    }
    // Development fallback - generate a random secret
    console.warn('WARNING: Using development JWT secret. Set JWT_SECRET for production!');
    return 'dev-secret-do-not-use-in-production-' + Date.now();
  }
  return secret;
};

const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

const verifyToken = (token) => {
  return jwt.verify(token, getJwtSecret());
};

module.exports = {
  generateToken,
  verifyToken
};
