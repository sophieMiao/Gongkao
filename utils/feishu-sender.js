const { PrismaClient } = require('@prisma/client');
const fetch = require('node-fetch');

const prisma = new PrismaClient();

/**
 * 发送飞书消息
 */
async function sendFeishuMessage(openId, content, cardId = null) {
  try {
    // 获取飞书 access token
    const token = await getFeishuAccessToken();
    
    // 发送消息 API
    const response = await fetch('https://open.feishu.cn/open-apis/im/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify({
        receive_id: openId,
        receive_id_type: 'open_id',
        msg_type: content.msg_type || 'text',
        content: typeof content === 'string' ? { text: content } : content.content,
        card_id: cardId
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('发送飞书消息失败:', response.status, error);
      throw new Error(`发送失败: ${response.status} - ${error}`);
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('sendFeishuMessage error:', error);
    throw error;
  }
}

/**
 * 获取飞书 Access Token
 */
async function getFeishuAccessToken() {
  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;
  
  if (!appId || !appSecret) {
    throw new Error('FEISHU_APP_ID 和 FEISHU_APP_SECRET 必须配置');
  }
  
  // 这里应该有缓存逻辑，避免频繁获取 token
  const cacheKey = 'feishu_access_token';
  // TODO: 实现 Redis 缓存
  
  const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: appId,
      app_secret: appSecret
    })
  });
  
  if (!response.ok) {
    throw new Error(`获取飞书 token 失败: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (data.code !== 0) {
    throw new Error(`飞书认证失败: ${data.msg}`);
  }
  
  return data.tenant_access_token;
}

/**
 * 发送卡片消息（便捷方法）
 */
async function sendCardMessage(openId, card) {
  return sendFeishuMessage(openId, card);
}

module.exports = {
  sendFeishuMessage,
  sendCardMessage,
  getFeishuAccessToken
};
