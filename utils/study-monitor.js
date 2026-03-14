#!/usr/bin/env node
/**
 * 学习状态监控与自动提醒系统
 * 检测异常情况并触发提醒或计划调整建议
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class StudyMonitor {
  constructor() {
    this.alertRules = [
      {
        id: 'streak_break',
        name: '连续学习中断',
        check: this.checkStreakBreak.bind(this),
        severity: 'high',
        action: 'send_reminder'
      },
      {
        id: 'accuracy_decline',
        name: '正确率下降',
        check: this.checkAccuracyDecline.bind(this),
        severity: 'medium',
        action: 'suggest_adjustment'
      },
      {
        id: 'no_improvement_2weeks',
        name: '两周无提升',
        check: this.checkNoImprovement.bind(this),
        severity: 'high',
        action: 'suggest_material_change'
      },
      {
        id: 'insufficient_study_time',
        name: '学习时长不足',
        check: this.checkInsufficientStudyTime.bind(this),
        severity: 'medium',
        action: 'adjust_intensity'
      },
      {
        id: 'material_feedback_low',
        name: '资料评分过低',
        check: this.checkMaterialFeedback.bind(this),
        severity: 'high',
        action: 'recommend_new_material'
      }
    ];
  }

  // 监控所有活跃用户
  async monitorAllUsers() {
    console.log('🔍 开始学习状态监控...');
    
    const users = await prisma.user.findMany({
      where: { status: 'active' }
    });
    
    const alerts = [];
    
    for (const user of users) {
      const userAlerts = await this.monitorUser(user.id);
      if (userAlerts.length > 0) {
        alerts.push({ userId: user.id, userName: user.name, alerts: userAlerts });
      }
    }
    
    console.log(`✅ 监控完成，发现 ${alerts.length} 个用户需要关注`);
    return alerts;
  }

  // 监控单个用户
  async monitorUser(userId) {
    const alerts = [];
    
    for (const rule of this.alertRules) {
      const triggered = await rule.check(userId);
      if (triggered) {
        alerts.push({
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          action: rule.action,
          details: triggered
        });
        
        // 执行相应动作
        await this.executeAction(userId, rule.action, triggered);
      }
    }
    
    return alerts;
  }

  // 规则1：检查连续学习中断
  async checkStreakBreak(userId) {
    const user = await prisma.user.findFirst({ where: { id: userId } });
    if (user.streak === 0) {
      return { current_streak: 0, last_completed: await this.getLastCompletionDate(userId) };
    }
    return null;
  }

  // 规则2：检查正确率下降（对比上周）
  async checkAccuracyDecline(userId) {
    const today = new Date().toISOString().split('T')[0];
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    
    // 获取本周和上周的平均正确率
    const [current, previous] = await Promise.all([
      this.getWeeklyAccuracy(userId, today),
      this.getWeeklyAccuracy(userId, lastWeek.toISOString().split('T')[0])
    ]);
    
    if (previous && current && current < previous - 0.15) { // 下降15%以上
      return { previous_accuracy: previous, current_accuracy: current, decline: previous - current };
    }
    return null;
  }

  // 规则3：检查两周无提升（核心指标）
  async checkNoImprovement(userId) {
    const today = new Date();
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    
    // 获取最近两周每个知识点的正确率
    const snapshots = await prisma.progressSnapshot.findMany({
      where: {
        user_id: userId,
        snapshot_date: { gte: twoWeeksAgo }
      },
      orderBy: { snapshot_date: 'asc' }
    });
    
    if (snapshots.length < 5) return null; // 数据不足
    
    // 检查趋势：最近3天 vs 更早
    const recent = snapshots.slice(-3);
    const earlier = snapshots.slice(0, -3);
    
    const recentAvg = recent.reduce((sum, s) => sum + (s.accuracy || 0), 0) / recent.length;
    const earlierAvg = earlier.reduce((sum, s) => sum + (s.accuracy || 0), 0) / earlier.length;
    
    // 如果最近3天平均正确率没有比早期高5%以上，视为无提升
    if (recentAvg <= earlierAvg + 0.05) {
      return {
        period: '2周',
        earlier_accuracy: earlierAvg,
        recent_accuracy: recentAvg,
        improvement: recentAvg - earlierAvg
      };
    }
    
    return null;
  }

  // 规则4：检查学习时长不足（对比目标）
  async checkInsufficientStudyTime(userId) {
    const today = new Date().toISOString().split('T')[0];
    const snapshot = await prisma.progressSnapshot.findFirst({
      where: {
        user_id: userId,
        snapshot_date: new Date(today),
        knowledge_point: 'TOTAL'
      }
    });
    
    // 目标：每日至少60分钟
    const targetMinutes = 60;
    const actualMinutes = snapshot?.study_minutes_today || 0;
    
    if (actualMinutes < targetMinutes * 0.5) { // 不足目标50%
      return { target_minutes: targetMinutes, actual_minutes: actualMinutes, percentage: Math.round(actualMinutes / targetMinutes * 100) };
    }
    return null;
  }

  // 规则5：检查资料评分过低
  async checkMaterialFeedback(userId) {
    const lowRatings = await prisma.materialFeedback.findMany({
      where: {
        user_id: userId,
        rating: { lte: 2 }, // 1-2分
        is_active: true
      }
    });
    
    if (lowRatings.length > 0) {
      return { low_rated_materials: lowRatings.map(m => m.material_name), avg_rating: lowRatings.reduce((sum, m) => sum + m.rating, 0) / lowRatings.length };
    }
    return null;
  }

  // 执行动作
  async executeAction(userId, action, details) {
    switch (action) {
      case 'send_reminder':
        await this.sendReminder(userId, details);
        break;
      case 'suggest_adjustment':
        await this.suggestPlanAdjustment(userId, details);
        break;
      case 'suggest_material_change':
        await this.suggestMaterialChange(userId, details);
        break;
      case 'adjust_intensity':
        await this.suggestIntensityAdjustment(userId, details);
        break;
      case 'recommend_new_material':
        await this.recommendAlternativeMaterial(userId, details);
        break;
    }
  }

  // 动作：发送提醒
  async sendReminder(userId, details) {
    const user = await prisma.user.findFirst({ where: { id: userId } });
    console.log(`📱 发送提醒给 ${user.name} (${user.open_id}): 连续学习中断，请保持学习节奏！`);
    
    // 这里应该调用飞书消息API
    // await feishuIMSend(user.open_id, `提醒：你已经中断连续学习${details.last_completed}天，请保持节奏！`);
  }

  // 动作：建议调整计划
  async suggestPlanAdjustment(userId, details) {
    console.log(`📊 为 ${userId} 生成计划调整建议：正确率下降 ${Math.round(details.decline * 100)}%`);
    
    // 创建计划调整记录（草稿状态）
    await prisma.planAdjustment.create({
      data: {
        user_id: userId,
        reason: 'too_slow',
        reason_detail: `检测到正确率下降${Math.round(details.decline * 100)}%，建议调整学习策略`,
        original_plan: { /* 原计划JSON */ },
        adjusted_plan: { /* 建议新计划 */ },
        impact_modules: ['言语理解', '判断推理']
      }
    });
  }

  // 动作：建议更换资料
  async suggestMaterialChange(userId, details) {
    console.log(`📚 为 ${userId} 推荐新资料：检测到两周无提升`);
    
    // 获取资料推荐
    // 这里应该调用material-recommendations逻辑
    const recommendations = await this.generateMaterialRecommendations(userId);
    
    // 发送消息给用户
    const message = `🔍 学习状态分析：\n\n` +
      `我注意到你最近两周的学习正确率没有明显提升（当前${Math.round(details.recent_accuracy * 100)}%）。\n\n` +
      `💡 建议尝试以下资料：\n` +
      recommendations.map((r, i) => `${i + 1}. ${r.name}（${r.reason}）`).join('\n') +
      `\n\n回复"采纳推荐"或"暂时不需要"`;
    
    // await feishuIMSend(userId, message);
  }

  // 动作：建议调整强度
  async suggestIntensityAdjustment(userId, details) {
    console.log(`⏱️  为 ${userId} 调整学习强度：今日学习${details.actual_minutes}分钟，目标${details.target_minutes}分钟`);
  }

  // 动作：推荐替代资料
  async recommendAlternativeMaterial(userId, details) {
    const user = await prisma.user.findFirst({ where: { id: userId } });
    const lowRated = details.low_rated_materials.join('、');
    console.log(`⚠️  提醒 ${user.name}：你给资料 ${lowRated} 的评分较低，建议更换`);
  }

  // 辅助：获取周正确率
  async getWeeklyAccuracy(userId, weekStartDate) {
    const weekEnd = new Date(weekStartDate);
    weekEnd.setDate(weekEnd.getDate() + 7);
    
    const tasks = await prisma.dailyTask.findMany({
      where: {
        user_id: userId,
        task_date: { gte: new Date(weekStartDate), lt: weekEnd },
        status: 'completed'
      }
    });
    
    if (tasks.length === 0) return 0;
    const correct = tasks.filter(t => t.is_correct).length;
    return correct / tasks.length;
  }

  // 辅助：获取最后完成日期
  async getLastCompletionDate(userId) {
    const lastTask = await prisma.dailyTask.findFirst({
      where: { user_id: userId, status: 'completed' },
      orderBy: { task_date: 'desc' },
      select: { task_date: true }
    });
    
    if (!lastTask) return '从未完成';
    
    const last = new Date(lastTask.task_date);
    const today = new Date();
    const diff = Math.floor((today - last) / (24 * 60 * 60 * 1000));
    return `${diff}天前`;
  }

  // 辅助：生成资料推荐（简化版）
  async generateMaterialRecommendations(userId) {
    const user = await prisma.user.findFirst({
      where: { id: userId },
      select: { learning_style: true, preferred_materials: true }
    });
    
    const recommendations = [];
    
    if (user.learning_style === 'visual') {
      recommendations.push({ name: '粉笔系统班视频课', reason: '适合视觉学习者' });
    } else if (user.learning_style === 'auditory') {
      recommendations.push({ name: '花生十三音频课程', reason: '适合听觉学习者' });
    } else {
      recommendations.push({ name: '粉笔980系统班', reason: '综合性强' });
    }
    
    // 基于薄弱点
    const weakPoints = await prisma.progressSnapshot.findMany({
      where: { user_id: userId },
      orderBy: { accuracy: 'asc' },
      take: 1
    });
    
    if (weakPoints.length > 0 && weakPoints[0].accuracy < 0.6) {
      recommendations.push({
        name: `${weakPoints[0].knowledge_point}专项突破`,
        reason: `当前正确率仅${Math.round(weakPoints[0].accuracy * 100)}%`
      });
    }
    
    return recommendations;
  }
}

// 导出
module.exports = { StudyMonitor };

// 如果直接运行此文件，执行监控
if (require.main === module) {
  const monitor = new StudyMonitor();
  monitor.monitorAllUsers().then(() => {
    console.log('监控完成');
    process.exit(0);
  }).catch(console.error);
}