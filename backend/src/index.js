require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');

const logger = require('./utils/logger');
const authRoutes = require('./routes/auth');
const leadsRoutes = require('./routes/leads');
const auditRoutes = require('./routes/audit');
const pitchRoutes = require('./routes/pitches');
const discoverRoutes = require('./routes/discover');
const outreachRoutes = require('./routes/outreach');
const billingRoutes = require('./routes/billing');
const settingsRoutes = require('./routes/settings');
const webhookRoutes = require('./routes/webhooks');
const dashboardRoutes = require('./routes/dashboard');
const { errorHandler } = require('./middleware/errorHandler');
const { sequenceProcessor } = require('./services/sequenceProcessor');

const app = express();
const PORT = process.env.PORT || 4000;

// ── Security & Middleware ──────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
}));

// Stripe webhook needs raw body
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));

app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));

// ── Global Rate Limiting ───────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', globalLimiter);

// ── Routes ─────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/pitches', pitchRoutes);
app.use('/api/discover', discoverRoutes);
app.use('/api/outreach', outreachRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});

// ── Error Handler ──────────────────────────────────────────
app.use(errorHandler);

// ── Cron Jobs ──────────────────────────────────────────────
// Process outreach sequences every 5 minutes
cron.schedule('*/5 * * * *', () => {
  sequenceProcessor().catch(err => logger.error('Sequence processor error:', err));
});

// Weekly report email every Monday 8am IST
cron.schedule('0 2 * * 1', () => {
  // sendWeeklyReports();
  logger.info('Weekly reports cron triggered');
});

// ── Start ──────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`🚀 LeadSutra API running on http://localhost:${PORT}`);
  logger.info(`   Environment: ${process.env.NODE_ENV}`);
});

module.exports = app;
