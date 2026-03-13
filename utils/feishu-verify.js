const crypto = require('crypto');

/**
 * 验证飞书请求签名
 */
function verifyFeishuRequest(body, signature, timestamp, verificationToken) {
  if (!signature || !timestamp || !verificationToken) {
    return false;
  }
  
  // 构造待签名字符串
  const stringToSign = `${timestamp}\n${body}`;
  
  // 计算 HMAC-SHA256
  const expectedSignature = crypto
    .createHmac('sha256', verificationToken)
    .update(stringToSign, 'utf8')
    .digest('base64');
  
  // 对比签名
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'base64'),
    Buffer.from(expectedSignature, 'base64')
  );
}

module.exports = { verifyFeishuRequest };
