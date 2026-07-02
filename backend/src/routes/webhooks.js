const express = require('express');
const Stripe = require('stripe');
const db = require('../utils/db');
const logger = require('../utils/logger');

const router = express.Router();
const stripe = process.env.STRIPE_SECRET_KEY ? Stripe(process.env.STRIPE_SECRET_KEY) : null;

const PLAN_CREDITS = { pro: 500, agency: 2000, free: 50 };

// ── POST /api/webhooks/stripe ──────────────────────────────
// NOTE: this route receives raw body (configured in index.js)
router.post('/stripe', async (req, res) => {
  if (!stripe) return res.status(503).send('Billing not configured');

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.error('Stripe webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata.user_id;
        const plan = session.metadata.plan;
        await db.query(
          'UPDATE users SET plan = $1, credits_total = $2, stripe_subscription_id = $3 WHERE id = $4',
          [plan, PLAN_CREDITS[plan] || 50, session.subscription, userId]
        );
        break;
      }
      case 'invoice.payment_succeeded': {
        // Renew monthly credits
        const invoice = event.data.object;
        const { rows } = await db.query('SELECT id, plan FROM users WHERE stripe_customer_id = $1', [invoice.customer]);
        if (rows[0]) {
          await db.query(
            'UPDATE users SET credits_used = 0, credits_total = $2 WHERE id = $1',
            [rows[0].id, PLAN_CREDITS[rows[0].plan] || 50]
          );
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await db.query(
          `UPDATE users SET plan = 'free', credits_total = 50, stripe_subscription_id = NULL WHERE stripe_subscription_id = $1`,
          [sub.id]
        );
        break;
      }
      default:
        logger.info(`Unhandled Stripe event: ${event.type}`);
    }

    await db.query(
      'INSERT INTO billing_events (user_id, stripe_event_id, event_type, status, metadata) VALUES ((SELECT id FROM users WHERE stripe_customer_id = $1), $2, $3, $4, $5) ON CONFLICT (stripe_event_id) DO NOTHING',
      [event.data.object.customer || null, event.id, event.type, 'processed', JSON.stringify(event.data.object)]
    ).catch(() => {}); // best-effort logging

    res.json({ received: true });
  } catch (err) {
    logger.error('Error processing Stripe webhook:', err);
    res.status(500).send('Webhook processing failed');
  }
});

// ── POST /api/webhooks/sendgrid ────────────────────────────
// Email engagement tracking (opens, clicks, bounces)
router.post('/sendgrid', express.json(), async (req, res) => {
  const events = req.body;
  if (!Array.isArray(events)) return res.status(400).json({ error: 'Expected array of events' });

  for (const e of events) {
    try {
      const updates = {
        delivered: { status: 'delivered' },
        open: { status: 'opened', opened_at: new Date(e.timestamp * 1000) },
        click: { status: 'clicked', clicked_at: new Date(e.timestamp * 1000) },
        bounce: { status: 'bounced' },
        spamreport: { status: 'spam' },
        unsubscribe: { status: 'unsubscribed' },
      }[e.event];

      if (!updates || !e.sg_message_id) continue;

      const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`).join(', ');
      await db.query(
        `UPDATE email_logs SET ${setClauses} WHERE sendgrid_message_id = $1`,
        [e.sg_message_id, ...Object.values(updates)]
      );
    } catch (err) {
      logger.error('Error processing SendGrid event:', err.message);
    }
  }

  res.json({ received: true });
});

module.exports = router;
