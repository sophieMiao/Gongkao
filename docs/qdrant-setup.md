# Qdrant 向量数据库配置

```yaml
version: '3.8'

services:
  qdrant:
    image: qdrant/qdrant:latest
    container_name: kaogong-qdrant
    restart: unless-stopped
    ports:
      - "6333:6333"   # HTTP API
      - "6334:6334"   # gRPC API
    volumes:
      - qdrant_data:/qdrant/storage
    environment:
      - QDRANT__SERVICE__HTTP_PORT=6333
      - QDRANT__SERVICE__GRPC_PORT=6334
    networks:
      - kaogong-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:6333/health"]
      interval: 10s
      timeout: 5s
      retries: 3

networks:
  kaogong-network:
    driver: bridge

volumes:
  qdrant_data:
```

## 集成到主 docker-compose

编辑 `docker-compose.saas.yml`，添加 qdrant 服务。

---

## Collection Schema

```javascript
// Collection: kaogong_knowledge
{
  "name": "kaogong_knowledge",
  "vectors": {
    "size": 1536,
    "distance": "Cosine"
  },
  "payload": [
    { "name": "text", "data_type": "text" },
    { "name": "type", "data_type": "keyword" },  // knowledge_point/explanation/policy
    { "name": "knowledge_point", "data_type": "keyword" },
    { "name": "source", "data_type": "keyword" },
    { "name": "source_id", "data_type": "keyword" },
    { "name": "created_at", "data_type": "datetime" }
  ]
}
```

---

## API 使用示例

```javascript
const { QdrantClient } = require('qdrant');

const client = new QdrantClient({
  url: 'http://localhost:6333'
});

// 插入向量
await client.upsert(collection, {
  points: [
    {
      id: 'q_001_explanation',
      vector: [0.1, 0.2, ...], // 1536维
      payload: {
        text: '工程问题涉及工作量、效率、合作时间的计算...',
        type: 'explanation',
        knowledge_point: '数量关系-工程问题',
        source: 'question_bank',
        source_id: 'q_001',
        created_at: '2025-03-14T00:00:00Z'
      }
    }
  ]
});

// 搜索
const results = await client.search(collection, {
  vector: queryEmbedding,
  filter: {
    must: [
      { key: 'type', match: { value: 'explanation' } }
    ]
  },
  limit: 10
});
```

---

## 下一步

1. 实现向量化工具（调用 StepFun embedding API）
2. 将现有题库、知识点转换为向量
3. 实现检索逻辑
4. 集成 Rerank
