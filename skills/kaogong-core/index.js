#!/usr/bin/env node
/**
 * kaogong-core Skill - 考公学习伴侣核心逻辑
 */

const { OpenClaw } = require('openclaw');

// 工具函数：获取当前日期
function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

// 工作流：注册新用户
async function registerUser(context) {
  const { message, user_id } = context;
  
  // 第一步：收集目标信息
  await message.reply({
    msg_type: 'text',
    content: JSON.stringify({
      text: '欢迎使用考公学习伴侣！请告诉我以下信息：\n\n' +
            '1. 目标地区（如：北京、上海、广东）\n' +
            '2. 考试类型（国考/省考/事业单位）\n' +
            '3. 目标分数（如：行测70+，申论65+）\n' +
            '4. 预计考试时间（如：2025-11-30）\n\n' +
            '请按格式回复：\n' +
            '地区：北京\n' +
            '类型：国考\n' +
            '目标：行测70 申论65\n' +
            '时间：2025-11-30'
    })
  });

  // 等待用户回复（状态管理）
  context.session.set('registration_step', 'waiting_info');
  
  return { status: 'waiting_for_user_info' };
}

// 处理用户注册信息
async function processRegistration(context) {
  const { message, user_id } = context;
  const text = message.content.text;
  
  // 解析用户输入（简单实现，生产环境需更健壮）
  const lines = text.split('\n');
  const info = {};
  lines.forEach(line => {
    if (line.includes('：')) {
      const [key, value] = line.split('：');
      info[key.trim()] = value.trim();
    }
  });

  // 保存用户信息到飞书多维表格
  const userRecord = {
    user_id: user_id,
    name: info['姓名'] || '考生',
    target_region: info['地区'] || '',
    exam_type: info['类型'] || '',
    target_score_parse: parseTargetScore(info['目标']),
    exam_date: info['时间'] || '',
    registered_at: new Date().toISOString(),
    level: 1,
    total_points: 0,
    streak: 0
  };

  // 调用 feishu_bitable_app_table_record create
  await context.tools.feishu_bitable_app_table_record({
    action: 'create',
    app_token: process.env.BITABLE_APP_TOKEN,
    table_id: process.env.USERS_TABLE_ID,
    fields: userRecord
  });

  // 初始化进度表
  await initProgress(context, user_id);

  // 发送欢迎消息 + 第一日任务
  await sendWelcomeAndFirstTask(context, userRecord);
  
  return { status: 'registered' };
}

// 解析目标分数
function parseTargetScore(scoreText) {
  // 简单解析，如"行测70 申论65"
  const result = { 行测: 60, 申论: 55 };
  if (!scoreText) return result;
  
  const match = scoreText.match(/行测(\d+)/);
  if (match) result.行测 = parseInt(match[1]);
  
  const match2 = scoreText.match(/申论(\d+)/);
  if (match2) result.申论 = parseInt(match2[1]);
  
  return result;
}

// 初始化进度表
async function initProgress(context, user_id) {
  const today = getTodayDate();
  const progressRecord = {
    user_id: user_id,
    date: today,
    knowledge_point: 'INIT',
    total_questions: 0,
    correct_count: 0,
    accuracy: 0,
    estimated_score: 0,
    daily_points_earned: 0,
    status: 'initialized'
  };

  await context.tools.feishu_bitable_app_table_record({
    action: 'create',
    app_token: process.env.BITABLE_APP_TOKEN,
    table_id: process.env.PROGRESS_TABLE_ID,
    fields: progressRecord
  });
}

// 发送欢迎消息和第一日任务
async function sendWelcomeAndFirstTask(context, userRecord) {
  const welcomeMsg = `你好 ${userRecord.name}！🎉\n\n` +
    `我已为你制定备考计划：\n` +
    `📍 目标地区：${userRecord.target_region}\n` +
    `📝 考试类型：${userRecord.exam_type}\n` +
    `🎯 目标分数：行测${userRecord.target_score_parse['行测']}分，申论${userRecord.target_score_parse['申论']}分\n` +
    `📅 考试日期：${userRecord.exam_date || '待定'}\n\n` +
    `从今天起，我会每天为你推送学习任务，像多邻国一样陪伴你备考！\n` +
    `💪 让我们一起加油吧！`;

  await context.tools.feishu_im_user_message({
    action: 'send',
    receive_id_type: 'open_id',
    receive_id: userRecord.user_id,
    msg_type: 'text',
    content: JSON.stringify({ text: welcomeMsg })
  });

  // 生成第一日任务
  await generateAndSendDailyTask(context, userRecord.user_id);
}

// 生成并发送每日任务（核心逻辑）
async function generateAndSendDailyTask(context, user_id) {
  const today = getTodayDate();
  
  // 1. 获取用户信息和当前进度
  const user = await getUserInfo(context, user_id);
  const progress = await getRecentProgress(context, user_id, 7);
  
  // 2. 计算今日任务量
  const { daysRemaining, tasksNeeded } = calculateDailyTasks(user, progress);
  
  // 3. 识别薄弱知识点
  const weakPoints = await identifyWeakPoints(context, user_id);
  
  // 4. 从题库抽取题目
  const questions = await selectQuestions(context, {
    weakPoints,
    count: tasksNeeded,
    userLevel: user.level,
    date: today
  });
  
  // 5. 生成任务卡片
  const card = buildDailyTaskCard({
    user,
    questions,
    date: today,
    totalPoints: calculatePoints(questions)
  });
  
  // 6. 保存任务记录
  await saveDailyTasks(context, user_id, today, questions);
  
  // 7. 推送卡片
  await context.tools.feishu_im_user_message({
    action: 'send',
    receive_id_type: 'open_id',
    receive_id: user_id,
    msg_type: 'interactive',
    content: JSON.stringify(card)
  });

  return { taskCount: questions.length };
}

// 计算剩余天数和任务量
function calculateDailyTasks(user, progress) {
  const examDate = new Date(user.exam_date);
  const today = new Date();
  const daysRemaining = Math.max(1, Math.floor((examDate - today) / (1000 * 60 * 60 * 24)));
  
  // 根据剩余天数调整每日任务量（剩余越少，任务越重）
  let baseTasks = 5;
  if (daysRemaining > 180) baseTasks = 3;
  else if (daysRemaining > 90) baseTasks = 5;
  else if (daysRemaining > 30) baseTasks = 7;
  else baseTasks = 10;
  
  // 根据近期完成率调整
  const recentCompletion = calculateCompletionRate(progress);
  if (recentCompletion < 0.7) baseTasks = Math.floor(baseTasks * 0.8); // 降低难度
  else if (recentCompletion > 0.9) baseTasks = Math.ceil(baseTasks * 1.2); // 增加强度
  
  return { daysRemaining, tasksNeeded: baseTasks };
}

// 识别薄弱知识点
async function identifyWeakPoints(context, user_id) {
  const progressData = await context.tools.feishu_bitable_app_table_record({
    action: 'list',
    app_token: process.env.BITABLE_APP_TOKEN,
    table_id: process.env.PROGRESS_TABLE_ID,
    filter: JSON.stringify({
      conjunction: 'and',
      conditions: [
        { field_name: 'user_id', operator: 'is', value: [user_id] }
      ]
    }),
    page_size: 100
  });

  // 按知识点统计正确率
  const pointStats = {};
  progressData.records.forEach(record => {
    const point = record.fields.knowledge_point;
    if (point && point !== 'INIT') {
      if (!pointStats[point]) {
        pointStats[point] = { total: 0, correct: 0 };
      }
      pointStats[point].total += record.fields.total_questions || 0;
      pointStats[point].correct += record.fields.correct_count || 0;
    }
  });

  // 找出正确率低于70%的知识点
  const weakPoints = [];
  for (const [point, stats] of Object.entries(pointStats)) {
    if (stats.total >= 5) { // 至少有5题数据
      const accuracy = stats.correct / stats.total;
      if (accuracy < 0.7) {
        weakPoints.push({ point, accuracy, need: Math.ceil((0.8 - accuracy) * 10) });
      }
    }
  }

  // 按需练习量排序
  weakPoints.sort((a, b) => b.need - a.need);
  
  return weakPoints.slice(0, 3); // 返回前3个薄弱点
}

// 构建每日任务卡片
function buildDailyTaskCard({ user, questions, date, totalPoints }) {
  const dayNumber = calculateDayNumber(user.registered_at, date);
  
  // 按知识点分组
  const grouped = {};
  questions.forEach(q => {
    const point = q.knowledge_point;
    if (!grouped[point]) grouped[point] = [];
    grouped[point].push(q);
  });

  let tasksList = '';
  Object.entries(grouped).forEach(([point, qs], idx) => {
    tasksList += `${idx + 1}. ${point} (${qs.length}题, ${qs[0].difficulty === 'hard' ? '🔥' : qs[0].difficulty === 'medium' ? '⚡' : '💡'})\n`;
  });

  return {
    msg_type: 'interactive',
    content: {
      config: { wide_screen_mode: true },
      elements: [
        {
          tag: 'header',
          template: 'blue',
          title: {
            content: `📚 考公学习伴侣 | 第${dayNumber}天任务`,
            tag: 'plain_text'
          }
        },
        {
          tag: 'div',
          fields: [
            {
              tag: 'lark_md',
              content: `**今日学习目标（${questions.length * 2}分钟）**\n\n${tasksList}`
            }
          ]
        },
        {
          tag: "action",
          "actions": [
            {
              "tag": "button",
              "text": { "content": "开始学习", "tag": "plain_text" },
              "type": "primary",
              "url": `https://kaogong.openclaw.ai/task/${date}?user=${user.user_id}`
            },
            {
              "tag": "button",
              "text": { "content": "稍后提醒", "tag": "plain_text" },
              "type": "default",
              "url": `https://kaogong.openclaw.ai/remind/${date}?user=${user.user_id}`
            }
          ]
        },
        {
          tag: 'div',
          fields: [
            {
              tag: 'lark_md',
              content: `───────────────\n💎 **完成任务可获得：${totalPoints}积分**\n🔥 **当前连续：${user.streak || 0}天** | **等级：Lv.${user.level || 1}**`
            }
          ]
        }
      ]
    }
  };
}

// 计算注册以来的天数
function calculateDayNumber(registeredAt, currentDate) {
  const reg = new Date(registeredAt);
  const cur = new Date(currentDate);
  const diff = Math.floor((cur - reg) / (1000 * 60 * 60 * 24));
  return diff + 1;
}

// 计算积分
function calculatePoints(questions) {
  let total = 0;
  questions.forEach(q => {
    total += 10; // 基础分
    if (q.difficulty === 'medium') total += 2;
    if (q.difficulty === 'hard') total += 5;
  });
  return total;
}

// 保存每日任务到数据库
async function saveDailyTasks(context, user_id, date, questions) {
  // 批量创建任务记录
  const tasks = questions.map(q => ({
    task_id: `task_${date}_${q.id}`,
    user_id,
    date,
    task_type: '行测',
    knowledge_point: q.knowledge_point,
    question_content: q.content,
    options: q.options,
    correct_answer: q.correct_answer,
    user_answer: null,
    is_correct: null,
    status: 'pending',
    points_available: q.difficulty === 'hard' ? 15 : q.difficulty === 'medium' ? 12 : 10
  }));

  // 批量插入到 tasks 表
  for (const task of tasks) {
    await context.tools.feishu_bitable_app_table_record({
      action: 'create',
      app_token: process.env.BITABLE_APP_TOKEN,
      table_id: process.env.TASKS_TABLE_ID,
      fields: task
    });
  }
}

// 导出 OpenClaw Skill
module.exports = {
  // 动作：注册用户
  actions: {
    register: registerUser,
    processRegistration: processRegistration,
    
    // 每日任务
    generateAndSendDailyTask: generateAndSendDailyTask,
    
    // 辅助方法
    identifyWeakPoints,
    calculateDailyTasks,
    buildDailyTaskCard
  },
  
  // 元数据
  metadata: {
    name: 'kaogong-core',
    version: '1.0.0',
    description: '考公学习伴侣核心Agent',
    author: 'Your Name',
    tags: ['education', 'exam', 'civil-service']
  }
};
