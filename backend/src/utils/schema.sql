-- ============================================
-- LeadSutra Database Schema
-- PostgreSQL 14+
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for fuzzy search

-- ============================================
-- USERS & AUTH
-- ============================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  agency_name VARCHAR(255),
  phone VARCHAR(50),
  avatar_url TEXT,
  plan VARCHAR(50) NOT NULL DEFAULT 'free',  -- free | pro | agency
  credits_total INTEGER NOT NULL DEFAULT 50,
  credits_used INTEGER NOT NULL DEFAULT 0,
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  email_verified BOOLEAN DEFAULT FALSE,
  email_verification_token VARCHAR(255),
  password_reset_token VARCHAR(255),
  password_reset_expires TIMESTAMPTZ,
  onboarded BOOLEAN DEFAULT FALSE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  services_offered TEXT[] DEFAULT '{}',
  default_from_name VARCHAR(255),
  default_reply_to VARCHAR(255),
  signature TEXT,
  notify_replies BOOLEAN DEFAULT TRUE,
  notify_hot_leads BOOLEAN DEFAULT TRUE,
  notify_weekly_report BOOLEAN DEFAULT FALSE,
  notify_low_credits BOOLEAN DEFAULT TRUE,
  timezone VARCHAR(100) DEFAULT 'Asia/Kolkata',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- LEADS & BUSINESSES
-- ============================================

CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_name VARCHAR(255) NOT NULL,
  website_url VARCHAR(500),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100) DEFAULT 'India',
  industry VARCHAR(100),
  google_place_id VARCHAR(255),
  google_rating DECIMAL(2,1),
  google_review_count INTEGER DEFAULT 0,
  lead_score INTEGER DEFAULT 0 CHECK (lead_score >= 0 AND lead_score <= 100),
  status VARCHAR(50) DEFAULT 'new',  -- new | saved | contacted | replied | proposal | won | lost
  gaps TEXT[] DEFAULT '{}',
  notes TEXT,
  source VARCHAR(100) DEFAULT 'manual',  -- manual | discover | import | api
  is_archived BOOLEAN DEFAULT FALSE,
  last_contacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leads_user_id ON leads(user_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_score ON leads(lead_score DESC);
CREATE INDEX idx_leads_industry ON leads(industry);
CREATE INDEX idx_leads_city ON leads(city);
CREATE INDEX idx_leads_name_trgm ON leads USING GIN (business_name gin_trgm_ops);

-- ============================================
-- WEBSITE AUDITS
-- ============================================

CREATE TABLE audits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url VARCHAR(500) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',  -- pending | running | completed | failed
  overall_score INTEGER,
  seo_score INTEGER,
  speed_score INTEGER,
  mobile_score INTEGER,
  social_score INTEGER,
  review_score INTEGER,
  gaps JSONB DEFAULT '[]',
  recommendations JSONB DEFAULT '[]',
  raw_data JSONB DEFAULT '{}',
  -- PageSpeed data
  lcp DECIMAL(5,2),
  fid DECIMAL(5,2),
  cls DECIMAL(4,3),
  ttfb DECIMAL(5,2),
  -- SEO data
  meta_title TEXT,
  meta_description TEXT,
  h1_count INTEGER,
  image_alt_missing INTEGER,
  -- Social
  has_facebook BOOLEAN,
  has_instagram BOOLEAN,
  has_linkedin BOOLEAN,
  -- GMB
  has_gmb BOOLEAN,
  gmb_rating DECIMAL(2,1),
  gmb_reviews INTEGER,
  error_message TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audits_lead_id ON audits(lead_id);
CREATE INDEX idx_audits_user_id ON audits(user_id);

-- ============================================
-- AI PITCHES
-- ============================================

CREATE TABLE pitches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  title VARCHAR(255),
  pitch_type VARCHAR(100) NOT NULL,  -- cold_email | whatsapp | linkedin | followup | phone
  service VARCHAR(255),
  tone VARCHAR(100),
  subject_line TEXT,
  body TEXT NOT NULL,
  is_saved BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pitches_user_id ON pitches(user_id);
CREATE INDEX idx_pitches_lead_id ON pitches(lead_id);

-- ============================================
-- EMAIL OUTREACH SEQUENCES
-- ============================================

CREATE TABLE sequences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'draft',  -- draft | active | paused | completed
  from_name VARCHAR(255),
  from_email VARCHAR(255),
  reply_to VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sequence_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  step_type VARCHAR(50) DEFAULT 'email',  -- email | wait | condition
  subject VARCHAR(500),
  body TEXT,
  delay_days INTEGER DEFAULT 0,
  delay_hours INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sequence_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_step INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'active',  -- active | paused | completed | unsubscribed
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  next_send_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE(sequence_id, lead_id)
);

-- ============================================
-- EMAIL TRACKING
-- ============================================

CREATE TABLE email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  sequence_id UUID REFERENCES sequences(id) ON DELETE SET NULL,
  enrollment_id UUID REFERENCES sequence_enrollments(id) ON DELETE SET NULL,
  to_email VARCHAR(255) NOT NULL,
  from_email VARCHAR(255) NOT NULL,
  subject VARCHAR(500),
  body TEXT,
  sendgrid_message_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'queued',  -- queued | sent | delivered | opened | clicked | bounced | spam | unsubscribed
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_logs_user_id ON email_logs(user_id);
CREATE INDEX idx_email_logs_lead_id ON email_logs(lead_id);

-- ============================================
-- ACTIVITY LOG
-- ============================================

CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,  -- lead_saved | lead_contacted | audit_run | pitch_sent | deal_won etc.
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC);

-- ============================================
-- BILLING / SUBSCRIPTIONS
-- ============================================

CREATE TABLE billing_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_event_id VARCHAR(255) UNIQUE,
  event_type VARCHAR(100),
  amount INTEGER,  -- in paise/cents
  currency VARCHAR(10) DEFAULT 'inr',
  status VARCHAR(50),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- HELPER FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER user_settings_updated_at BEFORE UPDATE ON user_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER sequences_updated_at BEFORE UPDATE ON sequences FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create user settings on user creation
CREATE OR REPLACE FUNCTION create_user_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_settings (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_user_created AFTER INSERT ON users FOR EACH ROW EXECUTE FUNCTION create_user_settings();

-- Views for dashboard stats
CREATE OR REPLACE VIEW user_dashboard_stats AS
SELECT
  u.id as user_id,
  COUNT(DISTINCT l.id) as total_leads,
  COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'won') as won_leads,
  COUNT(DISTINCT el.id) as emails_sent,
  COUNT(DISTINCT el.id) FILTER (WHERE el.opened_at IS NOT NULL) as emails_opened,
  COUNT(DISTINCT el.id) FILTER (WHERE el.status = 'replied') as emails_replied,
  COUNT(DISTINCT a.id) as audits_run,
  AVG(l.lead_score)::INTEGER as avg_lead_score,
  u.credits_total - u.credits_used as credits_remaining
FROM users u
LEFT JOIN leads l ON l.user_id = u.id AND NOT l.is_archived
LEFT JOIN email_logs el ON el.user_id = u.id
LEFT JOIN audits a ON a.user_id = u.id
GROUP BY u.id;
