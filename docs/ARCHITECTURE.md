# Architecture Documentation

## Green Leaf International School & College

---

## System Architecture

```
┌─────────────────────┐     ┌─────────────────────┐
│   Public Website     │     │    Admin Panel       │
│   (React + Vite)     │     │   (React + Vite)     │
│   Port: 5173         │     │   Port: 5174         │
└──────────┬──────────┘     └──────────┬──────────┘
           │                            │
           │         REST API           │
           └────────────┬──────────────┘
                        │
                ┌───────▼───────┐
                │   Express API  │
                │   Port: 5000   │
                └───────┬───────┘
                        │
                ┌───────▼───────┐
                │   Database     │
                │   (TBD Phase 5)│
                └───────────────┘
```

---

## Directory Structure

```
green-leaf-school/
├── client/                    # Public-facing React website
│   ├── public/                # Static assets
│   ├── src/
│   │   ├── Components/        # Reusable UI components
│   │   ├── Pages/             # Page-level components
│   │   ├── Shared/            # Shared utilities within client
│   │   ├── services/          # API service layer
│   │   ├── hooks/             # Custom React hooks
│   │   ├── utils/             # Utility functions
│   │   ├── assets/            # Images, fonts, etc.
│   │   ├── App.jsx            # Root component with routing
│   │   ├── main.jsx           # Entry point
│   │   └── index.css          # Global styles + Tailwind
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── postcss.config.js
│
├── server/                    # Express API backend
│   ├── src/
│   │   ├── config/            # Database, app configuration
│   │   ├── controllers/       # Route handlers
│   │   ├── routes/            # API route definitions
│   │   ├── models/            # Data models
│   │   ├── services/          # Business logic
│   │   ├── middleware/        # Auth, validation, error handling
│   │   ├── validators/       # Input validation schemas
│   │   ├── utils/            # Server utilities
│   │   ├── uploads/          # User-uploaded files
│   │   └── server.js         # Express app entry point
│   ├── admin/                 # Admin React application
│   │   ├── src/
│   │   │   ├── components/   # Admin UI components
│   │   │   ├── pages/        # Admin page components
│   │   │   ├── layouts/      # Admin layout components
│   │   │   ├── services/     # Admin API services
│   │   │   ├── hooks/        # Admin custom hooks
│   │   │   ├── utils/        # Admin utilities
│   │   │   ├── assets/       # Admin assets
│   │   │   ├── App.jsx       # Admin root component
│   │   │   ├── main.jsx      # Admin entry point
│   │   │   └── index.css     # Admin global styles
│   │   └── package.json
│   ├── package.json
│   └── .env                   # Environment variables
│
├── shared/                    # Shared across client and server
│   ├── constants/             # API routes, status codes
│   ├── types/                 # Shared type definitions
│   └── utils/                 # Shared utility functions
│
├── docs/                      # Project documentation
│   ├── API.md
│   ├── DATABASE.md
│   ├── ARCHITECTURE.md
│   └── DEPLOYMENT.md
│
├── package.json               # Root orchestration
├── .gitignore
└── README.md
```

---

## Design System

### Colors
- **Forest Green:** Primary brand color (#2d8a3e)
- **Leaf Green:** Accent/secondary (#4dac54)
- **Cream:** Background (#fefdfb)
- **Charcoal:** Text (#3d3d3d)
- **Gold:** Subtle accent (#d4a843)

### Typography
- **Headings:** Georgia / Times New Roman (serif)
- **Body:** Inter / system-ui (sans-serif)

---

## Data Flow

```
Admin Panel
    ↓ (CRUD operations)
Express API
    ↓ (validation, business logic)
Database
    ↓ (data retrieval)
Public Website
    ↓ (rendered content)
User
```
