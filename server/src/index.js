const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { authMiddleware } = require('./middleware/auth');
const taskRoutes = require('./routes/tasks');
const userRoutes = require('./routes/users');
const statsRoutes = require('./routes/stats');
const syncRoutes = require('./routes/sync');
const WebSocketServer = require('./websocket');

const app = express();

// 中间件
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 限流中间件
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 每个IP 100次请求
  message: { success: false, error: 'Too many requests, please try again later.' },
});

const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 100, // 第100次请求后开始延迟
  delayMs: 500, // 延迟500ms
});

app.use('/api/v1/', apiLimiter, speedLimiter);

// API 路由
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/tasks', authMiddleware, taskRoutes);
app.use('/api/v1/users', authMiddleware, userRoutes);
app.use('/api/v1/stats', authMiddleware, statsRoutes);
app.use('/api/v1/sync', authMiddleware, syncRoutes);
app.use('/api/v1/upload', authMiddleware, require('./routes/upload'));

// 静态文件服务 (可选的 Web 前端)
app.use(express.static('../public'));

// 错误处理
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
  });
});

const PORT = process.env.PORT || 8080;
const server = http.createServer(app);

// 启动 WebSocket 服务器
const wss = new WebSocketServer(server);

// 将 wss 挂载到 app 上，便于其他模块访问
app.wss = wss;

server.listen(PORT, () => {
  console.log(`🚀 Gongkao API Server listening on port ${PORT}`);
  console.log(`🔗 WebSocket server available at ws://localhost:${PORT}/ws`);
});

module.exports = { app, server, wss };
