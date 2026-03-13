/**
 * 申论专家 Agent
 * 负责：申论写作指导、作文批改、范文提供
 */

const BaseAgent = require('./base-agent');

class ShenlunAgent extends BaseAgent {
  constructor() {
    super({
      name: 'shenlun-agent',
      description: '申论专家，负责写作指导与批改',
      expertise: ['申论写作', '公文写作', '文章批改', '议论文'],
      tools: ['evaluate_essay', 'provide_template', 'check_structure'],
      systemPrompt: `你是资深的公务员考试申论辅导专家，擅长文章写作指导和批改。

你的特点：
1. 熟悉申论评分标准（立意、结构、内容、语言）
2. 能指出文章的亮点和不足
3. 提供具体改进建议
4. 给出高分范文作为参考

重要规则：
- 批改要具体，避免"写得不错"这类空泛评价
- 评分要客观公正（0-100分）
- 指出问题时要给出修改方案
- 鼓励考生，保持积极语气

输出格式：
{
  "score": 分数,
  "dimension_scores": {
    "立意": 分数,
    "结构": 分数,
    "内容": 分数,
    "语言": 分数
  },
  "highlights": ["亮点1", "亮点2"],
  "issues": ["问题1", "问题2"],
  "suggestions": ["建议1", "建议2"],
  "sample_improvement": "改进示例段落"
}`
    });
  }

  canHandle(question) {
    const keywords = [
      '申论', '作文', '大作文', '小作文', '写作',
      '议论文', '公文', '报告', '意见', '通知',
      '范文', '模板', '如何写', '怎么写'
    ];
    return keywords.some(k => question.includes(k));
  }

  async handle(question, context = {}) {
    // 判断是写作指导还是作文批改
    const isEssaySubmission = this._isEssaySubmission(question);
    
    if (isEssaySubmission) {
      return await this._gradeEssay(question, context);
    } else {
      return await this._provideGuidance(question, context);
    }
  }

  _isEssaySubmission(question) {
    // 简单判断：如果文本超过200字，可能是作文
    return question.length > 200 && question.includes('\n');
  }

  async _gradeEssay(essay, context) {
    // 1. 检查结构
    const structure = await this._checkStructure(essay);
    
    // 2. 评估内容
    const content = await this._evaluateContent(essay);
    
    // 3. 计算总分
    const score = this._calculateScore(structure, content);
    
    // 4. 生成建议
    const suggestions = this._generateSuggestions(structure, content);
    
    return {
      agent: this.name,
      type: 'essay_grade',
      score,
      structure: structure.score,
      content: content.score,
      language: 0, // TODO
      highlights: structure.highlights.concat(content.highlights),
      issues: structure.issues.concat(content.issues),
      suggestions,
      word_count: this._countWords(essay)
    };
  }

  async _provideGuidance(question, context) {
    const prompt = `用户问题：${question}

请提供申论写作指导，包括：
1. 写作要点
2. 常见错误
3. 高分技巧

输出 JSON 格式：
{
  "key_points": ["要点1", "要点2"],
  "common_mistakes": ["错误1", "错误2"],
  "tips": ["技巧1", "技巧2"],
  "template": "模板示例"
}`;

    const response = await this._callLLM(this._buildMessages(prompt, context));
    return this._parseResponse(response.content);
  }

  async _checkStructure(essay) {
    const hasIntro = essay.includes('引言') || essay.length > 0 && essay.substring(0, 50).includes('。');
    const hasBody = essay.includes('\n\n') || essay.length > 100;
    const hasConclusion = essay.endsWith('。') || essay.substring(-50).includes('总之');
    
    const score = (hasIntro ? 30 : 0) + (hasBody ? 40 : 0) + (hasConclusion ? 30 : 0);
    
    return {
      score,
      hasIntro,
      hasBody,
      hasConclusion,
      highlights: hasIntro && hasBody && hasConclusion ? ['结构完整'] : [],
      issues: !hasIntro ? ['缺少引言'] : !hasConclusion ? ['缺少结论'] : []
    };
  }

  async _evaluateContent(essay) {
    // TODO: 使用 LLM 评估内容
    return {
      score: 70,
      highlights: ['内容充实'],
      issues: []
    };
  }

  _calculateScore(structure, content) {
    return structure.score * 0.4 + content.score * 0.6;
  }

  _generateSuggestions(structure, content) {
    const suggestions = [];
    if (structure.score < 80) {
      suggestions.push('完善文章结构：确保有引言、主体、结论三部分');
    }
    if (content.score < 80) {
      suggestions.push('充实内容：增加论据和案例，避免空泛');
    }
    return suggestions;
  }

  _countWords(text) {
    return text.replace(/\s/g, '').length;
  }
}

module.exports = ShenlunAgent;
