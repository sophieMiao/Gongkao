# RAG 检索系统设计

## 架构

```
用户问题
   ↓
┌─────────────────────────────────────┐
│         Query Understanding          │
│  - 问题分类（知识点、政策、真题）    │
│  - 关键词提取                       │
│  - Query 扩展（同义词）              │
└─────────────────────────────────────┘
   ↓
┌─────────────────────────────────────┐
│          Dual Retrieval             │
│  ┌─────────────┐  ┌─────────────┐ │
│  │   BM25      │  │  Vector     │ │
│  │  (关键词)   │  │  (语义)     │ │
│  └─────────────┘  └─────────────┘ │
│        ↓               ↓            │
│     候选集 A         候选集 B       │
└─────────────────────────────────────┘
   ↓
┌─────────────────────────────────────┐
│           Fusion + Rerank           │
│  - 去重、融合                        │
│  - Rerank（重排序）                 │
│  - Top-K 选择                       │
└─────────────────────────────────────┘
   ↓
最终检索结果（相关知识点、政策、题目解析）
```

---

## 组件

### 1. Vector Store (Qdrant)

**集合设计**：

```python
# 集合名：kaogong_knowledge
collection_name = "kaogong_knowledge"

向量维度：1536（OpenAI text-embedding-3-small）
距离度量：Cosine

Payload 结构：
{
  "text": "知识点内容",
  "type": "knowledge_point/explanation/policy",  # 内容类型
  "knowledge_point": "数量关系-工程问题",  # 关联知识点
  "source": "真题解析/政策文件/教材",
  "source_id": "原文档ID",
  "created_at": "2025-03-14"
}
```

**数据准备**：
- 将 `data/question_bank.json` 中的每道题的 `explanation` 向量化
- 将政策文件（政府工作报告、考试大纲）向量化
- 将知识点描述向量化

---

### 2. BM25 检索

使用 `elastic-builder` 或 `node-bm25` 实现轻量级关键词检索。

索引字段：
- `content`：题目内容、解析
- `knowledge_point`：知识点标签
- `tags`：题型标签

---

### 3. Retriever 实现

```javascript
class DualRetriever {
  constructor() {
    this.qdrant = new QdrantClient();
    this.bm25 = new BM25Index();
  }

  async retrieve(query, topK = 10) {
    // 并行检索
    const [vectorResults, bm25Results] = await Promise.all([
      this.qdrant.search(query, { topK: topK * 2 }),
      this.bm25.search(query, { topK: topK * 2 })
    ]);

    // 融合
    const fused = this.fuseResults(vectorResults, bm25Results);

    // Rerank
    const reranked = await this.rerank(query, fused);

    return reranked.slice(0, topK);
  }

  fuseResults(vec, bm25) {
    // 使用 Reciprocal Rank Fusion (RRF)
    // 或简单加权：0.6 * vector_score + 0.4 * bm25_score
  }

  async rerank(query, candidates) {
    // 使用 Cohere Rerank API 或自研
    // 返回重排序后的结果
  }
}
```

---

### 4. RAG Chain

```javascript
class RAGChain {
  constructor() {
    this.retriever = new DualRetriever();
    this.llm = new StepFun({ model: 'step-3.5-flash' });
  }

  async answer(question) {
    // 1. 检索
    const docs = await this.retriever.retrieve(question);

    // 2. 构建 Prompt
    const context = docs.map(d => d.text).join('\n---\n');
    const prompt = `基于以下资料回答问题：

${context}

问题：${question}

要求：
- 如果资料中有答案，直接引用并给出结论
- 如果资料不足，说明「根据现有资料无法确定」
- 引用具体的资料位置

回答：`;

    // 3. LLM 生成
    const response = await this.llm.chat(prompt);

    // 4. 返回（包含引用）
    return {
      answer: response.content,
      sources: docs.map(d => ({
        text: d.text.substring(0, 100) + '...',
        knowledge_point: d.knowledge_point
      }))
    };
  }
}
```

---

## 应用场景

1. **用户问答**：「什么是工程问题？」 → 检索 + 生成解释
2. **错题解析**：用户答题后，自动检索相关知识点并给出详细解析
3. **政策咨询**：「2025 年国考有什么新政策？」 → 检索政策文件
4. **岗位查询**：「北京税务局的岗位要求是什么？」 → 检索历年岗位数据

---

## 实施步骤

1. **Week 1**: 搭建 Qdrant，导入初始向量数据
2. **Week 2**: 实现 BM25 检索，完成双路召回
3. **Week 3**: 集成 Rerank（先用简单加权，再上 Cohere）
4. **Week 4**: 集成到主流程，用户问答使用 RAG

---

## 性能目标

- 检索延迟：< 200ms（P95）
- 召回率：> 90%（测试集）
- Rerank 准确率：> 85%

---

## 监控指标

- `rag_retrieval_duration_seconds`
- `rag_retrieval_count`
- `rag_hit_rate`（是否检索到相关内容）
- `vector_store_errors_total`
