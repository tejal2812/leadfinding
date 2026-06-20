const express = require('express');
const db = require('../utils/db');
const { authenticate, requireCredits, deductCredits } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { discoverBusinesses } = require('../services/discoverService');

const router = express.Router();
router.use(authenticate);

// ── POST /api/discover/search ──────────────────────────────
router.post('/search', requireCredits(1), asyncHandler(async (req, res) => {
  const { industry, city, min_rating, limit = 20 } = req.body;

  const results = await discoverBusinesses({
    industry, city, minRating: min_rating, limit: Math.min(limit, 100),
  });

  // Filter out businesses already saved as leads for this user
  const placeIds = results.map(r => r.google_place_id).filter(Boolean);
  let existingIds = new Set();
  if (placeIds.length) {
    const { rows } = await db.query(
      `SELECT google_place_id FROM leads WHERE user_id = $1 AND google_place_id = ANY($2)`,
      [req.user.id, placeIds]
    );
    existingIds = new Set(rows.map(r => r.google_place_id));
  }

  const enriched = results.map(r => ({ ...r, already_saved: existingIds.has(r.google_place_id) }));

  await deductCredits(req.user.id, 1, `Discovery search: ${industry || 'all'} in ${city || 'all'}`);

  res.json({ results: enriched, count: enriched.length });
}));

// ── POST /api/discover/save ────────────────────────────────
// Save one or more discovered businesses as leads
router.post('/save', asyncHandler(async (req, res) => {
  const { businesses } = req.body; // array of business objects from /search
  if (!Array.isArray(businesses) || !businesses.length) {
    return res.status(400).json({ error: 'businesses array is required' });
  }

  const saved = [];
  for (const b of businesses) {
    const { rows } = await db.query(`
      INSERT INTO leads (
        user_id, business_name, website_url, email, phone, address, city, state, country, industry,
        google_place_id, google_rating, google_review_count, lead_score, gaps, status, source
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'saved','discover')
      ON CONFLICT DO NOTHING
      RETURNING *
    `, [
      req.user.id, b.business_name, b.website_url, b.email, b.phone, b.address, b.city,
      b.state || null, b.country || 'India',
      b.industry, b.google_place_id, b.google_rating, b.google_review_count,
      b.lead_score || 0, b.gaps || [],
    ]);
    if (rows[0]) saved.push(rows[0]);
  }

  await db.query(
    'INSERT INTO activity_logs (user_id, action, description) VALUES ($1, $2, $3)',
    [req.user.id, 'bulk_save', `Saved ${saved.length} leads from discovery`]
  );

  res.status(201).json({ saved: saved.length, leads: saved });
}));

module.exports = router;
