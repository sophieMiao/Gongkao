const VectorStore = require('./vector-store');
const EmbeddingGenerator = require('./embedding-generator');
const BM25Index = require('./bm25-index');
const natural = require('natural');

class DualRetriever {
  constructor() {
    this.vectorStore = new VectorStore();
    this.bm25 = new BM25Index();
    this.embedder = new EmbeddingGenerator();
    this.weights = {
      vector: 0.6,
      bm25: 0.4
    };
  }

  /**
   * 初始化：加载数据到两个索引
   */
  async initialize() {
    console.log('🚀 初始化 RAG 检索系统...');
    
    // 1. 初始化向量数据库
    await this.vectorStore.ensureCollection();
    
    // 2. 加载题库数据到 BM25
    const questionBank = require('../data/question_bank.json');
    const docs = questionBank.questions.map(q => ({
      id: q.id,
      content: this._buildDocument(q),
      type: 'question',
      knowledge_point: q.knowledge_point,
      source: q.source
    }));
    
    this.bm25.addDocuments(docs);
    console.log(`✅ BM25 索引已加载 ${docs.length} 文档`);
    
    // 3. 向量化并插入 Qdrant（如果为空）
    const info = await this.vectorStore.getInfo();
    if (info.points_count === 0) {
      await this._populateVectorStore(questionBank);
    }
    
    console.log('✅ RAG 检索系统初始化完成');
  }

  /**
   * 构建文档内容（题目的完整文本）
   */
  _buildDocument(question) {
    let doc = `知识点：${question.knowledge_point}\n`;
    doc += `题目：${question.content}\n`;
    if (question.options) {
      doc += `选项：${question.options.join('；')}\n`;
    }
    doc += `答案：${question.correct_answer}\n`;
    if (question.explanation) {
      doc += `解析：${question.explanation}`;
    }
    return doc;
  }

  /**
   * 将题库数据填充到向量数据库
   */
  async _populateVectorStore(questionBank) {
    console.log('📦 正在向量化题库并插入 Qdrant...');
    
    const points = [];
    const batchSize = 10;
    
    for (let i = 0; i < questionBank.questions.length; i += batchSize) {
      const batch = questionBank.questions.slice(i, i + batchSize);
      const texts = batch.map(q => this._buildDocument(q));
      
      // 批量生成 embeddings
      const embeddings = await this.embedder.generateBatch(texts);
      
      batch.forEach((q, idx) => {
        points.push({
          id: q.id,
          vector: embeddings[idx],
          payload: {
            text: texts[idx],
            type: 'question',
            knowledge_point: q.knowledge_point,
            source: q.source,
            source_id: q.id,
            created_at: new Date().toISOString()
          }
        });
      });
      
      if (i % 50 === 0) {
        console.log(`  处理中: ${i + batch.length}/${questionBank.questions.length}`);
      }
    }
    
    await this.vectorStore.upsert(points);
    console.log(`✅ 已插入 ${points.length} 条向量数据`);
  }

  /**
   * 检索：双路召回 + 融合
   */
  async retrieve(query, options = {}) {
    const { limit = 10, rerank = true } = options;
    
    // 生成查询向量
    const queryVector = await this.embedder.generate(query);
    
    // 并行检索
    const [vectorResults, bm25Results] = await Promise.all([
      this.vectorStore.search(queryVector, { limit: limit * 2 }),
      this.bm25.search(query, { limit: limit * 2 })
    ]);
    
    // 融合结果
    const fused = this._fuseResults(vectorResults, bm25Results);
    
    // Rerank（如果启用）
    if (rerank && fused.length > limit) {
      const reranked = await this._rerank(query, fused);
      return reranked.slice(0, limit);
    }
    
    return fused.slice(0, limit);
  }

  /**
   * 结果融合：加权分数
   */
  _fuseResults(vectorResults, bm25Results) {
    const scoreMap = new Map();
    
    // 归一化分数
    const vecMax = Math.max(...vectorResults.map(r => r.score));
    const bm25Max = Math.max(...bm25Results.map(r => r.score));
    
    // 向量结果
    vectorResults.forEach(doc => {
      const normScore = doc.score / vecMax;
      scoreMap.set(doc.id, {
        doc,
        scores: { vector: normScore, bm25: 0 },
        sources: ['vector']
      });
    });
    
    // BM25 结果
    bm25Results.forEach(doc => {
      const normScore = doc.score / bm25Max;
      if (scoreMap.has(doc.id)) {
        const existing = scoreMap.get(doc.id);
        existing.scores.bm25 = normScore;
        existing.sources.push('bm25');
      } else {
        scoreMap.set(doc.id, {
          doc,
          scores: { vector: 0, bm25: normScore },
          sources: ['bm25']
        });
      }
    });
    
    // 计算加权总分
    const results = Array.from(scoreMap.values()).map(item => {
      const totalScore = 
        item.scores.vector * this.weights.vector +
        item.scores.bm25 * this.weights.bm25;
      
      // 双路召回加分
      const boost = item.sources.includes('vector') && item.sources.includes('bm25') ? 0.1 : 0;
      
      return {
        id: item.doc.id,
        score: totalScore + boost,
        payload: item.doc.payload,
        sources: item.sources
      };
    });
    
    // 按总分排序
    results.sort((a, b) => b.score - a.score);
    
    return results;
  }

  /**
   * Rerank（简单实现：基于 query 相关性重算）
   * TODO: 可集成 Cohere Rerank API
   */
  async _rerank(query, candidates) {
    // 这里可以实现更复杂的 rerank 逻辑
    // 目前直接返回融合结果
    return candidates;
  }
}

module.exports = DualRetriever;
