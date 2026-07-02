# LeadSutra — AI Client Discovery Platform

A production-ready, full-stack clone of LeadSutra: an AI-powered platform for agencies and freelancers to discover business leads, audit their websites, generate personalized pitches, and run automated outreach sequences.

## Stack

- **Frontend:** React 18 + Vite + Tailwind CSS + React Query + Zustand
- **Backend:** Node.js + Express + PostgreSQL
- **AI:** OpenAI GPT-4 for pitch generation
- **Lead Discovery:** Google Places API
- **Website Audits:** Google PageSpeed Insights API + Cheerio scraping
- **Email:** SendGrid (with SMTP fallback)
- **Billing:** Stripe subscriptions
- **Infra:** Docker, Docker Compose, nginx

## Features

✅ JWT authentication (register/login/password reset/email verification)
✅ Real Google Places business discovery with lead scoring
✅ Real website audits (PageSpeed + SEO scrape + social detection)
✅ AI-generated personalized pitches (OpenAI, with template fallback)
✅ Email sending via SendGrid with open/click tracking
✅ Multi-step automated outreach sequences (cron-based)
✅ Kanban pipeline with drag-and-drop
✅ CSV export
✅ Credit-based usage metering
✅ Stripe subscription billing + webhooks
✅ Activity logging & dashboard analytics
✅ Rate limiting, input validation, security headers

---

## Quick Start (Docker — recommended)

```bash
git clone <this-repo>
cd leadsutra

# Copy and fill environment variables
cp backend/.env.example backend/.env
# Edit backend/.env with your API keys (see below)

# Start everything
docker compose up --build

# In a separate terminal, run migrations + seed demo data
docker compose exec backend npm run db:migrate
docker compose exec backend npm run db:seed
```

Visit:
- Frontend: http://localhost:5173
- Backend API: http://localhost:4000/api/health

Demo login: `demo@leadsutra.in` / `Demo@1234`

---

## Manual Setup (without Docker)

### 1. Database
Install PostgreSQL 14+ locally, or use a hosted provider (Supabase, Neon, Railway, RDS).

```bash
createdb leadsutra
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env — at minimum set DATABASE_URL and JWT_SECRET
npm run db:migrate
npm run db:seed     # optional demo data
npm run dev          # starts on :4000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev           # starts on :5173, proxies /api to :4000
```

---

## Required API Keys (for full functionality)

The app works in **demo/mock mode** without any of these (uses fallback templates and randomized mock data), but for real production behavior:

| Service | Purpose | Get it from |
|---|---|---|
| `GOOGLE_PLACES_API_KEY` | Real business discovery | [Google Cloud Console](https://console.cloud.google.com/) → enable Places API |
| `GOOGLE_PSI_API_KEY` | Real PageSpeed/SEO audit scores | [Google Cloud Console](https://console.cloud.google.com/) → enable PageSpeed Insights API |
| `OPENAI_API_KEY` | AI-generated pitches | [platform.openai.com](https://platform.openai.com/api-keys) |
| `SENDGRID_API_KEY` | Sending outreach emails | [SendGrid](https://sendgrid.com) |
| `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` | Subscription billing | [Stripe Dashboard](https://dashboard.stripe.com/apikeys) |

Without these, the backend gracefully falls back to mock/template data so you can demo the full UX without spending on APIs.

---

## Project Structure

```
leadsutra/
├── backend/
│   ├── src/
│   │   ├── index.js              # Express app entry
│   │   ├── routes/               # auth, leads, audit, pitches, discover, outreach, billing, settings, webhooks, dashboard
│   │   ├── services/              # auditService, pitchService (OpenAI), discoverService (Places), emailService (SendGrid), sequenceProcessor (cron)
│   │   ├── middleware/            # auth (JWT), errorHandler
│   │   └── utils/                 # db.js, schema.sql, logger, migrate, seed
│   ├── package.json
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── pages/                 # Dashboard, Discover, Leads, Pipeline, Auditor, Pitches, Outreach, Settings, Login, Register
│   │   ├── components/Layout.jsx
│   │   ├── services/api.js        # axios client + all API methods
│   │   ├── store/authStore.js     # zustand auth state
│   │   └── App.jsx
│   ├── package.json
│   ├── Dockerfile
│   └── nginx.conf
├── docker-compose.yml
└── README.md
```

---

## Database Schema

Full schema in `backend/src/utils/schema.sql`. Key tables:

- `users`, `user_settings` — auth & preferences
- `leads` — saved business leads with scores/gaps/status
- `audits` — website audit results (SEO, speed, social, GMB)
- `pitches` — AI-generated outreach copy
- `sequences`, `sequence_steps`, `sequence_enrollments` — drip campaigns
- `email_logs` — sent email tracking (opens/clicks/bounces)
- `activity_logs` — audit trail of user actions
- `billing_events` — Stripe event log

---

## Deployment

### Backend (Railway / Render / Fly.io / EC2)
1. Provision a PostgreSQL database (or use the platform's managed Postgres)
2. Set all env vars from `.env.example`
3. Run `npm run db:migrate` once (or as a release step)
4. Deploy with `npm start`
5. Point Stripe webhook to `https://your-api.com/api/webhooks/stripe`
6. Point SendGrid event webhook to `https://your-api.com/api/webhooks/sendgrid`

### Frontend (Vercel / Netlify / Cloudflare Pages)
1. Set build command: `npm run build`, output dir: `dist`
2. Set `VITE_API_URL` env var to your backend URL
3. Deploy

### Database
Recommended: [Supabase](https://supabase.com) (managed Postgres + connection pooling) or [Neon](https://neon.tech).

---

## Security Notes

- Passwords hashed with bcrypt (12 rounds)
- JWT auth with 7-day expiry
- Rate limiting on auth endpoints (10/15min) and audits (5/min)
- Helmet security headers + CSP
- Input validation via express-validator
- Stripe webhook signature verification
- SQL injection protected via parameterized queries throughout

## License

MIT — build on this freely.
