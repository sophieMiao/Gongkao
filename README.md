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

### 系统架构

```
用户 → 飞书机器人 → 后端 API → PostgreSQL
                    ↓
                StepFun AI（题目生成）
```

### 数据模型

- `users` - 用户信息、目标设置
- `daily_tasks` - 每日任务记录
- `progress_snapshots` - 每日进度快照
- `question_bank` - 题库（现成 + AI 生成）
- `knowledge_points` - 知识点图谱

---

## 📦 部署（管理员视角）

本项目为 **SaaS 托管服务**，需要管理员部署到云服务器。

### 1. 环境要求

- Docker + Docker Compose
- PostgreSQL 14+
- Node.js 18+
- Python 3.9+（AI 生成器）

### 2. 申请必要凭据

| 服务 | 用途 | 申请地址 |
|------|------|----------|
| StepFun API Key | AI 生成题目 | https://platform.stepfun.com |
| 飞书开放平台 | 机器人推送 | https://open.feishu.cn |
| 云服务器 | 运行服务 | 阿里云/腾讯云 |

### 3. 快速部署

```bash
# 克隆仓库
git clone https://github.com/sophieMiao/Gongkao.git
cd Gongkao

# 复制环境变量配置
cp .env.example .env
# 编辑 .env，填入你的 API Key

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f
```

### 4. 配置飞书机器人

1. 访问 [飞书开放平台](https://open.feishu.cn)
2. 创建「自建应用」→「机器人」
3. 配置消息推送 URL：`https://your-domain.com/webhook/feishu`
4. 开通「发送消息」权限
5. 获取 `APP_ID`、`APP_SECRET`、`VERIFICATION_TOKEN`
6. 填入 `.env` 文件

详细步骤见 [docs/deployment.md](docs/deployment.md)

### 5. 初始化数据库

```bash
docker-compose exec app python scripts/init_db.py
docker-compose exec app python scripts/import_questions.py
```

### 6. 测试

```bash
# 健康检查
curl http://localhost:8080/health

# 查看 API 文档
open http://localhost:8080/docs
```

---

## 💰 成本预估

| 项目 | 月费用（元） |
|------|-------------|
| 云服务器（2核4G） | 100-200 |
| 域名 + SSL | 30-50 |
| StepFun API（按量） | 100-300 |
| **总计** | **约 300-600元/月** |

按 500 名考生估算，人均成本约 0.6-1.2元/月，可收费 9.9元/月实现盈利。

---

## 📚 文档

- [SaaS 架构设计](docs/saas-architecture.md) - 详细的技术架构
- [部署指南](docs/deployment.md) - 一步一步部署教程
- [开发指南](docs/development.md) - 如何本地开发和贡献
- [API 文档](docs/api.md) - REST API 接口说明
- [飞书机器人配置](docs/feishu-setup.md) - 机器人申请流程

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 开发路线图

- [x] MVP 架构设计
- [ ] 后端 API 实现
- [ ] 飞书机器人集成
- [ ] 难度自适应算法
- [ ] 管理后台
- [ ] Web 答题界面
- [ ] 移动端适配
- [ ] 模拟考试系统
- [ ] 申论 AI 评分
- [ ] 社区功能

---

## 📄 许可证

MIT License - 自由使用、修改、分发

---

## 🙏 致谢

- [OpenClaw](https://openclaw.ai) - Agent 框架
- [StepFun](https://stepfun.com) - AI 能力
- 飞书开放平台 - 消息推送

---

## 📞 支持

- GitHub Issues: [提交问题](https://github.com/sophieMiao/Gongkao/issues)
- 讨论区: [加入讨论](https://github.com/sophieMiao/Gongkao/discussions)

**Made with ❤️ for 考公考生**
