# Baloch AI

Ready-to-deploy starter for a team AI app where:
- regular user login is optional;
- anonymous visitors get a random, server-issued session cookie;
- every anonymous session has isolated chat history;
- logged-in users get their own isolated user/session data;
- admin has a separate dashboard;
- xAI API credentials stay server-side only;
- admin can inspect anonymous session activity without receiving users' passwords;
- API usage/cost is recorded from xAI response usage when available;
- raw IP addresses are NOT stored; an HMAC hash is stored for abuse/security analytics.

## Architecture

Browser / Mobile / APK
        |
        | HTTPS
        v
Backend API
  |-- anonymous session cookie
  |-- optional user JWT
  |-- admin JWT
  |-- rate limits
  |-- authorization checks
        |
        +--> PostgreSQL
        |
        +--> xAI Responses API
              XAI_API_KEY stays here

## Important security boundary

Never put XAI_API_KEY, XAI_MANAGEMENT_API_KEY, admin password, database URL, or any other secret in frontend code or APK assets.

xAI's current API documentation uses `Authorization: Bearer <xAI API key>` against `https://api.x.ai`; the Responses API is the preferred interface. This project calls it only from the backend and sends `store:false` so the app keeps its own conversation history rather than relying on xAI's stateful response storage.

## Environment

Copy `.env.example` to `.env`:

DATABASE_URL=postgres://...
JWT_SECRET=<long random secret>
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=<strong password>
XAI_API_KEY=<xAI API key>
APP_ORIGIN=https://your-frontend.example
COOKIE_SECURE=true
SESSION_TTL_DAYS=30
ALLOW_ANONYMOUS=true
MODEL=grok-4.6
MAX_MESSAGES_PER_DAY_ANON=30
MAX_MESSAGES_PER_DAY_USER=200
ANON_RATE_LIMIT_PER_MINUTE=20
USER_RATE_LIMIT_PER_MINUTE=60
ADMIN_RATE_LIMIT_PER_MINUTE=120
IP_HASH_SECRET=<another long random secret>

## Local

Backend:
  cd backend
  npm install
  npm run migrate
  npm run dev

Frontend:
  cd frontend
  npm install
  npm run dev

Set VITE_API_URL=http://localhost:8080 in frontend/.env.

## Production

Use a managed PostgreSQL database and HTTPS. Run:
  npm run migrate
  npm start

A reverse proxy can route `/api/*` to the backend and everything else to the frontend.

## Admin

Open `/admin`. The admin signs in using ADMIN_EMAIL and ADMIN_PASSWORD. The dashboard shows:
- active/recent sessions;
- anonymous vs authenticated;
- event counts;
- last activity;
- message counts;
- approximate usage/cost recorded from xAI responses.

It does not show the xAI secret or user passwords.

## Privacy

The anonymous session identifier is a random opaque ID. Activity events intentionally avoid storing raw IP addresses; an HMAC hash is stored for security/abuse correlation. Add your own privacy notice/consent requirements according to the jurisdictions and users you serve.

## xAI billing

Your xAI API team billing remains configured in xAI Console. The app's per-user limits are an additional application-level guardrail; they do not replace xAI's team billing/spend controls.
