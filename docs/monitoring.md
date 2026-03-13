# 监控系统文档

## 组件

- **Prometheus** - 指标收集与存储
- **Grafana** - 指标可视化与仪表板
- **Loki**（可选）- 日志收集

## 部署

```bash
# 启动监控栈
docker-compose -f docker-compose.monitoring.yml up -d

# 访问
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3000 (admin/admin)
# Loki: http://localhost:3100
```

## 仪表板

预配置的 Grafana 仪表板在 `monitoring/grafana/dashboards/`：

- **kaogong-overview.json** - 总览仪表板
  - 用户数、活跃度
  - 任务完成率
  - 系统性能（响应时间、错误率）
  - AI 调用统计

## 关键指标

| 指标 | 描述 | 告警阈值 |
|------|------|---------|
| `kaogong_users_total` | 总用户数 | - |
| `kaogong_active_users` | 日活跃用户 | < 10 |
| `kaogong_tasks_completion_rate` | 任务完成率 | < 50% |
| `kaogong_request_duration_seconds` | 请求延迟（P95） | > 2s |
| `kaogong_llm_requests_total` | LLM 调用次数 | - |
| `kaogong_cost_estimated_total` | 累计成本 | > 1000元/天 |

## 集成到应用

```javascript
const metrics = require('./utils/metrics');

// 1. 注册中间件
app.use(metrics.middleware());

// 2. 暴露 /metrics 端点
app.get('/metrics', async (req, res) => {
  const m = await metrics.getMetrics();
  res.set('Content-Type', metrics.register.contentType);
  res.end(m);
});

// 3. 记录业务指标
metrics.setUserCount(100);
metrics.setActiveUsers(50);
metrics.recordLLMCall({ model: 'step-3.5-flash', inputTokens: 100, outputTokens: 50 });
```

## 告警规则（Prometheus Alertmanager）

```yaml
groups:
  - name: kaogong-alerts
    rules:
      - alert: HighErrorRate
        expr: kaogong_errors_total / kaogong_requests_total > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "错误率超过 5%"
          
      - alert: SlowResponse
        expr: histogram_quantile(0.95, kaogong_request_duration_seconds) > 2
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "P95 响应时间超过 2s"
```

## 成本监控

`kaogong_cost_estimated_total` 指标实时估算成本：
- StepFun: 0.1元 / 1k tokens
- 其他 API 可自定义价格

通过 Grafana 设置告警：当日成本超过预算时通知。
