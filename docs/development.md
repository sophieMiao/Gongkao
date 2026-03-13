# 开发指南

## 环境设置

### 1. 克隆与依赖

```bash
git clone https://github.com/yourusername/cangkou-agent.git
cd cangkou-agent

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或 venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env` 并填入你的配置：

```bash
cp .env.example .env
```

编辑 `.env`：

```env
# StepFun API Key（用于AI生成题目）
STEPFUN_API_KEY=your_stepfun_api_key

# 飞书配置
FEISHU_APP_ID=your_app_id
FEISHU_APP_SECRET=your_app_secret
BITABLE_APP_TOKEN=your_bitable_app_token
USERS_TABLE_ID=your_users_table_id
TASKS_TABLE_ID=your_tasks_table_id
PROGRESS_TABLE_ID=your_progress_table_id
KNOWLEDGE_TABLE_ID=your_knowledge_table_id

# OpenClaw配置
OPENCLAW_GATEWAY_URL=http://localhost:8080
```

### 3. 飞书多维表格设置

运行初始化脚本创建所需的数据表：

```bash
python scripts/setup_bitable.py
```

该脚本会创建以下表结构：
- `users` - 用户信息
- `tasks` - 每日任务记录
- `progress` - 学习进度
- `knowledge_points` - 知识点统计
- `questions` - 题库（可选，如果使用飞书存储题目）

### 4. 运行 OpenClaw

```bash
# 启动 OpenClaw 网关
openclaw gateway start

# 注册你的 Skills
openclaw skills register skills/cangkou-core
openclaw skills register skills/cangkou-knowledge
openclaw skills register skills/cangkou-notification

# 启动 Agent
openclaw agent run --skill cangkou-core
```

### 5. 测试

```bash
# 单元测试
pytest tests/unit/

# 集成测试
pytest tests/integration/

# 模拟用户注册流程
python tests/simulate_registration.py
```

## 项目结构

```
cangkou-agent/
├── skills/                    # OpenClaw Skills
│   ├── cangkou-core/         # 核心Agent逻辑
│   │   ├── SKILL.md
│   │   ├── index.js         # Node.js实现
│   │   └── workflows/       # 工作流定义（计划中）
│   ├── cangkou-knowledge/    # 知识库管理
│   │   ├── SKILL.md
│   │   ├── index.js
│   │   └── data/            # 题库、知识点
│   └── cangkou-notification/ # 通知推送
│       ├── SKILL.md
│       └── index.js
├── utils/                     # 工具模块
│   ├── difficulty.py         # 难度自适应算法
│   ├── scheduler.py          # 任务调度
│   ├── assessor.py           # 进度评估
│   └── ai_generator.py       # AI题目生成
├── data/                      # 数据文件
│   ├── question_bank.json    # 现成题库
│   ├── knowledge_points.json # 知识点图谱
│   └── score_thresholds.json # 历年分数线
├── config/
│   └── agent.yaml            # Agent配置
├── scripts/
│   ├── setup_bitable.py      # 飞书表初始化
│   └── import_questions.py   # 批量导入题库
├── tests/                     # 测试
├── docs/                      # 文档
├── requirements.txt
├── README.md
└── LICENSE
```

## 扩展题库

### 添加现成题目

编辑 `data/question_bank.json`，在 `questions` 数组中添加：

```json
{
  "id": "q_011",
  "type": "choice",
  "content": "你的题目内容",
  "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
  "correct_answer": "A",
  "explanation": "答案解析",
  "knowledge_point": "数量关系-工程问题",
  "difficulty": "medium",
  "tags": ["标签1", "标签2"],
  "source": "2024某省真题"
}
```

### 使用 AI 生成

系统会自动为薄弱知识点生成新题。如需手动触发：

```python
from utils.ai_generator import AIGenerator

async def generate_more():
    gen = AIGenerator()
    questions = await gen.generate_batch(
        knowledge_point="判断推理-图形推理",
        difficulty="medium",
        count=5
    )
    print(f"生成了 {len(questions)} 道题")
```

## 配置说明

### `config/agent.yaml` 关键参数

- `assessment.mastery_threshold` - 知识点掌握阈值（默认80%）
- `assessment.consecutive_days_required` - 连续达标天数（默认7天）
- `gamification.points` - 积分规则
- `ai_generator.max_generate_per_day` - 每天AI生成题数限制
- `curriculum.xingce_weights` - 行测各模块权重

## 部署到云端

### Docker

```bash
# 构建镜像
docker build -t cangkou-agent .

# 运行
docker run -d \
  --name cangkou \
  -p 8080:8080 \
  -e STEPFUN_API_KEY=your_key \
  -e BITABLE_APP_TOKEN=your_token \
  -e USERS_TABLE_ID=your_table_id \
  cangkou-agent
```

### Kubernetes

参考 `k8s/deployment.yaml` 和 `k8s/service.yaml`。

### Serverless（Railway）

1. Fork 本项目
2. 在 Railway 新建项目，连接 GitHub 仓库
3. 添加环境变量
4. 部署

## 监控与维护

### 日志查看

```bash
# Docker
docker logs -f cangkou

# Kubernetes
kubectl logs -f deployment/cangkou-agent
```

### 数据库查询（飞书）

通过飞书开放平台 API 或直接访问多维表格查看数据。

### 性能指标

- 每日任务发送成功率
- 用户完成率
- AI 生成题目成功率
- 系统响应时间

## 故障排查

### 1. 无法发送飞书消息

- 检查 `feishu_im_user_message` 工具权限
- 确认用户已添加 Agent 为好友或已入群
- 查看网关日志

### 2. AI 生成失败

- 检查 `STEPFUN_API_KEY` 是否正确
- API 调用次数限制
- 网络连接

### 3. 数据库写入失败

- 确认飞书 App 已开通多维表格权限
- `BITABLE_APP_TOKEN` 是否正确
- 表字段是否匹配

## 贡献代码

1. Fork 本仓库
2. 创建功能分支
3. 提交 PR，描述清楚修改内容
4. 确保测试通过

## 待办事项

- [ ] 完善单元测试覆盖率
- [ ] 添加更多题目到初始题库
- [ ] 实现申论写作AI评分
- [ ] 开发管理后台（查看所有用户进度）
- [ ] 添加短信/邮件备用通知渠道
- [ ] 支持多地区/考试类型配置
- [ ] 增加数据导出功能

## 联系方式

- GitHub Issues: 提交 Bug 或功能需求
- 讨论区: 交流使用经验

---

祝所有考生成功上岸！🎓
