#!/usr/bin/env node
/**
 * kaogong-agent SaaS 版主服务器
 * 提供 REST API + 飞书 Webhook 处理
 */

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { verifyFeishuRequest } = require('./utils/feishu-verify');
const { sendFeishuMessage } = require('./utils/feishu-sender');
const { TaskScheduler } = require('./utils/task-scheduler');
const { ProgressAssessor } = require('./utils/progress-assessor');
const { QuestionBank } = require('./utils/question-bank');
const { AIGenerator } = require('./utils/ai-generator');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const app = express();
const prisma = new PrismaClient();

// 中间件
app.use(express.json());
app.use(express.static('public')); // 静态文件（答题页面）

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== API 路由 ====================

// 1. 用户注册
app.post('/api/v1/register', async (req, res) => {
  try {
    const { open_id, name, target_region, exam_type, target_score, exam_date } = req.body;
    
    if (!open_id || !name || !exam_type || !target_score) {
      return res.status(400).json({
        error: '缺少必要参数',
        required: ['open_id', 'name', 'exam_type', 'target_score']
      });
    }
    
    // 检查是否已注册
    const existing = await prisma.user.findFirst({
      where: { open_id }
    });
    
    if (existing) {
      return res.json({
        success: true,
        user_id: existing.id,
        message: '已注册，欢迎回来！'
      });
    }
    
    // 创建用户
    const user = await prisma.user.create({
      data: {
        open_id,
        name,
        target_region: target_region || '',
        exam_type,
        target_score_xingce: target_score.行测 || 60,
        target_score_shenlun: target_score.申论 || 55,
        exam_date: exam_date ? new Date(exam_date) : null,
        level: 1,
        total_points: 0,
        streak: 0,
        status: 'active'
      }
    });
    
    // 生成第一日任务
    const scheduler = new TaskScheduler(prisma, user);
    await scheduler.generateAndSendDailyTask();
    
    res.json({
      success: true,
      user_id: user.id,
      message: `欢迎 ${name}！已为你生成第一日学习任务，请注意查收飞书消息。`
    });
  } catch (error) {
    console.error('注册失败:', error);
    res.status(500).json({ error: '注册失败', details: error.message });
  }
});

// 2. 获取今日任务
app.get('/api/v1/tasks/today', async (req, res) => {
  try {
    const { user_id, open_id } = req.query;
    
    if (!user_id && !open_id) {
      return res.status(400).json({ error: '请提供 user_id 或 open_id' });
    }
    
    // 查找用户
    const user = user_id 
      ? await prisma.user.findFirst({ where: { id: parseInt(user_id) } })
      : await prisma.user.findFirst({ where: { open_id } });
    
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    // 查询今日任务
    const tasks = await prisma.dailyTask.findMany({
      where: {
        user_id: user.id,
        task_date: today,
        status: 'pending'
      },
      orderBy: { id: 'asc' }
    });
    
    // 如果任务不存在（可能是刚注册），生成任务
    if (tasks.length === 0) {
      const scheduler = new TaskScheduler(prisma, user);
      await scheduler.generateAndSendDailyTask();
      
      // 重新查询
      const newTasks = await prisma.dailyTask.findMany({
        where: { user_id: user.id, task_date: today, status: 'pending' },
        orderBy: { id: 'asc' }
      });
      
      return res.json({
        date: today,
        tasks: newTasks.map(t => ({
          id: t.id,
          knowledge_point: t.knowledge_point,
          content: t.question_content,
          options: t.options,
          points_available: t.points_available
        })),
        total_points: newTasks.reduce((sum, t) => sum + t.points_available, 0),
        streak: user.streak
      });
    }
    
    res.json({
      date: today,
      tasks: tasks.map(t => ({
        id: t.id,
        knowledge_point: t.knowledge_point,
        content: t.question_content,
        options: t.options,
        points_available: t.points_available
      })),
      total_points: tasks.reduce((sum, t) => sum + t.points_available, 0),
      streak: user.streak
    });
  } catch (error) {
    console.error('获取任务失败:', error);
    res.status(500).json({ error: '获取任务失败', details: error.message });
  }
});

// 3. 提交答案
app.post('/api/v1/tasks/:taskId/answer', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { user_answer, time_spent_seconds } = req.body;
    
    if (!user_answer) {
      return res.status(400).json({ error: '请提供 user_answer' });
    }
    
    // 查找任务
    const task = await prisma.dailyTask.findFirst({
      where: { id: parseInt(taskId), status: 'pending' },
      include: { user: true }
    });
    
    if (!task) {
      return res.status(404).json({ error: '任务不存在或已完成' });
    }
    
    // 判断对错
    const is_correct = user_answer === task.correct_answer;
    const points_earned = is_correct ? task.points_available : 0;
    
    // 更新任务状态
    const updatedTask = await prisma.dailyTask.update({
      where: { id: task.id },
      data: {
        user_answer,
        is_correct,
        time_spent_seconds: time_spent_seconds || 0,
        status: 'completed',
        points_earned
      }
    });
    
    // 更新用户积分和连续天数
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    // 检查昨日是否完成任务
    const yesterdayTasks = await prisma.dailyTask.count({
      where: {
        user_id: task.user_id,
        task_date: yesterday,
        status: 'completed'
      }
    });
    
    const newStreak = yesterdayTasks > 0 ? task.user.streak + 1 : 1;
    
    await prisma.user.update({
      where: { id: task.user_id },
      data: {
        total_points: { increment: points_earned },
        streak: newStreak,
        level: await calculateLevel(task.user.total_points + points_earned)
      }
    });
    
    // 更新进度快照
    await updateProgressSnapshot(prisma, task.user_id, task.knowledge_point, is_correct);
    
    // 检查是否达标（连续7天且正确率达标）
    const assessor = new ProgressAssessor(prisma);
    const goalReached = await assessor.checkGoalReached(task.user_id);
    
    if (goalReached.all_conditions_met) {
      await sendGoalReachedMessage(task.user, goalReached);
    }
    
    res.json({
      success: true,
      correct: is_correct,
      points_earned,
      explanation: task.explanation, // 这里应该是从题库获取的解析
      streak: newStreak,
      goal_reached: goalReached.all_conditions_met
    });
  } catch (error) {
    console.error('提交答案失败:', error);
    res.status(500).json({ error: '提交失败', details: error.message });
  }
});

// 4. 查询进度
app.get('/api/v1/progress/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await prisma.user.findFirst({
      where: { id: parseInt(userId) }
    });
    
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    // 获取最近7天进度
    const recentProgress = await prisma.progressSnapshot.findMany({
      where: { user_id: user.id },
      orderBy: { snapshot_date: 'desc' },
      take: 7
    });
    
    // 计算当前各模块正确率
    const stats = await prisma.$queryRaw`
      SELECT 
        knowledge_point,
        COUNT(*) as total_questions,
        SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct_count,
        AVG(CASE WHEN is_correct THEN 1.0 ELSE 0.0 END) as accuracy
      FROM daily_tasks 
      WHERE user_id = ${user.id} AND status = 'completed'
      GROUP BY knowledge_point
      ORDER BY accuracy ASC
    `;
    
    res.json({
      user: {
        name: user.name,
        level: user.level,
        total_points: user.total_points,
        streak: user.streak
      },
      recent_progress: recentProgress,
      knowledge_stats: stats,
      target_score: {
        xingce: user.target_score_xingce,
        shenlun: user.target_score_shenlun
      }
    });
  } catch (error) {
    console.error('查询进度失败:', error);
    res.status(500).json({ error: '查询失败', details: error.message });
  }
});

// ==================== 飞书 Webhook ====================

// 飞书事件订阅（用于接收用户消息）
app.post('/webhook/feishu', async (req, res) => {
  try {
    // 1. 验证签名
    const signature = req.headers['x-lark-signature'];
    const timestamp = req.headers['x-lark-request-timestamp'];
    
    if (!verifyFeishuRequest(req.rawBody, signature, timestamp, process.env.FEISHU_VERIFICATION_TOKEN)) {
      return res.status(401).json({ error: '签名验证失败' });
    }
    
    // 2. 解析事件
    const event = req.body;
    const eventType = event.event?.type;
    
    // 3. 处理事件
    if (eventType === 'p2p_chat_create' || eventType === 'message') {
      const { sender_id, message } = event.event;
      const text = message?.content?.text || '';
      
      // 如果用户说"我想备考公务员"
      if (text.includes('备考') || text.includes('公务员')) {
        // 触发注册流程
        await handleRegistration(sender_id.open_id);
      }
    }
    
    // 4. 返回成功
    res.json({ code: 0, msg: 'success' });
  } catch (error) {
    console.error('Webhook处理失败:', error);
    res.status(500).json({ error: '处理失败' });
  }
});

// 处理用户注册流程
async function handleRegistration(openId) {
  // 查询用户是否已注册
  const user = await prisma.user.findFirst({
    where: { open_id: openId }
  });
  
  if (user) {
    // 已注册，发送欢迎回来消息
    await sendFeishuMessage(openId, {
      msg_type: 'text',
      content: JSON.stringify({
        text: `欢迎回来 ${user.name}！\n\n今天是第${calculateDayNumber(user.registered_at)}天备考，你的当前等级是 Lv.${user.level}。\n\n输入「今日任务」获取学习任务，或「我的进度」查看学习报告。`
      })
    });
    return;
  }
  
  // 新用户，发送注册引导
  await sendFeishuMessage(openId, {
    msg_type: 'text',
    content: JSON.stringify({
      text: '你好！欢迎使用考公学习伴侣。\n\n请按格式回复以下信息：\n\n' +
            '地区：北京\n' +
            '类型：国考\n' +
            '目标：行测70 申论65\n' +
            '时间：2025-11-30\n\n' +
            '（姓名将使用你的飞书昵称）'
    })
  });
  
  // 设置会话状态，等待用户回复
  // TODO: 实现会话状态管理
}

// ==================== 定时任务 ====================

// 每日任务生成（早上8点）
cron.schedule(`${process.env.DAILY_TASK_TIME || '08:00'} * * * *`, async () => {
  console.log('⏰ 开始生成每日任务...');
  
  try {
    // 查询所有活跃用户
    const users = await prisma.user.findMany({
      where: { status: 'active' }
    });
    
    console.log(`📊 今日需要推送 ${users.length} 名用户`);
    
    for (const user of users) {
      try {
        const scheduler = new TaskScheduler(prisma, user);
        await scheduler.generateAndSendDailyTask();
        console.log(`  ✓ 用户 ${user.name} (${user.id}) 任务已生成`);
      } catch (error) {
        console.error(`  ✗ 用户 ${user.id} 失败:`, error.message);
      }
    }
    
    console.log('✅ 每日任务推送完成');
  } catch (error) {
    console.error('定时任务失败:', error);
  }
});

// 每周报告（周一早上9点）
cron.schedule(`${process.env.WEEKLY_REPORT_TIME || '09:00'} * * 1`, async () => {
  console.log('📊 开始生成周报...');
  
  // TODO: 实现周报生成逻辑
});

// ==================== 启动 ====================

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`🚀 kaogong-agent SaaS 版启动`);
  console.log(`📍 监听端口: ${PORT}`);
  console.log(`🩺 健康检查: http://localhost:${PORT}/health`);
  console.log(`📚 API 文档: http://localhost:${PORT}/docs (待实现)`);
});

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});
