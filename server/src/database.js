// 数据库访问层 (基于 Prisma)
const { PrismaClient } = require('@prisma/client');
const cache = require('./cache');

const prisma = new PrismaClient();

class Database {
  // 用户相关
  async getUser(id) {
    // 尝试从缓存获取
    const cacheKey = `user:${id}`;
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const user = await prisma.user.findUnique({ where: { id } });
    if (user) {
      await cache.set(cacheKey, user, 300); // 缓存5分钟
    }
    return user;
  }

  async getUserByOpenId(openId) {
    return await prisma.user.findFirst({ where: { open_id: openId } });
  }

  async saveUser(user) {
    const result = await prisma.user.upsert({
      where: { id: user.id },
      create: user,
      update: user,
    });
    // 清除缓存
    await cache.del(`user:${user.id}`);
    return result;
  }

  async updateUser(id, updates) {
    const result = await prisma.user.update({ where: { id }, data: updates });
    await cache.del(`user:${id}`);
    return result;
  }

  // 任务相关
  async getTodayTask(userId) {
    const cacheKey = `today_task:${userId}`;
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const today = new Date().toISOString().split('T')[0];
    const task = await prisma.task.findFirst({
      where: {
        user_id: userId,
        created_at: {
          gte: new Date(today).getTime(),
        },
      },
      include: {
        questions: true,
      },
      orderBy: { created_at: 'desc' },
    });

    if (task) {
      await cache.set(cacheKey, task, 600); // 缓存10分钟
    }
    return task;
  }

  async createTask(task) {
    const result = await prisma.task.create({ data: task });
    // 清除该用户的今日任务缓存
    await cache.del(`today_task:${task.user_id}`);
    return result;
  }

  async updateTaskProgress(taskId, userId) {
    // 更新任务进度逻辑
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    // ... 计算进度
    // 清除缓存
    await cache.del(`today_task:${userId}`);
    await cache.del(`stats:${userId}`);
    return task;
  }

  async getTaskHistory(userId, limit = 20) {
    return await prisma.task.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: limit,
    });
  }

  // 答案相关
  async saveAnswer(answer) {
    return await prisma.answer.create({ data: answer });
  }

  async getAnswersByTask(taskId) {
    return await prisma.answer.findMany({ where: { task_id: taskId } });
  }

  async getUnsyncedAnswers(userId) {
    return await prisma.answer.findMany({
      where: { user_id: userId, synced: false },
    });
  }

  async markAnswerSynced(answerId) {
    return await prisma.answer.update({
      where: { id: answerId },
      data: { synced: true },
    });
  }

  // 统计数据
  async getDailyProgress(userId, taskId?) {
    // 查询今日答题情况
    const today = new Date().toISOString().split('T')[0];
    const where = {
      user_id: userId,
      created_at: { gte: new Date(today).getTime() },
    };
    if (taskId) {
      where.task_id = taskId;
    }

    const answers = await prisma.answer.findMany({
      where,
      select: { is_correct: true, time_spent_seconds: true },
    });

    const total = answers.length;
    const correct = answers.filter(a => a.is_correct).length;
    const totalTime = answers.reduce((sum, a) => sum + (a.time_spent_seconds || 0), 0);

    return { total, correct, totalTime, accuracy: total > 0 ? (correct / total) * 100 : 0 };
  }

  async getKnowledgeMastery(userId) {
    // 按知识点统计正确率
    const answers = await prisma.answer.findMany({
      where: { user_id: userId },
      include: { question: true },
    });

    const masteryMap = new Map();
    const countMap = new Map();

    answers.forEach(answer => {
      const kps = answer.question.knowledge_points || [];
      kps.forEach(kp => {
        if (!countMap.has(kp)) {
          countMap.set(kp, { correct: 0, total: 0 });
        }
        const stats = countMap.get(kp);
        stats.total++;
        if (answer.is_correct) stats.correct++;
      });
    });

    return Array.from(countMap.entries()).map(([name, stats]) => ({
      name,
      mastered: stats.correct,
      total: stats.total,
      percentage: (stats.correct / stats.total) * 100,
    }));
  }

  async getTimeDistribution(userId, period = 'week') {
    // 按时间段统计学习时长
    const days = period === 'week' ? 7 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const answers = await prisma.answer.findMany({
      where: {
        user_id: userId,
        created_at: { gte: startDate.getTime() },
      },
    });

    // 简单按小时分组
    const distribution = Array(24).fill(0);
    answers.forEach(a => {
      const hour = new Date(a.created_at).getHours();
      distribution[hour] += a.time_spent_seconds || 0;
    });

    return distribution.map((minutes, hour) => ({
      period: `${hour}:00`,
      minutes: Math.floor(minutes / 60),
    }));
  }

  async getScoreTrend(userId, days = 30) {
    // 模拟分数趋势（基于正确率）
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const answers = await prisma.answer.findMany({
      where: {
        user_id: userId,
        created_at: { gte: startDate.getTime() },
      },
    });

    // 按天分组计算正确率
    const daily = new Map();
    answers.forEach(a => {
      const date = new Date(a.created_at).toISOString().split('T')[0];
      if (!daily.has(date)) {
        daily.set(date, { correct: 0, total: 0 });
      }
      const stats = daily.get(date);
      stats.total++;
      if (a.is_correct) stats.correct++;
    });

    return Array.from(daily.entries())
      .map(([date, stats]) => ({
        date: date.slice(5), // MM-DD
        score: Math.round((stats.correct / stats.total) * 100),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // 同步相关
  async getPendingUpdates(userId, since) {
    return await prisma.syncQueue.findMany({
      where: { user_id: userId, created_at: { gt: since } },
    });
  }

  async upsertAnswer(answer, userId) {
    // 插入或更新答案
    return await prisma.answer.upsert({
      where: { id: answer.id },
      create: { ...answer, user_id: userId },
      update: answer,
    });
  }

  async markSynced(syncIds, userId) {
    // 标记同步队列项为已处理
    await prisma.syncQueue.deleteMany({
      where: { id: { in: syncIds }, user_id: userId },
    });
  }
}

module.exports = new Database();
