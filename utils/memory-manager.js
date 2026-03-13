/**
 * Memory Manager - 记忆压缩系统
 * 目标：降低 60% Token 消耗
 */

class MemoryManager {
  constructor(redisClient, config = {}) {
    this.redis = redisClient;
    this.config = {
      maxShortTermTurns: 10,      // 短期记忆最大轮次
      summaryThreshold: 20,       // 超过20轮触发摘要
      tokenBudget: 4000,          // 总 Token 预算
      profileKeys: ['target_score', 'weak_points', 'streak'] // 用户画像字段
    };
  }

  /**
   * 获取用户的完整上下文（短期 + 长期 + 画像）
   */
  async getContext(userId) {
    // 1. 获取短期记忆（最近对话）
    const shortTerm = await this._getShortTerm(userId);
    
    // 2. 获取长期记忆（摘要）
    const longTerm = await this._getLongTerm(userId);
    
    // 3. 获取用户画像
    const profile = await this._getProfile(userId);
    
    // 4. 构建最终 context
    return this._buildContext(shortTerm, longTerm, profile);
  }

  /**
   * 添加新对话
   */
  async addMessage(userId, role, content) {
    const key = `memory:${userId}:short`;
    
    // 1. 添加到短期记忆（列表 push）
    await this.redis.lPush(key, JSON.stringify({
      role,
      content,
      timestamp: Date.now(),
      tokens: this._countTokens(content)
    }));
    
    // 2. 修剪滑动窗口（保留 maxShortTermTurns * 2 条）
    await this.redis.lTrim(key, 0, this.config.maxShortTermTurns * 2 - 1);
    
    // 3. 检查是否需要生成摘要
    const length = await this.redis.llen(key);
    if (length >= this.config.summaryThreshold * 2) {
      await this._generateSummary(userId);
    }
  }

  /**
   * 生成对话摘要（压缩旧对话）
   */
  async _generateSummary(userId) {
    const key = `memory:${userId}:short`;
    const allMessages = await this.redis.lRange(key, 0, -1);
    const messages = allMessages.map(m => JSON.parse(m));
    
    // 分割：最新的保留，旧的摘要
    const recent = messages.slice(0, this.config.maxShortTermTurns);
    const oldMessages = messages.slice(this.config.maxShortTermTurns);
    
    // 调用 LLM 生成摘要
    const summary = await this._summarizeWithLLM(oldMessages);
    
    // 保存摘要到长期记忆
    await this.redis.lPush(`memory:${userId}:long`, JSON.stringify({
      type: 'summary',
      content: summary,
      created_at: Date.now()
    }));
    
    // 重置短期记忆为 recent
    await this.redis.del(key);
    for (const msg of recent.reverse()) {
      await this.redis.lPush(key, JSON.stringify(msg));
    }
  }

  /**
   * 更新用户画像（关键信息持久化）
   */
  async updateProfile(userId, updates) {
    const key = `memory:${userId}:profile`;
    const existing = await this.redis.get(key);
    const profile = existing ? JSON.parse(existing) : {};
    
    Object.assign(profile, updates, { updated_at: Date.now() });
    
    await this.redis.set(key, JSON.stringify(profile));
  }

  /**
   * 获取用户画像
   */
  async _getProfile(userId) {
    const data = await this.redis.get(`memory:${userId}:profile`);
    return data ? JSON.parse(data) : {};
  }

  /**
   * 清空用户记忆（用于测试）
   */
  async clear(userId) {
    const keys = await this.redis.keys(`memory:${userId}:*`);
    if (keys.length) {
      await this.redis.del(keys);
    }
  }

  // 辅助方法
  _countTokens(text) {
    // 简单估算：1 token ≈ 4 字符（中文）
    return Math.ceil(text.length / 4);
  }

  async _summarizeWithLLM(messages) {
    // TODO: 调用 LLM 生成摘要
    // 暂时返回简单合并
    const total = messages.length;
    return `摘要：共${total}轮对话，已压缩`;
  }

  _buildContext(shortTerm, longTerm, profile) {
    // 合并为最终 context
    return {
      short_term: shortTerm,
      long_term: longTerm,
      profile,
      // 计算总 token 数
      total_tokens: this._calculateTotalTokens(shortTerm, longTerm, profile)
    };
  }

  _calculateTotalTokens(shortTerm, longTerm, profile) {
    let tokens = 0;
    shortTerm.forEach(m => tokens += m.tokens || 0);
    longTerm.forEach(s => tokens += this._countTokens(s.content));
    tokens += this._countTokens(JSON.stringify(profile));
    return tokens;
  }

  async _getShortTerm(userId) {
    const raw = await this.redis.lRange(`memory:${userId}:short`, 0, -1);
    return raw.map(r => JSON.parse(r));
  }

  async _getLongTerm(userId) {
    const raw = await this.redis.lRange(`memory:${userId}:long`, 0, 9);
    return raw.map(r => JSON.parse(r));
  }
}

module.exports = MemoryManager;
