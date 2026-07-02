require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');

async function seed() {
  console.log('🌱 Seeding database...');

  // 1. Seed demo@leadsutra.in
  const demoHash = await bcrypt.hash('Demo@1234', 10);
  const { rows: demoUserRows } = await db.query(`
    INSERT INTO users (email, password_hash, full_name, agency_name, plan, credits_total, credits_used, email_verified)
    VALUES ('demo@leadsutra.in', $1, 'Arjun Kumar', 'DigiGrow Agency', 'pro', 500, 160, TRUE)
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
    RETURNING id
  `, [demoHash]);

  const demoUserId = demoUserRows[0].id;

  await db.query(`
    UPDATE user_settings SET
      services_offered = ARRAY['Social Media Management','SEO & Content Marketing','Google Ads / PPC'],
      default_from_name = 'Arjun from DigiGrow',
      default_reply_to = 'arjun@digigrow.in',
      signature = 'Best regards,\nArjun Kumar\nDigiGrow Agency | +91 98765 43210'
    WHERE user_id = $1
  `, [demoUserId]);

  // 2. Seed hello.opirawebs@outlook.com
  const opiraHash = await bcrypt.hash('Opira##2005', 10);
  const { rows: opiraUserRows } = await db.query(`
    INSERT INTO users (email, password_hash, full_name, agency_name, plan, credits_total, credits_used, email_verified)
    VALUES ('hello.opirawebs@outlook.com', $1, 'Opira Webs Admin', 'Opira Webs', 'pro', 1000, 0, TRUE)
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
    RETURNING id
  `, [opiraHash]);

  const opiraUserId = opiraUserRows[0].id;

  await db.query(`
    UPDATE user_settings SET
      services_offered = ARRAY['Social Media Management','SEO & Content Marketing','Google Ads / PPC','Website Redesign'],
      default_from_name = 'Opira Webs Support',
      default_reply_to = 'hello.opirawebs@outlook.com',
      signature = 'Best regards,\nOpira Webs Team'
    WHERE user_id = $1
  `, [opiraUserId]);

  // Seed default leads for both users
  const leads = [
    ['Spice Garden Restaurant', 'spicegarden.in', 'owner@spicegarden.in', 'Ahmedabad', 'Restaurant', 88, ['No SEO','Slow Site','No Reviews'], 'hot'],
    ['Sharma Real Estate', 'sharmaestates.com', 'sharma@estates.com', 'Pune', 'Real Estate', 74, ['No Social','Outdated Site'], 'contacted'],
    ["Dr. Patel's Clinic", 'patelclinic.in', 'reception@patelclinic.in', 'Mumbai', 'Healthcare', 91, ['No GMB','No Reviews','No SEO'], 'won'],
    ['TechMart Electronics', 'techmart.co.in', 'info@techmart.co.in', 'Bengaluru', 'Retail', 62, ['No Social','No Ads'], 'saved'],
    ['EduSphere Coaching', 'edusphere.in', 'hello@edusphere.in', 'Delhi', 'Education', 79, ['Slow Site','No Video'], 'replied'],
  ];

  for (const userId of [demoUserId, opiraUserId]) {
    // Delete existing leads to avoid duplicate seeding
    await db.query('DELETE FROM leads WHERE user_id = $1', [userId]);

    for (const [name, url, email, city, industry, score, gaps, status] of leads) {
      await db.query(`
        INSERT INTO leads (user_id, business_name, website_url, email, city, industry, lead_score, gaps, status, source)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'manual')
      `, [userId, name, url, email, city, industry, score, gaps, status]);
    }
  }

  console.log('✅ Seed complete.');
  console.log('1. login: demo@leadsutra.in / Demo@1234');
  console.log('2. login: hello.opirawebs@outlook.com / Opira##2005');
  process.exit(0);
}

seed().catch(err => { console.error('❌ Seed failed:', err); process.exit(1); });
