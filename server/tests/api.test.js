const request = require('supertest');
const app = require('../src/index');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

describe('API Integration Tests', () => {
  let authToken;

  beforeAll(async () => {
    // 清理测试数据
    await prisma.answer.deleteMany();
    await prisma.task.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login successfully with valid code', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ code: 'test_code' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('access_token');
      expect(response.body.data).toHaveProperty('user');
      authToken = response.body.data.access_token;
    });

    it('should reject missing code', async () => {
      await request(app)
        .post('/api/v1/auth/login')
        .send({})
        .expect(400);
    });
  });

  describe('GET /api/v1/tasks/today', () => {
    it('should return 401 without token', async () => {
      await request(app)
        .get('/api/v1/tasks/today')
        .expect(401);
    });

    it('should return task when authenticated', async () => {
      // 先创建一个任务
      const userId = 'test_user_1';
      await prisma.task.create({
        data: {
          id: 'task_test_1',
          user_id: userId,
          day_number: 1,
          knowledge_point: '数量关系',
          estimated_minutes: 30,
          points_available: 100,
          streak: 1,
        },
      });

      const response = await request(app)
        .get('/api/v1/tasks/today')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
    });
  });

  describe('POST /api/v1/tasks/:id/answer', () => {
    it('should submit answer successfully', async () => {
      const taskId = 'task_test_1';
      const response = await request(app)
        .post(`/api/v1/tasks/${taskId}/answer`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          question_id: 'q1',
          user_answer: 'A',
          time_spent_seconds: 120,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('correct');
    });

    it('should reject invalid question', async () => {
      await request(app)
        .post('/api/v1/tasks/invalid_task/answer')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          question_id: 'q1',
          user_answer: 'A',
          time_spent_seconds: 120,
        })
        .expect(404);
    });
  });

  describe('GET /api/v1/stats/daily', () => {
    it('should return daily progress', async () => {
      const response = await request(app)
        .get('/api/v1/stats/daily')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('correct');
      expect(response.body.data).toHaveProperty('accuracy');
    });
  });

  describe('WebSocket Connection', () => {
    it('should reject connection without token', (done) => {
      const WebSocket = require('ws');
      const ws = new WebSocket('ws://localhost:8080/ws');

      ws.on('close', (code) => {
        expect(code).toBe(1008);
        ws.terminate();
        done();
      });
    });
  });
});
