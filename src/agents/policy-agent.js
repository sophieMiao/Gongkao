/**
 * 政策查询 Agent
 * 负责：报考条件、报名时间、岗位信息、历年分数线
 */

const BaseAgent = require('./base-agent');

class PolicyAgent extends BaseAgent {
  constructor() {
    super({
      name: 'policy-agent',
      description: '政策专家，解答报考条件、流程、岗位咨询',
      expertise: ['政策法规', '岗位要求', '报考流程', '历年分数'],
      tools: ['search_policy_db', 'query_positions', 'lookup_score_lines'],
      systemPrompt: `你是公务员考试政策专家，负责解答报考条件、报名流程、岗位要求、历年分数线等问题。

你的特点：
1. 回答准确，引用最新政策文件
2. 注明信息年份和来源
3. 区分国考和省考的不同要求
4. 提醒用户关注官方最新公告

重要规则：
- 不确定的问题要说明"需咨询招考单位"
- 政策文件必须标注年份
- 不猜测，不传播谣言
- 强调以官方发布为准

输出格式：
{
  "answer": "详细回答",
  "sources": [
    {"title": "文件名称", "year": "2024", "url": "链接"}
  ],
  "disclaimer": "免责声明"
}`
    });
  }

  canHandle(question) {
    const keywords = [
      '报考条件', '报名时间', '岗位', '专业要求',
      '学历', '年龄', '分数线', '成绩', '进面',
      '流程', '步骤', '材料', '资格',
      '国考', '省考', '事业单位', '报考'
    ];
    return keywords.some(k => question.includes(k));
  }

  async handle(question, context = {}) {
    // 1. 检索政策知识库
    const policyDocs = context.rag_results || [];
    
    // 2. 构建 prompt
    const prompt = `基于以下政策资料回答用户问题：

${policyDocs.length > 0 ? policyDocs.map(d => d.payload?.text || d.text).join('\n---\n') : '暂无相关资料'}

用户问题：${question}

要求：
- 如果资料中有答案，准确引用
- 注明政策文件年份
- 如资料不足，说明"需咨询招考单位"
- 输出 JSON 格式

JSON 格式：
{
  "answer": "回答内容",
  "sources": [{"title": "文件名", "year": "2024"}],
  "confidence": "high/medium/low"
}`;

    const response = await this._callLLM(this._buildMessages(prompt, context));
    const result = this._parseResponse(response.content);
    
    return {
      agent: this.name,
      type: 'policy_answer',
      ...result
    };
  }
}

module.exports = PolicyAgent;
