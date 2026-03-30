const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const db = require('../database');

// 获取用户信息
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await db.getUser(userId);
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch profile' });
  }
});

// 更新用户信息
router.patch('/profile', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const updates = req.body;
    await db.updateUser(userId, updates);
    res.json({ success: true, message: 'Profile updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
});

// 获取用户偏好
router.get('/preferences', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const prefs = await db.getUserPreferences(userId);
    res.json({ success: true, data: prefs });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch preferences' });
  }
});

// 更新用户偏好
router.patch('/preferences', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const prefs = req.body;
    await db.updateUserPreferences(userId, prefs);
    res.json({ success: true, message: 'Preferences updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update preferences' });
  }
});

module.exports = router;
