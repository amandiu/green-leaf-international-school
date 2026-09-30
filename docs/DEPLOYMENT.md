# Deployment Documentation

## Green Leaf International School & College

> Production deployment (VPS + Nginx + PM2 + managed database) is planned
> work — see PROJECT_MASTER_PLAN.md Phase Q. This document reflects the real,
> verified runtime contract; do not invent configuration here.

---

## Prerequisites

- Node.js >= 18.x
- npm >= 9.x
- Database server: MySQL 8+ / MariaDB 10.4+ (`server/src/config/db.js`)

---

## Environment Variables

### Server (.env)

| Variable       | Description              | Default                    |
|----------------|--------------------------|----------------------------|
| NODE_ENV       | Environment mode         | development                |
| PORT           | Server port              | 5000                       |
| CLIENT_URL     | Client app URL           | http://localhost:5173       |
| ADMIN_URL      | Admin app URL            | http://localhost:5174       |
| DB_HOST        | Database host            | (required in production)   |
| DB_PORT        | Database port            | (required in production)   |
| DB_NAME        | Database name            | (required in production)   |
| DB_USER        | Database user            | (required in production)   |
| DB_PASSWORD    | Database password        | (required in production)   |
| AUTH_SECRET    | Admin session signing secret (HMAC; server refuses to start without it, min 32 chars) | (required) |
| SESSION_TTL_HOURS | Admin session lifetime in hours | 12 |
| ADMIN_TOKEN    | DEPRECATED Bearer secret for scripts/tests only (may be removed) | (optional) |

---

## Development

```bash
# Install all dependencies
npm run install:all

# Run all services
npm run dev

# Run individually
npm run dev:client   # http://localhost:5173
npm run dev:server   # http://localhost:5000
npm run dev:admin    # http://localhost:5174
```

---

## Production Build

```bash
# Build client and admin
npm run build

# Start server
npm run start
```

---

## Reverse Proxy / trust proxy (verify at deployment)

The API currently runs with `app.set('trust proxy', 1)`
(`server/src/server.js`): it trusts exactly ONE proxy hop so `req.ip` is the
real client address behind the local Vite dev proxy / cloudflared quick
-tunnel — this keeps rate-limit buckets per-client instead of one shared
loopback bucket.

Before the final VPS deployment, VERIFY this setting against the actual
production topology:

- **One local reverse proxy in front of the API** (e.g. Nginx on the same
  host): `trust proxy = 1` remains correct.
- **Additional layers** (Cloudflare/NLB in front of Nginx): set the number
  of trusted hops to match, or use `trust proxy` with a known proxy IP —
  too few hops breaks real-IP extraction (rate limits keyed on the proxy),
  too many allows client-spoofed `X-Forwarded-For` to defeat IP rate
  limits.
- Check `secure` cookie behavior and the CSRF Origin/Referer guard
  (`X-Forwarded-Proto`) once TLS terminates at the proxy.

Do NOT change the value blindly — verify the deployed proxy chain first.

---

## Deployment Targets (Planned)

- **VPS/Cloud:** DigitalOcean, AWS EC2, or similar
- **Database:** MySQL 8+ / MariaDB 10.4+ (managed, with automated backups)
- **File Storage:** Local filesystem (expandable to S3)
- **Process Manager:** PM2 (recommended)
- **Reverse Proxy:** Nginx (recommended)
- **SSL:** Let's Encrypt (recommended)
