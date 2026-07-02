const express = require('express');
const db = require('../utils/db');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();
router.use(authenticate);

// ── GET /api/dashboard/overview ────────────────────────────
router.get('/overview', asyncHandler(async (req, res) => {
  const [stats, activity, gaps, chart] = await Promise.all([
    db.query('SELECT * FROM user_dashboard_stats WHERE user_id = $1', [req.user.id]),
    db.query(`
      SELECT al.*, l.business_name FROM activity_logs al
      LEFT JOIN leads l ON l.id = al.lead_id
      WHERE al.user_id = $1 ORDER BY al.created_at DESC LIMIT 10
    `, [req.user.id]),
    db.query(`
      SELECT unnest(gaps) as gap, COUNT(*) as count FROM leads
      WHERE user_id = $1 AND NOT is_archived GROUP BY gap ORDER BY count DESC LIMIT 5
    `, [req.user.id]),
    db.query(`
      SELECT DATE(created_at) as day, COUNT(*) FILTER (WHERE 1=1) as count
      FROM audits WHERE user_id = $1 AND created_at > NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at) ORDER BY day
    `, [req.user.id]),
  ]);

  res.json({
    stats: stats.rows[0] || {},
    recent_activity: activity.rows,
    top_gaps: gaps.rows,
    weekly_chart: chart.rows,
  });
}));

module.exports = router;
