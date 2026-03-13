# 技术栈升级计划

## 参考项目亮点

参考那个 Java + LangChain4j 的企业级 Agent 项目，我们需要升级以下能力：

### 1. 向量检索 + RAG
**问题**：现在只有简单题库查询，没有语义检索
**升级**：
- 集成 Qdrant（或 PgVector）
- 将政策文档、知识点、真题解析向量化
- 实现「双路召回」：
  - 路由1：BM25 关键词检索（精确匹配）
  - 路由2：向量相似度检索（语义理解）
- 添加 Rerank 层（Cohere Rerank 或自研）
- 效果：减少模型幻觉，提高答案准确性

### 2. 记忆自进化
**问题**：用户不能直接修改知识库
**升级**：
- 用户说「我不懂工程问题，多解释一下」
- Agent 自动更新该知识点的教学策略
- 或者用户反馈「这道题答案错了」，自动标记待审核

### 3. 多租户记忆压缩
**问题**：Context 会越来越长，Token 消耗大
**升级**：
- Redis 存储每个用户的对话历史
- 滑动窗口：只保留最近 N 轮
- 重要记忆持久化（用户目标、薄弱点）
- 预计降低 60% Token 消耗

### 4. 多智能体系统
**问题**：单个 Agent 能力有限
**升级**：
```
用户问题 → Router Agent → 分发到专家 Agent
                    ↓
    xingce-agent  (数量关系、资料分析)
    shenlun-agent (申论写作、批改)
    policy-agent  (政策查询、岗位咨询)
    motivation-agent (激励、心理疏导)
```

每个 Agent 有自己的 Prompt、工具、知识库。

### 5. Function Calling
**问题**：现在工具调用是硬编码的
**升级**：
- 定义工具 Schema（OpenAI 格式）
- LLM 自动选择工具
- 支持多轮工具调用（先查知识库，再生成答案）

### 6. 安全体系
**问题**：没有输入安全检查
**升级**：
- 敏感词过滤（政治、暴力、广告）
- Prompt 注入检测
- 内容审核（防止不当输出）

### 7. 监控与 LLMOps
**问题**：没有监控
**升级**：
- Prometheus 指标：
  - 请求量、延迟、错误率
  - Token 消耗（输入/输出）
  - AI 调用成功率
  - 用户活跃度
- Grafana 仪表板
- 成本分析（每用户每日成本）

---

## 技术选型

| 组件 | 候选 | 选择 | 理由 |
|------|------|------|------|
| 向量数据库 | Qdrant, PgVector, Weaviate | **Qdrant** | 性能好、Rust 写、Docker 易部署 |
| 缓存/记忆 | Redis | **Redis** | 已有，成熟 |
| 监控 | Prometheus + Grafana | **同左** | 行业标准 |
| LLM 网关 | LangChain, LlamaIndex, 自研 | **自研轻量** | 避免重依赖 |
| 安全 | 自研规则 + 第三方 API | **自研 + 百度内容审核** | 成本可控 |

---

## 实施步骤（分支策略）

```
main                     - 稳定版，生产环境
dev                     - 开发主线，合并测试
feature/rag-system      - RAG 检索系统
feature/multi-agent     - 多智能体架构
feature/memory-compress - 记忆压缩
feature/monitoring      - 监控系统
```

每次完成一个 feature，merge 回 dev，测试后合并到 main。

---

## 代码组织变化

```
kaogong-agent/
├── server.saas.js           → 拆分为：
├── src/
│   ├── api/                # REST API 路由
│   ├── agents/             # 多智能体实现
│   │   ├── base-agent.js
│   │   ├── xingce-agent.js
│   │   ├── shenlun-agent.js
│   │   ├── policy-agent.js
│   │   └── motivation-agent.js
│   ├── rag/                # RAG 系统
│   │   ├── retriever.js    # 双路召回
│   │   ├── reranker.js     # 重排序
│   │   └── vector-store.js # Qdrant 连接
│   ├── memory/             # 记忆管理
│   │   ├── redis-memory.js
│   │   ├── compressor.js   # 滑动窗口压缩
│   │   └── summarizer.js   # 自动摘要
│   ├── tools/              # Function Calling 工具集
│   │   ├── registry.js
│   │   ├── search-kb.js
│   │   ├── generate-q.js
│   │   └── assess.js
│   ├── security/           # 安全体系
│   │   ├── guardrail.js    # 敏感词、注入检测
│   │   └── content-mod.js  # 内容审核
│   ├── monitoring/         # 监控
│   │   ├── metrics.js
│   │   ├── prometheus.js
│   │   └── dashboard.json  # Grafana 配置
│   └── config/
├── tests/
└── docs/
```

---

## 里程碑

- [ ] 2025-03-15: RAG 检索可用
- [ ] 2025-03-17: 多智能体通信
- [ ] 2025-03-19: 记忆压缩（Token 消耗降低 30%）
- [ ] 2025-03-21: 监控系统上线
- [ ] 2025-03-23: 完整安全体系
- [ ] 2025-03-25: 性能测试 + 优化
- [ ] 2025-03-27: 小范围用户测试（10人）

---

## 成功指标

| 指标 | 当前 | 目标 |
|------|------|------|
| 平均响应时间 | - | < 2s |
| Token 消耗/用户/天 | - | < 1000 tokens |
| 用户任务完成率 | - | > 70% |
| AI 调用成功率 | - | > 99% |
| 系统可用性 | - | 99.5% |

---

**现在开始编码！**
