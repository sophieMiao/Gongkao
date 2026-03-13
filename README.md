# 考公学习伴侣 - 智能备考Agent

一个基于 OpenClaw 的 AI 驱动的公务员考试学习伴侣，像多邻国一样每日推送个性化任务，动态调整学习进度，直到考生达到目标分数。

## ✨ 特性

- 🎯 **目标导向**：根据历年分数线制定个性化备考路径
- 🤖 **AI 动态调整**：每日根据学生掌握情况调整难度和任务
- 📚 **智能题库**：现成题目 + AI 生成题目（StepFun API）
- 🎮 **游戏化学习**：积分、等级、连胜 streak、成就徽章
- 📊 **进度追踪**：实时掌握知识点掌握度、预估得分
- 🔔 **每日提醒**：通过飞书/邮件推送学习任务
- 🌐 **云部署**：支持多用户同时使用

## 🏗️ 架构

```
kaogong-agent/
├── skills/                    # OpenClaw Skills
│   ├── kaogong-core/         # 核心 Agent（任务调度、评估）
│   ├── kaogong-knowledge/    # 知识库管理（题库、知识点）
│   ├── kaogong-notification/ # 通知推送（飞书、邮件）
│   └── kaogong-analytics/    # 数据分析（进度报告）
├── data/                     # 数据文件
│   ├── question_bank.json    # 现成题库
│   ├── knowledge_points.json # 知识点图谱
│   └── score_thresholds.json # 历年分数线
├── utils/
│   ├── difficulty.py         # 难度自适应算法
│   ├── scheduler.py          # 任务调度器
│   ├── assessor.py           # 进度评估器
│   └── ai_generator.py       # AI 题目生成器
├── config/
│   └── openclaw.yaml        # OpenClaw 配置
├── tests/                    # 测试用例
└── docs/                     # 文档
```

## 🚀 快速开始

### 1. 环境准备

```bash
# 克隆仓库
git clone https://github.com/yourusername/kaogong-agent.git
cd kaogong-agent

# 安装依赖
pip install -r requirements.txt

# 配置 OpenClaw
cp config/openclaw.yaml.example config/openclaw.yaml
# 编辑配置文件，填入你的 API keys
```

### 2. 配置数据源

```bash
# 初始化飞书多维表格（存储用户数据、进度）
# 运行配置向导
python scripts/setup.py
```

### 3. 启动 Agent

```bash
# 方式一：直接运行（开发环境）
openclaw run --config config/openclaw.yaml

# 方式二：Docker（生产环境）
docker-compose up -d

# 方式三：云部署（K8s）
kubectl apply -f k8s/
```

### 4. 用户使用

用户在飞书中添加 Agent 为好友或加入群聊，即可开始：

```
用户：我想备考公务员
Agent：你好！请告诉我：
1. 目标地区（如：北京、上海、广东）
2. 考试类型（国考/省考）
3. 目标分数（如：行测70+，申论65+）
4. 预计考试时间

然后 Agent 会：
- 根据历年分数线制定90天计划
- 每天推送学习任务
- 动态调整难度
- 每周发送进度报告
```

## 📊 评估标准

Agent 根据以下因素动态调整：

1. **目标分数差距**：当前预估分 vs 目标分
2. **知识点掌握度**：每个知识点的正确率
3. **学习时长**：每日投入时间
4. **剩余天数**：距离考试时间

动态调整：
- 正确率 > 85% → 提升难度，减少同类题目
- 正确率 < 60% → 降低难度，增加练习量
- 连续3天达标 → 提前进入下一阶段
- 进度滞后 → 增加每日任务量

## 🎯 达标判定

Agent「认可」的标准：
- ✅ 连续7天完成学习任务（无缺勤）
- ✅ 各模块正确率达到目标（数量关系70%、判断推理80%等）
- ✅ 预估分数超过目标线（基于最近10次模拟）
- ✅ 所有核心知识点完成「掌握」状态（正确率>80%）

达标后 Agent 会：
1. 发送恭喜消息和证书
2. 提供冲刺建议（押题、模拟考试）
3. 转为「维护模式」（每周1次模拟测试）

## 📝 题库管理

### 现成题目
- 放在 `data/question_bank.json`
- 格式：JSON，包含题目、选项、答案、解析、知识点标签
- 来源：公开真题、自行整理

### AI 生成题目
- 使用 StepFun Step API 自动生成新题
- 配置 `ai_generator.py` 中的 API key
- 生成策略：
  - 知识点薄弱环节 → 生成针对性练习
  - 旧题重复出现 → 生成变体题
  - 特定题型练习 → 批量生成

## 🔧 配置说明

### `config/openclaw.yaml`

```yaml
agent:
  name: "考公学习伴侣"
  timezone: "Asia/Shanghai"
  
notification:
  channel: "feishu"  # 推送渠道
  daily_task_time: "08:00"
  weekly_report_day: "Monday"
  
assessment:
  mastery_threshold: 0.8
  consecutive_days: 7
  min_daily_time: 10
  
ai_generator:
  enabled: true
  provider: "stepfun"
  api_key: "${STEPFUN_API_KEY}"
  generate_per_day: 10  # 每天最多生成题数
  
database:
  type: "feishu_bitable"  # 或 "sqlite"
  bitable_app_token: "${BITABLE_APP_TOKEN}"
  bitable_table_ids:
    users: "${USERS_TABLE_ID}"
    tasks: "${TASKS_TABLE_ID}"
    progress: "${PROGRESS_TABLE_ID}"
```

## 📈 数据存储

### 飞书多维表格（推荐）

创建三个表：

**1. 用户表**
| 字段 | 类型 | 说明 |
|------|------|------|
| user_id | 文本 | 飞书 open_id |
| name | 文本 | 姓名 |
| target_region | 单选 | 目标地区 |
| exam_type | 单选 | 考试类型 |
| target_score | 数字 | 目标分数 |
| exam_date | 日期 | 考试日期 |
| level | 数字 | 当前等级 |
| total_points | 数字 | 总积分 |
| streak | 数字 | 连续天数 |
| registered_at | 创建时间 | 注册时间 |

**2. 每日任务表**
| 字段 | 类型 | 说明 |
|------|------|------|
| task_id | 文本 | 任务ID |
| user_id | 文本 | 用户ID |
| date | 日期 | 任务日期 |
| task_type | 单选 | 行测/申论/常识 |
| knowledge_point | 文本 | 知识点 |
| question | 文本 | 题目内容 |
| options | 多选 | 选项 |
| correct_answer | 文本 | 正确答案 |
| user_answer | 文本 | 用户答案 |
| is_correct | 复选框 | 是否正确 |
| time_spent | 数字 | 用时(分钟) |
| points_earned | 数字 | 获得积分 |
| status | 单选 | 待完成/已完成 |

**3. 进度表**
| 字段 | 类型 | 说明 |
|------|------|------|
| user_id | 文本 | 用户ID |
| date | 日期 | 记录日期 |
| knowledge_point | 文本 | 知识点 |
| total_questions | 数字 | 总题数 |
| correct_count | 数字 | 正确数 |
| accuracy | 数字 | 正确率 |
| estimated_score | 数字 | 预估分数 |
| rank | 数字 | 等级 |

### SQLite（备选）

```bash
# 初始化数据库
sqlite3 data/kaogong.db < schema.sql
```

## 🧪 测试

```bash
# 单元测试
pytest tests/unit/

# 集成测试（需要配置测试环境）
pytest tests/integration/

# 模拟用户流程
python tests/simulate_user.py
```

## 📦 部署

### 云部署（推荐）

1. **Docker 部署**
```bash
docker build -t kaogong-agent .
docker run -d --name kaogong -p 8080:8080 \
  -e STEPFUN_API_KEY=your_key \
  -e BITABLE_APP_TOKEN=your_token \
  kaogong-agent
```

2. **Kubernetes**
```bash
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```

3. **Serverless（Vercel/Railway）**
```bash
# 参考 docs/serverless.md
```

### 本地运行

```bash
openclaw gateway start
openclaw agent run --skill skills/kaogong-core
```

## 🤝 贡献

欢迎贡献！请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)

### 开发指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 需要帮助的地方

- 📝 题库扩充（各模块题目）
- 🎨 UI/UX 改进（飞书卡片消息设计）
- 🔧 难度算法优化
- ☁️ 云部署文档（其他平台）
- 🧪 测试用例

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 🙏 致谢

- [OpenClaw](https://openclaw.ai) - 强大的 Agent 框架
- [StepFun](https://stepfun.com) - AI 能力支持
- 飞书开放平台 - 消息推送与数据存储

## 📞 联系方式

-  Issues: [GitHub Issues](https://github.com/yourusername/kaogong-agent/issues)
-  讨论: [GitHub Discussions](https://github.com/yourusername/kaogong-agent/discussions)

---

**Made with ❤️ for 考公考生**
