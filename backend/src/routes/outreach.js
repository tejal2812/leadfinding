const express = require('express');
const db = require('../utils/db');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();
router.use(authenticate);

// ── GET /api/outreach/sequences ────────────────────────────
router.get('/sequences', asyncHandler(async (req, res) => {
  const { rows } = await db.query(`
    SELECT s.*,
      (SELECT COUNT(*) FROM sequence_enrollments e WHERE e.sequence_id = s.id) as enrolled_count,
      (SELECT COUNT(*) FROM sequence_enrollments e WHERE e.sequence_id = s.id AND e.status = 'active') as active_count,
      (SELECT COUNT(*) FROM sequence_steps st WHERE st.sequence_id = s.id) as step_count
    FROM sequences s WHERE s.user_id = $1 ORDER BY s.created_at DESC
  `, [req.user.id]);
  res.json(rows);
}));

// ── GET /api/outreach/sequences/:id ────────────────────────
router.get('/sequences/:id', asyncHandler(async (req, res) => {
  const { rows: seqRows } = await db.query(
    'SELECT * FROM sequences WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]
  );
  if (!seqRows[0]) return res.status(404).json({ error: 'Sequence not found' });

  const { rows: steps } = await db.query(
    'SELECT * FROM sequence_steps WHERE sequence_id = $1 ORDER BY step_number ASC', [req.params.id]
  );

  const { rows: enrollments } = await db.query(`
    SELECT e.*, l.business_name, l.email FROM sequence_enrollments e
    JOIN leads l ON l.id = e.lead_id WHERE e.sequence_id = $1 ORDER BY e.enrolled_at DESC LIMIT 100
  `, [req.params.id]);

  res.json({ ...seqRows[0], steps, enrollments });
}));

// ── POST /api/outreach/sequences ───────────────────────────
router.post('/sequences', asyncHandler(async (req, res) => {
  const { name, description, steps, from_name, from_email, reply_to } = req.body;
  if (!name || !steps?.length) return res.status(400).json({ error: 'name and at least one step are required' });

  const result = await db.transaction(async (client) => {
    const { rows } = await client.query(`
      INSERT INTO sequences (user_id, name, description, from_name, from_email, reply_to, status)
      VALUES ($1,$2,$3,$4,$5,$6,'draft') RETURNING *
    `, [req.user.id, name, description, from_name, from_email, reply_to]);

    const sequence = rows[0];

    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      await client.query(`
        INSERT INTO sequence_steps (sequence_id, step_number, step_type, subject, body, delay_days, delay_hours)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [sequence.id, i + 1, s.step_type || 'email', s.subject, s.body, s.delay_days || 0, s.delay_hours || 0]);
    }

    return sequence;
  });

  res.status(201).json(result);
}));

// ── PATCH /api/outreach/sequences/:id ──────────────────────
router.patch('/sequences/:id', asyncHandler(async (req, res) => {
  const { status, name, description } = req.body;
  const { rows } = await db.query(`
    UPDATE sequences SET
      status = COALESCE($3, status),
      name = COALESCE($4, name),
      description = COALESCE($5, description)
    WHERE id = $1 AND user_id = $2 RETURNING *
  `, [req.params.id, req.user.id, status, name, description]);
  if (!rows[0]) return res.status(404).json({ error: 'Sequence not found' });
  res.json(rows[0]);
}));

// ── DELETE /api/outreach/sequences/:id ─────────────────────
router.delete('/sequences/:id', asyncHandler(async (req, res) => {
  await db.query('DELETE FROM sequences WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  res.json({ message: 'Sequence deleted' });
}));

// ── POST /api/outreach/sequences/:id/enroll ────────────────
router.post('/sequences/:id/enroll', asyncHandler(async (req, res) => {
  const { lead_ids } = req.body;
  if (!lead_ids?.length) return res.status(400).json({ error: 'lead_ids array is required' });

  const { rows: stepRows } = await db.query(
    'SELECT * FROM sequence_steps WHERE sequence_id = $1 ORDER BY step_number ASC LIMIT 1',
    [req.params.id]
  );
  if (!stepRows[0]) return res.status(400).json({ error: 'Sequence has no steps' });

  const firstStep = stepRows[0];
  const nextSend = new Date(Date.now() + (firstStep.delay_days * 86400000) + (firstStep.delay_hours * 3600000));

  const enrolled = [];
  for (const leadId of lead_ids) {
    const { rows } = await db.query(`
      INSERT INTO sequence_enrollments (sequence_id, lead_id, user_id, current_step, next_send_at)
      VALUES ($1,$2,$3,0,$4)
      ON CONFLICT (sequence_id, lead_id) DO NOTHING
      RETURNING *
    `, [req.params.id, leadId, req.user.id, nextSend]);
    if (rows[0]) enrolled.push(rows[0]);
  }

  res.status(201).json({ enrolled: enrolled.length });
}));

// ── GET /api/outreach/stats ────────────────────────────────
router.get('/stats', asyncHandler(async (req, res) => {
  const { rows } = await db.query(`
    SELECT
      COUNT(*) as emails_sent,
      COUNT(*) FILTER (WHERE opened_at IS NOT NULL) as emails_opened,
      COUNT(*) FILTER (WHERE status = 'replied') as emails_replied,
      COUNT(*) FILTER (WHERE status = 'unsubscribed') as unsubscribed
    FROM email_logs WHERE user_id = $1
  `, [req.user.id]);
  res.json(rows[0]);
}));

module.exports = router;
