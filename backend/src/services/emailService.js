const sgMail = require('@sendgrid/mail');
const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Fallback SMTP transport (for dev or non-SendGrid use)
const smtpTransport = process.env.SMTP_HOST ? nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
}) : null;

async function send({ to, from, fromName, replyTo, subject, text, html }) {
  if (process.env.SENDGRID_API_KEY) {
    const msg = {
      to,
      from: { email: from || process.env.SENDGRID_FROM_EMAIL, name: fromName || process.env.SENDGRID_FROM_NAME },
      replyTo: replyTo || from,
      subject,
      text,
      html: html || text.replace(/\n/g, '<br>'),
      trackingSettings: {
        clickTracking: { enable: true },
        openTracking: { enable: true },
      },
    };
    const [response] = await sgMail.send(msg);
    return response.headers['x-message-id'];
  }

  if (smtpTransport) {
    const info = await smtpTransport.sendMail({
      from: `"${fromName}" <${process.env.SMTP_USER}>`,
      to, replyTo, subject, text, html: html || text.replace(/\n/g, '<br>'),
    });
    return info.messageId;
  }

  logger.warn('No email provider configured (SENDGRID_API_KEY or SMTP_HOST). Email not sent:', { to, subject });
  return `dev-mode-${Date.now()}`;
}

async function sendOutreachEmail({ to, fromName, replyTo, subject, body }) {
  return send({ to, fromName, replyTo, subject, text: body });
}

async function sendVerificationEmail(to, name, token) {
  const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  return send({
    to,
    fromName: 'LeadSutra',
    subject: 'Verify your LeadSutra account',
    text: `Hi ${name},\n\nWelcome to LeadSutra! Please verify your email by clicking the link below:\n\n${verifyUrl}\n\nThis link expires in 24 hours.`,
  });
}

async function sendPasswordReset(to, token) {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  return send({
    to,
    fromName: 'LeadSutra',
    subject: 'Reset your LeadSutra password',
    text: `You requested a password reset. Click the link below to set a new password:\n\n${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`,
  });
}

module.exports = { send, sendOutreachEmail, sendVerificationEmail, sendPasswordReset };
