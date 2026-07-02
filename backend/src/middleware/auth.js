const jwt = require('jsonwebtoken');
const db = require('../utils/db');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { rows } = await db.query(
      'SELECT id, email, full_name, agency_name, plan, credits_total, credits_used, avatar_url FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (!rows[0]) return res.status(401).json({ error: 'User not found' });

    req.user = rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Check if user has enough credits
const requireCredits = (amount = 1) => async (req, res, next) => {
  const credits_remaining = req.user.credits_total - req.user.credits_used;
  if (credits_remaining < amount) {
    return res.status(402).json({
      error: 'Insufficient credits',
      credits_remaining,
      required: amount,
    });
  }
  next();
};

// Deduct credits from user
const deductCredits = async (userId, amount, description) => {
  await db.query(
    'UPDATE users SET credits_used = credits_used + $1 WHERE id = $2',
    [amount, userId]
  );
  await db.query(
    'INSERT INTO activity_logs (user_id, action, description, metadata) VALUES ($1, $2, $3, $4)',
    [userId, 'credits_used', description, JSON.stringify({ amount })]
  );
};

module.exports = { authenticate, requireCredits, deductCredits };
