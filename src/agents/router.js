/**
 * Agent Router - 协调者
 * 负责路由用户问题到合适的专家 Agent
 */

const XingceAgent = require('./xingce-agent');
const ShenlunAgent = require('./shenlun-agent');
const PolicyAgent = require('./policy-agent');
const MotivationAgent = require('./motivation-agent');

class AgentRouter {
  constructor() {
    this.agents = [
      new XingceAgent(),
      new ShenlunAgent(),
      new PolicyAgent(),
      new MotivationAgent()
    ];
    
    // LLM 用于分类（当规则匹配失败时）
    const { StepFun } = require('openclaw');
    this.llm = new StepFun({ model: 'step-3.5-flash' });
  }

  /**
   * 路由并处理问题
   */
  async route(question, context = {}) {
    console.log(`🤖 处理问题: ${question.substring(0, 50)}...`);
    
    // 1. 快速规则匹配
    for (const agent of this.agents) {
      if (agent.canHandle(question)) {
        console.log(`   ✅ 路由到: ${agent.name}`);
        return await agent.handle(question, context);
      }
    }
    
    // 2. LLM 分类
    console.log(`   🔍 规则未匹配，使用 LLM 分类...`);
    const agent = await this._classifyWithLLM(question);
    if (agent) {
      console.log(`   ✅ LLM 路由到: ${agent.name}`);
      return await agent.handle(question, context);
    }
    
    // 3. 默认回复
    console.log(`   ⚠️  无匹配 Agent，返回默认回复`);
    return this._defaultResponse(question);
  }

  /**
   * 使用 LLM 分类问题
   */
  async _classifyWithLLM(question) {
    const agentDescriptions = this.agents.map(a => 
      `${a.name}: ${a.description} (专长: ${a.expertise.join(', ')})`
    ).join('\n');
    
    const prompt = `请根据用户问题选择最合适的处理专家：

可用专家：
${agentDescriptions}

用户问题：${question}

请只输出专家的名称（如 xingce-agent），不要其他内容：`;

    try {
      const response = await this.llm.chat([{ role: 'user', content: prompt }]);
      const choice = response.content.trim().toLowerCase();
      
      // 查找匹配的 Agent
      const agent = this.agents.find(a => 
        a.name === choice || 
        a.name.includes(choice) ||
        choice.includes(a.name.replace('-agent', ''))
      );
      
      return agent;
    } catch (error) {
      console.error('LLM 分类失败:', error);
      return null;
    }
  }

  /**
   * 默认回复（无法识别时）
   */
  _defaultResponse(question) {
    return {
      agent: 'router',
      type: 'fallback',
      content: '我还在学习中，暂时无法回答这个问题。\n\n你可以问我：\n• 行测题目怎么解？（数量关系、资料分析等）\n• 申论写作怎么拿高分？\n• 报考条件是什么？\n• 学习累了怎么坚持？',
      suggested_agents: this.agents.map(a => ({
        name: a.name,
        description: a.description
      }))
    };
  }

  /**
   * 获取所有 Agent 统计信息
   */
  getStats() {
    return this.agents.map(agent => ({
      name: agent.name,
      stats: agent.getStats ? agent.getStats() : {}
    }));
  }

  /**
   * 重置所有 Agent 历史
   */
  resetAllHistory() {
    this.agents.forEach(agent => {
      if (agent.clearHistory) agent.clearHistory();
    });
  }
}

module.exports = AgentRouter;
