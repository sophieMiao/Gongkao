/**
 * 行测专家 Agent
 * 负责：数量关系、资料分析、判断推理、言语理解
 */

const BaseAgent = require('./base-agent');

class XingceAgent extends BaseAgent {
  constructor() {
    super({
      name: 'xingce-agent',
      description: '行测专家，负责数量关系、资料分析、判断推理、言语理解等题型的解答',
      expertise: ['数量关系', '资料分析', '判断推理', '言语理解'],
      tools: ['search_knowledge_base', 'generate_question', 'calculate'],
      systemPrompt: `你是资深的公务员考试行测辅导专家，专门帮助考生解决数量关系、资料分析、判断推理、言语理解等题型。

你的特点：
1. 解题步骤清晰，善于使用"审题→列式→计算→检查"的流程
2. 提供多种解题方法（常规法、技巧法、排除法）
3. 总结题目规律和常见陷阱
4. 用通俗易懂的语言讲解，避免学术化表达
5. 如果用户提供题目，必须给出详细步骤和最终答案

重要规则：
- 数学计算必须准确
- 图形推理要描述清楚规律
- 言语理解要解释词语含义和语境
- 资料分析要指出数据来源和计算方法

当用户问题不属于行测时，返回 null 表示无法处理。`
    });
  }

  canHandle(question) {
    const keywords = [
      '数量关系', '工程问题', '行程问题', '概率', '排列组合',
      '资料分析', '增长率', '比重', '倍数', '平均量',
      '判断推理', '图形推理', '逻辑判断', '三段论', '加强削弱',
      '言语理解', '选词填空', '片段阅读', '语句表达', '病句'
    ];
    
    return keywords.some(k => question.includes(k));
  }

  async handle(question, context = {}) {
    // 1. 识别具体知识点
    const knowledgePoint = await this._identifyKnowledgePoint(question);
    
    // 2. 检索相关知识
    const ragResults = context.rag_results || [];
    
    // 3. 构建详细 prompt
    const userPrompt = this._buildUserPrompt(question, knowledgePoint, ragResults);
    
    // 4. 调用 LLM
    const response = await this._callLLM(this._buildMessages(userPrompt, context));
    
    // 5. 解析结果
    const result = this._parseResponse(response.content);
    
    return {
      agent: this.name,
      type: 'xingce_solution',
      knowledge_point: knowledgePoint,
      ...result
    };
  }

  _buildUserPrompt(question, knowledgePoint, ragResults) {
    let prompt = `用户问题：${question}\n\n`;
    
    if (knowledgePoint) {
      prompt += `识别到的知识点：${knowledgePoint}\n\n`;
    }
    
    if (ragResults.length > 0) {
      prompt += '参考资料：\n';
      ragResults.forEach((r, i) => {
        prompt += `[${i + 1}] ${r.payload?.text || r.text}\n`;
      });
      prompt += '\n';
    }
    
    prompt += `请给出详细解答。要求：
1. 如果是题目，提供解题步骤和最终答案
2. 如果是概念询问，提供定义和示例
3. 使用 JSON 格式返回（如需要）
4. 语言简洁，避免冗长

输出格式（如果是题目）：
{
  "steps": ["步骤1", "步骤2", ...],
  "answer": "最终答案",
  "explanation": "解析",
  "tips": ["技巧1", "技巧2"]
}

输出格式（如果是概念）：
{
  "definition": "概念定义",
  "key_points": ["要点1", "要点2"],
  "example": "示例"
}`;

    return prompt;
  }

  _identifyKnowledgePoint(question) {
    // 简单规则匹配，后续可用 LLM 分类
    const pointMap = {
      '工程问题': ['工程', '合作', '效率', '完成时间'],
      '行程问题': ['行程', '速度', '距离', '相遇', '追及'],
      '概率统计': ['概率', '排列', '组合', '随机'],
      '图形推理': ['图形', '规律', '对称', '旋转', '平移'],
      '逻辑判断': ['逻辑', '推理', '三段论', '前提', '结论'],
      '选词填空': ['选词', '填空', '词语', '搭配'],
      '资料分析': ['资料', '数据', '表格', '增长率', '比重']
    };
    
    for (const [point, keywords] of Object.entries(pointMap)) {
      if (keywords.some(k => question.includes(k))) {
        return point;
      }
    }
    
    return null;
  }

  _parseResponse(content) {
    const json = this._parseJSONResponse(content);
    if (json) return json;
    
    return {
      answer: content,
      steps: []
    };
  }
}

module.exports = XingceAgent;
