const express = require('express');
const db = require('../utils/db');
const { authenticate, requireCredits, deductCredits } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { generatePitch } = require('../services/pitchService');

const router = express.Router();
router.use(authenticate);

// ── POST /api/pitches/generate ─────────────────────────────
router.post('/generate', requireCredits(1), asyncHandler(async (req, res) => {
  const { lead_id, pitch_type, service, tone } = req.body;
  if (!lead_id || !pitch_type || !service || !tone) {
    return res.status(400).json({ error: 'lead_id, pitch_type, service, and tone are required' });
  }

  const { rows: leadRows } = await db.query(
    'SELECT * FROM leads WHERE id = $1 AND user_id = $2', [lead_id, req.user.id]
  );
  if (!leadRows[0]) return res.status(404).json({ error: 'Lead not found' });
  const lead = leadRows[0];

  const { rows: settingsRows } = await db.query(
    'SELECT default_from_name, signature FROM user_settings WHERE user_id = $1', [req.user.id]
  );
  const settings = settingsRows[0] || {};

  const { subject, body } = await generatePitch({
    businessName: lead.business_name,
    city: lead.city,
    industry: lead.industry,
    gaps: lead.gaps,
    service,
    tone,
    pitchType: pitch_type,
    senderName: settings.default_from_name || req.user.full_name,
    agencyName: req.user.agency_name,
  });

  const { rows } = await db.query(`
    INSERT INTO pitches (user_id, lead_id, pitch_type, service, tone, subject_line, body, title)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
  `, [req.user.id, lead_id, pitch_type, service, tone, subject, body, `${lead.business_name} — ${pitch_type}`]);

  await deductCredits(req.user.id, 1, `Pitch generated for ${lead.business_name}`);

  res.status(201).json(rows[0]);
}));

// ── GET /api/pitches ────────────────────────────────────────
router.get('/', asyncHandler(async (req, res) => {
  const { lead_id, saved } = req.query;
  let q = `SELECT p.*, l.business_name FROM pitches p LEFT JOIN leads l ON l.id = p.lead_id WHERE p.user_id = $1`;
  const params = [req.user.id];
  if (lead_id) { params.push(lead_id); q += ` AND p.lead_id = $${params.length}`; }
  if (saved === 'true') q += ` AND p.is_saved = TRUE`;
  q += ` ORDER BY p.created_at DESC LIMIT 100`;

  const { rows } = await db.query(q, params);
  res.json(rows);
}));

// ── PATCH /api/pitches/:id ─────────────────────────────────
router.patch('/:id', asyncHandler(async (req, res) => {
  const { is_saved, body, subject_line } = req.body;
  const { rows } = await db.query(`
    UPDATE pitches SET
      is_saved = COALESCE($3, is_saved),
      body = COALESCE($4, body),
      subject_line = COALESCE($5, subject_line)
    WHERE id = $1 AND user_id = $2 RETURNING *
  `, [req.params.id, req.user.id, is_saved, body, subject_line]);
  if (!rows[0]) return res.status(404).json({ error: 'Pitch not found' });
  res.json(rows[0]);
}));

// ── DELETE /api/pitches/:id ────────────────────────────────
router.delete('/:id', asyncHandler(async (req, res) => {
  await db.query('DELETE FROM pitches WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  res.json({ message: 'Pitch deleted' });
}));

// ── POST /api/pitches/:id/send ─────────────────────────────
router.post('/:id/send', requireCredits(1), asyncHandler(async (req, res) => {
  const emailService = require('../services/emailService');
  const { rows } = await db.query(`
    SELECT p.*, l.email, l.business_name FROM pitches p
    JOIN leads l ON l.id = p.lead_id WHERE p.id = $1 AND p.user_id = $2
  `, [req.params.id, req.user.id]);

  const pitch = rows[0];
  if (!pitch) return res.status(404).json({ error: 'Pitch not found' });
  if (!pitch.email) return res.status(400).json({ error: 'Lead has no email address' });

  const { rows: settingsRows } = await db.query(
    'SELECT default_from_name, default_reply_to, signature FROM user_settings WHERE user_id = $1', [req.user.id]
  );
  const settings = settingsRows[0] || {};

  const messageId = await emailService.sendOutreachEmail({
    to: pitch.email,
    fromName: settings.default_from_name || req.user.full_name,
    replyTo: settings.default_reply_to || req.user.email,
    subject: pitch.subject_line || `Re: ${pitch.business_name}`,
    body: `${pitch.body}\n\n${settings.signature || ''}`,
  });

  await db.query('UPDATE pitches SET sent_at = NOW() WHERE id = $1', [pitch.id]);
  await db.query(`
    INSERT INTO email_logs (user_id, lead_id, to_email, from_email, subject, body, sendgrid_message_id, status, sent_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,'sent', NOW())
  `, [req.user.id, pitch.lead_id, pitch.email, settings.default_reply_to || req.user.email, pitch.subject_line, pitch.body, messageId]);

  await db.query('UPDATE leads SET status = $1, last_contacted_at = NOW() WHERE id = $2', ['contacted', pitch.lead_id]);
  await deductCredits(req.user.id, 1, `Pitch sent to ${pitch.business_name}`);

  res.json({ message: 'Email sent successfully' });
}));

module.exports = router;
