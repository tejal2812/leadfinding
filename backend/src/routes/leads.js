const express = require('express');
const { body, query, validationResult } = require('express-validator');
const db = require('../utils/db');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const csv = require('csv-stringify/sync');
const multer = require('multer');
const csvParser = require('csv-parser');
const { Readable } = require('stream');

const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

const router = express.Router();
router.use(authenticate);

// ── GET /api/leads ─────────────────────────────────────────
router.get('/', asyncHandler(async (req, res) => {
  const {
    status, industry, city, min_score, max_score, gap,
    search, sort = 'created_at', order = 'desc',
    page = 1, limit = 50,
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  let conditions = ['l.user_id = $1', 'NOT l.is_archived'];
  let params = [req.user.id];
  let idx = 2;

  if (status) { conditions.push(`l.status = $${idx++}`); params.push(status); }
  if (industry) { conditions.push(`l.industry = $${idx++}`); params.push(industry); }
  if (city) { conditions.push(`l.city ILIKE $${idx++}`); params.push(`%${city}%`); }
  if (min_score) { conditions.push(`l.lead_score >= $${idx++}`); params.push(parseInt(min_score)); }
  if (max_score) { conditions.push(`l.lead_score <= $${idx++}`); params.push(parseInt(max_score)); }
  if (gap) { conditions.push(`$${idx++} = ANY(l.gaps)`); params.push(gap); }
  if (search) {
    conditions.push(`(l.business_name ILIKE $${idx} OR l.website_url ILIKE $${idx} OR l.email ILIKE $${idx})`);
    params.push(`%${search}%`); idx++;
  }

  const allowedSorts = ['created_at', 'lead_score', 'business_name', 'last_contacted_at', 'updated_at'];
  const sortCol = allowedSorts.includes(sort) ? sort : 'created_at';
  const sortDir = order === 'asc' ? 'ASC' : 'DESC';

  const where = `WHERE ${conditions.join(' AND ')}`;

  const [leadsResult, countResult] = await Promise.all([
    db.query(`
      SELECT l.*, a.overall_score as audit_score, a.id as latest_audit_id
      FROM leads l
      LEFT JOIN LATERAL (
        SELECT overall_score, id FROM audits WHERE lead_id = l.id ORDER BY created_at DESC LIMIT 1
      ) a ON TRUE
      ${where}
      ORDER BY l.${sortCol} ${sortDir}
      LIMIT $${idx++} OFFSET $${idx++}
    `, [...params, parseInt(limit), offset]),
    db.query(`SELECT COUNT(*) FROM leads l ${where}`, params),
  ]);

  res.json({
    leads: leadsResult.rows,
    total: parseInt(countResult.rows[0].count),
    page: parseInt(page),
    pages: Math.ceil(parseInt(countResult.rows[0].count) / parseInt(limit)),
  });
}));

// ── GET /api/leads/:id ─────────────────────────────────────
router.get('/:id', asyncHandler(async (req, res) => {
  const { rows } = await db.query(`
    SELECT l.*,
      COALESCE(
        (SELECT json_agg(a ORDER BY a.created_at DESC) FROM audits a WHERE a.lead_id = l.id LIMIT 5),
        '[]'
      ) as audits,
      COALESCE(
        (SELECT json_agg(p ORDER BY p.created_at DESC) FROM pitches p WHERE p.lead_id = l.id LIMIT 10),
        '[]'
      ) as pitches,
      COALESCE(
        (SELECT json_agg(el ORDER BY el.created_at DESC) FROM email_logs el WHERE el.lead_id = l.id LIMIT 20),
        '[]'
      ) as email_history
    FROM leads l
    WHERE l.id = $1 AND l.user_id = $2
  `, [req.params.id, req.user.id]);

  if (!rows[0]) return res.status(404).json({ error: 'Lead not found' });
  res.json(rows[0]);
}));

// ── POST /api/leads ────────────────────────────────────────
router.post('/',
  [
    body('business_name').trim().isLength({ min: 1, max: 255 }),
    body('email').optional().isEmail().normalizeEmail(),
    body('website_url').optional().isURL(),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const {
      business_name, website_url, email, phone, address, city, state, country,
      industry, lead_score, status, gaps, notes, source, google_place_id,
      google_rating, google_review_count,
    } = req.body;

    const { rows } = await db.query(`
      INSERT INTO leads (
        user_id, business_name, website_url, email, phone, address, city, state, country,
        industry, lead_score, status, gaps, notes, source, google_place_id,
        google_rating, google_review_count
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      RETURNING *
    `, [
      req.user.id, business_name, website_url, email, phone, address, city,
      state, country || 'India', industry, lead_score || 0, status || 'saved',
      gaps || [], notes, source || 'manual', google_place_id, google_rating, google_review_count,
    ]);

    await db.query(
      'INSERT INTO activity_logs (user_id, lead_id, action, description) VALUES ($1, $2, $3, $4)',
      [req.user.id, rows[0].id, 'lead_saved', `Saved lead: ${business_name}`]
    );

    res.status(201).json(rows[0]);
  })
);

// ── PATCH /api/leads/:id ───────────────────────────────────
router.patch('/:id', asyncHandler(async (req, res) => {
  const allowed = [
    'business_name','website_url','email','phone','address','city','state','country',
    'industry','lead_score','status','gaps','notes','last_contacted_at',
  ];
  const updates = Object.keys(req.body)
    .filter(k => allowed.includes(k))
    .reduce((acc, k) => ({ ...acc, [k]: req.body[k] }), {});

  if (!Object.keys(updates).length) return res.status(400).json({ error: 'No valid fields to update' });

  const sets = Object.keys(updates).map((k, i) => `${k} = $${i + 3}`);
  const values = Object.values(updates);

  const { rows } = await db.query(
    `UPDATE leads SET ${sets.join(', ')} WHERE id = $1 AND user_id = $2 RETURNING *`,
    [req.params.id, req.user.id, ...values]
  );

  if (!rows[0]) return res.status(404).json({ error: 'Lead not found' });

  if (updates.status) {
    await db.query(
      'INSERT INTO activity_logs (user_id, lead_id, action, description) VALUES ($1,$2,$3,$4)',
      [req.user.id, req.params.id, `lead_${updates.status}`, `Status changed to ${updates.status}`]
    );
  }

  res.json(rows[0]);
}));

// ── DELETE /api/leads/:id ──────────────────────────────────
router.delete('/:id', asyncHandler(async (req, res) => {
  if (req.query.hard === 'true') {
    await db.query('DELETE FROM leads WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  } else {
    await db.query(
      'UPDATE leads SET is_archived = TRUE WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
  }
  res.json({ message: 'Lead deleted' });
}));

// ── POST /api/leads/bulk ───────────────────────────────────
router.post('/bulk', asyncHandler(async (req, res) => {
  const { action, ids, data } = req.body;
  if (!ids?.length) return res.status(400).json({ error: 'No IDs provided' });

  const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');

  if (action === 'delete') {
    await db.query(`UPDATE leads SET is_archived = TRUE WHERE id IN (${placeholders}) AND user_id = $1`, [req.user.id, ...ids]);
  } else if (action === 'update_status' && data?.status) {
    await db.query(`UPDATE leads SET status = $${ids.length + 2} WHERE id IN (${placeholders}) AND user_id = $1`, [req.user.id, ...ids, data.status]);
  }

  res.json({ message: `Bulk ${action} complete`, count: ids.length });
}));

// ── POST /api/leads/import ─────────────────────────────────
router.post('/import', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No CSV file uploaded' });

  const results = [];
  const stream = Readable.from(req.file.buffer.toString('utf8'));

  await new Promise((resolve, reject) => {
    stream
      .pipe(csvParser())
      .on('data', (data) => results.push(data))
      .on('end', resolve)
      .on('error', reject);
  });

  if (!results.length) return res.status(400).json({ error: 'Uploaded CSV is empty' });

  let importCount = 0;

  for (const row of results) {
    // Standardize key lookups (case-insensitive and trimming spaces)
    const normalizedRow = {};
    for (const key of Object.keys(row)) {
      normalizedRow[key.toLowerCase().trim().replace(/[\s_-]+/g, '')] = row[key]?.trim();
    }

    const businessName = normalizedRow.businessname || normalizedRow.name || normalizedRow.company;
    if (!businessName) continue; // Skip rows without a business name

    const websiteUrl = normalizedRow.website || normalizedRow.websiteurl || normalizedRow.url;
    const email = normalizedRow.email;
    const phone = normalizedRow.phone || normalizedRow.phonenumber;
    const city = normalizedRow.city || 'Unknown';
    const industry = normalizedRow.industry || 'General';
    const notes = normalizedRow.notes || normalizedRow.description;
    const address = normalizedRow.address || normalizedRow.location;

    // Estimate a baseline score and gaps based on data availability
    const gaps = [];
    let score = 50;
    if (!websiteUrl) {
      gaps.push('No Website');
      score += 20;
    }
    if (!email) {
      gaps.push('No Contact Email');
      score += 15;
    }
    if (!phone) {
      gaps.push('No Phone Number');
      score += 5;
    }

    await db.query(`
      INSERT INTO leads (
        user_id, business_name, website_url, email, phone, address, city,
        industry, lead_score, status, gaps, notes, source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'saved', $10, $11, 'csv_import')
    `, [
      req.user.id,
      businessName,
      websiteUrl || null,
      email || null,
      phone || null,
      address || null,
      city,
      industry,
      Math.min(95, score),
      gaps,
      notes || null
    ]);

    importCount++;
  }

  res.json({ message: `Successfully imported ${importCount} leads`, count: importCount });
}));

// ── GET /api/leads/export/csv ──────────────────────────────
router.get('/export/csv', asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT business_name, website_url, email, phone, city, industry, lead_score, status, gaps, notes, created_at
     FROM leads WHERE user_id = $1 AND NOT is_archived ORDER BY created_at DESC`,
    [req.user.id]
  );

  const csvData = csv.stringify(rows, {
    header: true,
    columns: { business_name:'Business Name', website_url:'Website', email:'Email', phone:'Phone',
               city:'City', industry:'Industry', lead_score:'Score', status:'Status', notes:'Notes', created_at:'Added On' },
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=leadsutra-leads.csv');
  res.send(csvData);
}));

// ── GET /api/leads/stats/overview ─────────────────────────
router.get('/stats/overview', asyncHandler(async (req, res) => {
  const { rows } = await db.query(`
    SELECT
      COUNT(*) FILTER (WHERE NOT is_archived) as total,
      COUNT(*) FILTER (WHERE status = 'hot' AND NOT is_archived) as hot,
      COUNT(*) FILTER (WHERE status = 'contacted' AND NOT is_archived) as contacted,
      COUNT(*) FILTER (WHERE status = 'won') as won,
      ROUND(AVG(lead_score) FILTER (WHERE NOT is_archived)) as avg_score,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days' AND NOT is_archived) as this_week
    FROM leads WHERE user_id = $1
  `, [req.user.id]);

  res.json(rows[0]);
}));

module.exports = router;
