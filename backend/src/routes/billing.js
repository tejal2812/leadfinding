const express = require('express');
const Stripe = require('stripe');
const db = require('../utils/db');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();
const stripe = process.env.STRIPE_SECRET_KEY ? Stripe(process.env.STRIPE_SECRET_KEY) : null;

const PLANS = {
  free: { credits: 50, price: 0 },
  pro: { credits: 500, price: 2999, priceId: process.env.STRIPE_PRO_PRICE_ID },
  agency: { credits: 2000, price: 9999, priceId: process.env.STRIPE_AGENCY_PRICE_ID },
};

router.use(authenticate);

// ── GET /api/billing/plans ──────────────────────────────────
router.get('/plans', (req, res) => {
  res.json({
    plans: [
      { id: 'free', name: 'Free', credits: 50, price: 0, features: ['50 credits/mo', 'Basic audits', 'Manual outreach'] },
      { id: 'pro', name: 'Pro', credits: 500, price: 2999, features: ['500 credits/mo', 'AI pitch generation', 'Email sequences', 'CSV export'] },
      { id: 'agency', name: 'Agency', credits: 2000, price: 9999, features: ['2000 credits/mo', 'Unlimited sequences', 'Priority support', 'Team seats'] },
    ],
  });
});

// ── POST /api/billing/create-checkout-session ──────────────
router.post('/create-checkout-session', asyncHandler(async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Billing not configured' });

  const { plan } = req.body;
  const planConfig = PLANS[plan];
  if (!planConfig?.priceId) return res.status(400).json({ error: 'Invalid plan' });

  let customerId = req.user.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: req.user.email,
      name: req.user.full_name,
      metadata: { user_id: req.user.id },
    });
    customerId = customer.id;
    await db.query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [customerId, req.user.id]);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: planConfig.priceId, quantity: 1 }],
    success_url: `${process.env.FRONTEND_URL}/settings?billing=success`,
    cancel_url: `${process.env.FRONTEND_URL}/settings?billing=cancelled`,
    metadata: { user_id: req.user.id, plan },
  });

  res.json({ url: session.url });
}));

// ── POST /api/billing/create-portal-session ────────────────
router.post('/create-portal-session', asyncHandler(async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Billing not configured' });
  if (!req.user.stripe_customer_id) return res.status(400).json({ error: 'No billing account found' });

  const session = await stripe.billingPortal.sessions.create({
    customer: req.user.stripe_customer_id,
    return_url: `${process.env.FRONTEND_URL}/settings`,
  });

  res.json({ url: session.url });
}));

// ── GET /api/billing/usage ──────────────────────────────────
router.get('/usage', asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    'SELECT credits_total, credits_used, plan FROM users WHERE id = $1', [req.user.id]
  );
  res.json({
    ...rows[0],
    credits_remaining: rows[0].credits_total - rows[0].credits_used,
    percent_used: Math.round((rows[0].credits_used / rows[0].credits_total) * 100),
  });
}));

module.exports = router;
