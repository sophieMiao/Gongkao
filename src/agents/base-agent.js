/**
 * Base Agent - 所有智能体的基类
 */

class BaseAgent {
  constructor(config) {
    this.name = config.name;
    this.description = config.description || '';
    this.expertise = config.expertise || [];
    this.tools = config.tools || [];
    this.systemPrompt = config.systemPrompt || '';
    this.model = config.model || 'step-3.5-flash';
    
    // 初始化 LLM 客户端
    this.llm = this._initLLM();
    
    // 上下文历史（每个 Agent 维护自己的对话历史）
    this.conversationHistory = [];
    
    // 统计
    this.stats = {
      requests: 0,
      tokensUsed: 0,
      errors: 0
    };
  }

  /**
   * 初始化 LLM 客户端
   */
  _initLLM() {
    // 这里可以根据需要支持不同的 LLM 提供商
    const { StepFun } = require('openclaw'); // 或直接使用 stepfun-api
    
    return {
      chat: async (messages, options = {}) => {
        // 使用 StepFun API
        // TODO: 实现实际的 API 调用
        return {
          content: 'Mock response',
          usage: { total_tokens: 100 }
        };
      }
    };
  }

  /**
   * 检查是否能处理此问题（子类需重写）
   */
  canHandle(question) {
    throw new Error('Subclasses must implement canHandle()');
  }

  /**
   * 处理问题（子类需重写）
   */
  async handle(question, context = {}) {
    throw new Error('Subclasses must implement handle()');
  }

  /**
   * 构建完整的消息数组（包含系统提示 + 历史 + 用户问题）
   */
  _buildMessages(question, context = {}) {
    const messages = [
      { role: 'system', content: this.systemPrompt }
    ];
    
    // 添加对话历史（限制最近10轮）
    const recentHistory = this.conversationHistory.slice(-10);
    messages.push(...recentHistory);
    
    // 添加上下文信息
    if (context.user_profile) {
      messages.push({
        role: 'system',
        content: `用户信息：${JSON.stringify(context.user_profile, null, 2)}`
      });
    }
    
    if (context.rag_results) {
      messages.push({
        role: 'system',
        content: `参考资料：\n${context.rag_results.map(r => r.payload?.text || r.text).join('\n---\n')}`
      });
    }
    
    // 添加当前问题
    messages.push({ role: 'user', content: question });
    
    return messages;
  }

  /**
   * 调用 LLM
   */
  async _callLLM(messages, options = {}) {
    this.stats.requests++;
    
    try {
      const response = await this.llm.chat(messages, options);
      this.stats.tokensUsed += response.usage?.total_tokens || 0;
      
      // 保存到历史
      this.conversationHistory.push(
        { role: 'user', content: messages[messages.length - 1].content },
        { role: 'assistant', content: response.content }
      );
      
      return response;
    } catch (error) {
      this.stats.errors++;
      throw error;
    }
  }

  /**
   * 解析 LLM 响应为 JSON（辅助方法）
   */
  _parseJSONResponse(content) {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return { ...this.stats, historyLength: this.conversationHistory.length / 2 };
  }

  /**
   * 清空历史
   */
  clearHistory() {
    this.conversationHistory = [];
  }
}

module.exports = BaseAgent;
