#!/usr/bin/env node
/**
 * 计划监控与管理 API
 * 提供：计划调整、资料反馈、学习会话、进度监控
 */

const http = require('http');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 创建 HTTP 服务器
function createMonitoringServer() {
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

    // ==================== 计划调整相关 ====================
    
    // 获取用户的计划调整历史
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
        res.end(JSON.stringify({
          adjustments,
          total,
          limit,
          offset
        }));
      } catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: error.message }));
      }
      return;
    }

    // 创建计划调整记录
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
              original_plan: original_plan,
              adjusted_plan: adjusted_plan,
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

    // ==================== 资料反馈相关 ====================
    
    // 获取用户的资料反馈列表
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

    // 提交资料反馈
    if (req.url.match(/^\/api\/v1\/users\/(\d+)\/material-feedback$/) && req.method === 'POST') {
      const userId = parseInt(req.url.split('/')[4]);
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { material_name, rating, feedback_text } = JSON.parse(body);
          
          // UPSERT：如果已存在则更新，否则创建
          const feedback = await prisma.materialFeedback.upsert({
            where: {
              user_id_material_name: {
                user_id: userId,
                material_name: material_name
              }
            },
            update: {
              rating,
              feedback_text,
              is_active: true,
              created_at: new Date()
            },
            create: {
              user_id: userId,
              material_name,
              rating,
              feedback_text,
              is_active: true
            }
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

    // 获取资料推荐（基于用户学习风格和弱项）
    if (req.url.match(/^\/api\/v1\/users\/(\d+)\/material-recommendations$/) && req.method === 'GET') {
      const userId = parseInt(req.url.split('/')[4]);
      
      try {
        const user = await prisma.user.findFirst({
          where: { id: userId },
          select: { learning_style: true, preferred_materials: true }
        });
        
        // 获取薄弱知识点
        const weakPoints = await prisma.progressSnapshot.findMany({
          where: {
            user_id: userId,
            snapshot_date: new Date(new Date().toISOString().split('T')[0])
          },
          orderBy: { accuracy: 'asc' },
          take: 3
        });
        
        // 简单的推荐逻辑（实际应该更复杂）
        const recommendations = [];
        
        // 基于学习风格的推荐
        if (user.learning_style === 'visual') {
          recommendations.push({
            type: 'video_course',
            name: '粉笔系统班视频课',
            reason: '适合视觉学习者，图表丰富'
          });
        } else if (user.learning_style === 'auditory') {
          recommendations.push({
            type: 'audio_lecture',
            name: '花生十三音频课程',
            reason: '适合听觉学习者，讲解清晰'
          });
        } else {
          recommendations.push({
            type: 'interactive',
            name: '粉笔APP题库',
            reason: '互动练习，适合动手型学习者'
          });
        }
        
        // 基于薄弱点的推荐
        weakPoints.forEach(wp => {
          if (wp.accuracy && wp.accuracy < 0.6) {
            recommendations.push({
              type: 'targeted_practice',
              knowledge_point: wp.knowledge_point,
              name: `${wp.knowledge_point}专项练习`,
              reason: `当前正确率仅${Math.round(wp.accuracy * 100)}%，建议强化`,
              current_accuracy: wp.accuracy
            });
          }
        });
        
        // 基于用户喜好的推荐（如果用户已有偏好资料，推荐类似）
        if (user.preferred_materials && user.preferred_materials.length > 0) {
          recommendations.push({
            type: 'similar',
            name: `${user.preferred_materials[0]}进阶版`,
            reason: '基于你的喜好推荐'
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

    // ==================== 学习会话相关 ====================
    
    // 开始学习会话
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
          res.end(JSON.stringify({
            session_id: session.id,
            start_time: session.start_time
          }));
        } catch (error) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }

    // 结束学习会话
    if (req.url.match(/^\/api\/v1\/study-sessions\/(\d+)\/end$/) && req.method === 'POST') {
      const sessionId = parseInt(req.url.split('/')[4]);
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { tasks_completed, correct_count, knowledge_points, mood_after, notes } = JSON.parse(body);
          
          const endTime = new Date();
          const session = await prisma.studySession.findFirst({
            where: { id: sessionId }
          });
          
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
          
          // 更新当日的ProgressSnapshot，增加学习时长
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
              study_minutes_today: {
                increment: durationMinutes
              },
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

    // 获取学习会话历史
    if (req.url.match(/^\/api\/v1\/users\/(\d+)\/study-sessions$/) && req.method === 'GET') {
      const userId = parseInt(req.url.split('/')[4]);
      const urlParams = new URLSearchParams(req.url.split('?')[1] || '');
      const limit = parseInt(urlParams.get('limit')) || 10;
      const days = parseInt(urlParams.get('days')) || 7;
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      try {
        const sessions = await prisma.studySession.findMany({
          where: {
            user_id: userId,
            start_time: { gte: startDate }
          },
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

module.exports = { createMonitoringServer };