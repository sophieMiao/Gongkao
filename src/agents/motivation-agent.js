/**
 * 激励 Agent
 * 负责：学习动力、情绪支持、计划调整
 */

const BaseAgent = require('./base-agent');

class MotivationAgent extends BaseAgent {
  constructor() {
    super({
      name: 'motivation-agent',
      description: '学习伴侣，提供激励和心理支持',
      expertise: ['学习动力', '情绪管理', '计划调整'],
      tools: ['check_streak', 'give_encouragement', 'suggest_break'],
      systemPrompt: `你是温暖的学习伴侣，专门帮助考生保持学习动力、管理情绪。

你的特点：
1. 共情能力强，善于倾听
2. 鼓励具体、真诚，不空洞
3. 根据用户状态提供个性化建议
4. 正向引导，避免说教

重要规则：
- 承认用户的感受（"我理解你感到累"）
- 提供具体可行的建议
- 用"你可以试试..."而不是"你应该..."
- 适时提醒连续学习天数等成就
- 必要时建议休息

输出风格：温暖、自然、像朋友一样`
    });
  }

  canHandle(question) {
    const keywords = [
      '不想学', '坚持', '累了', '焦虑', '压力',
      '怎么办', '鼓励', '动力', '放弃', '烦躁',
      '心态', '情绪', '休息', '加油'
    ];
    return keywords.some(k => question.includes(k));
  }

  async handle(question, context = {}) {
    // 1. 获取用户状态
    const userStatus = await this._getUserStatus(context.user_id);
    
    // 2. 分析情绪
    const emotion = this._detectEmotion(question);
    
    // 3. 生成回应
    const prompt = `用户状态：
- 连续学习天数：${userStatus.streak}
- 当前等级：Lv.${userStatus.level}
- 最近完成率：${userStatus.completionRate}%

用户说：${question}
检测情绪：${emotion}

请生成温暖、有力的回应，提供具体建议。`;

    const response = await this._callLLM(this._buildMessages(prompt, context));
    
    return {
      agent: this.name,
      type: 'encouragement',
      content: response.content,
      user_status: userStatus,
      emotion
    };
  }

  async _getUserStatus(userId) {
    // 从数据库查询用户状态（简化版）
    return {
      streak: 5,
      level: 3,
      completionRate: 0.8
    };
  }

  _detectEmotion(text) {
    if (text.includes('累') || text.includes('疲惫')) return 'tired';
    if (text.includes('焦虑') || text.includes('压力')) return 'anxious';
    if (text.includes('放弃') || text.includes('不想')) return 'frustrated';
    return 'normal';
  }
}

module.exports = MotivationAgent;
