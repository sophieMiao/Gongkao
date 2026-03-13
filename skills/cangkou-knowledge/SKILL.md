# Skill: cangkou-knowledge

## 描述

考公学习伴侣的知识库管理 Skill，负责题目检索、知识点管理和AI题目生成。

## 功能

- 现成题目检索（按知识点、难度、题型）
- AI 生成新题目（使用 StepFun API）
- 知识点图谱维护
- 错题本管理
- 难度标注与动态调整

## 接口

### `get_questions`

获取指定知识点和难度的题目。

**参数**:
```json
{
  "knowledge_point": "数量关系-工程问题",
  "difficulty": "medium",  // easy/medium/hard
  "count": 5,
  "exclude_used": true  // 排除用户已做过的题目
}
```

**返回**:
```json
{
  "questions": [
    {
      "id": "q_001",
      "type": "choice",  // choice/short_answer/reading
      "content": "题目内容",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "correct_answer": "A",
      "explanation": "答案解析",
      "knowledge_point": "数量关系-工程问题",
      "difficulty": "medium",
      "source": "现成题库"  // 或 "AI生成-2025-01-15"
    }
  ],
  "total_available": 120
}
```

### `generate_questions`

使用 AI 生成新题目。

**参数**:
```json
{
  "knowledge_point": "数量关系-工程问题",
  "difficulty": "medium",
  "count": 3,
  "template": "standard"  // 题目模板类型
}
```

**返回**: 同 `get_questions`

### `record_answer`

记录用户答案并更新知识点掌握度。

**参数**:
```json
{
  "user_id": "ou_xxx",
  "question_id": "q_001",
  "user_answer": "A",
  "is_correct": true,
  "time_spent_seconds": 45
}
```

**返回**:
```json
{
  "knowledge_point_updated": {
    "point": "数量关系-工程问题",
    "total_questions": 25,
    "correct_count": 20,
    "accuracy": 0.8,
    "mastered": true
  }
}
```

### `get_weak_points`

获取用户薄弱知识点列表。

**参数**:
```json
{
  "user_id": "ou_xxx",
  "threshold": 0.7  // 正确率低于此值视为薄弱
}
```

**返回**:
```json
{
  "weak_points": [
    {
      "knowledge_point": "判断推理-逻辑判断",
      "accuracy": 0.58,
      "total_questions": 15,
      "recommended_practice": 10
    }
  ]
}
```

## 题库数据结构

`data/question_bank.json`:

```json
{
  "questions": [
    {
      "id": "q_001",
      "type": "choice",
      "content": "甲乙合作完成一项工程需要10天，甲单独做需要15天，乙单独做需要多少天？",
      "options": ["A. 20天", "B. 25天", "C. 30天", "D. 35天"],
      "correct_answer": "C",
      "explanation": "设工程总量为1，甲每天做1/15，甲乙合作每天做1/10，则乙每天做1/10-1/15=1/30，乙单独做需要30天。",
      "knowledge_point": "数量关系-工程问题",
      "difficulty": "medium",
      "tags": ["合作问题", "工作量计算"],
      "source": "2024国考真题"
    }
  ],
  "knowledge_points": [
    {
      "id": "kp_001",
      "name": "数量关系-工程问题",
      "module": "数量关系",
      "category": "工程问题",
      "description": "涉及工作量、效率、合作等问题",
      "difficulty_levels": ["easy", "medium", "hard"],
      "estimated_questions_needed": 30
    }
  ]
}
```

## AI生成提示词模板

```python
GENERATION_PROMPTS = {
    "choice": """请生成一道公务员考试{module}的{knowledge_point}选择题。
要求：
1. 难度：{difficulty}
2. 选项4个，只有一个正确答案
3. 提供详细解析
4. 符合公考命题风格

输出格式（JSON）：
{{
  "content": "题目内容",
  "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
  "correct_answer": "A",
  "explanation": "答案解析"
}}""",
  
    "short_answer": """请生成一道{module}{knowledge_point}简答题。
要求：
1. 难度：{difficulty}
2. 需要文字作答
3. 提供参考答案
4. 字数控制在100字以内

输出格式（JSON）：
{{
  "content": "题目内容",
  "answer_requirement": "作答要求",
  "reference_answer": "参考答案",
  "explanation": "评分要点"
}}"""
}
```

## 错误处理

- **API 调用失败**: 重试3次后降级到备用题目
- **生成质量差**: 自动过滤（解析失败或答案不明确）
- **题库不足**: 紧急情况下降级到更宽泛的知识点

## 扩展

添加新题型：在 `types` 枚举中添加，实现对应的 prompt 模板和批改逻辑。

## 测试

```bash
pytest tests/test_knowledge.py -v
```
