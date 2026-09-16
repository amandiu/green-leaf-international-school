import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

const app = express();
const PORT = process.env.PORT || 5000;

// --------------- Middleware ---------------

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
import navigationRoutes from './routes/navigationRoutes.js';
app.use('/api/navigation', navigationRoutes);

import adminNavigationRoutes from './routes/adminNavigationRoutes.js';
app.use('/api/admin/navigation', adminNavigationRoutes);

import leadershipRoutes from './routes/leadershipRoutes.js';
app.use('/api/leadership-messages', leadershipRoutes);

import { adminLeadershipRouter } from './routes/leadershipRoutes.js';
app.use('/api/admin/leadership-messages', adminLeadershipRouter);

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
