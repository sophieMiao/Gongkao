/**
 * Agent Message Bus - 智能体间通信层
 * 支持：发布/订阅、消息路由、异步通信、消息历史
 */

class AgentMessageBus {
  constructor(config = {}) {
    this.config = {
      maxHistorySize: 1000,      // 最大历史记录
      defaultTimeout: 30000,     // 默认超时
      enablePersistence: false,  // 是否持久化（未来可存Redis）
      ...config
    };
    
    // 订阅表：{ topic: [callback1, callback2, ...] }
    this.subscribers = {};
    
    // 消息历史（最近 N 条）
    this.history = [];
    
    // Agent 注册表
    this.agents = new Map(); // agentId -> agentInstance
    
    // 事件监听器
    this.eventListeners = {
      message: [],
      error: [],
      agent_join: [],
      agent_leave: []
    };
  }

  /**
   * 注册 Agent 到消息总线
   */
  registerAgent(agent) {
    if (!agent.id || !agent.name) {
      throw new Error('Agent must have id and name');
    }
    
    this.agents.set(agent.id, agent);
    agent.messageBus = this; // 注入引用
    
    this._emit('agent_join', { agentId: agent.id, agentName: agent.name });
    
    console.log(`[MessageBus] Agent registered: ${agent.name} (${agent.id})`);
  }

  /**
   * 发布消息（广播或定向）
   * @param {Object} message - { from, to, topic, content, type, metadata }
   */
  async publish(message) {
    const envelope = this._createEnvelope(message);
    
    // 保存历史
    this._addToHistory(envelope);
    
    // 记录日志
    console.log(`[MessageBus] ${envelope.from} → ${envelope.to || 'all'} : ${envelope.topic}`);
    
    // 触发消息事件
    this._emit('message', envelope);
    
    // 确定接收者
    const recipients = this._resolveRecipients(envelope);
    
    // 并发投递（不等待结果）
    const promises = recipients.map(agent => this._deliver(envelope, agent));
    await Promise.allSettled(promises);
  }

  /**
   * 订阅主题（接收消息）
   */
  subscribe(topic, callback) {
    if (!this.subscribers[topic]) {
      this.subscribers[topic] = [];
    }
    this.subscribers[topic].push(callback);
    
    // 返回取消订阅函数
    return () => {
      this.subscribers[topic] = this.subscribers[topic].filter(cb => cb !== callback);
    };
  }

  /**
   * 请求-响应模式（等待特定 agent 回复）
   */
  async request(request, timeout = null) {
    const { from, to, topic, content, metadata = {} } = request;
    
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._removeListener(to, topic, listener);
        reject(new Error(`Timeout waiting for response from ${to}`));
      }, timeout || this.config.defaultTimeout);

      const listener = (response) => {
        if (response.metadata?.correlationId === metadata.correlationId) {
          clearTimeout(timer);
          this._removeListener(to, topic, listener);
          resolve(response);
        }
      };

      this.subscribe(topic, listener);
      
      // 发送请求
      this.publish({
        ...request,
        type: 'request'
      });
    });
  }

  /**
   * 广播消息给所有 Agent
   */
  broadcast(topic, content, from = 'system') {
    return this.publish({
      from,
      to: '*',
      topic,
      content,
      type: 'broadcast'
    });
  }

  /**
   * 发送消息给特定 Agent
   */
  send(to, topic, content, from = 'system') {
    return this.publish({
      from,
      to,
      topic,
      content,
      type: 'message'
    });
  }

  /**
   * 获取消息历史
   */
  getHistory(options = {}) {
    let result = this.history;
    
    if (options.agentId) {
      result = result.filter(m => m.from === options.agentId || m.to === options.agentId);
    }
    
    if (options.topic) {
      result = result.filter(m => m.topic === options.topic);
    }
    
    if (options.limit) {
      result = result.slice(-options.limit);
    }
    
    return result;
  }

  /**
   * 事件监听
   */
  on(event, callback) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].push(callback);
    }
  }

  off(event, callback) {
    if (this.eventListeners[event]) {
      this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
    }
  }

  // ============ 私有方法 ============

  _createEnvelope(message) {
    return {
      id: this._generateId(),
      timestamp: Date.now(),
      from: message.from || 'system',
      to: message.to || '*',
      topic: message.topic || 'general',
      content: message.content,
      type: message.type || 'message',
      metadata: message.metadata || {},
      version: '1.0'
    };
  }

  _addToHistory(envelope) {
    this.history.push(envelope);
    
    // 限制大小
    if (this.history.length > this.config.maxHistorySize) {
      this.history = this.history.slice(-this.config.maxHistorySize / 2);
    }
  }

  _resolveRecipients(envelope) {
    if (envelope.to === '*') {
      return Array.from(this.agents.values());
    }
    
    if (Array.isArray(envelope.to)) {
      return envelope.to.map(id => this.agents.get(id)).filter(Boolean);
    }
    
    const agent = this.agents.get(envelope.to);
    return agent ? [agent] : [];
  }

  async _deliver(envelope, agent) {
    try {
      // 1. 检查 agent 是否订阅该主题
      const callbacks = this.subscribers[envelope.topic] || [];
      
      // 2. 调用 agent 的消息处理（如果实现）
      if (agent.onMessage) {
        await agent.onMessage(envelope);
      }
      
      // 3. 触发所有订阅回调
      for (const cb of callbacks) {
        try {
          await cb(envelope, agent);
        } catch (err) {
          console.error(`[MessageBus] Callback error for ${agent.id}:`, err);
        }
      }
    } catch (err) {
      this._emit('error', { envelope, error: err });
    }
  }

  _removeListener(agentId, topic, listener) {
    const callbacks = this.subscribers[topic];
    if (callbacks) {
      this.subscribers[topic] = callbacks.filter(cb => cb !== listener);
    }
  }

  _emit(event, data) {
    (this.eventListeners[event] || []).forEach(cb => {
      try {
        cb(data);
      } catch (err) {
        console.error(`[MessageBus] Event listener error for ${event}:`, err);
      }
    });
  }

  _generateId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ============ 调试工具 ============

  /**
   * 查看当前订阅状态
   */
  debugStats() {
    return {
      agents: Array.from(this.agents.keys()),
      topics: Object.keys(this.subscribers),
      historySize: this.history.length,
      subscriptions: Object.entries(this.subscribers).map(([topic, cbs]) => ({
        topic,
        count: cbs.length
      }))
    };
  }

  /**
   * 清空历史
   */
  clearHistory() {
    this.history = [];
  }
}

module.exports = AgentMessageBus;
