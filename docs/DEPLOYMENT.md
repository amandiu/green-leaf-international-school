# Deployment Documentation

## Green Leaf International School & College

> Detailed deployment configuration will be finalized in Phase 11.

---

## Prerequisites

- Node.js >= 18.x
- npm >= 9.x
- Database server (TBD)

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
| JWT_SECRET     | JWT signing secret       | (required in production)   |
| JWT_EXPIRES_IN | JWT expiration           | 7d                         |

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

## Deployment Targets (Planned)

- **VPS/Cloud:** DigitalOcean, AWS EC2, or similar
- **Database:** PostgreSQL or MongoDB (TBD Phase 5)
- **File Storage:** Local filesystem (expandable to S3)
- **Process Manager:** PM2 (recommended)
- **Reverse Proxy:** Nginx (recommended)
- **SSL:** Let's Encrypt (recommended)
