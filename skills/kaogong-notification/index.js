#!/usr/bin/env node
/**
 * kaogong-notification Skill - 通知推送管理
 */

const { OpenClaw } = require('openclaw');

// 消息卡片模板
const CardTemplates = {
  dailyTask: (data) => ({
    msg_type: 'interactive',
    content: {
      config: { wide_screen_mode: true },
      elements: [
        {
          tag: 'header',
          template: 'blue',
          title: {
            content: `📚 考公学习伴侣 | 第${data.dayNumber}天任务`,
            tag: 'plain_text'
          }
        },
        {
          tag: 'div',
          fields: [
            {
              tag: 'lark_md',
              content: `**今日学习目标（${data.totalMinutes}分钟）**\n\n${data.tasksList}`
            }
          ]
        },
        {
          tag: 'action',
          actions: [
            {
              tag: 'button',
              text: { content: '开始学习', tag: 'plain_text' },
              type: 'primary',
              url: data.taskUrl
            },
            {
              tag: 'button',
              text: { content: '稍后提醒', tag: 'plain_text' },
              type: 'default',
              url: data.remindUrl
            }
          ]
        },
        {
          tag: 'div',
          fields: [
            {
              tag: 'lark_md',
              content: `───────────────\n💎 **完成任务可获得：${data.points}积分**\n🔥 **当前连续：${data.streak}天** | **等级：Lv.${data.level}**`
            }
          ]
        }
      ]
    }
  }),
  
  weeklyReport: (data) => ({
    msg_type: 'interactive',
    content: {
      elements: [
        {
          tag: 'header',
          template: 'green',
          title: {
            content: '📊 本周学习报告',
            tag: 'plain_text'
          }
        },
        {
          tag: 'div',
          fields: [
            {
              tag: 'lark_md',
              content: `**${data.userName}，这周你表现很棒！**\n\n` +
                       `✅ **完成率**：${data.completionRate}%（${data.completedDays}/${data.totalDays}天）\n` +
                       `📈 **平均正确率**：${data.accuracy}%（${data.improvement}）\n` +
                       `🏆 **获得积分**：${data.points}\n` +
                       `⭐ **知识点突破**：${data.highlights}\n\n` +
                       `📊 **预估分数**：${data.estimatedScore}分\n` +
                       `🎯 **目标分数**：${data.targetScore}分\n\n` +
                       `${data.nextWeekSuggestion}`
            }
          ]
        }
      ]
    }
  }),
  
  achievement: (data) => ({
    msg_type: 'interactive',
    content: {
      elements: [
        {
          tag: 'header',
          template: 'orange',
          title: {
            content: `🏆 成就解锁：${data.name}`,
            tag: 'plain_text'
          }
        },
        {
          tag: 'div',
          fields: [
            {
              tag: 'lark_md',
              content: `${data.icon} **${data.description}**\n\n` +
                       `🎁 奖励积分：+${data.rewardPoints}\n` +
                       `👏 继续努力，解锁更多成就！`
            }
          ]
        }
      ]
    }
  }),
  
  goalReached: (data) => ({
    msg_type: 'interactive',
    content: {
      elements: [
        {
          tag: 'header',
          template: 'gold',
          title: {
            content: '🎉 恭喜达成目标！',
            tag: 'plain_text'
          }
        },
        {
          tag: 'div',
          fields: [
            {
              tag: 'lark_md',
              content: `**${data.userName}，你已达成备考目标！**\n\n` +
                       `📊 预估分数：${data.achievedScore}分（目标：${data.targetScore}分）\n` +
                       `📅 评估日期：${data.assessmentDate}\n` +
                       `⏳ 距离考试还有：${data.remainingDays}天\n\n` +
                       `🎯 你已经达到了 agent 认可的标准！\n` +
                       `接下来建议：\n` +
                       `1️⃣ 进行全真模拟考试\n` +
                       `2️⃣ 复习错题本\n` +
                       `3️⃣ 保持每天少量练习维持状态\n\n` +
                       `🏆 点击领取你的【达标证书】\n` +
                       `[证书链接](${data.certificateUrl})`
            }
          ]
        }
      ]
    }
  }),
  
  reminder: (data) => ({
    msg_type: 'interactive',
    content: {
      elements: [
        {
          tag: 'header',
          template: 'red',
          title: {
            content: '⏰ 学习提醒',
            tag: 'plain_text'
          }
        },
        {
          tag: 'div',
          fields: [
            {
              tag: 'lark_md',
              content: `Hi ${data.userName}，你还有 ${data.remainingTasks} 个任务未完成哦！\n\n` +
                       `⏱️ 距离任务截止还有：${data.remainingHours}小时\n` +
                       `💪 完成今日任务可获得 ${data.points} 积分，保持连胜记录！\n\n` +
                       `🚀 点击这里快速完成：[任务入口](${data.taskUrl})`
            }
          ]
        }
      ]
    }
  })
};

class NotificationSkill {
  constructor() {
    this.name = 'kaogong-notification';
  }
  
  async sendDailyTaskCard(context, params) {
    const { user_id, dayNumber, tasks, totalMinutes, points, streak, level, taskUrl } = params;
    
    // 构建任务列表文本
    const tasksList = tasks.map((t, idx) => 
      `${idx + 1}. ${t.knowledge_point} (${t.questionCount}题, ${this._difficultyIcon(t.difficulty)})\n`
    ).join('');
    
    const card = CardTemplates.dailyTask({
      dayNumber,
      totalMinutes,
      tasksList,
      points,
      streak,
      level,
      taskUrl,
      remindUrl: `https://kaogong.openclaw.ai/remind?user=${user_id}&date=${new Date().toISOString().split('T')[0]}`
    });
    
    await context.tools.feishu_im_user_message({
      action: 'send',
      receive_id_type: 'open_id',
      receive_id: user_id,
      msg_type: 'interactive',
      content: JSON.stringify(card)
    });
    
    return { success: true };
  }
  
  async sendWeeklyReport(context, params) {
    const { user_id, weekData } = params;
    
    const card = CardTemplates.weeklyReport({
      userName: weekData.userName,
      completionRate: weekData.completionRate,
      completedDays: weekData.completedDays,
      totalDays: weekData.totalDays,
      accuracy: weekData.accuracy,
      improvement: weekData.improvement,
      points: weekData.points,
      highlights: weekData.highlights.join('、'),
      estimatedScore: weekData.estimatedScore,
      targetScore: weekData.targetScore,
      nextWeekSuggestion: weekData.suggestion
    });
    
    await context.tools.feishu_im_user_message({
      action: 'send',
      receive_id_type: 'open_id',
      receive_id: user_id,
      msg_type: 'interactive',
      content: JSON.stringify(card)
    });
    
    return { success: true };
  }
  
  async sendAchievementNotification(context, params) {
    const { user_id, achievement } = params;
    
    const card = CardTemplates.achievement({
      name: achievement.name,
      description: achievement.description,
      icon: achievement.icon,
      rewardPoints: achievement.rewardPoints
    });
    
    await context.tools.feishu_im_user_message({
      action: 'send',
      receive_id_type: 'open_id',
      receive_id: user_id,
      msg_type: 'interactive',
      content: JSON.stringify(card)
    });
    
    return { success: true };
  }
  
  async sendGoalReachedNotification(context, params) {
    const { user_id, goal, userName, certificateUrl } = params;
    
    const card = CardTemplates.goalReached({
      userName,
      achievedScore: goal.achievedScore,
      targetScore: goal.targetScore,
      assessmentDate: goal.assessmentDate,
      remainingDays: goal.remainingDays,
      certificateUrl
    });
    
    await context.tools.feishu_im_user_message({
      action: 'send',
      receive_id_type: 'open_id',
      receive_id: user_id,
      msg_type: 'interactive',
      content: JSON.stringify(card)
    });
    
    return { success: true };
  }
  
  async sendReminder(context, params) {
    const { user_id, remainingTasks, remainingHours, points, taskUrl, userName } = params;
    
    const card = CardTemplates.reminder({
      userName,
      remainingTasks,
      remainingHours,
      points,
      taskUrl
    });
    
    await context.tools.feishu_im_user_message({
      action: 'send',
      receive_id_type: 'open_id',
      receive_id: user_id,
      msg_type: 'interactive',
      content: JSON.stringify(card)
    });
    
    return { success: true };
  }
  
  // 检查并发送催学提醒
  async checkAndSendReminders(context) {
    const today = new Date().toISOString().split('T')[0];
    
    // 查询今天已推送但未完成的任务
    const pendingTasks = await context.tools.feishu_bitable_app_table_record({
      action: 'list',
      app_token: process.env.BITABLE_APP_TOKEN,
      table_id: process.env.TASKS_TABLE_ID,
      filter: JSON.stringify({
        conjunction: 'and',
        conditions: [
          { field_name: 'date', operator: 'is', value: [today] },
          { field_name: 'status', operator: 'is', value: ['pending'] }
        ]
      }),
      page_size: 100
    });
    
    // 按用户分组
    const userTasks = {};
    pendingTasks.records.forEach(record => {
      const uid = record.fields.user_id;
      if (!userTasks[uid]) userTasks[uid] = [];
      userTasks[uid].push(record);
    });
    
    // 发送提醒（超过2小时未完成）
    const now = new Date();
    for (const [user_id, tasks] of Object.entries(userTasks)) {
      const remaining = tasks.length;
      if (remaining > 0) {
        // 获取用户信息
        const user = await this._getUserInfo(context, user_id);
        
        // 发送提醒（实际应用中可能限制频率，如每天最多1次）
        await this.sendReminder(context, {
          user_id,
          userName: user.name,
          remainingTasks: remaining,
          remainingHours: 4,  // 假设任务在20:00截止
          points: remaining * 10,
          taskUrl: `https://kaogong.openclaw.ai/tasks/today?user=${user_id}`
        });
      }
    }
    
    return { remindedUsers: Object.keys(userTasks).length };
  }
  
  async _getUserInfo(context, user_id) {
    const result = await context.tools.feishu_bitable_app_table_record({
      action: 'list',
      app_token: process.env.BITABLE_APP_TOKEN,
      table_id: process.env.USERS_TABLE_ID,
      filter: JSON.stringify({
        conjunction: 'and',
        conditions: [
          { field_name: 'user_id', operator: 'is', value: [user_id] }
        ]
      }),
      page_size: 1
    });
    
    if (result.records.length > 0) {
      return result.records[0].fields;
    }
    return { name: '考生' };
  }
  
  _difficultyIcon(difficulty) {
    switch(difficulty) {
      case 'hard': return '🔥';
      case 'medium': return '⚡';
      default: return '💡';
    }
  }
}

module.exports = {
  actions: {
    sendDailyTaskCard: async (ctx, params) => {
      const skill = new NotificationSkill();
      return skill.sendDailyTaskCard(ctx, params);
    },
    sendWeeklyReport: async (ctx, params) => {
      const skill = new NotificationSkill();
      return skill.sendWeeklyReport(ctx, params);
    },
    sendAchievementNotification: async (ctx, params) => {
      const skill = new NotificationSkill();
      return skill.sendAchievementNotification(ctx, params);
    },
    sendGoalReachedNotification: async (ctx, params) => {
      const skill = new NotificationSkill();
      return skill.sendGoalReachedNotification(ctx, params);
    },
    sendReminder: async (ctx, params) => {
      const skill = new NotificationSkill();
      return skill.sendReminder(ctx, params);
    },
    checkAndSendReminders: async (ctx) => {
      const skill = new NotificationSkill();
      return skill.checkAndSendReminders(ctx);
    }
  },
  metadata: {
    name: 'kaogong-notification',
    version: '1.0.0',
    description: '考公学习伴侣通知推送Skill',
    author: 'Your Name',
    tags: ['notification', 'feishu', 'card']
  }
};
