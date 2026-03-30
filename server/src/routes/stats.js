const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const db = require('../database');

// 获取今日学习进度
router.get('/daily', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const taskId = req.query.task_id;
    const progress = await db.getDailyProgress(userId, taskId);
    res.json({ success: true, data: progress });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch daily progress' });
  }
});

// 获取知识点掌握情况
router.get('/knowledge', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const mastery = await db.getKnowledgeMastery(userId);
    res.json({ success: true, data: mastery });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch knowledge mastery' });
  }
});

// 获取学习时间分布
router.get('/time-distribution', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const period = req.query.period || 'week';
    const distribution = await db.getTimeDistribution(userId, period);
    res.json({ success: true, data: distribution });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch time distribution' });
  }
});

// 获取分数趋势
router.get('/score-trend', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const days = parseInt(req.query.days) || 30;
    const trend = await db.getScoreTrend(userId, days);
    res.json({ success: true, data: trend });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch score trend' });
  }
});

module.exports = router;
