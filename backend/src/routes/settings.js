const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../utils/db');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();
router.use(authenticate);

// ── PATCH /api/settings/profile ────────────────────────────
router.patch('/profile', asyncHandler(async (req, res) => {
  const { full_name, agency_name, phone, avatar_url } = req.body;
  const { rows } = await db.query(`
    UPDATE users SET
      full_name = COALESCE($2, full_name),
      agency_name = COALESCE($3, agency_name),
      phone = COALESCE($4, phone),
      avatar_url = COALESCE($5, avatar_url)
    WHERE id = $1 RETURNING id, email, full_name, agency_name, phone, avatar_url
  `, [req.user.id, full_name, agency_name, phone, avatar_url]);
  res.json(rows[0]);
}));

// ── PATCH /api/settings/preferences ────────────────────────
router.patch('/preferences', asyncHandler(async (req, res) => {
  const {
    services_offered, default_from_name, default_reply_to, signature,
    notify_replies, notify_hot_leads, notify_weekly_report, notify_low_credits, timezone,
  } = req.body;

  const { rows } = await db.query(`
    UPDATE user_settings SET
      services_offered = COALESCE($2, services_offered),
      default_from_name = COALESCE($3, default_from_name),
      default_reply_to = COALESCE($4, default_reply_to),
      signature = COALESCE($5, signature),
      notify_replies = COALESCE($6, notify_replies),
      notify_hot_leads = COALESCE($7, notify_hot_leads),
      notify_weekly_report = COALESCE($8, notify_weekly_report),
      notify_low_credits = COALESCE($9, notify_low_credits),
      timezone = COALESCE($10, timezone)
    WHERE user_id = $1 RETURNING *
  `, [req.user.id, services_offered, default_from_name, default_reply_to, signature,
      notify_replies, notify_hot_leads, notify_weekly_report, notify_low_credits, timezone]);

  res.json(rows[0]);
}));

// ── POST /api/settings/change-password ─────────────────────
router.post('/change-password', asyncHandler(async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!new_password || new_password.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  const { rows } = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
  const valid = await bcrypt.compare(current_password, rows[0].password_hash);
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

  const password_hash = await bcrypt.hash(new_password, parseInt(process.env.BCRYPT_ROUNDS) || 12);
  await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [password_hash, req.user.id]);

  res.json({ message: 'Password updated successfully' });
}));

module.exports = router;
