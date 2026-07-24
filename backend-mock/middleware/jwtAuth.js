'use strict';
/**
 * jwtAuth.js — Socket.IO JWT Authentication Middleware
 *
 * Validates the JWT token supplied in socket.handshake.auth.token
 * against SUPABASE_JWT_SECRET. Populates socket.data.userId on success.
 * Rejects the connection with an error on failure.
 *
 * Usage:
 *   io.use(require('./middleware/jwtAuth'));
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET;

/**
 * @param {import('socket.io').Socket} socket
 * @param {Function} next
 */
function jwtAuthMiddleware(socket, next) {
  // Allow connections without JWT only in development when secret is absent
  if (!JWT_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      return next(new Error('AUTH_ERROR: SUPABASE_JWT_SECRET is not configured'));
    }
    // Dev-mode: accept token from auth object directly (no verification)
    const userId = socket.handshake.auth?.userId || socket.handshake.query?.userId;
    if (!userId) {
      return next(new Error('AUTH_ERROR: userId required in dev mode'));
    }
    socket.data.userId = userId;
    return next();
  }

  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('AUTH_ERROR: missing token'));
  }

  try {
    // Supabase JWTs use HS256 and embed the user ID in sub claim
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    const userId = decoded.sub;

    if (!userId) {
      return next(new Error('AUTH_ERROR: token missing sub claim'));
    }

    socket.data.userId = userId;
    socket.data.decoded = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new Error('AUTH_ERROR: token expired'));
    }
    if (err.name === 'JsonWebTokenError') {
      return next(new Error('AUTH_ERROR: invalid token'));
    }
    return next(new Error('AUTH_ERROR: ' + err.message));
  }
}

module.exports = jwtAuthMiddleware;
