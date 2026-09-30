# API Documentation

## Green Leaf International School & College — REST API

**Base URL:** `http://localhost:5000`

---

## Health Check

### GET `/api/health`

Check if the API server is running.

**Response:**

```json
{
  "success": true,
  "message": "Green Leaf API is running",
  "environment": "development",
  "timestamp": "2026-09-09T00:00:00.000Z"
}
```

**Status:** `200 OK`

---

## API Endpoints (Implemented)

> The API is live; this table lists the core public endpoints. The complete
> mounted route map (public + admin) is maintained in SYSTEM_DESIGN.md §E.

| Method | Endpoint                  | Description                                   |
|--------|---------------------------|-----------------------------------------------|
| POST   | `/api/auth/login`         | Admin login (session cookie)                  |
| POST   | `/api/auth/logout`        | Admin logout                                  |
| GET    | `/api/navigation`         | Public navigation tree                        |
| GET    | `/api/pages/home`         | Homepage content (resolved sections)          |
| GET    | `/api/content/blocks`     | Reusable content blocks                       |
| GET    | `/api/gallery`            | Gallery images (PUBLISHED)                    |
| GET    | `/api/news`               | News articles (`?type=&limit=&offset=`)       |
| GET    | `/api/news/:slug`         | News detail (PUBLISHED only)                  |
| GET    | `/api/downloads`          | Downloads Center (PUBLISHED)                  |
| GET    | `/api/leadership`         | Leadership section + messages                 |
| POST   | `/api/contact`            | Submit contact form                           |
| GET    | `/api/settings`           | Site settings (effective merged)              |

---

## Error Response Format

All errors follow a consistent structure:

```json
{
  "success": false,
  "message": "Error description"
}
```

---

## Authentication

Admin sessions use an HMAC-SHA256 signed, HttpOnly session cookie issued by
`POST /api/auth/login` (SameSite=Lax; `secure` in production). There is no JWT.
State-changing `/api/auth/*` and `/api/admin/*` requests are additionally
guarded by Origin/Referer validation.

Scripts/tests may use the deprecated `Authorization: Bearer <ADMIN_TOKEN>`
transition path.
