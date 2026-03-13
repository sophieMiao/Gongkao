/**
 * Memory Manager 单元测试
 * 运行: node tests/memory-manager.test.js
 */

const MemoryManager = require('../utils/memory-manager');

// Mock Redis
const mockRedis = {
  data: {},
  async lPush(key, value) {
    if (!this.data[key]) this.data[key] = [];
    this.data[key].unshift(value);
  },
  async lRange(key, start, end) {
    if (!this.data[key]) return [];
    return this.data[key].slice(start, end >= 0 ? end : this.data[key].length + end);
  },
  async lTrim(key, start, end) {
    if (!this.data[key]) return;
    this.data[key] = this.data[key].slice(start, end + 1);
  },
  async llen(key) {
    return this.data[key] ? this.data[key].length : 0;
  },
  async get(key) {
    return this.data[key] || null;
  },
  async set(key, value) {
    this.data[key] = value;
  },
  async del(key) {
    delete this.data[key];
  },
  async keys(pattern) {
    return Object.keys(this.data).filter(k => k.match(pattern.replace('*', '.*')));
  }
};

async function runTests() {
  console.log('🧪 Memory Manager 测试\n');
  console.log('='.repeat(50));
  
  const manager = new MemoryManager(mockRedis);
  const userId = 'test_user_001';
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: 添加消息
  console.log('\n1. 测试添加消息');
  try {
    await manager.addMessage(userId, 'user', '第一个问题');
    await manager.addMessage(userId, 'assistant', '第一个回答');
    const count = await mockRedis.llen(`memory:${userId}:short`);
    if (count === 2) {
      console.log('  ✅ 添加2条消息成功');
      passed++;
    } else {
      console.log(`  ❌ 消息数错误: ${count}`);
      failed++;
    }
  } catch (e) {
    console.log('  ❌ 错误:', e.message);
    failed++;
  }
  
  // Test 2: 滑动窗口修剪
  console.log('\n2. 测试滑动窗口');
  try {
    // 添加 30 条消息（超过阈值）
    for (let i = 0; i < 30; i++) {
      await manager.addMessage(userId, 'user', `消息${i}`);
    }
    const count = await mockRedis.llen(`memory:${userId}:short`);
    // 应该修剪到 maxShortTermTurns * 2 = 20
    if (count <= 20) {
      console.log(`  ✅ 滑动窗口生效: ${count} 条（<=20）`);
      passed++;
    } else {
      console.log(`  ❌ 窗口未修剪: ${count} 条`);
      failed++;
    }
  } catch (e) {
    console.log('  ❌ 错误:', e.message);
    failed++;
  }
  
  // Test 3: 用户画像
  console.log('\n3. 测试用户画像');
  try {
    await manager.updateProfile(userId, {
      target_score: 70,
      weak_points: ['工程问题', '图形推理']
    });
    const profile = await manager._getProfile(userId);
    if (profile.target_score === 70 && profile.weak_points.length === 2) {
      console.log('  ✅ 用户画像保存成功');
      passed++;
    } else {
      console.log('  ❌ 用户画像不正确');
      failed++;
    }
  } catch (e) {
    console.log('  ❌ 错误:', e.message);
    failed++;
  }
  
  // Test 4: 获取上下文
  console.log('\n4. 测试获取上下文');
  try {
    const context = await manager.getContext(userId);
    if (context.short_term && context.profile && context.total_tokens > 0) {
      console.log(`  ✅ 上下文构建成功（${context.total_tokens} tokens）`);
      passed++;
    } else {
      console.log('  ❌ 上下文不完整');
      failed++;
    }
  } catch (e) {
    console.log('  ❌ 错误:', e.message);
    failed++;
  }
  
  // Test 5: Token 计数
  console.log('\n5. 测试 Token 计数');
  try {
    const text = '你好，这是一个测试句子。';
    const tokens = manager._countTokens(text);
    // 中文字符数/4 ≈ tokens
    const expected = Math.ceil(text.length / 4);
    if (tokens === expected) {
      console.log(`  ✅ Token 计数正确: ${tokens}`);
      passed++;
    } else {
      console.log(`  ❌ Token 计数错误: ${tokens} != ${expected}`);
      failed++;
    }
  } catch (e) {
    console.log('  ❌ 错误:', e.message);
    failed++;
  }
  
  // Test 6: 清空记忆
  console.log('\n6. 测试清空记忆');
  try {
    await manager.clear(userId);
    const keys = await mockRedis.keys(`memory:${userId}:*`);
    if (keys.length === 0) {
      console.log('  ✅ 记忆清空成功');
      passed++;
    } else {
      console.log(`  ❌ 仍有残留: ${keys.length} 个 key`);
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
    console.log('\n✨ 所有测试通过！');
    process.exit(0);
  } else {
    console.log('\n⚠️  有测试失败。');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('测试失败:', err);
  process.exit(1);
});
