const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const db = require('../database'); // 待实现
const crypto = require('crypto');

// 登录（飞书 OAuth code 换取 token）
router.post('/login', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, error: 'Missing authorization code' });
    }

    // TODO: 使用 code 调用飞书 API 获取用户信息
    // const userInfo = await feishuApi.getUserByCode(code);

    // 模拟用户信息
    const userInfo = {
      id: '1',
      open_id: 'ou_b267210a662373b530d3a2af309d451b',
      name: '张三',
      avatar: null,
      department: '技术部',
    };

    // 生成 JWT
    const token = generateToken({ userId: userInfo.id, openId: userInfo.open_id });

    // 保存/更新用户信息
    await db.saveUser(userInfo);

    res.json({
      success: true,
      data: {
        access_token: token,
        user: userInfo,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// 刷新 token
router.post('/refresh', authMiddleware, async (req, res) => {
  try {
    const { refresh_token } = req.body;
    // 验证 refresh_token 并签发新的 access_token
    // 简化版：直接签发新 token
    const newToken = generateToken({ userId: req.user.userId, openId: req.user.openId });
    res.json({ success: true, data: { access_token: newToken } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Refresh failed' });
  }
});

// 退出登录
router.post('/logout', authMiddleware, async (req, res) => {
  // 可选：将 token 加入黑名单
  res.json({ success: true, message: 'Logged out' });
});

module.exports = router;
