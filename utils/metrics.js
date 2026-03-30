/**
 * 指标收集工具
 * 集成 Prometheus 客户端，收集业务和系统指标
 */

const client = require('prom-client');

// 创建指标注册表
const register = new client.Registry();

// 全局标签（可动态添加）
const commonLabels = {
  app: 'gongkao-agent',
  version: process.env.npm_package_version || '2.0.0'
};

// ============== 系统指标 ==============

// Node.js 内置指标
const collectDefaultMetrics = new client.CollectDefaultMetrics({
  prefix: 'gongkao_',
  labels: commonLabels
});
collectDefaultMetrics.collect();

// 自定义系统指标
const systemUptime = new client.Gauge({
  name: 'gongkao_system_uptime_seconds',
  help: 'Application uptime in seconds',
  labelNames: ['instance'],
  registers: [register]
});

const nodeMemoryUsage = new client.Gauge({
  name: 'gongkao_node_memory_bytes',
  help: 'Node.js process memory usage in bytes',
  labelNames: ['type'], // heap_total, heap_used, external, rss
  registers: [register]
});

const eventLoopLag = new client.Gauge({
  name: 'gongkao_event_loop_lag_ms',
  help: 'Event loop lag in milliseconds',
  registers: [register]
});

// ============== HTTP 指标 ==============

const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'gongkao_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register]
});

const httpRequestsTotal = new client.Counter({
  name: 'gongkao_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

// ============== 业务指标 ==============

// 用户相关
const activeUsers = new client.Gauge({
  name: 'gongkao_active_users',
  help: 'Number of active users in the last 24 hours',
  labelNames: [],
  registers: [register]
});

const userRegistrationTotal = new client.Counter({
  name: 'gongkao_user_registrations_total',
  help: 'Total number of user registrations',
  labelNames: [],
  registers: [register]
});

// 任务相关
const dailyTasksGenerated = new client.Counter({
  name: 'gongkao_daily_tasks_generated_total',
  help: 'Total number of daily tasks generated',
  labelNames: ['user_id'],
  registers: [register]
});

const dailyTasksCompleted = new client.Counter({
  name: 'gongkao_daily_tasks_completed_total',
  help: 'Total number of daily tasks completed',
  labelNames: ['user_id'],
  registers: [register]
});

const taskCompletionRate = new client.Gauge({
  name: 'gongkao_task_completion_rate',
  help: 'Task completion rate (0-1)',
  labelNames: [],
  registers: [register]
});

// 答题相关
const questionsAnswered = new client.Counter({
  name: 'gongkao_questions_answered_total',
  help: 'Total number of questions answered',
  labelNames: ['user_id', 'question_type', 'knowledge_point'],
  registers: [register]
});

const answerCorrectness = new client.Gauge({
  name: 'gongkao_answer_correctness_rate',
  help: 'Answer correctness rate (0-1)',
  labelNames: ['knowledge_point'],
  registers: [register]
});

const questionDifficulty = new client.Gauge({
  name: 'gongkao_question_difficulty',
  help: 'Average question difficulty (0-1)',
  labelNames: ['knowledge_point'],
  registers: [register]
});

// 知识点相关
const knowledgePointsMastered = new client.Gauge({
  name: 'gongkao_knowledge_points_mastered',
  help: 'Number of knowledge points mastered by user',
  labelNames: ['user_id'],
  registers: [register]
});

// AI 调用相关
const aiCallsTotal = new client.Counter({
  name: 'gongkao_ai_calls_total',
  help: 'Total number of AI API calls',
  labelNames: ['api', 'status'],
  registers: [register]
});

const aiCallDuration = new client.Histogram({
  name: 'gongkao_ai_call_duration_seconds',
  help: 'Duration of AI API calls in seconds',
  labelNames: ['api'],
  buckets: [0.1, 0.5, 1, 2.5, 5, 10],
  registers: [register]
});

// 飞书消息相关
const feishuMessagesSent = new client.Counter({
  name: 'gongkao_feishu_messages_sent_total',
  help: 'Total number of Feishu messages sent',
  labelNames: ['message_type', 'status'],
  registers: [register]
});

// ============== 中间件 ==============

// HTTP 请求指标中间件
function metricsMiddleware(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route || req.path;

    httpRequestDurationMicroseconds
      .labels(req.method, route, res.statusCode.toString())
      .observe(duration);

    httpRequestsTotal
      .labels(req.method, route, res.statusCode.toString())
      .inc();
  });

  next();
}

// 系统指标更新定时任务
function startSystemMetricsUpdater() {
  const { performance } = require('perf_hooks');
  const os = require('os');

  setInterval(() => {
    // 更新运行时间
    const uptime = process.uptime();
    systemUptime.set({ instance: process.pid }, uptime);

    // 内存使用
    const memoryUsage = process.memoryUsage();
    nodeMemoryUsage
      .labels('heap_total')
      .set(memoryUsage.heapTotal);
    nodeMemoryUsage
      .labels('heap_used')
      .set(memoryUsage.heapUsed);
    nodeMemoryUsage
      .labels('external')
      .set(memoryUsage.external);
    nodeMemoryUsage
      .labels('rss')
      .set(memoryUsage.rss);

    // 事件循环延迟
    const lag = performance.eventLoopUtilization ? performance.eventLoopUtilization().utilization : 0;
    eventLoopLag.set(lag);
  }, 10000); // 每 10 秒更新一次
}

// ============== 业务指标辅助函数 ==============

function incrementUserRegistration() {
  userRegistrationTotal.inc();
  updateActiveUsers();
}

function incrementDailyTasksGenerated(userId) {
  dailyTasksGenerated.labels(userId).inc();
}

function incrementDailyTasksCompleted(userId) {
  dailyTasksCompleted.labels(userId).inc();
  updateTaskCompletionRate();
}

function recordQuestionAnswered(userId, questionType, knowledgePoint) {
  questionsAnswered.labels(userId, questionType, knowledgePoint).inc();
}

function setAnswerCorrectness(knowledgePoint, rate) {
  answerCorrectness.labels(knowledgePoint).set(rate);
}

function setQuestionDifficulty(knowledgePoint, difficulty) {
  questionDifficulty.labels(knowledgePoint).set(difficulty);
}

function setKnowledgePointsMastered(userId, count) {
  knowledgePointsMastered.labels(userId).set(count);
}

function incrementAICall(api, status, duration) {
  aiCallsTotal.labels(api, status).inc();
  aiCallDuration.labels(api).observe(duration / 1000);
}

function incrementFeishuMessage(messageType, status) {
  feishuMessagesSent.labels(messageType, status).inc();
}

// 计算任务完成率
function updateTaskCompletionRate() {
  // 这里应该从数据库查询实际数据
  // 暂时返回一个示例值
  const rate = 0.75; // 示例：75% 完成率
  taskCompletionRate.set(rate);
}

// 更新活跃用户数
function updateActiveUsers() {
  // 这里应该从数据库查询最近 24 小时活跃用户数
  // 暂时返回一个示例值
  const count = 100; // 示例：100 活跃用户
  activeUsers.set(count);
}

// ============== 导出 ==============

module.exports = {
  register,
  metricsMiddleware,
  startSystemMetricsUpdater,
  // 辅助函数
  incrementUserRegistration,
  incrementDailyTasksGenerated,
  incrementDailyTasksCompleted,
  recordQuestionAnswered,
  setAnswerCorrectness,
  setQuestionDifficulty,
  setKnowledgePointsMastered,
  incrementAICall,
  incrementFeishuMessage,
  // 指标对象（供手动使用）
  metrics: {
    systemUptime,
    nodeMemoryUsage,
    eventLoopLag,
    httpRequestDurationMicroseconds,
    httpRequestsTotal,
    activeUsers,
    userRegistrationTotal,
    dailyTasksGenerated,
    dailyTasksCompleted,
    taskCompletionRate,
    questionsAnswered,
    answerCorrectness,
    questionDifficulty,
    knowledgePointsMastered,
    aiCallsTotal,
    aiCallDuration,
    feishuMessagesSent
  }
};
