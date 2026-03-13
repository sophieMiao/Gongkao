/**
 * AI 题目生成器（StepFun API）
 */

const { StepFun } = require('stepfun-api'); // 需要安装 stepfun-api SDK

class AIQuestionGenerator {
  constructor() {
    this.apiKey = process.env.STEPFUN_API_KEY;
    this.client = new StepFun({ apiKey: this.apiKey });
    this.maxGeneratePerDay = parseInt(process.env.MAX_AI_QUESTIONS_PER_USER_PER_DAY) || 10;
  }

  /**
   * 为指定知识点生成题目
   */
  async generateForPoint(knowledgePoint, count = 1) {
    const questions = [];
    
    for (let i = 0; i < count; i++) {
      try {
        const q = await this._generateSingle(knowledgePoint);
        if (q) questions.push(q);
      } catch (error) {
        console.error(`AI生成题目失败 (${knowledgePoint}):`, error.message);
      }
    }
    
    return questions;
  }

  /**
   * 为模块生成题目（泛化知识点）
   */
  async generateForModule(module, count = 1) {
    // 根据模块选择典型知识点
    const pointMap = {
      '数量关系': ['数量关系-工程问题', '数量关系-行程问题', '数量关系-概率统计'],
      '判断推理': ['判断推理-图形推理', '判断推理-逻辑判断'],
      '言语理解': ['言语理解-选词填空', '言语理解-片段阅读'],
      '资料分析': ['资料分析-速算技巧'],
      '常识判断': ['常识判断-时政热点']
    };
    
    const points = pointMap[module] || [module];
    const randomPoint = points[Math.floor(Math.random() * points.length)];
    
    return this.generateForPoint(randomPoint, count);
  }

  /**
   * 生成单个题目
   */
  async _generateSingle(knowledgePoint) {
    const prompt = this._buildPrompt(knowledgePoint);
    
    try {
      const response = await this.client.chat.completions.create({
        model: 'step-3.5-flash',
        messages: [
          { role: 'system', content: '你是一位资深的公务员考试命题专家，擅长出题。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
        max_tokens: 800
      });
      
      const content = response.choices[0].message.content.trim();
      
      // 解析 JSON
      const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim();
      const data = JSON.parse(jsonStr);
      
      return {
        id: `ai_${knowledgePoint.replace(/\s/g, '_')}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content: data.content,
        options: data.options || [],
        correct_answer: data.correct_answer,
        explanation: data.explanation || '',
        knowledge_point: knowledgePoint,
        difficulty: this._inferDifficulty(data.content, data.options),
        source: `AI生成-${new Date().toISOString().split('T')[0]}`
      };
    } catch (error) {
      console.error('StepFun API 调用失败:', error.message);
      return null;
    }
  }

  /**
   * 构建提示词
   */
  _buildPrompt(knowledgePoint) {
    return `请生成一道公务员考试${knowledgePoint}的单项选择题。

要求：
1. 难度：中等（medium）
2. 题干清晰，选项4个，只有一个正确答案
3. 提供详细解析，包括解题思路和知识点讲解
4. 符合公务员考试命题风格，不偏不怪
5. 避免使用敏感内容

输出格式（严格JSON，不要markdown）：
{
  "content": "题干内容",
  "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
  "correct_answer": "A/B/C/D",
  "explanation": "答案解析，包括知识点讲解"
}`;
  }

  /**
   * 推断题目难度（简化版）
   */
  _inferDifficulty(content, options) {
    // 根据题干长度、选项复杂度简单判断
    if (!content || content.length < 50) return 'easy';
    if (content.length > 200) return 'hard';
    if (options && options.length === 4) {
      // 检查选项是否有复杂的文字
      const avgOptionLength = options.reduce((sum, opt) => sum + (opt?.length || 0), 0) / 4;
      if (avgOptionLength > 30) return 'hard';
    }
    return 'medium';
  }
}

module.exports = AIQuestionGenerator;
