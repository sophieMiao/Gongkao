# 性能优化说明

## 已实施的优化

### 1. 数据库查询优化
- **缓存层**: 使用 Redis 缓存高频查询 (用户信息、今日任务)
- **索引**: Prisma schema 中定义了关键字段索引
- **连接池**: Prisma 默认连接池管理

### 2. API 性能
- **限流保护**: express-rate-limit (15分钟100次)
- **渐进延迟**: express-slow-down (防止暴力攻击)
- **GZIP 压缩**: 通过 nginx 或 Cloudflare 启用

### 3. 静态资源
- **Web 前端**: 使用 Vite 构建，自动代码分割和压缩
- **CDN**: 建议将静态资源托管到 CDN

### 4. WebSocket 连接
- **连接管理**: 高效 Map 结构管理用户连接
- **心跳机制**: 客户端定期 ping/pong
- **自动清理**: 连接断开时自动移除

## 推荐进一步优化

### 数据库
```sql
-- 为频繁查询添加索引
CREATE INDEX idx_task_user_created ON tasks(user_id, created_at DESC);
CREATE INDEX idx_answer_user_created ON answers(user_id, created_at DESC);
CREATE INDEX idx_question_knowledge ON questions(knowledge_points);
```

### Redis 缓存策略
- 用户信息: 5分钟
- 今日任务: 10分钟
- 统计数据: 30分钟
- 热门题目: 1小时

### Nginx 配置
```nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript;
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m;
```

## 监控指标
- 请求延迟 (p95 < 200ms)
- 数据库查询时间 (p95 < 50ms)
- WebSocket 连接数
- 同步成功率 (>99.5%)

## 压测建议
使用 `autocannon` 或 `k6` 进行负载测试:
```bash
npx autocannon -c 100 -d 30 http://localhost:8080/api/v1/tasks/today
```
