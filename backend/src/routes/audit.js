const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const db = require('../utils/db');
const { authenticate, requireCredits, deductCredits } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { auditWebsite } = require('../services/auditService');

const router = express.Router();
router.use(authenticate);

const auditLimiter = rateLimit({ windowMs: 60000, max: 5, message: { error: 'Audit rate limit reached' } });

// ── POST /api/audit/run ────────────────────────────────────
router.post('/run', auditLimiter, requireCredits(2), asyncHandler(async (req, res) => {
  const { url, lead_id } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  // Create audit record
  const { rows } = await db.query(`
    INSERT INTO audits (user_id, lead_id, url, status) VALUES ($1, $2, $3, 'running') RETURNING id
  `, [req.user.id, lead_id || null, url]);

  const auditId = rows[0].id;

  // Respond immediately, run audit asynchronously
  res.json({ audit_id: auditId, status: 'running', message: 'Audit started' });

  // Run audit in background
  setImmediate(async () => {
    try {
      const results = await auditWebsite(url);

      await db.query(`
        UPDATE audits SET
          status = 'completed',
          overall_score = $2, seo_score = $3, speed_score = $4, mobile_score = $5,
          social_score = $6, review_score = $7,
          gaps = $8, recommendations = $9, raw_data = $10,
          lcp = $11, cls = $12, ttfb = $13,
          meta_title = $14, meta_description = $15,
          h1_count = $16, image_alt_missing = $17,
          has_facebook = $18, has_instagram = $19, has_linkedin = $20,
          completed_at = NOW()
        WHERE id = $1
      `, [
        auditId,
        results.overall_score, results.seo_score, results.speed_score, results.mobile_score,
        results.social_score, results.review_score,
        JSON.stringify(results.gaps), JSON.stringify(results.recommendations), JSON.stringify(results),
        parseFloat(results.speed.lcp) || null,
        parseFloat(results.speed.cls) || null,
        parseFloat(results.speed.ttfb) || null,
        results.seo.title, results.seo.meta_description,
        results.seo.h1_count || 0, results.seo.image_alt_missing || 0,
        !!results.social.has_facebook, !!results.social.has_instagram, !!results.social.has_linkedin,
      ]);

      // Update lead score if linked
      if (lead_id) {
        await db.query(
          'UPDATE leads SET lead_score = $1, gaps = $2 WHERE id = $3 AND user_id = $4',
          [results.overall_score, results.gaps, lead_id, req.user.id]
        );
      }

      await deductCredits(req.user.id, 2, `Website audit: ${url}`);
    } catch (err) {
      await db.query(`UPDATE audits SET status = 'failed', error_message = $2 WHERE id = $1`, [auditId, err.message]);
    }
  });
}));

// ── GET /api/audit/:id ─────────────────────────────────────
router.get('/:id', asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    'SELECT * FROM audits WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Audit not found' });
  res.json(rows[0]);
}));

// ── GET /api/audit/lead/:leadId ────────────────────────────
router.get('/lead/:leadId', asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    'SELECT * FROM audits WHERE lead_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 10',
    [req.params.leadId, req.user.id]
  );
  res.json(rows);
}));

// ── GET /api/audit/history ─────────────────────────────────
router.get('/', asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const { rows } = await db.query(
    `SELECT a.*, l.business_name FROM audits a
     LEFT JOIN leads l ON l.id = a.lead_id
     WHERE a.user_id = $1 ORDER BY a.created_at DESC LIMIT $2 OFFSET $3`,
    [req.user.id, parseInt(limit), offset]
  );
  res.json(rows);
}));

module.exports = router;
