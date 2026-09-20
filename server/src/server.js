import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

// Fail fast when the session secret is missing/weak — admin
// sessions cannot be signed without it.
if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
  console.error('FATAL: AUTH_SECRET is missing or too short (min 32 chars). Set it in server/.env.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;

// --------------- Middleware ---------------
import { attachSessionUser, jsonBodyErrorHandler } from './middleware/sessionAuth.js';

// Security headers
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: [
    process.env.CLIENT_URL || 'http://localhost:5173',
    process.env.ADMIN_URL || 'http://localhost:5174',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Request logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookies (admin session) + safe handling of malformed JSON bodies
app.use(cookieParser());
app.use(attachSessionUser);
app.use(jsonBodyErrorHandler);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// --------------- Health Endpoint ---------------

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Green Leaf API is running',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

// --------------- API Routes ---------------
import authRoutes from './routes/authRoutes.js';
app.use('/api/auth', authRoutes);

import navigationRoutes from './routes/navigationRoutes.js';
app.use('/api/navigation', navigationRoutes);

import adminNavigationRoutes from './routes/adminNavigationRoutes.js';
app.use('/api/admin/navigation', adminNavigationRoutes);

import leadershipRoutes, { adminLeadershipRouter } from './routes/leadershipRoutes.js';
app.use('/api/leadership-messages', leadershipRoutes);
app.use('/api/admin/leadership-messages', adminLeadershipRouter);

// Combined public payload: section copy + active messages.
import { getPublicLeadership } from './controllers/leadershipController.js';
app.get('/api/leadership', getPublicLeadership);

// Admin section settings (same adminAuth gate as the messages router).
import adminAuth from './middleware/sessionAuth.js';
import {
  getLeadershipSectionSettings,
  updateLeadershipSectionSettings,
} from './controllers/leadershipController.js';
const leadershipSectionAdmin = express.Router();
leadershipSectionAdmin.use(adminAuth);
leadershipSectionAdmin.get('/', getLeadershipSectionSettings);
leadershipSectionAdmin.put('/', updateLeadershipSectionSettings);
app.use('/api/admin/leadership-section', leadershipSectionAdmin);

import uploadsRoutes from './routes/uploadsRoutes.js';
app.use('/api/uploads', uploadsRoutes);

// --------------- 404 Handler ---------------

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

// --------------- Global Error Handler ---------------

app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message || 'Internal server error',
  });
});

// --------------- Start Server ---------------

app.listen(PORT, () => {
  console.log(`🌿 Green Leaf API server running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
});

export default app;
