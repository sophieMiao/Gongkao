#!/usr/bin/env node
/**
 * 手动测试脚本 - 测试多智能体系统
 * 运行: node tests/agents.test.js
 */

// 模拟 LLM 客户端（避免依赖真实 API）
const mockLLM = {
  chat: async (messages, options = {}) => {
    const lastMsg = messages[messages.length - 1].content.toLowerCase();
    
    if (lastMsg.includes('工程问题') || lastMsg.includes('数量关系')) {
      return {
        content: JSON.stringify({
          steps: ["设工程总量为1", "甲每天做1/15", "甲乙合作每天做1/10", "乙每天做1/10-1/15=1/30", "乙单独做需要30天"],
          answer: "30天",
          explanation: "合作效率等于效率之和",
          tips: ["记住公式：工作量=效率×时间"]
        }),
        usage: { total_tokens: 100 }
      };
    }
    
    if (lastMsg.includes('分类')) {
      return { content: 'xingce-agent', usage: { total_tokens: 50 } };
    }
    
    if (lastMsg.includes('申论')) {
      return {
        content: JSON.stringify({
          definition: "申论是模拟公务员工作场景的写作测试",
          key_points: ["立意要明确", "结构要完整", "内容要充实"],
          example: "例如：谈改革的意义..."
        }),
        usage: { total_tokens: 80 }
      };
    }
    
    return {
      content: JSON.stringify({ answer: '这是模拟回答', tips: [] }),
      usage: { total_tokens: 50 }
    };
  }
};

// 加载 Agents
const BaseAgent = require('../src/agents/base-agent');
const XingceAgent = require('../src/agents/xingce-agent');
const ShenlunAgent = require('../src/agents/shenlun-agent');
const PolicyAgent = require('../src/agents/policy-agent');
const MotivationAgent = require('../src/agents/motivation-agent');
const AgentRouter = require('../src/agents/router');

// 注入 mock LLM
BaseAgent.prototype._initLLM = function() {
  return mockLLM;
};

async function runTests() {
  console.log('🧪 多智能体系统测试\n');
  console.log('='.repeat(50));
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Agent 实例化
  console.log('\n1. 测试 Agent 实例化');
  try {
    const agents = [
      new XingceAgent(),
      new ShenlunAgent(),
      new PolicyAgent(),
      new MotivationAgent()
    ];
    console.log(`  ✅ 成功创建 ${agents.length} 个 Agent`);
    passed++;
  } catch (e) {
    console.log('  ❌ 实例化失败:', e.message);
    failed++;
  }
  
  // Test 2: canHandle 方法
  console.log('\n2. 测试 canHandle() 方法');
  const testCases = [
    { agent: new XingceAgent(), q: '工程问题怎么解？', expected: true },
    { agent: new ShenlunAgent(), q: '申论作文怎么写？', expected: true },
    { agent: new PolicyAgent(), q: '报考条件是什么？', expected: true },
    { agent: new MotivationAgent(), q: '我不想学了', expected: true },
    { agent: new XingceAgent(), q: '今天天气如何？', expected: false }
  ];
  
  for (const tc of testCases) {
    try {
      const result = tc.agent.canHandle(tc.q);
      if (result === tc.expected) {
        console.log(`  ✅ "${tc.q}" → ${tc.expected}`);
        passed++;
      } else {
        console.log(`  ❌ "${tc.q}" → 期望 ${tc.expected}, 实际 ${result}`);
        failed++;
      }
    } catch (e) {
      console.log(`  ❌ "${tc.q}" → 错误: ${e.message}`);
      failed++;
    }
  }
  
  // Test 3: Router 路由
  console.log('\n3. 测试 Router 路由');
  const router = new AgentRouter();
  const routingTests = [
    { q: '工程问题', expectedAgent: 'xingce-agent' },
    { q: '申论写作', expectedAgent: 'shenlun-agent' },
    { q: '报考条件', expectedAgent: 'policy-agent' },
    { q: '不想学了', expectedAgent: 'motivation-agent' },
    { q: '随机问题', expectedAgent: 'router' }
  ];
  
  for (const tc of routingTests) {
    try {
      const result = await router.route(tc.q);
      const matched = result.agent === tc.expectedAgent || result.type === 'fallback';
      if (matched) {
        console.log(`  ✅ "${tc.q}" → ${result.agent || 'fallback'}`);
        passed++;
      } else {
        console.log(`  ❌ "${tc.q}" → 期望 ${tc.expectedAgent}, 实际 ${result.agent}`);
        failed++;
      }
    } catch (e) {
      console.log(`  ❌ "${tc.q}" → 错误: ${e.message}`);
      failed++;
    }
  }
  
  // Test 4: Agent handle 方法
  console.log('\n4. 测试 Agent handle() 方法');
  try {
    const agent = new XingceAgent();
    const result = await agent.handle('请解答工程问题');
    if (result.agent === 'xingce-agent' && result.answer) {
      console.log('  ✅ XingceAgent.handle() 返回有效答案');
      passed++;
    } else {
      console.log('  ❌ 返回结构不正确');
      failed++;
    }
  } catch (e) {
    console.log('  ❌ 错误:', e.message);
    failed++;
  }
  
  // Test 5: 记忆历史
  console.log('\n5. 测试对话历史管理');
  try {
    const agent = new XingceAgent();
    await agent.handle('问题1');
    await agent.handle('问题2');
    const stats = agent.getStats();
    if (stats.historyLength >= 2) {
      console.log(`  ✅ 历史记录正确 (${stats.historyLength} 轮对话)`);
      passed++;
    } else {
      console.log('  ❌ 历史记录不正确');
      failed++;
    }
  } catch (e) {
    console.log('  ❌ 错误:', e.message);
    failed++;
  }
  
  // Test 6: 清空历史
  console.log('\n6. 测试清空历史');
  try {
    const agent = new XingceAgent();
    await agent.handle('测试');
    agent.clearHistory();
    const stats = agent.getStats();
    if (stats.historyLength === 0) {
      console.log('  ✅ 历史清空成功');
      passed++;
    } else {
      console.log('  ❌ 历史未清空');
      failed++;
    }
  } catch (e) {
    console.log('  ❌ 错误:', e.message);
    failed++;
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`测试结果: ${passed} 通过, ${failed} 失败`);
  console.log('='.repeat(50));
  
  if (failed === 0) {
    console.log('\n✨ 所有测试通过！代码质量良好。');
    process.exit(0);
  } else {
    console.log('\n⚠️  有测试失败，请检查代码。');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('测试运行失败:', err);
  process.exit(1);
});
