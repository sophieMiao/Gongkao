# 考公学习伴侣 - SaaS 托管服务架构设计

## 目标

- ✅ 开箱即用：用户注册即可使用
- ✅ 零配置：无需申请任何 API Key
- ✅ 多租户：支持大量考生同时使用
- ✅ 统一管理：管理员可查看所有用户进度

---

## 🏗️ 新架构

```
                    ┌─────────────────┐
                    │   用户（考生）   │
                    └────────┬────────┘
                             │ 1. 注册/登录
                             ▼
                    ┌─────────────────┐
                    │    Web 前端      │  ← 可选：未来添加
                    │  (Vue/React)    │
                    └────────┬────────┘
                             │ 2. API 调用
                             ▼
┌─────────────────────────────────────────────────────────┐
│                   后端 API 服务器                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │  User Service      │  Task Service     │  Auth  │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────┘
                          │ 3. 数据操作
                          ▼
          ┌─────────────────────────────┐
          │   统一数据库（PostgreSQL）    │
          │  users, tasks, progress...  │
          └─────────────────────────────┘
                          │
                          │ 4. 推送任务
                          ▼
          ┌─────────────────────────────┐
          │    飞书机器人（一个就够了）    │
          │  统一应用，服务所有用户       │
          └─────────────────────────────┘
                          │
                          │ 5. AI 生成题目
                          ▼
          ┌─────────────────────────────┐
          │     StepFun API（统一Key）   │
          └─────────────────────────────┘
```

---

## 📊 数据模型（PostgreSQL）

### 1. users 表

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  open_id VARCHAR(255) UNIQUE NOT NULL,  -- 飞书 user_id
  name VARCHAR(100) NOT NULL,
  target_region VARCHAR(50),
  exam_type VARCHAR(20) CHECK (exam_type IN ('国考', '省考', '事业单位')),
  target_score_xingce INTEGER,
  target_score_shenlun INTEGER,
  exam_date DATE,
  level INTEGER DEFAULT 1,
  total_points INTEGER DEFAULT 0,
  streak INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',  -- active/completed/dropped
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 2. daily_tasks 表

```sql
CREATE TABLE daily_tasks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  task_date DATE NOT NULL,
  task_type VARCHAR(20),  -- 行测/申论/常识
  knowledge_point VARCHAR(100),
  question_content TEXT,
  options JSONB,  -- 存储选项数组
  correct_answer VARCHAR(10),
  user_answer VARCHAR(10),
  is_correct BOOLEAN,
  time_spent_seconds INTEGER,
  points_available INTEGER,
  points_earned INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending',  -- pending/completed/expired
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, task_date, knowledge_point)  -- 防止重复
);
```

### 3. progress_snapshots 表（每日进度快照）

```sql
CREATE TABLE progress_snapshots (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  snapshot_date DATE NOT NULL,
  knowledge_point VARCHAR(100),
  total_questions INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  accuracy DECIMAL(5,2) DEFAULT 0.0,
  estimated_score DECIMAL(5,2) DEFAULT 0.0,
  module_scores JSONB,  -- 各模块预估分 {"数量关系": 68, ...}
  streak_days INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  total_points INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, snapshot_date, knowledge_point)
);
```

### 4. question_bank 表（题库）

```sql
CREATE TABLE question_bank (
  id SERIAL PRIMARY KEY,
  question_id VARCHAR(100) UNIQUE NOT NULL,
  type VARCHAR(20) DEFAULT 'choice',
  content TEXT NOT NULL,
  options JSONB,  -- 数组 ["A. ...", "B. ...", ...]
  correct_answer VARCHAR(10) NOT NULL,
  explanation TEXT,
  knowledge_point VARCHAR(100) NOT NULL,
  difficulty VARCHAR(10) CHECK (difficulty IN ('easy', 'medium', 'hard')),
  source VARCHAR(100),  -- "现成题库" 或 "AI生成-2025-01-15"
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX(knowledge_point, difficulty)
);
```

### 5. knowledge_points 表（知识点元数据）

```sql
CREATE TABLE knowledge_points (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,  -- 如 "数量关系-工程问题"
  module VARCHAR(50) NOT NULL,  -- 所属模块
  category VARCHAR(50),  -- 分类
  description TEXT,
  difficulty_levels JSONB,  -- ["easy", "medium", "hard"]
  estimated_questions_needed INTEGER DEFAULT 30,
  weight DECIMAL(3,2) DEFAULT 1.0,  -- 在总分中的权重
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔑 环境变量（服务端配置）

```env
# 服务端配置
NODE_ENV=production
PORT=8080
DATABASE_URL=postgresql://user:pass@localhost/kaogong
JWT_SECRET=your_jwt_secret_key_here

# 飞书配置（统一应用 - 只需要一套）
FEISHU_APP_ID=your_app_id
FEISHU_APP_SECRET=your_app_secret
FEISHU_BOT_TOKEN=your_bot_token  # 机器人身份
FEISHU_BOT_VERIFICATION_TOKEN=your_verification_token  # 事件验证

# StepFun AI
STEPFUN_API_KEY=your_stepfun_api_key

# 管理后台（可选）
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_admin_password
```

**注意**：不再需要 `BITABLE_APP_TOKEN` 和各 `*_TABLE_ID`！

---

## 🛠️ 核心 API 接口

### 用户注册

```
POST /api/v1/register
Content-Type: application/json

{
  "open_id": "ou_xxx",  // 从飞书登录获取
  "name": "张三",
  "target_region": "北京",
  "exam_type": "国考",
  "target_score": {"行测": 70, "申论": 65},
  "exam_date": "2025-11-30"
}

响应：
{
  "success": true,
  "user_id": 123,
  "message": "注册成功，今日任务已生成"
}
```

### 获取今日任务

```
GET /api/v1/tasks/today?user_id=123&open_id=ou_xxx

响应：
{
  "date": "2025-01-15",
  "tasks": [
    {
      "id": 456,
      "knowledge_point": "数量关系-工程问题",
      "content": "题目内容...",
      "options": [...],
      "points_available": 15
    }
  ],
  "total_points": 50,
  "streak": 5
}
```

### 提交答案

```
POST /api/v1/tasks/456/answer
{
  "user_answer": "C",
  "time_spent_seconds": 45
}

响应：
{
  "correct": true,
  "explanation": "答案解析...",
  "points_earned": 15,
  "knowledge_point_updated": {
    "accuracy": 0.82,
    "mastered": true
  }
}
```

### Webhook：飞书事件推送

```
POST /webhook/feishu
{
  "type": "message",
  "event": {...}
}
```

处理用户发来的消息（如「我想备考公务员」），触发注册流程。

---

## 📱 用户流程（简化）

1. **首次使用**
   - 用户添加「考公学习伴侣」飞书机器人
   - 发送「开始备考」
   - 机器人回复注册问题（地区、考试类型、目标分数）
   - 用户回复信息，自动创建账户
   - 立即推送第一日任务

2. **每日学习**
   - 早上 8:00，机器人自动推送任务卡片
   - 用户点击「开始学习」，打开 Web 页面答题
   - 提交答案，即时批改
   - 完成所有任务获得积分

3. **进度追踪**
   - 每周一早上发送周报
   - 达标后自动发送恭喜消息

---

## 🚀 改造步骤

### Step 1: 数据库迁移

1. 创建 PostgreSQL 数据库
2. 运行 schema.sql 创建表结构
3. 导入初始题库（data/question_bank.json → question_bank 表）

### Step 2: 后端重构

1. 创建 Express.js/FastAPI 服务器
2. 实现以下路由：
   - `POST /api/v1/register`
   - `GET /api/v1/tasks/today`
   - `POST /api/v1/tasks/:id/answer`
   - `GET /api/v1/progress/:user_id`
   - `POST /webhook/feishu`（处理飞书消息）
3. 数据库 ORM：Prisma/Sequelize/SQLAlchemy
4. 飞书消息推送：使用统一应用凭据

### Step 3: 前端页面（可选）

1. 任务卡片页面（用户答题界面）
2. 进度查看页面
3. 个人中心（修改目标、查看历史）

### Step 4: 定时任务

1. 每日 8:00 批量生成任务并推送
2. 每周一生成周报
3. 检查未完成任务并催学

### Step 5: 管理后台

1. 用户列表
2. 进度查询
3. 数据导出
4. 手动调整用户状态

### Step 6: 部署

1. 云服务器 + Docker Compose
2. Nginx + HTTPS（域名）
3. 数据库备份
4. 日志监控

---

## 💰 成本估算

| 项目 | 月费用（元） | 备注 |
|------|-------------|------|
| 云服务器（2核4G） | 100-200 | 腾讯云/阿里云 |
| 域名 + SSL | 30-50 | .com 域名约 60元/年 |
| StepFun API | 按量计费 | 假设 1000用户 × 每天5题 ≈ 50万token/月 ≈ 100-200元 |
| 短信/推送（可选） | 0-100 | 飞书免费，备用短信 0.05元/条 |
| **总计** | **约 300-500元/月** | 用户量上去后可摊薄成本 |

---

## 🎯 优先级

**Phase 1（1-2周）**：核心 API + 数据库 + 统一飞书推送
- 用户注册/登录
- 每日任务生成
- 答题与批改
- 飞书卡片推送

**Phase 2（1周）**：难度算法 + 进度评估
- 知识点掌握度计算
- 预估分数
- 难度自适应

**Phase 3（1周）**：周报 + 成就系统
- 周报生成与推送
- 成就解锁
- 达标判定

**Phase 4（可选）**：Web 界面 + 管理后台

---

我现在可以开始改造代码了吗？还是你想先讨论细节？
