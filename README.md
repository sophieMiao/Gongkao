# kaogong-agent / 考公学习伴侣

> **像多邻国一样的 AI 公务员考试学习伴侣 - 开箱即用**

[![GitHub license](https://img.shields.io/github/license/sophieMiao/Gongkao)](https://github.com/sophieMiao/Gongkao/blob/main/LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/sophieMiao/Gongkao)](https://github.com/sophieMiao/Gongkao/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/sophieMiao/Gongkao)](https://github.com/sophieMiao/Gongkao/issues)

## 🎯 这是什么？

一个 AI 驱动的公务员考试备考助手，像多邻国一样每天给你推送个性化学习任务，直到你达到目标分数。

**特点**：
- ✅ **零配置**：注册即可使用，无需申请任何 API Key
- ✅ **AI 出题**：根据你的薄弱环节自动生成题目
- ✅ **动态调整**：每天根据你的答题情况调整难度
- ✅ **游戏化**：积分、等级、连续学习奖励
- ✅ **飞书推送**：每日任务自动送达

---

## 📦 版本说明

本项目提供 **两个版本**，适应不同需求：

### 1️⃣ 轻量版（推荐，默认分支）

**适用场景**：个人部署、小规模用户（< 500人）、快速启动

**特点**：
- ✅ 无需 Qdrant 向量数据库（用本地 JSON 文件替代）
- ✅ 无需 BM25 索引（简单关键词匹配）
- ✅ 单容器部署（仅需 PostgreSQL + Redis）
- ✅ 内存占用 < 500MB
- ✅ 5分钟快速部署

**分支**：`feature/lightweight`（默认）

### 2️⃣ 原版（企业版）

**适用场景**：大规模数据、需要高精度检索、复杂 RAG

**特点**：
- ✅ Qdrant 向量数据库 + BM25 双路召回
- ✅ 支持 rerank 重排序
- ✅ 可扩展 embedding 模型
- ✅ 适合题目 > 10,000 道
- ✅ 检索精度更高

**分支**：`feature/rag-system`

---

**如何选择？**
- 新手/快速体验 → **轻量版**
- 有大量题库/需要精准检索 → **原版**

---

## 🚀 快速开始（用户视角）

### 1. 添加机器人

在飞书中搜索并添加「考公学习伴侣」机器人（或扫描二维码）

### 2. 开始备考

发送消息：
```
我想备考公务员
```

机器人会引导你填写：
- 目标地区（北京、上海、广东...）
- 考试类型（国考/省考/事业单位）
- 目标分数（行测70+，申论65+）
- 预计考试时间

### 3. 每天学习

早上 8:00，你会收到任务卡片：
```
📚 考公学习伴侣 | 第15天任务

今日学习目标（12分钟）：
1. 数量关系-工程问题 (3题) 💡
2. 判断推理-图形推理 (4题) ⚡
3. 时政热点阅读 (5分钟)

───────────────
💎 完成任务可获得：120积分
🔥 当前连续：5天 | 等级：Lv.4

[开始学习] [稍后提醒]
```

点击「开始学习」答题，即时批改，获得积分。

### 4. 查看进度

每周一你会收到周报：
```
📊 本周学习报告

张三，这周你表现很棒！
✅ 完成率：100%（7/7天）
📈 平均正确率：78%（↑5%）
🏆 获得积分：850
⭐ 知识点突破：工程问题、图形推理

距离目标分数还差：8分
下周继续加油！
```

---

## 🏗️ 技术架构（开发者视角）

### 核心特性

- **OpenClaw 驱动**：基于强大的 Agent 框架
- **AI 生成题目**：使用 StepFun API 自动生成考公题目
- **难度自适应**：根据答题正确率动态调整难度
- **统一数据存储**：PostgreSQL 集中管理多租户数据
- **飞书机器人**：一个应用服务所有用户
- **Docker 部署**：一键启动，运维简单

### 系统架构（轻量版）

```
用户 → 飞书机器人 → 后端 API → PostgreSQL
                    ↓
                StepFun AI（题目生成）
                    ↓
        SimpleRetriever（本地JSON检索，无向量库）
```

### 数据模型

- `users` - 用户信息、目标设置
- `daily_tasks` - 每日任务记录
- `progress_snapshots` - 每日进度快照
- `question_bank` - 题库（现成 + AI 生成）
- `knowledge_points` - 知识点图谱

### 技术栈

| 组件 | 轻量版 | 原版（企业） |
|------|--------|-------------|
| 知识检索 | 本地 JSON + 关键词 | Qdrant + BM25 + Rerank |
| 向量数据库 | ❌ 不需要 | ✅ Qdrant |
| 内存占用 | ~500MB | ~2GB+ |
| 部署复杂度 | 简单（3容器） | 中等（4容器） |
| 检索精度 | 中等（关键词） | 高（语义+ lexical） |
| 适合规模 | < 500 用户 | 500+ 用户 |
| 启动速度 | 快（< 10秒） | 慢（需索引构建） |
| 扩展性 | 中等 | 高 |
| **推荐场景** | 个人/小团队快速启动 | 大规模、高精度需求 |

---

## 📦 部署（管理员视角）

### 1. 环境要求

- Docker + Docker Compose
- PostgreSQL 14+（由 Docker 自动启动）
- Redis（由 Docker 自动启动）
- Node.js 18+（仅本地开发需要）
- 云服务器（推荐 2核4G，约 ¥100/月）

### 2. 申请必要凭据

| 服务 | 用途 | 申请地址 |
|------|------|----------|
| StepFun API Key | AI 生成题目 | https://platform.stepfun.com |
| 飞书开放平台 | 机器人推送 | https://open.feishu.cn |
| 云服务器 | 运行服务 | 阿里云/腾讯云 |

### 3. 快速部署（3步骤）

#### 步骤 1：克隆并配置

```bash
# 克隆仓库（轻量版）
git clone -b feature/lightweight https://github.com/sophieMiao/Gongkao.git
cd Gongkao

# 复制环境变量配置
cp .env.saas .env

# 编辑 .env，填入：
# - STEPFUN_API_KEY（必填）
# - FEISHU_APP_ID, FEISHU_APP_SECRET（必填）
# - FEISHU_VERIFICATION_TOKEN（必填）
# - POSTGRES_PASSWORD（修改默认密码）
# - APP_URL（你的域名，如 https://kaogong.example.com）
```

#### 步骤 2：启动服务

```bash
# 一键启动所有服务（PostgreSQL, Redis, App）
docker-compose -f docker-compose.saas.yml up -d

# 查看日志
docker-compose -f docker-compose.saas.yml logs -f app

# 等待启动完成（看到 "🚀 kaogong-agent SaaS 版启动"）
```

#### 步骤 3：配置飞书机器人

1. 访问 [飞书开放平台](https://open.feishu.cn)
2. 创建「自建应用」→「机器人」
3. 配置消息推送 URL：`https://your-domain.com/webhook/feishu`
4. 开通「发送消息」权限
5. 获取 `APP_ID`、`APP_SECRET`、`VERIFICATION_TOKEN`
6. 填入 `.env` 文件（已填过）
7. 发布应用，安装到工作区

详细步骤见 [docs/deployment.md](docs/deployment.md)

### 4. 初始化数据库

```bash
# 首次启动自动执行 Prisma migrate
# 如果需要手动导入示例数据：
docker-compose -f docker-compose.saas.yml exec app node scripts/import_sample_data.js
```

### 5. 测试

```bash
# 健康检查
curl http://localhost:8080/health

# 查看指标（监控）
curl http://localhost:8080/metrics

# 访问 Grafana（如果启用了监控栈）
# docker-compose -f docker-compose.monitoring.yml up -d
# 浏览器打开 http://localhost:3000 (admin/admin)
```

### 6. 访问 Web 答题界面

```
http://your-domain.com/task.html?user=1&task_id=123
```

---

## 📦 部署（Docker Compose 文件说明）

### 轻量版配置（推荐）

```yaml
# docker-compose.saas.yml
services:
  postgres:   # PostgreSQL 数据库
  redis:      # Redis 缓存（记忆存储）
  app:        # 主应用（Node.js + Express）
```

**总计：3 个容器，内存占用 ~1.5GB**

### 完整监控栈（可选）

```bash
# 启动监控（Prometheus + Grafana + Loki）
docker-compose -f docker-compose.monitoring.yml up -d

# 访问：
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3000
# Loki: http://localhost:3100
```

---

## 💰 成本预估（500 用户/月，轻量版）

| 项目 | 费用 |
|------|------|
| 云服务器（2核4G） | ¥100-150 |
| 域名 + SSL | ¥30-50 |
| StepFun API（500人×5题/天×30天） | ¥200-400 |
| **总计** | **约 ¥330-600/月** |

人均成本 ¥0.66-1.2/天，可定价 ¥9.9/月实现盈利。

**注意**：轻量版不包含 Qdrant，节省了约 ¥100/月（内存和存储成本）。

---

## 📊 版本对比

| 特性 | 轻量版（推荐） | 企业版（原版） |
|------|---------------|---------------|
| **分支** | `feature/lightweight` | `feature/rag-system` |
| 知识检索 | 本地 JSON + 关键词 | Qdrant 向量 + BM25 |
| 检索精度 | 中等（依赖关键词） | 高（语义 + 词汇） |
| 部署复杂度 | ⭐☆☆☆☆ (简单) | ⭐⭐⭐☆☆ (中等) |
| 内存占用 | ~500MB | ~2GB+ |
| 容器数量 | 3个（PostgreSQL, Redis, App） | 4个（+Qdrant） |
| 适合用户数 | < 500 | 500+ |
| 启动速度 | 快（< 10秒） | 慢（需索引构建） |
| 扩展性 | 中等 | 高 |
| **推荐场景** | 个人/小团队快速启动 | 大规模、高精度需求 |

---

## 📚 文档

### 轻量版（当前分支）
- [部署指南](docs/deployment.md) - 一步一步部署教程
- [开发指南](docs/development.md) - 如何本地开发和贡献
- [API 文档](docs/api.md) - REST API 接口说明
- [飞书机器人配置](docs/feishu-setup.md) - 机器人申请流程

### 企业版（原版）
- [企业版架构设计](docs/saas-architecture.md) - 详细的技术架构（Qdrant + RAG）
- [RAG 检索系统](docs/rag-system.md) - 双路召回实现

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 开发路线图

#### ✅ 轻量版（当前版本，已实现）
- [x] 多智能体系统（4专家 + Router）
- [x] Agent 消息总线（通信 + 学习）
- [x] 轻量级检索（本地 JSON + 关键词）
- [x] 记忆压缩（Redis + 滑动窗口）
- [x] 监控系统（Prometheus + Grafana）
- [x] 安全体系（Guardrail）
- [x] Web 答题前端
- [x] Docker 一键部署
- [x] 飞书机器人集成

#### 🔄 企业版（原版，feature/rag-system 分支）
- [x] Qdrant 向量数据库
- [x] BM25 全文检索
- [x] 双路召回融合
- [ ] Cohere Rerank 集成
- [ ] 大规模题库优化

#### 📅 未来计划（两个版本共通）
- [ ] 更多题目导入（1000+）
- [ ] 周报自动生成
- [ ] 管理后台（React）
- [ ] 移动端 PWA 支持
- [ ] 错题本导出 PDF
- [ ] 模拟考试系统
- [ ] 申论 AI 评分
- [ ] 社区功能（排行榜、学习小组）

---

## 🔄 分支管理

本项目使用多分支策略，区分不同版本和功能：

| 分支 | 用途 | 状态 | 推荐 |
|------|------|------|------|
| `main` | 稳定版（待定） | 开发中 | ⚠️ 未稳定 |
| `dev` | 开发主线 | 活跃 | 开发者用 |
| `feature/lightweight` | **轻量版（默认）** | ✅ 推荐 | **所有用户** |
| `feature/rag-system` | 企业版（Qdrant） | ✅ 完成 | 大规模部署 |
| `feature/multi-agent` | 多智能体系统 | ✅ 已合并 | - |
| `feature/memory-compress` | 记忆压缩 | ✅ 已合并 | - |
| `feature/agent-communication` | Agent 通信层 | ✅ 已合并 | - |
| `feature/monitoring` | 监控系统 | ✅ 已合并 | - |
| `feature/security` | 安全体系 | ✅ 已合并 | - |
| `feature/web-frontend` | Web 前端 | ✅ 已合并 | - |

### 如何切换版本？

```bash
# 克隆仓库
git clone https://github.com/sophieMiao/Gongkao.git
cd Gongkao

# 切换到轻量版（推荐）
git checkout feature/lightweight

# 或切换到企业版
git checkout feature/rag-system
```

---

## 🐛 已知问题

见 [KNOWN_ISSUES.md](KNOWN_ISSUES.md)

---

## 📞 支持

- GitHub Issues: [提交问题](https://github.com/sophieMiao/Gongkao/issues)
- 讨论区: [加入讨论](https://github.com/sophieMiao/Gongkao/discussions)
- 文档: [docs/](docs/) 目录

**Made with ❤️ for 考公考生**

---

## ⚖️ 许可证

MIT License - 自由使用、修改、分发