const dotenvPath = require('path').resolve(__dirname, '..', '.env');
require('dotenv').config({ path: dotenvPath });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const { sequelize } = require('./models');
const { initQueues } = require('./queues');
const { initWorkers } = require('./queues/workers');
const logger = require('./utils/logger');

const authRoutes = require('./routes/auth');
const campaignRoutes = require('./routes/campaigns');
const businessRoutes = require('./routes/businesses');
const emailRoutes = require('./routes/emails');
const outreachRoutes = require('./routes/outreach');
const analyticsRoutes = require('./routes/analytics');
const settingsRoutes = require('./routes/settings');
const pipelineRoutes = require('./routes/pipeline');
const repliesRoutes = require('./routes/replies');

const errorHandler = require('./middleware/errorHandler');
const rateLimiter = require('./middleware/rateLimiter');

const app = express();
const PORT = process.env.PORT || 7860;

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) }
}));
app.use(rateLimiter);

app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.use('/api/auth', authRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/businesses', businessRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/outreach', outreachRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/pipeline', pipelineRoutes);
app.use('/api/replies', repliesRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

app.all('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint not found: ${req.method} ${req.path}`,
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

app.use(errorHandler);

async function startServer() {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully.');

    await sequelize.sync({ alter: true });
    logger.info('Database models synchronized.');

    await initQueues();
    logger.info('BullMQ queues initialized.');

    await initWorkers();
    logger.info('BullMQ workers started.');

    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`LeadForge AI server running on http://0.0.0.0:${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      
      // Keep-Alive Ping — prevents Render/HF free tier from sleeping
      // Pings own health endpoint every 10 minutes
      setInterval(() => {
        fetch(`http://localhost:${PORT}/api/health`)
          .then(res => {
            if (res.ok) logger.debug('Keep-alive ping successful');
            else logger.warn(`Keep-alive ping warning: ${res.status}`);
          })
          .catch(err => logger.error('Keep-alive ping failed:', err.message));
      }, 10 * 60 * 1000);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  await sequelize.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  await sequelize.close();
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

startServer();
