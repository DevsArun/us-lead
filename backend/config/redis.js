const IORedis = require('ioredis');
const logger = require('../utils/logger');

let redisConnection = null;

function getRedisConnection() {
  if (!redisConnection) {
    redisConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryDelayOnFailover: 100,
      retryDelayOnClusterDown: 100,
      lazyConnect: true,
    });

    redisConnection.on('connect', () => {
      logger.info('Redis connection established.');
    });

    redisConnection.on('error', (err) => {
      logger.error('Redis connection error:', err.message);
    });

    redisConnection.on('close', () => {
      logger.warn('Redis connection closed.');
    });
  }
  return redisConnection;
}

function createRedisConnection() {
  return new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

module.exports = { getRedisConnection, createRedisConnection };
