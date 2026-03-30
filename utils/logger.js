/**
 * 结构化日志工具
 * 使用 pino 风格，支持不同日志级别和结构化输出
 */

const pino = require('pino');

// 创建日志记录器
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty'
  },
  timestamp: pino.stdTimeFunctions.isoTime
});

// 添加请求 ID 中间件
function requestIdMiddleware(req, res, next) {
  const requestId = req.headers['x-request-id'] || generateRequestId();
  req.id = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}

function generateRequestId() {
  return 'req_' + Math.random().toString(36).substr(2, 9);
}

// 错误处理中间件
function errorMiddleware(err, req, res, next) {
  logger.error({
    msg: err.message,
    stack: err.stack,
    requestId: req.id,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });

  // 根据错误类型返回不同的状态码
  const statusCode = err.statusCode || 500;
  const response = {
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
    requestId: req.id
  };

  // 只在开发环境暴露详细错误
  if (process.env.NODE_ENV !== 'production') {
    response.details = err.details;
  }

  res.status(statusCode).json(response);
}

// 增强的 HTTP 请求日志中间件
function accessLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      msg: 'HTTP request',
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      requestId: req.id,
      contentType: res.getHeader('content-type'),
      contentLength: res.getHeader('content-length')
    });
  });

  next();
}

// 业务日志快捷方法
const bizLogger = {
  task: (userId, taskId, action, data = {}) => {
    logger.info({
      msg: 'Task event',
      type: 'task',
      userId,
      taskId,
      action,
      ...data
    });
  },
  user: (userId, action, data = {}) => {
    logger.info({
      msg: 'User event',
      type: 'user',
      userId,
      action,
      ...data
    });
  },
  question: (userId, questionId, action, data = {}) => {
    logger.info({
      msg: 'Question event',
      type: 'question',
      userId,
      questionId,
      action,
      ...data
    });
  },
  system: (event, data = {}) => {
    logger.info({
      msg: 'System event',
      type: 'system',
      event,
      ...data
    });
  },
  error: (context, error, data = {}) => {
    logger.error({
      msg: 'Application error',
      context,
      error: error.message,
      stack: error.stack,
      ...data
    });
  }
};

module.exports = {
  logger,
  requestIdMiddleware,
  errorMiddleware,
  accessLogger,
  bizLogger
};
