const WebSocket = require('ws');
const http = require('http');
const jwt = require('jsonwebtoken');
const { authMiddleware } = require('./src/middleware/auth');

class WebSocketServer {
  constructor(server) {
    this.wss = new WebSocket.Server({ server, path: '/ws' });
    this.clients = new Map(); // userId -> Set<WebSocket>
    
    this.setupHandlers();
    console.log('WebSocket server initialized on /ws');
  }

  setupHandlers() {
    this.wss.on('connection', (ws, req) => {
      // 从 URL 参数获取 token
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get('token');
      
      if (!token) {
        ws.close(1008, 'Unauthorized');
        return;
      }

      const decoded = authMiddleware.verifyToken(token);
      if (!decoded) {
        ws.close(1008, 'Invalid token');
        return;
      }

      const userId = decoded.userId;
      this.addClient(userId, ws);

      // 发送连接成功消息
      this.sendToClient(userId, {
        type: 'connected',
        message: 'WebSocket connected',
        timestamp: new Date().toISOString(),
      });

      // 处理客户端消息
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          this.handleMessage(userId, message);
        } catch (error) {
          console.error('Invalid WebSocket message:', error);
        }
      });

      ws.on('close', () => {
        this.removeClient(userId, ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.removeClient(userId, ws);
      });
    });
  }

  addClient(userId, ws) {
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    this.clients.get(userId).add(ws);
  }

  removeClient(userId, ws) {
    if (this.clients.has(userId)) {
      this.clients.get(userId).delete(ws);
      if (this.clients.get(userId).size === 0) {
        this.clients.delete(userId);
      }
    }
  }

  handleMessage(userId, message) {
    const { type, payload } = message;

    switch (type) {
      case 'ping':
        this.sendToClient(userId, { type: 'pong' });
        break;
      case 'subscribe':
        // 订阅特定频道
        break;
      default:
        console.log(`Unknown message type: ${type}`);
    }
  }

  sendToClient(userId, data) {
    if (this.clients.has(userId)) {
      const message = JSON.stringify(data);
      this.clients.get(userId).forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      });
    }
  }

  // 广播消息给所有在线用户
  broadcast(data) {
    const message = JSON.stringify(data);
    this.clients.forEach((connections) => {
      connections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      });
    });
  }

  // 发送任务完成通知
  sendTaskCompleted(userId, taskId, points, accuracy) {
    this.sendToClient(userId, {
      type: 'task_completed',
      payload: { taskId, points, accuracy },
      timestamp: new Date().toISOString(),
    });
  }

  // 发送新任务通知
  sendNewTask(userId, task) {
    this.sendToClient(userId, {
      type: 'new_task',
      payload: task,
      timestamp: new Date().toISOString(),
    });
  }

  // 发送提醒通知
  sendReminder(userId, title, body) {
    this.sendToClient(userId, {
      type: 'reminder',
      payload: { title, body },
      timestamp: new Date().toISOString(),
    });
  }

  // 发送系统消息
  sendSystemMessage(userId, message) {
    this.sendToClient(userId, {
      type: 'system',
      payload: { message },
      timestamp: new Date().toISOString(),
    });
  }
}

module.exports = WebSocketServer;
