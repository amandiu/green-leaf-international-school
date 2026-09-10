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

## API Endpoints (Planned)

> These will be implemented in Phase 5.

| Method | Endpoint           | Description              |
|--------|-------------------|--------------------------|
| POST   | `/api/auth/login` | Admin login              |
| POST   | `/api/auth/logout`| Admin logout             |
| GET    | `/api/home`       | Homepage content         |
| GET    | `/api/about`      | About page content       |
| GET    | `/api/academics`  | Academics content        |
| GET    | `/api/admissions` | Admissions content       |
| GET    | `/api/gallery`    | Gallery images           |
| GET    | `/api/news`       | News articles            |
| GET    | `/api/videos`     | Video listings           |
| POST   | `/api/contact`    | Submit contact form      |
| GET    | `/api/settings`   | Site settings            |

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

> Will be implemented in Phase 6.

Admin routes will require a valid JWT token in the `Authorization` header:

```
Authorization: Bearer <token>
```
