# Qdrant 向量数据库客户端封装

const { QdrantClient } = require('qdrant');

class VectorStore {
  constructor() {
    this.client = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      apiKey: process.env.QDRANT_API_KEY // 可选
    });
    this.collectionName = 'kaogong_knowledge';
  }

  /**
   * 初始化集合（如果不存在）
   */
  async ensureCollection() {
    try {
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(c => c.name === this.collectionName);
      
      if (!exists) {
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: 1536, // OpenAI embedding 维度
            distance: 'Cosine'
          },
          payload: [
            { name: 'text', data_type: 'text' },
            { name: 'type', data_type: 'keyword' },
            { name: 'knowledge_point', data_type: 'keyword' },
            { name: 'source', data_type: 'keyword' },
            { name: 'source_id', data_type: 'keyword' },
            { name: 'created_at', data_type: 'datetime' }
          ]
        });
        console.log(`✅ 创建集合: ${this.collectionName}`);
      }
    } catch (error) {
      console.error('初始化集合失败:', error);
      throw error;
    }
  }

  /**
   * 批量插入向量
   */
  async upsert(points) {
    // points: Array of { id, vector, payload }
    const batchSize = 100;
    for (let i = 0; i < points.length; i += batchSize) {
      const batch = points.slice(i, i + batchSize);
      await this.client.upsert(this.collectionName, {
        points: batch
      });
    }
  }

  /**
   * 搜索（支持过滤）
   */
  async search(vector, options = {}) {
    const { limit = 10, filter = null } = options;
    
    const params = {
      vector,
      limit,
      with_payload: true,
      with_vectors: false
    };
    
    if (filter) {
      params.filter = filter;
    }
    
    const results = await this.client.search(this.collectionName, params);
    return results.map(r => ({
      id: r.id,
      score: r.score,
      payload: r.payload
    }));
  }

  /**
   * 删除集合
   */
  async deleteCollection() {
    await this.client.deleteCollection(this.collectionName);
  }

  /**
   * 获取集合信息
   */
  async getInfo() {
    return await this.client.getCollection(this.collectionName);
  }
}

module.exports = VectorStore;
