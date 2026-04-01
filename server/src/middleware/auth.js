const jwt = require('jsonwebtoken');
const { User } = require('../models');

const getJwtSecret = () => {
  return process.env.JWT_SECRET || 'dev-secret-not-for-production';
};

// Default user cache (avoid repeated DB lookups)
let _defaultUser = null;

const getOrCreateDefaultUser = async () => {
  if (_defaultUser) return _defaultUser;

  let user = await User.findOne({ username: 'default' });
  if (!user) {
    user = await User.create({
      username: 'default',
      email: 'default@wealthos.local',
      password: 'wealthos-default-' + Math.random().toString(36).slice(2),
    });
    console.log('[auth] Default user created:', user._id);
  }

  _defaultUser = user;
  return user;
};

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      // Single-user mode: auto-attach default user
      req.user = await getOrCreateDefaultUser();
      return next();
    }

    const decoded = jwt.verify(token, getJwtSecret());
    const user = await User.findById(decoded.id);

    if (!user) {
      req.user = await getOrCreateDefaultUser();
      return next();
    }

    req.user = user;
    next();
  } catch (error) {
    // On any token error, fall back to default user
    try {
      req.user = await getOrCreateDefaultUser();
      next();
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'Server error during authentication' });
    }
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (token) {
      const decoded = jwt.verify(token, getJwtSecret());
      const user = await User.findById(decoded.id);
      if (user) req.user = user;
    }
    next();
  } catch (error) {
    next();
  }
};

module.exports = { auth, optionalAuth };
