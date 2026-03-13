#!/usr/bin/env node
/**
 * 手动测试脚本 - 测试多智能体系统
 */

// 模拟 LLM 客户端
const mockLLM = {
  chat: async (messages, options = {}) => {
    // 简单的关键词响应
    const lastMsg = messages[messages.length - 1].content.toLowerCase();
    
    if (lastMsg.includes('工程问题')) {
      return {
        content: '{"steps": ["设工程总量为1", "甲每天做1/15", "甲乙合作每天做1/10", "乙每天做1/10-1/15=1/30", "乙单独做需要30天"], "answer": "30天", "explanation": "合作效率等于效率之和", "tips": ["记住公式：工作量=效率×时间"]}',
        usage: { total_tokens: 100 }
      };
    }
    
    if (lastMsg.includes('分类')) {
      return { content: 'xingce-agent', usage: { total_tokens: 50 } };
    }
    
    return {
      content: '{"definition": "测试定义", "key_points": ["要点1"], "example": "示例"}',
      usage: { total_tokens: 80 }
    };
  }
};

// 临时修改 BaseAgent 使用 mock LLM
const BaseAgent = require('./src/agents/base-agent');
BaseAgent.prototype._initLLM = function() {
  return mockLLM;
};

// 加载 Agents
const XingceAgent = require('./src/agents/xingce-agent');
const ShenlunAgent = require('./src/agents/shenlun-agent');
const PolicyAgent = require('./src/agents/policy-agent');
const MotivationAgent = require('./src/agents/motivation-agent');
const AgentRouter = require('./src/agents/router');

async function runTests() {
  console.log('🧪 开始运行测试...\n');
  
  let passed = 0;
  let failed = 0;
  
  // 测试 1: XingceAgent canHandle
  console.log('测试 1: XingceAgent.canHandle()');
  try {
    const agent = new XingceAgent();
    if (agent.canHandle('请解答这道工程问题')) {
      console.log('  ✅ 正确识别工程问题');
      passed++;
    } else {
      console.log('  ❌ 未能识别工程问题');
      failed++;
    }
  } catch (e) {
    console.log('  ❌ 错误:', e.message);
    failed++;
  }
  
  // 测试 2: ShenlunAgent canHandle
  console.log('\n测试 2: ShenlunAgent.canHandle()');
  try {
    const agent = new ShenlunAgent();
    if (agent.canHandle('申论大作文怎么复习？')) {
      console.log('  ✅ 正确识别申论问题');
      passed++;
    } else {
      console.log('  ❌ 未能识别申论问题');
      failed++;
    }
  } catch (e) {
    console.log('  ❌ 错误:', e.message);
    failed++;
  }
  
  // 测试 3: PolicyAgent canHandle
  console.log('\n测试 3: PolicyAgent.canHandle()');
  try {
    const agent = new PolicyAgent();
    if (agent.canHandle('国考报考条件是什么？')) {
      console.log('  ✅ 正确识别政策问题');
      passed++;
    } else {
      console.log('  ❌ 未能识别政策问题');
      failed++;
    }
  } catch (e) {
    console.log('  ❌ 错误:', e.message);
    failed++;
  }
  
  // 测试 4: MotivationAgent canHandle
  console.log('\n测试 4: MotivationAgent.canHandle()');
  try {
    const agent = new MotivationAgent();
    if (agent.canHandle('我不想学了，太累了')) {
      console.log('  ✅ 正确识别激励问题');
      passed++;
    } else {
      console.log('  ❌ 未能识别激励问题');
      failed++;
    }
  } catch (e) {
    console.log('  ❌ 错误:', e.message);
    failed++;
  }
  
  // 测试 5: AgentRouter routing
  console.log('\n测试 5: AgentRouter 路由功能');
  try {
    const router = new AgentRouter();
    
    const testCases = [
      { q: '请解答这道工程问题', expected: 'xingce-agent' },
      { q: '申论作文怎么写？', expected: 'shenlun-agent' },
      { q: '报考条件是什么？', expected: 'policy-agent' },
      { q: '我不想学了', expected: 'motivation-agent' }
    ];
    
    for (const tc of testCases) {
      const result = await router.route(tc.q);
      if (result.agent === tc.expected) {
        console.log(`  ✅ "${tc.q}" → ${tc.expected}`);
        passed++;
      } else {
        console.log(`  ❌ "${tc.q}" → 期望 ${tc.expected}, 实际 ${result.agent}`);
        failed++;
      }
    }
  } catch (e) {
    console.log('  ❌ 错误:', e.message);
    failed++;
  }
  
  // 测试 6: Agent handle functions
  console.log('\n测试 6: Agent handle() 方法');
  try {
    const agent = new XingceAgent();
    const result = await agent.handle('请解答这道工程问题');
    if (result.agent === 'xingce-agent' && result.type === 'xingce_solution') {
      console.log('  ✅ XingceAgent.handle() 返回正确结构');
      passed++;
    } else {
      console.log('  ❌ 返回结构不正确');
      failed++;
    }
  } catch (e) {
    console.log('  ❌ 错误:', e.message);
    failed++;
  }
  
  // 测试 7: Router fallback
  console.log('\n测试 7: Router fallback 未知问题');
  try {
    const router = new AgentRouter();
    const result = await router.route('今天天气怎么样？');
    if (result.type === 'fallback' && result.content.includes('我还在学习中')) {
      console.log('  ✅ 正确返回 fallback 响应');
      passed++;
    } else {
      console.log('  ❌ fallback 响应不正确');
      failed++;
    }
  } catch (e) {
    console.log('  ❌ 错误:', e.message);
    failed++;
  }
  
  // 测试 8: Agent stats
  console.log('\n测试 8: Agent 统计信息');
  try {
    const agent = new XingceAgent();
    agent.stats.requests = 5;
    agent.stats.tokensUsed = 1000;
    const stats = agent.getStats();
    if (stats.requests === 5 && stats.tokensUsed === 1000) {
      console.log('  ✅ 统计信息正确');
      passed++;
    } else {
      console.log('  ❌ 统计信息不正确');
      failed++;
    }
  } catch (e) {
    console.log('  ❌ 错误:', e.message);
    failed++;
  }
  
  // 测试总结
  console.log('\n' + '='.repeat(50));
  console.log(`测试完成: ${passed} 通过, ${failed} 失败`);
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
