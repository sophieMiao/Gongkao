const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { authMiddleware } = require('./middleware/auth');
const taskRoutes = require('./routes/tasks');
const userRoutes = require('./routes/users');
const statsRoutes = require('./routes/stats');
const syncRoutes = require('./routes/sync');

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

// API 路由
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/tasks', authMiddleware, taskRoutes);
app.use('/api/v1/users', authMiddleware, userRoutes);
app.use('/api/v1/stats', authMiddleware, statsRoutes);
app.use('/api/v1/sync', authMiddleware, syncRoutes);

// 错误处理
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
  });
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`🚀 Gongkao API Server listening on port ${PORT}`);
});

module.exports = app;
