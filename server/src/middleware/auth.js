const crypto = require('crypto');
const config = require('../config');

/**
 * Verify admin password using constant-time comparison to prevent timing attacks.
 */
function verifyPassword(input) {
  if (!config.adminPassword) {
    return false;
  }
  const inputHash = crypto.createHash('sha256').update(input).digest();
  const expectedHash = crypto.createHash('sha256').update(config.adminPassword).digest();
  return crypto.timingSafeEqual(inputHash, expectedHash);
}

/**
 * Express middleware that checks X-Admin-Password header.
 */
function requireAuth(req, res, next) {
  const password = req.headers['x-admin-password'];

  if (!password || !verifyPassword(password)) {
    console.warn('[auth] Failed admin auth attempt from', req.ip);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

module.exports = { requireAuth, verifyPassword };
