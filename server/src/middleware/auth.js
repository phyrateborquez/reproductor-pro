const crypto = require('crypto');
const config = require('../config');

/**
 * Compara la contraseña ingresada contra la configurada usando
 * timingSafeEqual — previene Timing Attacks (ataques de temporización).
 */
function verifyPassword(input) {
  if (!input || !config.adminPassword) return false;
  const inputHash    = crypto.createHash('sha256').update(input).digest();
  const expectedHash = crypto.createHash('sha256').update(config.adminPassword).digest();
  return crypto.timingSafeEqual(inputHash, expectedHash);
}

/**
 * Middleware: protege rutas que requieren sesión de admin activa.
 * La sesión se establece en POST /api/auth/login via Cookie HttpOnly.
 * Ya no se usa X-Admin-Password como header (era inseguro via sessionStorage).
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin === true) {
    return next();
  }
  console.warn('[auth] Intento no autorizado desde', req.ip);
  return res.status(401).json({ error: 'No autorizado' });
}

module.exports = { requireAuth, verifyPassword };
