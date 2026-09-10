# Green Leaf International School & College

A modern, premium full-stack website for Green Leaf International School & College.

## Tech Stack

| Layer     | Technology                        |
|-----------|-----------------------------------|
| Frontend  | React + JavaScript + JSX + Vite   |
| Backend   | Node.js + Express                 |
| Database  | (Configured per phase)            |
| Admin     | React + JavaScript + JSX + Vite   |
| Styling   | Tailwind CSS                      |
| API       | REST API                          |

## Project Structure

```
green-leaf-school/
├── client/          # Public-facing React website
├── server/          # Express API backend
│   └── admin/       # Admin panel React app
├── shared/          # Shared constants, types, utils
├── docs/            # Project documentation
└── package.json     # Root scripts and orchestration
```

## Getting Started

### Prerequisites

- Node.js >= 18.x
- npm >= 9.x

### Installation

```bash
npm run install:all
```

### Development

Run all services concurrently:

```bash
npm run dev
```

Or run individually:

```bash
# Client (http://localhost:5173)
npm run dev:client

# Server (http://localhost:5000)
npm run dev:server

# Admin (http://localhost:5174)
npm run dev:admin
```

### Build

```bash
npm run build
```

## Documentation

- [API Documentation](docs/API.md)
- [Database Documentation](docs/DATABASE.md)
- [Architecture Documentation](docs/ARCHITECTURE.md)
- [Deployment Documentation](docs/DEPLOYMENT.md)

## License

Proprietary — Green Leaf International School & College
# green-leaf-international-school
