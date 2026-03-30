// Redis 缓存客户端
const redis = require('redis');

class CacheService {
  constructor() {
    this.client = null;
    this.enabled = process.env.REDIS_URL ? true : false;
  }

  async connect() {
    if (!this.enabled) return;

    try {
      this.client = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
      });
      await this.client.connect();
      console.log('Redis connected');
    } catch (error) {
      console.error('Redis connection failed:', error);
      this.enabled = false;
    }
  }

  async get(key) {
    if (!this.enabled || !this.client) return null;
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  async set(key, value, ttlSeconds = 3600) {
    if (!this.enabled || !this.client) return;
    try {
      await this.client.setEx(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }

  async del(key) {
    if (!this.enabled || !this.client) return;
    try {
      await this.client.del(key);
    } catch (error) {
      console.error('Redis del error:', error);
    }
  }

  async close() {
    if (this.client) {
      await this.client.quit();
    }
  }
}

module.exports = new CacheService();
