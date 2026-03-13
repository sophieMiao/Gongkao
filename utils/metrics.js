/**
 * 指标收集器 - 使用 Prometheus 客户端
 */

const client = require('prom-client');

// 创建指标寄存器
const register = new client.Registry();

// 通用标签
const commonLabels = ['service', 'version'];

// 1. 业务指标
const userCounter = new client.Gauge({
  name: 'kaogong_users_total',
  help: 'Total number of registered users',
  labelNames: commonLabels,
  registers: [register]
});

const activeUsersGauge = new client.Gauge({
  name: 'kaogong_active_users',
  help: 'Number of active users today',
  labelNames: commonLabels,
  registers: [register]
});

const tasksGenerated = new client.Counter({
  name: 'kaogong_tasks_generated_total',
  help: 'Total number of daily tasks generated',
  labelNames: commonLabels,
  registers: [register]
});

const tasksCompleted = new client.Counter({
  name: 'kaogong_tasks_completed_total',
  help: 'Total number of tasks completed by users',
  labelNames: commonLabels,
  registers: [register]
});

const taskCompletionRate = new client.Gauge({
  name: 'kaogong_tasks_completion_rate',
  help: 'Task completion rate (percentage)',
  labelNames: commonLabels,
  registers: [register]
});

// 2. 性能指标
const requestDuration = new client.Histogram({
  name: 'kaogong_request_duration_seconds',
  help: 'Request duration in seconds',
  labelNames: ['method', 'endpoint', 'status', ...commonLabels],
  buckets: [0.1, 0.3, 0.5, 1, 2, 5],
  registers: [register]
});

const requestsTotal = new client.Counter({
  name: 'kaogong_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'endpoint', 'status', ...commonLabels],
  registers: [register]
});

const errorsTotal = new client.Counter({
  name: 'kaogong_errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'endpoint', ...commonLabels],
  registers: [register]
});

// 3. AI 指标
const llmRequests = new client.Counter({
  name: 'kaogong_llm_requests_total',
  help: 'Total LLM API calls',
  labelNames: ['model', 'provider', ...commonLabels],
  registers: [register]
});

const llmTokens = new client.Counter({
  name: 'kaogong_llm_tokens_total',
  help: 'Total tokens used',
  labelNames: ['type', 'model', ...commonLabels], // type: input/output
  registers: [register]
});

const llmErrors = new client.Counter({
  name: 'kaogong_llm_errors_total',
  help: 'Total LLM errors',
  labelNames: ['provider', 'error_type', ...commonLabels],
  registers: [register]
});

const aiGenerationDuration = new client.Histogram({
  name: 'kaogong_ai_generation_duration_seconds',
  help: 'AI question generation duration',
  labelNames: ['knowledge_point', ...commonLabels],
  buckets: [1, 3, 5, 10, 20],
  registers: [register]
});

// 4. 成本指标
const costEstimated = new client.Gauge({
  name: 'kaogong_cost_estimated_total',
  help: 'Estimated total cost in CNY',
  labelNames: commonLabels,
  registers: [register]
});

const tokensPerUser = new client.Gauge({
  name: 'kaogong_token_usage_per_user',
  help: 'Average tokens used per user per day',
  labelNames: commonLabels,
  registers: [register]
});

// 设置默认标签
client.register.registerMetric(userCounter);
register.setDefaultLabels({
  service: 'kaogong-agent',
  version: process.env.npm_package_version || '1.0.0'
});

class MetricsCollector {
  constructor() {
    this.register = register;
  }

  /**
   * 暴露 metrics 端点（Express 中间件）
   */
  middleware() {
    return async (req, res, next) => {
      const start = Date.now();
      
      // 请求前记录
      requestsTotal.inc({ 
        method: req.method, 
        endpoint: req.route?.path || req.path,
        status: 'started'
      });
      
      res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        const status = res.statusCode.toString();
        
        requestDuration
          .labels(req.method, req.route?.path || req.path, status)
          .observe(duration);
        
        requestsTotal
          .labels(req.method, req.route?.path || req.path, status)
          .inc();
        
        if (res.statusCode >= 400) {
          errorsTotal
            .labels('http', req.route?.path || req.path)
            .inc();
        }
      });
      
      next();
    };
  }

  /**
   * 记录 LLM 调用
   */
  recordLLMCall(options) {
    const { model, provider, inputTokens, outputTokens } = options;
    
    llmRequests.labels(model, provider).inc();
    
    if (inputTokens) {
      llmTokens.labels('input', model).inc(inputTokens);
    }
    
    if (outputTokens) {
      llmTokens.labels('output', model).inc(outputTokens);
    }
    
    // 更新成本估算（假设 StepFun: 0.1元/1k tokens）
    const totalTokens = (inputTokens || 0) + (outputTokens || 0);
    const cost = totalTokens / 10000 * 0.1; // 每1万tokens 0.1元
    const current = costEstimated.get();
    costEstimated.set(current + cost);
  }

  /**
   * 记录 AI 生成耗时
   */
  timeAIGeneration(knowledgePoint) {
    const endTimer = aiGenerationDuration.startTimer();
    return {
      end: () => {
        const duration = endTimer();
        aiGenerationDuration.labels(knowledgePoint).observe(duration);
      }
    };
  }

  /**
   * 更新用户数
   */
  setUserCount(count) {
    userCounter.set(count);
  }

  /**
   * 更新活跃用户
   */
  setActiveUsers(count) {
    activeUsersGauge.set(count);
  }

  /**
   * 更新任务完成率
   */
  setCompletionRate(rate) {
    taskCompletionRate.set(rate);
  }

  /**
   * 获取所有指标（用于 /metrics 端点）
   */
  async getMetrics() {
    const metrics = await this.register.metrics();
    return metrics;
  }
}

module.exports = new MetricsCollector();
