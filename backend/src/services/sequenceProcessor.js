const db = require('../utils/db');
const emailService = require('./emailService');
const logger = require('../utils/logger');

/**
 * Processes due sequence steps: finds enrollments where next_send_at <= now,
 * sends the email, advances to next step or marks complete.
 * Runs every 5 minutes via cron in index.js.
 */
async function sequenceProcessor() {
  const { rows: due } = await db.query(`
    SELECT e.*, s.from_name, s.from_email, s.reply_to, s.status as sequence_status,
           l.business_name, l.email as lead_email
    FROM sequence_enrollments e
    JOIN sequences s ON s.id = e.sequence_id
    JOIN leads l ON l.id = e.lead_id
    WHERE e.status = 'active' AND e.next_send_at <= NOW() AND s.status = 'active'
    LIMIT 50
  `);

  if (!due.length) return;
  logger.info(`Processing ${due.length} due sequence enrollments`);

  for (const enrollment of due) {
    try {
      const nextStepNumber = enrollment.current_step + 1;

      const { rows: stepRows } = await db.query(
        'SELECT * FROM sequence_steps WHERE sequence_id = $1 AND step_number = $2',
        [enrollment.sequence_id, nextStepNumber]
      );

      if (!stepRows[0]) {
        // No more steps — mark complete
        await db.query(
          `UPDATE sequence_enrollments SET status = 'completed', completed_at = NOW() WHERE id = $1`,
          [enrollment.id]
        );
        continue;
      }

      const step = stepRows[0];

      if (!enrollment.lead_email) {
        logger.warn(`Skipping enrollment ${enrollment.id} — lead has no email`);
        await db.query(`UPDATE sequence_enrollments SET status = 'paused' WHERE id = $1`, [enrollment.id]);
        continue;
      }

      const personalizedSubject = personalize(step.subject, enrollment);
      const personalizedBody = personalize(step.body, enrollment);

      const messageId = await emailService.send({
        to: enrollment.lead_email,
        from: enrollment.from_email,
        fromName: enrollment.from_name,
        replyTo: enrollment.reply_to,
        subject: personalizedSubject,
        text: personalizedBody,
      });

      await db.query(`
        INSERT INTO email_logs (user_id, lead_id, sequence_id, enrollment_id, to_email, from_email, subject, body, sendgrid_message_id, status, sent_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'sent', NOW())
      `, [
        enrollment.user_id, enrollment.lead_id, enrollment.sequence_id, enrollment.id,
        enrollment.lead_email, enrollment.from_email, personalizedSubject, personalizedBody, messageId,
      ]);

      // Find next step to compute next_send_at
      const { rows: nextStepRows } = await db.query(
        'SELECT * FROM sequence_steps WHERE sequence_id = $1 AND step_number = $2',
        [enrollment.sequence_id, nextStepNumber + 1]
      );

      if (nextStepRows[0]) {
        const ns = nextStepRows[0];
        const nextSendAt = new Date(Date.now() + ns.delay_days * 86400000 + ns.delay_hours * 3600000);
        await db.query(
          'UPDATE sequence_enrollments SET current_step = $2, next_send_at = $3 WHERE id = $1',
          [enrollment.id, nextStepNumber, nextSendAt]
        );
      } else {
        await db.query(
          `UPDATE sequence_enrollments SET current_step = $2, status = 'completed', completed_at = NOW() WHERE id = $1`,
          [enrollment.id, nextStepNumber]
        );
      }

      await db.query(
        'UPDATE leads SET last_contacted_at = NOW(), status = CASE WHEN status = $2 THEN $3 ELSE status END WHERE id = $1',
        [enrollment.lead_id, 'saved', 'contacted']
      );

    } catch (err) {
      logger.error(`Failed to process enrollment ${enrollment.id}:`, err.message);
    }
  }
}

function personalize(text, enrollment) {
  if (!text) return text;
  return text
    .replace(/\{Business\}/gi, enrollment.business_name || '')
    .replace(/\{Name\}/gi, (enrollment.business_name || '').split(' ')[0]);
}

module.exports = { sequenceProcessor };
