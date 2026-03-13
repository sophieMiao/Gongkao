#!/usr/bin/env node
/**
 * 向量数据导入脚本
 * 将 question_bank.json 中的题目转换为向量并插入 Qdrant
 */

const VectorStore = require('./utils/vector-store');
const EmbeddingGenerator = require('./utils/embedding-generator');
const questionBank = require('./data/question_bank.json');

async function importToVectorStore() {
  console.log('🚀 开始导入向量数据...');
  
  const store = new VectorStore();
  const embedder = new EmbeddingGenerator();
  
  // 确保集合存在
  await store.ensureCollection();
  
  const questions = questionBank.questions;
  console.log(`📊 共 ${questions.length} 道题目需要向量化`);
  
  const points = [];
  const batchSize = 10;
  
  for (let i = 0; i < questions.length; i += batchSize) {
    const batch = questions.slice(i, i + batchSize);
    
    // 构建文档文本
    const documents = batch.map(q => {
      let text = `知识点：${q.knowledge_point}\n`;
      text += `题目：${q.content}\n`;
      if (q.options) {
        text += `选项：${q.options.join('；')}\n`;
      }
      text += `答案：${q.correct_answer}\n`;
      if (q.explanation) {
        text += `解析：${q.explanation}`;
      }
      return text;
    });
    
    // 批量生成 embeddings
    console.log(`  正在向量化第 ${i + 1}-${i + batch.length} 题...`);
    const embeddings = await embedder.generateBatch(documents);
    
    // 构建 points
    batch.forEach((q, idx) => {
      points.push({
        id: q.id,
        vector: embeddings[idx],
        payload: {
          text: documents[idx],
          type: 'question',
          knowledge_point: q.knowledge_point,
          source: q.source,
          source_id: q.id,
          created_at: new Date().toISOString()
        }
      });
    });
    
    // 分批插入
    if (points.length >= 50 || i + batchSize >= questions.length) {
      console.log(`  插入 ${points.length} 条向量数据...`);
      await store.upsert(points);
      points.length = 0; // 清空
    }
  }
  
  // 验证
  const info = await store.getInfo();
  console.log(`✅ 导入完成！集合中共有 ${info.points_count} 条向量数据`);
}

// 错误处理
importToVectorStore()
  .then(() => {
    console.log('✨ 所有数据导入成功');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ 导入失败:', err);
    process.exit(1);
  });
