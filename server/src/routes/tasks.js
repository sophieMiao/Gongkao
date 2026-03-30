const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const db = require('../database');

// 获取今日任务
router.get('/today', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const task = await db.getTodayTask(userId);
    
    if (!task) {
      return res.status(404).json({ success: false, error: 'No task for today' });
    }

    res.json({ success: true, data: task });
  } catch (error) {
    console.error('Get today task error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch task' });
  }
});

// 提交答案
router.post('/:taskId/answer', authMiddleware, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { user_answer, time_spent_seconds } = req.body;
    const userId = req.user.userId;

    // 获取题目
    const task = await db.getTask(taskId);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    // 验证答案
    const question = task.questions.find(q => q.id === req.body.question_id);
    if (!question) {
      return res.status(400).json({ success: false, error: 'Invalid question' });
    }

    const isCorrect = user_answer === question.correct_answer;

    // 保存答案
    const answer = {
      id: `a_${Date.now()}`,
      task_id: taskId,
      question_id: question.id,
      user_answer,
      is_correct: isCorrect,
      time_spent_seconds,
      created_at: Date.now(),
    };

    await db.saveAnswer(answer);

    // 更新任务进度
    await db.updateTaskProgress(taskId, userId);

    res.json({
      success: true,
      data: {
        correct: isCorrect,
        explanation: question.explanation,
        points_earned: isCorrect ? task.points_available / task.questions.length : 0,
      },
    });
  } catch (error) {
    console.error('Submit answer error:', error);
    res.status(500).json({ success: false, error: 'Failed to submit answer' });
  }
});

// 跳过题目
router.post('/:taskId/skip', authMiddleware, async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user.userId;

    // 标记为跳过（不计分）
    await db.skipQuestion(taskId, userId);

    res.json({ success: true, message: 'Question skipped' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to skip question' });
  }
});

// 获取任务历史
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const limit = parseInt(req.query.limit) || 20;
    const history = await db.getTaskHistory(userId, limit);

    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch history' });
  }
});

module.exports = router;
