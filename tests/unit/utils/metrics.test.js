/**
 * 单元测试示例 - metrics.js
 */

const { register, metrics } = require('../../utils/metrics');

describe('Metrics', () => {
  beforeAll(() => {
    // 清除所有指标，确保测试独立
    register.clear();
  });

  test('should create metrics registry', () => {
    expect(register).toBeDefined();
    expect(typeof register.getMetricsAsJSON).toBe('function');
  });

  test('should have system metrics', () => {
    const json = register.getMetricsAsJSON();
    expect(json).toHaveProperty('metrics');
  });

  test('should track HTTP request metrics', () => {
    const { httpRequestsTotal, httpRequestDurationMicroseconds } = metrics;

    // 模拟增加计数
    httpRequestsTotal.inc({ method: 'GET', route: '/health', status_code: '200' });

    const json = register.getMetricsAsJSON();
    const metric = json.metrics.find(m => m.name === 'gongkao_http_requests_total');
    expect(metric).toBeDefined();
  });

  test('should track business metrics', () => {
    const { dailyTasksGenerated, userRegistrationTotal } = metrics;

    dailyTasksGenerated.inc({ user_id: 'test_user_123' });
    userRegistrationTotal.inc();

    const json = register.getMetricsAsJSON();
    expect(json.metrics.some(m => m.name === 'gongkao_daily_tasks_generated_total')).toBe(true);
    expect(json.metrics.some(m => m.name === 'gongkao_user_registrations_total')).toBe(true);
  });

  test('should reset metrics on clear', () => {
    // 先增加一些指标
    metrics.userRegistrationTotal.inc();
    metrics.dailyTasksCompleted.inc({ user_id: 'test' });

    // 清除
    register.clear();

    const json = register.getMetricsAsJSON();
    // 应该没有之前的指标数据
    expect(json.metrics.filter(m => m.name.includes('user_registrations') || m.name.includes('daily_tasks_completed'))).toHaveLength(0);
  });
});
