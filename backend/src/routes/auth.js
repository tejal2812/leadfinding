const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const db = require('../utils/db');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const emailService = require('../services/emailService');
const logger = require('../utils/logger');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many auth attempts, please try again in 15 minutes.' },
});

const signToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// ── POST /api/auth/register ────────────────────────────────
router.post('/register', (req, res) => {
  res.status(403).json({ error: 'Registration is disabled. Please contact the administrator to request an account.' });
});

// ── POST /api/auth/login ───────────────────────────────────
router.post('/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;

    const { rows } = await db.query(
      'SELECT id, email, full_name, agency_name, plan, credits_total, credits_used, avatar_url, password_hash FROM users WHERE email = $1',
      [email]
    );

    if (!rows[0] || !await bcrypt.compare(password, rows[0].password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = rows[0];
    delete user.password_hash;

    await db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    const token = signToken(user.id);
    res.json({ token, user });
  })
);

// ── GET /api/auth/me ───────────────────────────────────────
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await db.query(`
    SELECT u.id, u.email, u.full_name, u.agency_name, u.plan, u.credits_total, u.credits_used,
           u.avatar_url, u.onboarded, u.email_verified, u.last_login_at, u.created_at,
           s.services_offered, s.default_from_name, s.default_reply_to, s.signature,
           s.notify_replies, s.notify_hot_leads, s.notify_weekly_report, s.notify_low_credits, s.timezone
    FROM users u
    LEFT JOIN user_settings s ON s.user_id = u.id
    WHERE u.id = $1
  `, [req.user.id]);

  res.json(rows[0]);
}));

// ── POST /api/auth/verify-email ───────────────────────────
router.post('/verify-email', asyncHandler(async (req, res) => {
  const { token } = req.body;
  const { rows } = await db.query(
    'UPDATE users SET email_verified = TRUE, email_verification_token = NULL WHERE email_verification_token = $1 RETURNING id',
    [token]
  );
  if (!rows[0]) return res.status(400).json({ error: 'Invalid or expired verification token' });
  res.json({ message: 'Email verified successfully' });
}));

// ── POST /api/auth/forgot-password ────────────────────────
router.post('/forgot-password', authLimiter, asyncHandler(async (req, res) => {
  const { email } = req.body;
  const resetToken = uuidv4();
  const expires = new Date(Date.now() + 3600000); // 1 hour

  await db.query(
    'UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE email = $3',
    [resetToken, expires, email]
  );

  // Always return success to prevent email enumeration
  emailService.sendPasswordReset(email, resetToken).catch(logger.error);
  res.json({ message: 'If that email is registered, you will receive a reset link.' });
}));

// ── POST /api/auth/reset-password ─────────────────────────
router.post('/reset-password', asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  const { rows } = await db.query(
    'SELECT id FROM users WHERE password_reset_token = $1 AND password_reset_expires > NOW()',
    [token]
  );
  if (!rows[0]) return res.status(400).json({ error: 'Invalid or expired reset token' });

  const password_hash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);
  await db.query(
    'UPDATE users SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL WHERE id = $2',
    [password_hash, rows[0].id]
  );
  res.json({ message: 'Password reset successfully' });
}));

module.exports = router;
