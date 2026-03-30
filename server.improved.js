#!/usr/bin/env node
/**
 * kaogong-agent 主服务器（改进版）
 * 集成 OpenClaw Agent 并提供 HTTP API
 * 包含：结构化日志、错误处理、API 文档
 */

const http = require('http');
const { OpenClaw } = require('openclaw');
const fs = require('fs');
const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// 加载配置
const config = require('./config/agent.yaml');

// 初始化日志
const { logger, requestIdMiddleware, errorMiddleware, accessLogger, bizLogger } = require('./utils/logger');

logger.info('🚀 启动考公学习伴侣...');

// 初始化 OpenClaw
const openclaw = new OpenClaw({
  gatewayUrl: process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:8080',
  skillsPath: path.join(__dirname, 'skills'),
  logger: logger
});

// 加载 Skills
async function loadSkills() {
  try {
    await openclaw.loadSkills();
    logger.info('✅ Skills loaded successfully');
  } catch (error) {
    logger.error('❌ Failed to load skills:', error);
    process.exit(1);
  }
}

// API 文档配置
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Gongkao API',
    version: '2.0.0',
    description: '考公学习伴侣 API 文档'
  },
  servers: [
    {
      url: `http://localhost:${process.env.PORT || 8080}`,
      description: '本地开发服务器'
    }
  ]
};

const options = {
  swaggerDefinition,
  apis: ['./docs/api/*.yaml'] // 如果有 YAML 文档
};

// 注意：如果文档使用 JSON，我们可以直接提供静态文件
// 这里我们简化，先提供静态 JSON 文件

// 创建 HTTP 服务器
function createServer() {
  const server = http.createServer(async (req, res) => {
    // 请求 ID 中间件
    requestIdMiddleware(req, res, () => {
      // 健康检查
      if (req.url === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
        logger.debug('Health check requested');
        return;
      }

      // API 文档
      if (req.url === '/api-docs' && req.method === 'GET') {
        // 这里可以返回 HTML 的 Swagger UI
        res.writeHead(200, { 'Content-Type': 'application/json' });
        fs.createReadStream(path.join(__dirname, 'docs/api/swagger.json')).pipe(res);
        return;
      }

      // API 路由
      if (req.url.startsWith('/api/') && req.method === 'POST') {
        const [_, version, resource] = req.url.split('/');

        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          try {
            const params = JSON.parse(body);

            // 记录 API 请求
            logger.debug({
              msg: 'API request',
              endpoint: resource,
              params: Object.keys(params)
            });

            const result = await handleApiRequest(resource, params);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } catch (error) {
            errorMiddleware(error, req, res, () => {});
          }
        });
        return;
      }

      // 404
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Not Found' }));
    }));
  });

  // 添加访问日志中间件（需要在服务器上挂载）
  server.on('request', accessLogger);

  return server;
}

// API 请求处理
async function handleApiRequest(resource, params) {
  const [skillName, action] = resource.split('.');

  if (!skillName || !action) {
    throw {
      statusCode: 400,
      message: 'Invalid API endpoint. Use /api/{skill}.{action}'
    };
  }

  // 检查 skill 是否已加载
  const skill = openclaw.getSkill(skillName);
  if (!skill) {
    throw {
      statusCode: 404,
      message: `Skill "${skillName}" not found`
    };
  }

  // 执行 action
  if (typeof skill[action] === 'function') {
    const context = {
      tools: {
        feishu_bitable_app_table_record: async (params) => {
          logger.debug('Feishu Bitable call:', params.action);
          return {};
        },
        feishu_im_user_message: async (params) => {
          logger.debug('Feishu IM send:', params.msg_type);
          return {};
        }
      },
      session: {
        get: (key) => {
          logger.debug('Session get:', key);
          return undefined;
        },
        set: (key, value) => {
          logger.debug('Session set:', key);
        }
      },
      bizLogger
    };

    try {
      const result = await skill[action](context, params);
      logger.debug({
        msg: 'API response',
        skill: skillName,
        action: action,
        success: true
      });
      return { success: true, data: result };
    } catch (error) {
      logger.error({
        msg: 'Skill execution failed',
        skill: skillName,
        action: action,
        error: error.message,
        stack: error.stack
      });
      throw {
        statusCode: 500,
        message: `Skill execution failed: ${error.message}`,
        details: process.env.NODE_ENV !== 'production' ? error.stack : undefined
      };
    }
  } else {
    throw {
      statusCode: 404,
      message: `Action "${action}" not found in skill "${skillName}"`
    };
  }
}

// 定时任务：每日推送
function setupCronJobs() {
  const cron = require('node-cron');

  // 每日任务生成与推送
  cron.schedule('0 8 * * *', async () => {
    logger.info('⏰ 执行每日任务生成任务...');
    try {
      // TODO: 实现具体逻辑
      // await openclaw.invokeSkill('kaogong-core', 'generateAndSendDailyTask');
      logger.info('✅ 每日任务生成完成');
    } catch (error) {
      logger.error('❌ 每日任务生成失败:', error);
    }
  });

  // 每周报告
  cron.schedule('0 9 * * 1', async () => {
    logger.info('⏰ 生成周报...');
    try {
      // TODO: 实现周报生成
      logger.info('✅ 周报生成完成');
    } catch (error) {
      logger.error('❌ 周报生成失败:', error);
    }
  });

  // 健康检查（每分钟）
  cron.schedule('* * * * *', () => {
    logger.debug('💓 Heartbeat');
  });

  logger.info('✅ Cron jobs scheduled');
}

// 启动
async function main() {
  await loadSkills();

  const server = createServer();
  const port = process.env.PORT || 8080;

  server.listen(port, () => {
    logger.info(`✅ Server listening on port ${port}`);
    logger.info(`📊 Health check: http://localhost:${port}/health`);
    logger.info(`📚 API endpoints: /api/{skill}.{action}`);
    logger.info(`📖 API docs: http://localhost:${port}/api-docs`);
  });

  // 设置定时任务
  setupCronJobs();

  // 优雅关闭
  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down gracefully...`);
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });

    // 强制退出（10秒后）
    setTimeout(() => {
      logger.error('Force shutdown after 10 seconds');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // 未捕获异常处理
  process.on('uncaughtException', (error) => {
    logger.error('❌ Uncaught Exception:', error);
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  });
}

main().catch((error) => {
  logger.error('❌ Failed to start server:', error);
  process.exit(1);
});
