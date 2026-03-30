const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const db = require('../database');

// 获取待同步数据（离线时使用）
router.get('/pending', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const since = req.query.since ? parseInt(req.query.since) : 0;
    const pending = await db.getPendingUpdates(userId, since);
    res.json({ success: true, data: pending });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch pending updates' });
  }
});

// 推送同步数据（离线时上传）
router.post('/push', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { answers, tasks } = req.body;

    // 批量插入/更新
    for (const answer of answers) {
      await db.upsertAnswer(answer, userId);
    }
    for (const task of tasks) {
      await db.upsertTask(task, userId);
    }

    res.json({ success: true, message: 'Sync data received' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to sync data' });
  }
});

// 标记已同步
router.post('/ack', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { sync_ids } = req.body;
    await db.markSynced(sync_ids, userId);
    res.json({ success: true, message: 'Acknowledged' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to ack sync' });
  }
});

module.exports = router;
