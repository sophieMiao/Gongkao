# 多智能体架构设计

## 架构概览

```
用户输入
   ↓
┌─────────────────────────────────────────────┐
│           Router Agent (协调者)              │
│  - 理解用户意图                             │
│  - 路由到对应专家 Agent                     │
│  - 汇总结果返回用户                         │
└─────────────────────────────────────────────┘
        ↓            ↓           ↓           ↓
┌─────────────┐┌─────────────┐┌─────────────┐┌─────────────┐
│  xingce-agent││shenlun-agent││policy-agent ││motivation-  │
│  行测专家    ││  申论专家   ││  政策专家   ││  agent      │
│             ││             ││             ││  激励/心理  │
└─────────────┘└─────────────┘└─────────────┘└─────────────┘
```

---

## Agent 定义

### 1. Base Agent（基类）

```javascript
class BaseAgent {
  constructor(config) {
    this.name = config.name;
    this.description = config.description;
    this.expertise = config.expertise; // 专长领域
    this.tools = config.tools || [];
    this.prompt = config.prompt;
    this.llm = new StepFun({ model: 'step-3.5-flash' });
  }

  /**
   * 处理用户问题
   */
  async handle(question, context = {}) {
    // 1. 构建 prompt
    const systemPrompt = this._buildSystemPrompt();
    const userPrompt = this._buildUserPrompt(question, context);
    
    // 2. 调用 LLM
    const response = await this.llm.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]);
    
    // 3. 解析结果
    const result = this._parseResponse(response.content);
    
    // 4. 记录到上下文
    this._updateContext(context, question, result);
    
    return result;
  }

  /**
   * 子类实现：检查是否能处理此问题
   */
  canHandle(question) {
    throw new Error('must implement');
  }

  /**
   * 子类实现：构建 system prompt
   */
  _buildSystemPrompt() {
    return this.prompt.system;
  }

  /**
   * 子类实现：构建 user prompt
   */
  _buildUserPrompt(question, context) {
    return question;
  }

  /**
   * 子类实现：解析 LLM 响应
   */
  _parseResponse(content) {
    return { answer: content };
  }
}
```

---

### 2. 行测 Agent (XingceAgent)

**职责**：
- 数量关系题解答
- 资料分析计算
- 提供解题思路和技巧

```javascript
class XingceAgent extends BaseAgent {
  constructor() {
    super({
      name: 'xingce-agent',
      description: '行测专家，负责数量关系、资料分析等题型',
      expertise: ['数量关系', '资料分析', '判断推理', '言语理解'],
      tools: ['search_knowledge_base', 'generate_question', 'calculate'],
      prompt: require('../prompts/xingce-agent')
    });
  }

  canHandle(question) {
    // 关键词匹配 + LLM 分类
    const keywords = ['数量关系', '工程问题', '行程问题', '资料分析', '增长率', '比重', '倍数'];
    const hasKeyword = keywords.some(k => question.includes(k));
    
    // 或者使用 LLM 分类
    if (!hasKeyword) {
      return this._classifyWithLLM(question) === 'xingce';
    }
    
    return true;
  }

  async handle(question, context = {}) {
    // 1. 识别知识点
    const knowledgePoint = await this._identifyKnowledgePoint(question);
    
    // 2. 检索相关知识点
    const ragResults = await context.rag.search(question, { limit: 3 });
    
    // 3. 如果有题目，提供解题步骤
    if (question.includes('题') || this._isQuestion(question)) {
      const solution = await this._solveQuestion(question, ragResults);
      return {
        type: 'solution',
        knowledge_point: knowledgePoint,
        steps: solution.steps,
        answer: solution.answer,
        explanation: solution.explanation,
        tips: solution.tips
      };
    }
    
    // 4. 如果是概念询问，提供讲解
    const explanation = await this._explainConcept(knowledgePoint, question);
    return {
      type: 'explanation',
      knowledge_point: knowledgePoint,
      content: explanation
    };
  }

  async _identifyKnowledgePoint(question) {
    // 使用 LLM 或规则识别知识点
    const prompt = `请识别这道题/问题属于哪个知识点：${question}\n\n输出格式：知识点名称（如：数量关系-工程问题）`;
    const resp = await this.llm.chat([{ role: 'user', content: prompt }]);
    return resp.content.trim();
  }

  async _solveQuestion(question, ragContext) {
    // 使用 Chain of Thought 解题
    const prompt = `你是一位行测专家。请解答以下题目，给出详细步骤。

题目：${question}

参考资料：
${ragContext.map(r => r.payload.text).join('\n---\n')}

要求：
1. 分析题型
2. 列出解题步骤
3. 给出最终答案
4. 总结技巧

输出 JSON 格式：
{
  "steps": ["步骤1", "步骤2", ...],
  "answer": "最终答案",
  "explanation": "解析",
  "tips": ["技巧1", "技巧2"]
}`;

    const resp = await this.llm.chat([
      { role: 'system', content: '你是一位资深的公务员考试行测辅导专家。' },
      { role: 'user', content: prompt }
    ]);

    try {
      const jsonStr = resp.content.match(/\{[\s\S]*\}/)[0];
      return JSON.parse(jsonStr);
    } catch (e) {
      return {
        steps: [resp.content],
        answer: '见解析',
        explanation: '',
        tips: []
      };
    }
  }
}
```

---

### 3. 申论 Agent (ShenlunAgent)

**职责**：
- 申论写作指导
- 作文批改与评分
- 提供范文和模板

```javascript
class ShenlunAgent extends BaseAgent {
  constructor() {
    super({
      name: 'shenlun-agent',
      description: '申论专家，负责写作指导与批改',
      expertise: ['申论写作', '公文写作', '文章批改'],
      tools: ['evaluate_essay', 'provide_template', 'check_structure'],
      prompt: require('../prompts/shenlun-agent')
    });
  }

  canHandle(question) {
    const keywords = ['申论', '作文', '公文', '大作文', '小作文', '写作', '议论文'];
    return keywords.some(k => question.includes(k));
  }

  async handle(question, context = {}) {
    // 判断是写作指导还是作文批改
    if (this._isEssaySubmission(question)) {
      return await this._gradeEssay(question, context);
    } else {
      return await this._provideGuidance(question, context);
    }
  }

  async _gradeEssay(essay, context) {
    // 1. 检查结构（引言、主体、结论）
    const structure = await this._checkStructure(essay);
    
    // 2. 评估内容（论点、论据、论证）
    const content = await this._evaluateContent(essay);
    
    // 3. 计算分数（0-100）
    const score = this._calculateScore(structure, content);
    
    // 4. 生成建议
    const suggestions = this._generateSuggestions(structure, content);
    
    return {
      type: 'essay_grade',
      score,
      structure: structure.score,
      content: content.score,
      language: 0, // TODO
      suggestions,
      highlight: this._highlightIssues(essay, structure, content)
    };
  }
}
```

---

### 4. 政策查询 Agent (PolicyAgent)

**职责**：
- 考公政策解答（报考条件、流程、时间）
- 岗位信息查询
- 历年分数线查询

```javascript
class PolicyAgent extends BaseAgent {
  constructor() {
    super({
      name: 'policy-agent',
      description: '政策专家，解答报考条件、流程、岗位咨询',
      expertise: ['政策法规', '岗位要求', '报考流程', '历年分数'],
      tools: ['search_policy_db', 'query_positions', 'lookup_score_lines'],
      prompt: require('../prompts/policy-agent')
    });
  }

  canHandle(question) {
    const keywords = ['报考条件', '报名时间', '岗位', '分数线', '要求', '资格', '流程'];
    return keywords.some(k => question.includes(k));
  }

  async handle(question, context = {}) {
    // 1. RAG 检索政策知识库
    const policyDocs = await context.rag.search(question, {
      filter: { type: 'policy' },
      limit: 5
    });
    
    // 2. 使用 LLM 综合回答
    const prompt = `基于以下政策资料回答问题：

资料：
${policyDocs.map(d => d.payload.text).join('\n---\n')}

问题：${question}

要求：
- 准确引用政策条文
- 注明信息来源年份
- 如有不确定，说明「需咨询官方」

回答：`;

    const resp = await this.llm.chat([
      { role: 'system', content: '你是公务员考试政策专家，回答需准确、合规。' },
      { role: 'user', content: prompt }
    ]);
    
    return {
      type: 'policy_answer',
      content: resp.content,
      sources: policyDocs.map(d => ({
        text: d.payload.text.substring(0, 100) + '...',
        source: d.payload.source
      }))
    };
  }
}
```

---

### 5. 激励 Agent (MotivationAgent)

**职责**：
- 学习动力维持
- 情绪支持
- 学习计划建议

```javascript
class MotivationAgent extends BaseAgent {
  constructor() {
    super({
      name: 'motivation-agent',
      description: '学习伴侣，提供激励和心理支持',
      expertise: ['学习动力', '情绪管理', '计划调整'],
      tools: ['check_streak', 'give_encouragement', 'suggest_break'],
      prompt: require('../prompts/motivation-agent')
    });
  }

  canHandle(question) {
    const keywords = ['不想学', '坚持', '累了', '焦虑', '怎么办', '鼓励', '动力'];
    return keywords.some(k => question.includes(k));
  }

  async handle(question, context = {}) {
    // 1. 查询用户状态
    const userStatus = await this._getUserStatus(context.user_id);
    
    // 2. 生成个性化鼓励
    const prompt = `用户状态：
- 连续学习天数：${userStatus.streak}
- 当前等级：Lv.${userStatus.level}
- 最近完成率：${userStatus.completionRate}%

用户说：${question}

请生成温暖、有力的回应，提供具体建议。`;

    const resp = await this.llm.chat([
      { role: 'system', content: '你是温暖的学习伴侣，善于鼓励和倾听。' },
      { role: 'user', content: prompt }
    ]);
    
    return {
      type: 'encouragement',
      content: resp.content,
      user_status: userStatus
    };
  }
}
```

---

## Router（协调者）

负责将用户问题路由到合适的 Agent：

```javascript
class AgentRouter {
  constructor() {
    this.agents = [
      new XingceAgent(),
      new ShenlunAgent(),
      new PolicyAgent(),
      new MotivationAgent()
    ];
    this.llm = new StepFun({ model: 'step-3.5-flash' });
  }

  /**
   * 路由问题
   */
  async route(question, context = {}) {
    // 1. 快速规则匹配
    for (const agent of this.agents) {
      if (agent.canHandle(question)) {
        console.log(`🎯 路由到: ${agent.name}`);
        return await agent.handle(question, context);
      }
    }
    
    // 2. LLM 分类（规则都没匹配时）
    const agent = await this._classifyWithLLM(question);
    if (agent) {
      return await agent.handle(question, context);
    }
    
    // 3. 默认：返回通用答案
    return this._defaultResponse(question);
  }

  async _classifyWithLLM(question) {
    const prompt = `用户问题：${question}

请选择最合适的处理专家：
1. xingce-agent (行测题目解答)
2. shenlun-agent (申论写作)
3. policy-agent (政策咨询)
4. motivation-agent (学习激励)

输出专家名称（小写）：`;

    const resp = await this.llm.chat([{ role: 'user', content: prompt }]);
    const choice = resp.content.trim().toLowerCase();
    
    return this.agents.find(a => a.name === choice || a.name.includes(choice));
  }

  _defaultResponse(question) {
    return {
      type: 'general',
      content: '我还在学习中，暂时无法回答这个问题。你可以问我关于行测题目、申论写作、考公政策或需要学习鼓励的问题哦~'
    };
  }
}
```

---

## 集成到主服务器

```javascript
// server.saas.js 添加
const router = new AgentRouter();

// 用户问答 API
app.post('/api/v1/chat', async (req, res) => {
  const { user_id, question } = req.body;
  
  // 加载用户上下文（从 Redis）
  const context = await loadUserContext(user_id);
  context.user_id = user_id;
  
  // 路由并处理
  const response = await router.route(question, context);
  
  // 保存上下文
  await saveUserContext(user_id, context);
  
  res.json(response);
});
```

---

## 迭代计划

- [x] 设计 Agent 基类
- [ ] 实现 XingceAgent（行测专家）
- [ ] 实现 ShenlunAgent（申论专家）
- [ ] 实现 PolicyAgent（政策专家）
- [ ] 实现 MotivationAgent（激励专家）
- [ ] 实现 AgentRouter（协调者）
- [ ] 集成到 API
- [ ] 单元测试
- [ ] 性能优化

---

## 文件结构

```
src/agents/
├── base-agent.js
├── xingce-agent.js
├── shenlun-agent.js
├── policy-agent.js
├── motivation-agent.js
├── router.js
└── prompts/
    ├── xingce-agent.js
    ├── shenlun-agent.js
    ├── policy-agent.js
    └── motivation-agent.js
```

---

## 优势

1. **职责清晰**：每个 Agent 专精一个领域
2. **可扩展**：添加新 Agent 无需修改核心
3. **可替换**：Agent 内部实现可独立升级
4. **成本优化**：不同问题可选用不同模型（简单问题用便宜模型）
5. **上下文隔离**：每个 Agent 管理自己的记忆

---

**现在开始编码！**