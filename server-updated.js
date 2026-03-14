#!/usr/bin/env node
/**
 * kaogong-agent 主服务器
 * 集成 OpenClaw Agent 并提供 HTTP API
 */

const http = require('http');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

// 加载配置
const config = require('./config/agent.yaml');
const prisma = new PrismaClient();

// 初始化 OpenClaw（如果已有）
let openclaw = null;
try {
  const { OpenClaw } = require('openclaw');
  openclaw = new OpenClaw({
    gatewayUrl: process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:8080',
    skillsPath: path.join(__dirname, 'skills'),
    logger: console
  });
  console.log('✅ OpenClaw initialized');
} catch (error) {
  console.log('⚠️ OpenClaw not available, running in standalone mode');
}

// 创建 HTTP 服务器
function createServer() {
  const server = http.createServer(async (req, res) => {
    // 设置 CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // 健康检查
    if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
      return;
    }

    // 获取今日任务列表
    if (req.url.match(/^\/api\/v1\/tasks\/daily\?user_id=\d+$/) && req.method === 'GET') {
      const urlParams = new URLSearchParams(req.url.split('?')[1]);
      const userId = parseInt(urlParams.get('user_id'));
      const date = urlParams.get('date') || new Date().toISOString().split('T')[0];
      
      try {
        const tasks = await prisma.dailyTask.findMany({
          where: {
            user_id: userId,
            task_date: new Date(date),
            status: 'pending'
          },
          orderBy: { id: 'asc' }
        });
        
        // 计算进度
        const total = tasks.length;
        const completed = await prisma.dailyTask.count({
          where: {
            user_id: userId,
            task_date: new Date(date),
            status: 'completed'
          }
        });
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          tasks: tasks.map(t => ({
            id: t.id,
            content: t.question_content,
            options: t.options,
            correct_answer: t.correct_answer,
            knowledge_point: t.knowledge_point,
            difficulty: t.difficulty || 'medium',
            points_available: t.points_available,
            estimated_minutes: t.estimated_minutes || 5
          })),
          progress: {
            completed,
            total,
            percentage: total > 0 ? Math.round((completed / total) * 100) : 0
          }
        }));
      } catch (error) {
        console.error('Error fetching daily tasks:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to fetch tasks' }));
      }
      return;
    }

    // 获取单个任务详情
    const taskMatch = req.url.match(/^\/api\/v1\/tasks\/(\d+)\?user_id=(\d+)$/);
    if (taskMatch && req.method === 'GET') {
      const taskId = parseInt(taskMatch[1]);
      const userId = parseInt(taskMatch[2]);
      
      try {
        const task = await prisma.dailyTask.findFirst({
          where: { id: taskId, user_id: userId },
          select: {
            id: true,
            question_content: true,
            options: true,
            correct_answer: true,
            knowledge_point: true,
            points_available: true,
            explanation: true,
            knowledge_tags: true,
            similar_questions: true,
            difficulty: true,
            estimated_minutes: true,
            task_date: true,
            user: {
              select: { streak: true, level: true, total_points: true }
            }
          }
        });
        
        if (!task) {
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'Task not found' }));
          return;
        }
        
        // 获取今日完成情况
        const today = task.task_date.toISOString().split('T')[0];
        const totalTasks = await prisma.dailyTask.count({
          where: { user_id: userId, task_date: new Date(today) }
        });
        const completedTasks = await prisma.dailyTask.count({
          where: { user_id: userId, task_date: new Date(today), status: 'completed' }
        });
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ...task,
          day_number: await calculateDayNumber(userId),
          total_tasks: totalTasks,
          completed_tasks: completedTasks,
          streak: task.user.streak,
          level: task.user.level
        }));
      } catch (error) {
        console.error('Error fetching task:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to fetch task' }));
      }
      return;
    }

    // 提交答案
    const answerMatch = req.url.match(/^\/api\/v1\/tasks\/(\d+)\/answer$/);
    if (answerMatch && req.method === 'POST') {
      const taskId = parseInt(answerMatch[1]);
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { user_answer, time_spent_seconds } = JSON.parse(body);
          
          // 获取任务
          const task = await prisma.dailyTask.findFirst({
            where: { id: taskId, status: 'pending' }
          });
          
          if (!task) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Task not found or already completed' }));
            return;
          }
          
          // 判断对错
          const isCorrect = task.correct_answer === user_answer;
          const pointsEarned = isCorrect ? task.points_available : 0;
          
          // 更新任务状态
          await prisma.dailyTask.update({
            where: { id: taskId },
            data: {
              user_answer,
              is_correct,
              time_spent_seconds,
              points_earned: pointsEarned,
              status: 'completed',
              answered_at: new Date()
            }
          });
          
          // 更新用户积分和连续学习
          await updateUserStats(task.user_id, isCorrect);
          
          // 创建进度快照
          await createProgressSnapshot(task.user_id, task.knowledge_point);
          
          // 返回结果
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            correct: isCorrect,
            points_earned,
            explanation: task.explanation,
            knowledge_points: task.knowledge_tags,
            similar_questions: task.similar_questions,
            user_answer,
            correct_answer: task.correct_answer
          }));
        } catch (error) {
          console.error('Error submitting answer:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to submit answer' }));
        }
      });
      return;
    }

    // 获取用户进度
    const progressMatch = req.url.match(/^\/api\/v1\/users\/(\d+)\/progress$/);
    if (progressMatch && req.method === 'GET') {
      const userId = parseInt(progressMatch[1]);
      const urlParams = new URLSearchParams(req.url.split('?')[1] || '');
      const date = urlParams.get('date') || new Date().toISOString().split('T')[0];
      
      try {
        // 获取今日完成情况
        const todayTasks = await prisma.dailyTask.findMany({
          where: {
            user_id: userId,
            task_date: new Date(date)
          }
        });
        
        const completed = todayTasks.filter(t => t.status === 'completed');
        const total = todayTasks.length;
        const correctCount = completed.filter(t => t.is_correct).length;
        const accuracy = completed.length > 0 ? (correctCount / completed.length) : 0;
        
        // 按知识点统计
        const knowledgeStats = {};
        completed.forEach(t => {
          const kp = t.knowledge_point;
          if (!knowledgeStats[kp]) {
            knowledgeStats[kp] = { total: 0, correct: 0 };
          }
          knowledgeStats[kp].total++;
          if (t.is_correct) knowledgeStats[kp].correct++;
        });
        
        // 计算各知识点正确率
        const knowledgePointAccuracy = {};
        Object.entries(knowledgeStats).forEach(([kp, stats]) => {
          knowledgePointAccuracy[kp] = stats.correct / stats.total;
        });
        
        // 获取用户最新信息
        const user = await prisma.user.findFirst({
          where: { id: userId },
          select: { streak: true, level: true, total_points: true, target_score_xingce: true, target_score_shenlun: true }
        });
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          date,
          completed_tasks: completed.length,
          total_tasks: total,
          accuracy,
          knowledge_point_accuracy: knowledgePointAccuracy,
          streak: user.streak,
          level: user.level,
          total_points: user.total_points,
          target_scores: {
            xingce: user.target_score_xingce,
            shenlun: user.target_score_shenlun
          }
        }));
      } catch (error) {
        console.error('Error fetching progress:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to fetch progress' }));
      }
      return;
    }

    // 404
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not Found' }));
  });

  return server;
}

// 计算用户学习天数
async function calculateDayNumber(userId) {
  const user = await prisma.user.findFirst({
    where: { id: userId },
    select: { registered_at: true }
  });
  
  if (!user) return 1;
  
  const regDate = new Date(user.registered_at);
  const today = new Date();
  const diff = Math.floor((today - regDate) / (24 * 60 * 60 * 1000));
  return diff + 1;
}

// 更新用户状态（积分、连续学习）
async function updateUserStats(userId, isCorrect) {
  const user = await prisma.user.findFirst({
    where: { id: userId }
  });
  
  // 检查昨日是否完成任务
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayTasks = await prisma.dailyTask.findMany({
    where: {
      user_id: userId,
      task_date: yesterday,
      status: 'completed'
    }
  });
  
  let newStreak = user.streak;
  if (yesterdayTasks.length > 0) {
    // 昨日有完成，保持连续或增加
    if (isCorrect) newStreak++;
  } else {
    // 昨日无完成，重置连续
    newStreak = isCorrect ? 1 : 0;
  }
  
  // 计算总积分（这里简化，实际应该累计）
  const totalPoints = user.total_points + (isCorrect ? 12 : 0); // 假设每题平均12分
  
  // 计算等级（每500分升一级）
  const newLevel = Math.floor(totalPoints / 500) + 1;
  
  await prisma.user.update({
    where: { id: userId },
    data: {
      streak: newStreak,
      total_points: totalPoints,
      level: newLevel
    }
  });
}

// 创建进度快照
async function createProgressSnapshot(userId, knowledgePoint) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  // 查询最近30天该知识点的数据
  const tasks = await prisma.dailyTask.findMany({
    where: {
      user_id: userId,
      knowledge_point: knowledgePoint,
      status: 'completed',
      created_at: { gte: thirtyDaysAgo }
    }
  });
  
  const total = tasks.length;
  const correct = tasks.filter(t => t.is_correct).length;
  const accuracy = total > 0 ? (correct / total) : 0;
  
  // 估算得分（简化的算法）
  const estimatedScore = accuracy * 100; // 假设满分100
  
  const today = new Date().toISOString().split('T')[0];
  
  await prisma.progressSnapshot.upsert({
    where: {
      user_id_snapshot_date_knowledge_point: {
        user_id: userId,
        snapshot_date: new Date(today),
        knowledge_point: knowledgePoint
      }
    },
    update: {
      total_questions: total,
      correct_count: correct,
      accuracy: accuracy,
      estimated_score: estimatedScore,
      streak_days: await getUserStreak(userId),
      level: await getUserLevel(userId),
      total_points: await getUserTotalPoints(userId)
    },
    create: {
      user_id: userId,
      snapshot_date: new Date(today),
      knowledge_point: knowledgePoint,
      total_questions: total,
      correct_count: correct,
      accuracy: accuracy,
      estimated_score: estimatedScore,
      streak_days: await getUserStreak(userId),
      level: await getUserLevel(userId),
      total_points: await getUserTotalPoints(userId)
    }
  });
}

async function getUserStreak(userId) {
  const user = await prisma.user.findFirst({ where: { id: userId } });
  return user?.streak || 0;
}

async function getUserLevel(userId) {
  const user = await prisma.user.findFirst({ where: { id: userId } });
  return user?.level || 1;
}

async function getUserTotalPoints(userId) {
  const user = await prisma.user.findFirst({ where: { id: userId } });
  return user?.total_points || 0;
}

// 启动
async function main() {
  console.log('🚀 启动考公学习伴侣...');
  
  const server = createServer();
  const port = process.env.PORT || 8080;
  
  server.listen(port, () => {
    console.log(`✅ Server listening on port ${port}`);
    console.log(`📊 Health check: http://localhost:${port}/health`);
    console.log(`📚 API endpoints:`);
    console.log(`   GET  /api/v1/tasks/daily?user_id={id}`);
    console.log(`   GET  /api/v1/tasks/{id}?user_id={id}`);
    console.log(`   POST /api/v1/tasks/{id}/answer`);
    console.log(`   GET  /api/v1/users/{id}/progress`);
  });
  
  // 优雅关闭
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    server.close(async () => {
      await prisma.$disconnect();
      console.log('Server closed');
      process.exit(0);
    });
  });
}

main().catch(console.error);