# Skill: kaogong-core

## 描述

考公学习伴侣的核心 Agent Skill，负责用户管理、任务调度、进度评估和动态难度调整。

## 功能

- 用户注册与信息收集
- 根据目标分数制定备考计划
- 每日生成个性化学习任务
- 实时评估学生进度并调整任务难度
- 判定是否达到"认可"标准
- 管理用户等级和积分

## 工作流

### 1. 注册流程 (`registration.workflow`)

```
用户 → Agent: "我想备考公务员"
Agent → 用户: 收集目标信息（地区、考试类型、目标分数、考试日期）
Agent → 用户: 可选：快速能力测试（5题）
Agent → 系统: 创建用户记录，初始化进度表
Agent → 用户: 发送欢迎消息 + 第一日任务
```

### 2. 每日任务流程 (`daily_task.workflow`)

```
定时触发（每天08:00）:
1. 读取用户当前进度
2. 计算今日应完成任务数（基于剩余天数和目标）
3. 从题库抽取题目：
   - 薄弱知识点优先
   - 难度匹配当前水平
   - 类型多样化（行测+申论）
4. 生成任务卡片并推送
5. 设置24小时完成时限

用户完成任务:
1. 提交答案
2. Agent 批改并记录
3. 更新知识点掌握度
4. 计算今日积分
5. 如果完成所有任务，解锁连胜奖励
```

### 3. 进度评估流程 (`assessment.workflow`)

```
每次答题后触发:
1. 更新该知识点的正确率
2. 重新计算各模块预估分数
3. 与目标分数对比，生成差距报告
4. 调整后续任务难度：
   - 正确率>85% → 提升难度
   - 正确率<60% → 降低难度 + 增加同类题
5. 检查是否连续达标（7天）
   - 是 → 发送"恭喜达标"通知
   - 否 → 继续常规推送
```

## 工具

本 Skill 依赖以下外部工具：

- `feishu_bitable_app_table_record` - 读写用户数据和进度
- `feishu_im_user_message` - 发送每日任务卡片
- `kaogong-knowledge:get_questions` - 从题库获取题目
- `kaogong-knowledge:generate_questions` - AI生成新题

## 配置

在 `config/agent.yaml` 中配置：

```yaml
assessment:
  mastery_threshold: 0.8
  consecutive_days_required: 7
  
gamification:
  points:
    base: 10
    difficulty_multiplier:
      easy: 1.0
      medium: 1.2
      hard: 1.5
```

## 数据结构

### 用户表字段

```json
{
  "user_id": "ou_xxx",
  "name": "张三",
  "target_region": "北京",
  "exam_type": "国考",
  "target_score": {
    "行测": 70,
    "申论": 65
  },
  "exam_date": "2025-11-30",
  "level": 3,
  "total_points": 450,
  "streak": 5,
  "registered_at": "2025-01-01T00:00:00+08:00"
}
```

### 进度表字段

```json
{
  "user_id": "ou_xxx",
  "date": "2025-01-15",
  "knowledge_point": "数量关系-工程问题",
  "total_questions": 20,
  "correct_count": 16,
  "accuracy": 0.8,
  "estimated_score": 68,
  "daily_points_earned": 150,
  "status": "completed"
}
```

## 消息模板

### 每日任务卡片

```json
{
  "title": "📚 考公学习伴侣 | 第3天任务",
  "content": [
    {"tag": "text", "text": "今日学习目标（12分钟）："},
    {"tag": "div", "children": [
      {"tag": "text", "text": "🔥 任务1：数量关系-工程问题 (5min)\n   ▢ 题目1：一项工程...\n   ▢ 题目2：甲乙合作..."}
    ]},
    {"tag": "div", "children": [
      {"tag": "text", "text": "🧠 任务2：判断推理-图形推理 (4min)\n   ▢ 找出图形规律..."}
    ]},
    {"tag": "div", "children": [
      {"tag": "text", "text": "📰 任务3：时政热点阅读 (3min)\n   ▢ 阅读：2025年政府工作报告重点..."}
    ]},
    {"tag": "text", "text": "───────────────"},
    {"tag": "text", "text": "💎 完成任务可获得：150积分\n🔥 当前连续：3天 | 等级：Lv.3"}
  ],
  "buttons": [
    {"text": "开始学习", "url": "https://..."},
    {"text": "稍后提醒我", "url": "..."}
  ]
}
```

### 周报卡片

```json
{
  "title": "📊 本周学习报告",
  "content": [
    {"tag": "text", "text": "张三，这周你表现很棒！"},
    {"tag": "text", "text": "✅ 完成率：100%（7/7天）"},
    {"tag": "text", "text": "📈 平均正确率：78%（↑5%）"},
    {"tag": "text", "text": "🏆 获得积分：1050"},
    {"tag": "text", "text": "⭐ 知识点突破：工程问题、图形推理"},
    {"tag": "text", "text": "距离目标分数还差：8分\n下周继续加油！"}
  ]
}
```

## 事件

- `user.registered` - 用户注册完成
- `task.generated` - 任务生成
- `task.completed` - 任务完成
- `assessment.updated` - 进度更新
- `level.up` - 等级提升
- `achievement.unlocked` - 成就解锁
- `goal.reached` - 达到目标标准

## 错误处理

- 题库不足时：自动触发 AI 生成
- 用户超时未完成：发送催学提醒
- 连续3天未完成：人工干预（发送鼓励消息）
- API 故障：降级到本地缓存任务

## 监控指标

- 每日任务发送数
- 任务完成率
- 平均正确率
- 用户流失率（连续7天未完成）
- AI 生成题目调用次数
