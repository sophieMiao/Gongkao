#!/usr/bin/env node
/**
 * kaogong-agent SaaS 版主服务器
 * 提供 REST API + 飞书 Webhook 处理
 * 集成：Agent消息总线 + RAG + 记忆 + 监控 + 安全
 */

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { verifyFeishuRequest } = require('./utils/feishu-verify');
const { sendFeishuMessage } = require('./utils/feishu-sender');
const { TaskScheduler } = require('./utils/task-scheduler');
const { ProgressAssessor } = require('./utils/progress-assessor');
const { QuestionBank } = require('./utils/question-bank');
const { AIGenerator } = require('./utils/ai-generator');
const { DualRetriever } = require('./utils/dual-retriever');
const { MemoryManager } = require('./utils/memory-manager');
const { Guardrail } = require('./utils/guardrail');
const { AgentMessageBus } = require('./src/message-bus');
const { AgentRouter } = require('./src/agents/router');
const { XingceAgent } = require('./src/agents/xingce-agent');
const { ShenlunAgent } = require('./src/agents/shenlun-agent');
const { PolicyAgent } = require('./src/agents/policy-agent');
const { MotivationAgent } = require('./src/agents/motivation-agent');
const { metricsCollector } = require('./utils/metrics');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const Redis = require('redis');

const app = express();
const prisma = new PrismaClient();

// ==================== 初始化核心组件 ====================

// Redis 客户端（用于 MemoryManager）
const redisClient = Redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.error('Redis Client Error:', err));
redisClient.connect().catch(console.error);

// 初始化组件
const aiGenerator = new AIGenerator();
const retriever = new DualRetriever();
const memoryManager = new MemoryManager(redisClient);
const guardrail = new Guardrail();

// 初始化消息总线
const messageBus = new AgentMessageBus();

// 创建 Agent 实例（注入依赖）
const agents = [
  new XingceAgent({ 
    llm: aiGenerator, 
    retriever, 
    memory: memoryManager 
  }),
  new ShenlunAgent({ 
    llm: aiGenerator,
    memory: memoryManager
  }),
  new PolicyAgent({ 
    llm: aiGenerator,
    retriever
  }),
  new MotivationAgent({ 
    llm: aiGenerator,
    memory: memoryManager
  })
];

// 注册 Agent 到消息总线
agents.forEach(agent => messageBus.registerAgent(agent));

// 创建 Router（注入消息总线）
const router = new AgentRouter({
  agents,
  messageBus,
  memory: memoryManager
});

// 中间件
app.use(express.json());
app.use(express.static('public')); // 静态文件（答题页面）

// 监控中间件
app.use(metricsCollector.middleware());

// 安全检查中间件
app.use(async (req, res, next) => {
  if (req.body && (req.body.message || req.body.question)) {
    const textToCheck = req.body.message || req.body.question;
    const check = await guardrail.checkInput(textToCheck);
    if (!check.safe) {
      metricsCollector.errorsTotal.labels('security', req.path).inc();
      return res.status(400).json({
        error: '输入不符合安全规范',
        reason: check.reason
      });
    }
    // 替换清洗后的文本
    if (req.body.message) req.body.message = check.sanitized;
    if (req.body.question) req.body.question = check.sanitized;
  }
  next();
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Prometheus metrics 端点
app.get('/metrics', async (req, res) => {
  try {
    const metrics = await metricsCollector.getMetrics();
    res.set('Content-Type', metricsCollector.register.contentType);
    res.end(metrics);
  } catch (err) {
    res.status(500).end(err.message);
  }
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
    
    // 初始化用户记忆
    await memoryManager.updateProfile(user.id, {
      target_score,
      weak_points: [],
      registered_at: new Date().toISOString()
    });
    
    // 生成第一日任务（使用 Agent 系统）
    const firstTask = await router.generateTask(user.id, {
      knowledge_point: 'general',
      difficulty: 'easy',
      reason: '首次任务，熟悉系统'
    });
    
    // 保存任务到数据库
    const task = await prisma.dailyTask.create({
      data: {
        user_id: user.id,
        task_date: new Date().toISOString().split('T')[0],
        knowledge_point: firstTask.knowledge_point,
        question_content: firstTask.content,
        options: firstTask.options,
        correct_answer: firstTask.correct_answer,
        explanation: firstTask.explanation,
        points_available: firstTask.points,
        status: 'pending',
        generated_by_agent: firstTask.agentUsed || 'router'
      }
    });
    
    // 发送飞书消息
    await sendFeishuMessage(open_id, {
      msg_type: 'text',
      content: JSON.stringify({
        text: `欢迎 ${name}！🎉\n\n已为你生成第1天学习任务：\n` +
              `📚 ${firstTask.knowledge_point}\n` +
              `💯 预计积分：${firstTask.points}\n\n` +
              `点击链接开始答题：\n${process.env.APP_URL}/task.html?task_id=${task.id}&user=${user.id}\n\n` +
              ` tips: 建议先复习知识点，再答题效果更好！`
      })
    });

    res.json({
      success: true,
      user_id: user.id,
      message: '注册成功！已发送第一日任务。',
      task: {
        id: task.id,
        knowledge_point: task.knowledge_point,
        content: task.question_content,
        options: task.options
      }
    });
  } catch (error) {
    console.error('注册失败:', error);
    res.status(500).json({ error: '注册失败', details: error.message });
  }
});

// 2. 用户与 Agent 对话（核心 Agent 接口）
app.post('/api/v1/chat', async (req, res) => {
  try {
    const { user_id, message } = req.body;
    
    if (!user_id || !message) {
      return res.status(400).json({
        error: '缺少参数',
        required: ['user_id', 'message']
      });
    }
    
    // 1. 获取用户上下文
    const user = await prisma.user.findFirst({
      where: { id: parseInt(user_id) }
    });
    
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    // 2. 添加到记忆
    await memoryManager.addMessage(user_id, 'user', message);
    
    // 3. 获取上下文（记忆 + RAG）
    const context = {
      user_id: user.id,
      user_profile: await memoryManager.getProfile(user.id),
      rag_results: await retriever.search(message, user.id),
      history: await memoryManager.getContext(user.id)
    };
    
    // 4. 记录 LLM 调用指标
    const llmTimer = metricsCollector.timeAIGeneration('chat');
    
    // 5. Router 处理（多 Agent 协作）
    const response = await router.process(message, context);
    
    llmTimer.end();
    
    // 6. 记录 Agent 回复到记忆
    await memoryManager.addMessage(user_id, 'assistant', response.text);
    
    // 7. 记录指标
    metricsCollector.recordLLMCall({
      model: 'step-3.5-flash',
      provider: 'stepfun',
      inputTokens: response.usage?.input_tokens || 0,
      outputTokens: response.usage?.output_tokens || 0
    });
    
    // 8. 检查是否需要学习反馈
    if (response.agent && response.feedback) {
      const agent = messageBus.agents.get(response.agent);
      if (agent) {
        agent.learn({
          question: message,
          response: response.text,
          rating: response.feedback.rating || 3,
          timestamp: Date.now()
        });
      }
    }
    
    res.json({
      reply: response.text,
      agent_used: response.agent,
      agents_involved: response.collaborators || [],
      context: {
        rag_hits: context.rag_results.length,
        memory_turns: context.history.short_term.length
      }
    });
  } catch (error) {
    console.error('Chat API 失败:', error);
    res.status(500).json({ error: '处理失败', details: error.message });
  }
});

// 3. 获取今日任务（由 Agent 生成）
app.get('/api/v1/tasks/today', async (req, res) => {
  try {
    const { user_id } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ error: '请提供 user_id' });
    }
    
    const user = await prisma.user.findFirst({
      where: { id: parseInt(user_id) }
    });
    
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    // 查询今日任务
    let tasks = await prisma.dailyTask.findMany({
      where: {
        user_id: user.id,
        task_date: today,
        status: 'pending'
      },
      orderBy: { id: 'asc' }
    });
    
    // 如果任务不存在，使用 Agent 生成
    if (tasks.length === 0) {
      console.log(`[Agent] 为用户 ${user.id} 生成今日任务...`);
      
      // 获取用户学习计划
      const profile = await memoryManager.getProfile(user.id);
      const weaknesses = profile.weak_points || [];
      
      // 让 Agent 规划今日任务（3-5题）
      const plan = await router.planDailyTasks(user.id, {
        date: today,
        userLevel: user.level,
        weaknesses,
        targetScore: {
          xingce: user.target_score_xingce,
          shenlun: user.target_score_shenlun
        }
      });
      
      // 批量创建任务
      const taskRecords = plan.tasks.map(task => ({
        user_id: user.id,
        task_date: today,
        knowledge_point: task.knowledge_point,
        question_content: task.content,
        options: task.options,
        correct_answer: task.correct_answer,
        explanation: task.explanation,
        points_available: task.points,
        status: 'pending',
        generated_by_agent: task.agentUsed || 'router'
      }));
      
      tasks = await prisma.dailyTask.createMany({
        data: taskRecords,
        skipDuplicates: true
      });
      
      // 返回生成的任务（需要重新查询）
      tasks = await prisma.dailyTask.findMany({
        where: { user_id: user.id, task_date: today },
        orderBy: { id: 'asc' }
      });
    }
    
    // 更新指标
    metricsCollector.setUserCount(await prisma.user.count());
    const activeToday = await prisma.dailyTask.count({
      where: { task_date: today, status: 'completed' }
    });
    metricsCollector.setActiveUsers(activeToday);
    
    res.json({
      date: today,
      tasks: tasks.map(t => ({
        id: t.id,
        knowledge_point: t.knowledge_point,
        content: t.question_content,
        options: t.options,
        points_available: t.points_available,
        estimated_minutes: t.estimated_minutes || 5,
        generated_by: t.generated_by_agent
      })),
      total_points: tasks.reduce((sum, t) => sum + t.points_available, 0),
      streak: user.streak,
      agent_used: tasks[0]?.generated_by_agent || 'scheduler'
    });
  } catch (error) {
    console.error('获取任务失败:', error);
    res.status(500).json({ error: '获取任务失败', details: error.message });
  }
});

// 4. 提交答案（增强版：记录到记忆 + Agent 反馈）
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
        points_earned,
        completed_at: new Date()
      }
    });
    
    // 记录到记忆（用于个性化）
    await memoryManager.addMessage(task.user_id, 'task_result', JSON.stringify({
      task_id: task.id,
      knowledge_point: task.knowledge_point,
      correct: is_correct,
      points: points_earned,
      time_spent: time_spent_seconds,
      timestamp: Date.now()
    }));
    
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
    
    // 获取用户画像，判断是否需要激励
    const profile = await memoryManager.getProfile(task.user_id);
    if (!is_correct && profile.streak && profile.streak > 3) {
      // 连续打卡中断，发送鼓励
      await messageBus.send(
        'motivation-agent',
        'user_feedback',
        {
          user_id: task.user_id,
          event: 'wrong_answer',
          knowledge_point: task.knowledge_point,
          streak: newStreak
        }
      );
    }
    
    // 检查目标达成
    const assessor = new ProgressAssessor(prisma);
    const goalReached = await assessor.checkGoalReached(task.user_id);
    
    if (goalReached.all_conditions_met) {
      await sendGoalReachedMessage(task.user, goalReached);
    }
    
    // 更新任务完成率指标
    const totalTasks = await prisma.dailyTask.count({
      where: { user_id: task.user_id, status: 'completed' }
    });
    metricsCollector.setCompletionRate(totalTasks / (totalTasks + 1)); // 简化计算
    
    res.json({
      success: true,
      correct: is_correct,
      points_earned,
      explanation: task.explanation,
      streak: newStreak,
      goal_reached: goalReached.all_conditions_met,
      agents_notified: !is_correct ? ['motivation-agent'] : []
    });
  } catch (error) {
    console.error('提交答案失败:', error);
    res.status(500).json({ error: '提交失败', details: error.message });
  }
});

// 5. 用户进度查询（增强版：包含 Agent 分析）
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
    
    // 获取 Agent 学习摘要（如果用户与 Agent 有交互）
    const agentStats = router.getStats();
    
    res.json({
      user: {
        name: user.name,
        level: user.level,
        total_points: user.total_points,
        streak: user.streak,
        target_score: {
          xingce: user.target_score_xingce,
          shenlun: user.target_score_shenlun
        }
      },
      recent_progress: recentProgress,
      knowledge_stats: stats,
      agent_performance: agentStats,
      weak_points: stats.slice(0, 3).map(s => s.knowledge_point) // 最差的3个
    });
  } catch (error) {
    console.error('查询进度失败:', error);
    res.status(500).json({ error: '查询失败', details: error.message });
  }
});

// 6. 用户目标设定（Agent 对话接口）
app.post('/api/v1/goals', async (req, res) => {
  try {
    const { user_id, goal_description } = req.body;
    
    if (!user_id || !goal_description) {
      return res.status(400).json({
        error: '缺少参数',
        required: ['user_id', 'goal_description']
      });
    }
    
    // 使用 Router 处理目标设定（会调用 GoalSettingAgent 如果存在）
    const context = {
      user_id,
      user_profile: await memoryManager.getProfile(user_id)
    };
    
    const response = await router.process(
      `我想设定学习目标：${goal_description}`,
      context
    );
    
    // 保存目标到用户画像
    await memoryManager.updateProfile(user_id, {
      last_goal_setting: {
        description: goal_description,
        agent_response: response.text,
        timestamp: Date.now()
      }
    });
    
    res.json({
      success: true,
      agent_used: response.agent,
      plan: response.plan || null,
      message: response.text
    });
  } catch (error) {
    console.error('设定目标失败:', error);
    res.status(500).json({ error: '设定失败', details: error.message });
  }
});

// 7. 获取 Agent 系统状态（管理接口）
app.get('/api/v1/admin/agents', async (req, res) => {
  try {
    // 简单的认证（实际需要 JWT）
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${process.env.ADMIN_TOKEN}`) {
      return res.status(401).json({ error: '未授权' });
    }
    
    const stats = router.getStats();
    const busStats = messageBus.debugStats();
    
    res.json({
      agents: stats,
      message_bus: busStats,
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(500).json({ error: '查询失败' });
  }
});

// ==================== 飞书 Webhook ====================

app.post('/webhook/feishu', async (req, res) => {
  try {
    const signature = req.headers['x-lark-signature'];
    const timestamp = req.headers['x-lark-request-timestamp'];
    
    if (!verifyFeishuRequest(req.rawBody, signature, timestamp, process.env.FEISHU_VERIFICATION_TOKEN)) {
      return res.status(401).json({ error: '签名验证失败' });
    }
    
    const event = req.body;
    const eventType = event.event?.type;
    
    if (eventType === 'p2p_chat_create' || eventType === 'message') {
      const { sender_id, message } = event.event;
      const text = message?.content?.text || '';
      
      if (text.includes('备考') || text.includes('公务员')) {
        await handleRegistration(sender_id.open_id);
      }
    }
    
    res.json({ code: 0, msg: 'success' });
  } catch (error) {
    console.error('Webhook处理失败:', error);
    res.status(500).json({ error: '处理失败' });
  }
});

async function handleRegistration(openId) {
  const user = await prisma.user.findFirst({
    where: { open_id: openId }
  });
  
  if (user) {
    await sendFeishuMessage(openId, {
      msg_type: 'text',
      content: JSON.stringify({
        text: `欢迎回来 ${user.name}！\n\n今天是第${calculateDayNumber(user.registered_at)}天备考，你的当前等级是 Lv.${user.level}。\n\n输入「今日任务」获取学习任务，或「我的进度」查看学习报告。`
      })
    });
    return;
  }
  
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
}

// ==================== 定时任务 ====================

cron.schedule(`${process.env.DAILY_TASK_TIME || '08:00'} * * * *`, async () => {
  console.log('⏰ 开始生成每日任务...');
  
  try {
    const users = await prisma.user.findMany({
      where: { status: 'active' }
    });
    
    console.log(`📊 今日需要推送 ${users.length} 名用户`);
    
    for (const user of users) {
      try {
        // 使用 Agent Router 生成个性化任务
        const plan = await router.planDailyTasks(user.id, {
          date: new Date().toISOString().split('T')[0],
          userLevel: user.level,
          weaknesses: [],
          targetScore: {
            xingce: user.target_score_xingce,
            shenlun: user.target_score_shenlun
          }
        });
        
        // 批量创建任务
        const today = new Date().toISOString().split('T')[0];
        const taskRecords = plan.tasks.map(task => ({
          user_id: user.id,
          task_date: today,
          knowledge_point: task.knowledge_point,
          question_content: task.content,
          options: task.options,
          correct_answer: task.correct_answer,
          explanation: task.explanation,
          points_available: task.points,
          status: 'pending',
          generated_by_agent: task.agentUsed || 'router'
        }));
        
        await prisma.dailyTask.createMany({
          data: taskRecords,
          skipDuplicates: true
        });
        
        // 发送飞书通知
        const taskList = plan.tasks.map((t, i) => 
          `${i+1}. ${t.knowledge_point} (${t.points}分)`
        ).join('\n');
        
        await sendFeishuMessage(user.open_id, {
          msg_type: 'text',
          content: JSON.stringify({
            text: `📅 今日学习任务 (${today})\n\n${taskList}\n\n` +
                  `点击链接开始答题：\n${process.env.APP_URL}/task.html?user=${user.id}\n\n` +
                  `加油！💪`
          })
        });
        
        console.log(`  ✓ 用户 ${user.name} (${user.id}) 任务已生成 (${plan.tasks.length}题)`);
      } catch (error) {
        console.error(`  ✗ 用户 ${user.id} 失败:`, error.message);
      }
    }
    
    console.log('✅ 每日任务推送完成');
  } catch (error) {
    console.error('定时任务失败:', error);
  }
});

cron.schedule(`${process.env.WEEKLY_REPORT_TIME || '09:00'} * * 1`, async () => {
  console.log('📊 开始生成周报...');
  // TODO: 实现周报生成
});

// ==================== 启动 ====================

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`🚀 kaogong-agent SaaS 版启动`);
  console.log(`📍 监听端口: ${PORT}`);
  console.log(`🩺 健康检查: http://localhost:${PORT}/health`);
  console.log(`📊 指标: http://localhost:${PORT}/metrics`);
  console.log(`🤖 Agent 系统: ${agents.length} 个专家已注册`);
  console.log(`📨 消息总线: ${messageBus.debugStats().agents.length} 个 Agent`);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  await prisma.$disconnect();
  await redisClient.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down...');
  await prisma.$disconnect();
  await redisClient.quit();
  process.exit(0);
});

// 辅助函数
async function calculateLevel(totalPoints) {
  return Math.floor(totalPoints / 100) + 1;
}

async function updateProgressSnapshot(prisma, userId, knowledgePoint, isCorrect) {
  const today = new Date().toISOString().split('T')[0];
  
  // 查找今日快照
  let snapshot = await prisma.progressSnapshot.findFirst({
    where: { user_id: userId, snapshot_date: today }
  });
  
  if (!snapshot) {
    snapshot = await prisma.progressSnapshot.create({
      data: {
        user_id: userId,
        snapshot_date: today,
        total_questions: 0,
        correct_count: 0
      }
    });
  }
  
  // 更新
  await prisma.progressSnapshot.update({
    where: { id: snapshot.id },
    data: {
      total_questions: { increment: 1 },
      correct_count: isCorrect ? { increment: 1 } : undefined
    }
  });
}

async function sendGoalReachedMessage(user, goalReached) {
  const motivationAgent = agents.find(a => a.name === 'motivation-agent');
  if (motivationAgent) {
    const message = await motivationAgent.generateCongratulation(user, goalReached);
    await sendFeishuMessage(user.open_id, {
      msg_type: 'text',
      content: JSON.stringify({ text: message })
    });
  }
}
