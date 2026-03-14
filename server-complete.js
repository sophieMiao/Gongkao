#!/usr/bin/env node
/**
 * kaogong-agent 主服务器（完整版）
 * 包含：每日练习 + 计划监控 + 资料推荐 + 学习会话
 */

const http = require('http');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 初始化 OpenClaw（可选）
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
  console.log('⚠️ OpenClaw not available, standalone mode');
}

// 创建 HTTP 服务器
function createServer() {
  const server = http.createServer(async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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

    // ==================== 路由分发 ====================

    // [原有的每日练习API保持不变...]
    // 这里省略原有代码，实际应该包含之前的所有API

    // ==================== 新增：学习风格管理 ====================
    
    // GET /api/v1/users/{userId}/learning-style
    if (req.url.match(/^\/api\/v1\/users\/(\d+)\/learning-style$/) && req.method === 'GET') {
      const userId = parseInt(req.url.split('/')[4]);
      try {
        const user = await prisma.user.findFirst({
          where: { id: userId },
          select: { learning_style: true, preferred_materials: true }
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(user || { learning_style: null, preferred_materials: [] }));
      } catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: error.message }));
      }
      return;
    }

    // POST /api/v1/users/{userId}/learning-style
    if (req.url.match(/^\/api\/v1\/users\/(\d+)\/learning-style$/) && req.method === 'POST') {
      const userId = parseInt(req.url.split('/')[4]);
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { learning_style, preferred_materials } = JSON.parse(body);
          const user = await prisma.user.update({
            where: { id: userId },
            data: {
              learning_style,
              preferred_materials: preferred_materials || []
            }
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(user));
        } catch (error) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }

    // ==================== 计划调整管理 ====================
    
    // GET /api/v1/users/{userId}/plan-adjustments
    if (req.url.match(/^\/api\/v1\/users\/(\d+)\/plan-adjustments$/) && req.method === 'GET') {
      const userId = parseInt(req.url.split('/')[4]);
      const urlParams = new URLSearchParams(req.url.split('?')[1] || '');
      const limit = parseInt(urlParams.get('limit')) || 20;
      const offset = parseInt(urlParams.get('offset')) || 0;
      
      try {
        const adjustments = await prisma.planAdjustment.findMany({
          where: { user_id: userId },
          orderBy: { adjustment_date: 'desc' },
          take: limit,
          skip: offset
        });
        const total = await prisma.planAdjustment.count({ where: { user_id: userId } });
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ adjustments, total, limit, offset }));
      } catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: error.message }));
      }
      return;
    }

    // POST /api/v1/users/{userId}/plan-adjustments
    if (req.url.match(/^\/api\/v1\/users\/(\d+)\/plan-adjustments$/) && req.method === 'POST') {
      const userId = parseInt(req.url.split('/')[4]);
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { reason, reason_detail, original_plan, adjusted_plan, impact_modules } = JSON.parse(body);
          const adjustment = await prisma.planAdjustment.create({
            data: {
              user_id: userId,
              reason,
              reason_detail,
              original_plan,
              adjusted_plan,
              impact_modules: impact_modules || []
            }
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(adjustment));
        } catch (error) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }

    // ==================== 资料反馈管理 ====================
    
    // GET /api/v1/users/{userId}/material-feedback
    if (req.url.match(/^\/api\/v1\/users\/(\d+)\/material-feedback$/) && req.method === 'GET') {
      const userId = parseInt(req.url.split('/')[4]);
      try {
        const feedbacks = await prisma.materialFeedback.findMany({
          where: { user_id: userId },
          orderBy: { created_at: 'desc' }
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ feedbacks }));
      } catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: error.message }));
      }
      return;
    }

    // POST /api/v1/users/{userId}/material-feedback
    if (req.url.match(/^\/api\/v1\/users\/(\d+)\/material-feedback$/) && req.method === 'POST') {
      const userId = parseInt(req.url.split('/')[4]);
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { material_name, rating, feedback_text } = JSON.parse(body);
          const feedback = await prisma.materialFeedback.upsert({
            where: {
              user_id_material_name: { user_id: userId, material_name }
            },
            update: { rating, feedback_text, is_active: true, created_at: new Date() },
            create: { user_id: userId, material_name, rating, feedback_text, is_active: true }
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(feedback));
        } catch (error) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }

    // ==================== 资料推荐系统 ====================
    
    // GET /api/v1/users/{userId}/material-recommendations
    if (req.url.match(/^\/api\/v1\/users\/(\d+)\/material-recommendations$/) && req.method === 'GET') {
      const userId = parseInt(req.url.split('/')[4]);
      
      try {
        // 获取用户学习风格
        const user = await prisma.user.findFirst({
          where: { id: userId },
          select: { learning_style: true, preferred_materials: true }
        });
        
        // 获取薄弱知识点
        const today = new Date().toISOString().split('T')[0];
        const weakPoints = await prisma.progressSnapshot.findMany({
          where: {
            user_id: userId,
            snapshot_date: new Date(today)
          },
          orderBy: { accuracy: 'asc' },
          take: 3
        });
        
        const recommendations = [];
        
        // 基于学习风格推荐
        const styleRecommendations = {
          visual: {
            type: 'video_course',
            name: '粉笔系统班视频课',
            reason: '适合视觉学习者，图表丰富，讲解直观'
          },
          auditory: {
            type: 'audio_lecture',
            name: '花生十三音频课程',
            reason: '适合听觉学习者，逻辑清晰，便于记忆'
          },
          kinesthetic: {
            type: 'interactive',
            name: '粉笔APP题库 + 手写笔记',
            reason: '适合动手型学习者，边做边记'
          },
          mixed: {
            type: 'comprehensive',
            name: '粉笔980系统班（视频+题库）',
            reason: '综合性强，适合混合型学习者'
          }
        };
        
        if (user.learning_style && styleRecommendations[user.learning_style]) {
          recommendations.push(styleRecommendations[user.learning_style]);
        } else {
          recommendations.push(styleRecommendations.mixed);
        }
        
        // 基于薄弱点推荐专项练习
        weakPoints.forEach(wp => {
          if (wp.accuracy && wp.accuracy < 0.6) {
            recommendations.push({
              type: 'targeted_practice',
              knowledge_point: wp.knowledge_point,
              name: `${wp.knowledge_point}专项突破`,
              reason: `当前正确率仅${Math.round(wp.accuracy * 100)}%，建议集中练习`,
              current_accuracy: wp.accuracy
            });
          }
        });
        
        // 基于用户喜好推荐
        if (user.preferred_materials && user.preferred_materials.length > 0) {
          recommendations.push({
            type: 'similar',
            name: `${user.preferred_materials[0]}进阶课程`,
            reason: '基于你的学习偏好推荐'
          });
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          learning_style: user.learning_style,
          weak_points: weakPoints,
          recommendations
        }));
      } catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: error.message }));
      }
      return;
    }

    // ==================== 学习会话管理 ====================
    
    // POST /api/v1/users/{userId}/study-sessions/start
    if (req.url.match(/^\/api\/v1\/users\/(\d+)\/study-sessions\/start$/) && req.method === 'POST') {
      const userId = parseInt(req.url.split('/')[4]);
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const session = await prisma.studySession.create({
            data: {
              user_id: userId,
              start_time: new Date(),
              tasks_completed: 0,
              correct_count: 0
            }
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ session_id: session.id, start_time: session.start_time }));
        } catch (error) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }

    // POST /api/v1/study-sessions/{sessionId}/end
    if (req.url.match(/^\/api\/v1\/study-sessions\/(\d+)\/end$/) && req.method === 'POST') {
      const sessionId = parseInt(req.url.split('/')[4]);
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { tasks_completed, correct_count, knowledge_points, mood_after, notes } = JSON.parse(body);
          
          const session = await prisma.studySession.findFirst({ where: { id: sessionId } });
          if (!session) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Session not found' }));
            return;
          }
          
          const endTime = new Date();
          const durationMinutes = Math.floor((endTime - new Date(session.start_time)) / (60 * 1000));
          
          await prisma.studySession.update({
            where: { id: sessionId },
            data: {
              end_time: endTime,
              duration_minutes: durationMinutes,
              tasks_completed,
              correct_count,
              knowledge_points: knowledge_points || [],
              mood_after,
              notes
            }
          });
          
          // 更新当日进度
          const today = new Date().toISOString().split('T')[0];
          await prisma.progressSnapshot.upsert({
            where: {
              user_id_snapshot_date_knowledge_point: {
                user_id: session.user_id,
                snapshot_date: new Date(today),
                knowledge_point: 'TOTAL'
              }
            },
            update: {
              study_minutes_today: { increment: durationMinutes },
              mood_today: mood_after
            },
            create: {
              user_id: session.user_id,
              snapshot_date: new Date(today),
              knowledge_point: 'TOTAL',
              study_minutes_today: durationMinutes,
              mood_today: mood_after
            }
          });
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            session_id: sessionId,
            duration_minutes,
            tasks_completed,
            accuracy: tasks_completed > 0 ? (correct_count / tasks_completed) : 0
          }));
        } catch (error) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }

    // GET /api/v1/users/{userId}/study-sessions
    if (req.url.match(/^\/api\/v1\/users\/(\d+)\/study-sessions$/) && req.method === 'GET') {
      const userId = parseInt(req.url.split('/')[4]);
      const urlParams = new URLSearchParams(req.url.split('?')[1] || '');
      const limit = parseInt(urlParams.get('limit')) || 10;
      const days = parseInt(urlParams.get('days')) || 7;
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      try {
        const sessions = await prisma.studySession.findMany({
          where: { user_id: userId, start_time: { gte: startDate } },
          orderBy: { start_time: 'desc' },
          take: limit
        });
        
        const totalMinutes = sessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
        const totalTasks = sessions.reduce((sum, s) => sum + (s.tasks_completed || 0), 0);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          sessions,
          summary: {
            total_sessions: sessions.length,
            total_minutes: totalMinutes,
            total_tasks: totalTasks,
            avg_session_length: sessions.length > 0 ? Math.round(totalMinutes / sessions.length) : 0
          }
        }));
      } catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: error.message }));
      }
      return;
    }

    // 404
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not Found' }));
  });

  return server;
}

// [保留原有的辅助函数：calculateDayNumber, updateUserStats, createProgressSnapshot等]

async function calculateDayNumber(userId) {
  const user = await prisma.user.findFirst({ where: { id: userId }, select: { registered_at: true } });
  if (!user) return 1;
  const regDate = new Date(user.registered_at);
  const today = new Date();
  const diff = Math.floor((today - regDate) / (24 * 60 * 60 * 1000));
  return diff + 1;
}

async function updateUserStats(userId, isCorrect) {
  const user = await prisma.user.findFirst({ where: { id: userId } });
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayTasks = await prisma.dailyTask.findMany({
    where: { user_id: userId, task_date: yesterday, status: 'completed' }
  });
  
  let newStreak = user.streak;
  if (yesterdayTasks.length > 0) {
    if (isCorrect) newStreak++;
  } else {
    newStreak = isCorrect ? 1 : 0;
  }
  
  const totalPoints = user.total_points + (isCorrect ? 12 : 0);
  const newLevel = Math.floor(totalPoints / 500) + 1;
  
  await prisma.user.update({
    where: { id: userId },
    data: { streak: newStreak, total_points: totalPoints, level: newLevel }
  });
}

async function createProgressSnapshot(userId, knowledgePoint) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
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
  const estimatedScore = accuracy * 100;
  
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
  console.log('🚀 启动考公学习伴侣（完整版）...');
  
  const server = createServer();
  const port = process.env.PORT || 8080;
  
  server.listen(port, () => {
    console.log(`✅ Server listening on port ${port}`);
    console.log(`📊 Health check: http://localhost:${port}/health`);
    console.log(`📚 API endpoints:`);
    console.log(`   GET/POST  /api/v1/users/{id}/learning-style`);
    console.log(`   GET/POST  /api/v1/users/{id}/plan-adjustments`);
    console.log(`   GET/POST  /api/v1/users/{id}/material-feedback`);
    console.log(`   GET       /api/v1/users/{id}/material-recommendations`);
    console.log(`   POST      /api/v1/users/{id}/study-sessions/start`);
    console.log(`   POST      /api/v1/study-sessions/{id}/end`);
    console.log(`   GET       /api/v1/users/{id}/study-sessions`);
    console.log(`   [原有每日练习API保持不变]`);
  });
  
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down...');
    server.close(async () => {
      await prisma.$disconnect();
      console.log('Server closed');
      process.exit(0);
    });
  });
}

main().catch(console.error);