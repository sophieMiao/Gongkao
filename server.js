#!/usr/bin/env node
/**
 * kaogong-agent 主服务器
 * 集成 OpenClaw Agent 并提供 HTTP API
 */

const http = require('http');
const { OpenClaw } = require('openclaw');
const fs = require('fs');
const path = require('path');

// 加载配置
const config = require('./config/agent.yaml');

// 初始化 OpenClaw
const openclaw = new OpenClaw({
  gatewayUrl: process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:8080',
  skillsPath: path.join(__dirname, 'skills'),
  logger: console
});

// 加载 Skills
async function loadSkills() {
  try {
    await openclaw.loadSkills();
    console.log('✅ Skills loaded successfully');
  } catch (error) {
    console.error('❌ Failed to load skills:', error);
    process.exit(1);
  }
}

// 创建 HTTP 服务器
function createServer() {
  const server = http.createServer(async (req, res) => {
    // 健康检查
    if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
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
          
          // 根据 resource 路由到对应的 skill action
          const result = await handleApiRequest(resource, params);
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (error) {
          console.error('API error:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }

    // 404
    res.writeHead(404);
    res.end('Not Found');
  });

  return server;
}

// API 请求处理
async function handleApiRequest(resource, params) {
  const [skillName, action] = resource.split('.');
  
  if (!skillName || !action) {
    throw new Error('Invalid API endpoint. Use /api/{skill}.{action}');
  }

  // 检查 skill 是否已加载
  const skill = openclaw.getSkill(skillName);
  if (!skill) {
    throw new Error(`Skill "${skillName}" not found`);
  }

  // 执行 action
  if (typeof skill[action] === 'function') {
    // 注入 context（简化版）
    const context = {
      tools: {
        feishu_bitable_app_table_record: async (params) => {
          // 实际实现需调用飞书 API
          console.log('Feishu Bitable call:', params.action);
          return {};
        },
        feishu_im_user_message: async (params) => {
          console.log('Feishu IM send:', params.msg_type);
          return {};
        }
      },
      session: { get: () => ({}) }
    };
    
    const result = await skill[action](context, params);
    return result;
  } else {
    throw new Error(`Action "${action}" not found in skill "${skillName}"`);
  }
}

// 定时任务：每日推送
function setupCronJobs() {
  const cron = require('node-cron');
  
  // 每日任务生成与推送
  cron.schedule('0 8 * * *', async () => {
    console.log('⏰ 执行每日任务生成任务...');
    // 这里调用 kaogong-core 的 generateAndSendDailyTask
    // 需要遍历所有用户
  });
  
  // 每周报告
  cron.schedule('0 9 * * 1', async () => {
    console.log('⏰ 生成周报...');
    // 调用 analytics skill
  });
}

// 启动
async function main() {
  console.log('🚀 启动考公学习伴侣...');
  
  await loadSkills();
  
  const server = createServer();
  const port = process.env.PORT || 8080;
  
  server.listen(port, () => {
    console.log(`✅ Server listening on port ${port}`);
    console.log(`📊 Health check: http://localhost:${port}/health`);
    console.log(`📚 API endpoints: /api/{skill}.{action}`);
  });
  
  // 设置定时任务
  setupCronJobs();
  
  // 优雅关闭
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
}

main().catch(console.error);
