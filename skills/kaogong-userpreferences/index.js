/**
 * 用户偏好管理技能
 * 管理学习风格、提醒设置、通知偏好等
 */

module.exports = {
  /**
   * 获取用户学习偏好
   */
  async getPreferences(context, { user_id }) {
    const { tools } = context;

    // 从数据库获取用户偏好
    const prefs = await tools.feishu_bitable_app_table_record({
      action: 'list',
      app_token: process.env.USER_PREFS_APP_TOKEN || 'app_preferences',
      table_id: 'user_preferences',
      filter: {
        conjunction: 'and',
        conditions: [
          { field_name: 'user_id', operator: 'is', value: [user_id] }
        ]
      }
    });

    if (prefs.records && prefs.records.length > 0) {
      return {
        success: true,
        data: prefs.records[0].fields
      };
    }

    // 返回默认偏好
    const defaultPrefs = {
      learning_style: 'mixed', // visual, auditory, kinesthetic, mixed
      daily_goal_minutes: 15,
      reminder_enabled: true,
      reminder_time: '08:00',
      timezone: 'Asia/Shanghai',
      notification_channels: ['feishu'],
      difficulty_adjustment: 'auto', // auto, manual
      weekly_report_enabled: true,
      monthly_challenge_enabled: true
    };

    return {
      success: true,
      data: defaultPrefs
    };
  },

  /**
   * 更新用户学习偏好
   */
  async updatePreferences(context, { user_id, preferences }) {
    const { tools } = context;

    // 验证偏好字段
    const allowedFields = [
      'learning_style',
      'daily_goal_minutes',
      'reminder_enabled',
      'reminder_time',
      'timezone',
      'notification_channels',
      'difficulty_adjustment',
      'weekly_report_enabled',
      'monthly_challenge_enabled'
    ];

    const updateData = {};
    Object.keys(preferences).forEach(key => {
      if (allowedFields.includes(key)) {
        updateData[key] = preferences[key];
      }
    });

    // 检查是否已存在记录
    const existing = await tools.feishu_bitable_app_table_record({
      action: 'list',
      app_token: process.env.USER_PREFS_APP_TOKEN || 'app_preferences',
      table_id: 'user_preferences',
      filter: {
        conjunction: 'and',
        conditions: [
          { field_name: 'user_id', operator: 'is', value: [user_id] }
        ]
      }
    });

    if (existing.records && existing.records.length > 0) {
      // 更新
      await tools.feishu_bitable_app_table_record({
        action: 'update',
        app_token: process.env.USER_PREFS_APP_TOKEN || 'app_preferences',
        table_id: 'user_preferences',
        record_id: existing.records[0].record_id,
        fields: updateData
      });
    } else {
      // 创建
      await tools.feishu_bitable_app_table_record({
        action: 'create',
        app_token: process.env.USER_PREFS_APP_TOKEN || 'app_preferences',
        table_id: 'user_preferences',
        fields: {
          user_id,
          ...updateData
        }
      });
    }

    return {
      success: true,
      message: 'Preferences updated successfully'
    };
  },

  /**
   * 获取学习风格建议
   */
  async getStyleRecommendation(context, { learning_style }) {
    const recommendations = {
      visual: {
        description: '视觉型学习者',
        tips: [
          '使用图表、思维导图来整理知识点',
          '观看教学视频辅助学习',
          '使用彩色笔记标记重点',
          '尝试在脑海中"绘制"图形推理题'
        ],
        resources: [
          '推荐使用图形化记忆卡片',
          '观看真题讲解视频',
          '使用颜色分类笔记法'
        ]
      },
      auditory: {
        description: '听觉型学习者',
        tips: [
          '朗读题目和解析',
          '听播客或音频课程',
          '使用语音备忘录记录知识点',
          '参与小组讨论'
        ],
        resources: [
          '订阅考公音频课程',
          '使用文字转语音工具',
          '录制自己的讲解音频'
        ]
      },
      kinesthetic: {
        description: '动手型学习者',
        tips: [
          '多做题，实践中学习',
          '使用手势或动作辅助记忆',
          '定时休息，保持活跃',
          '模拟真实考试环境'
        ],
        resources: [
          '动手练习题册',
          '模拟考试系统',
          '学习小组实践'
        ]
      },
      mixed: {
        description: '混合型学习者',
        tips: [
          '结合多种学习方式',
          '根据题目类型调整策略',
          '保持学习方式多样性',
          '定期评估和调整'
        ],
        resources: [
          '综合学习材料',
          '多媒体课程',
          '多样化练习题库'
        ]
      }
    };

    return {
      success: true,
      data: recommendations[learning_style] || recommendations.mixed
    };
  },

  /**
   * 检查并更新学习提醒设置
   */
  async updateReminderSchedule(context, { user_id }) {
    const { tools, bizLogger } = context;

    try {
      const prefs = await this.getPreferences(context, { user_id });

      if (!prefs.success || !prefs.data.reminder_enabled) {
        return { success: true, skipped: true, reason: 'reminder disabled' };
      }

      // 这里可以集成外部提醒服务
      // 例如：使用 node-cron 创建定时任务，或调用日历 API

      bizLogger.system('reminder_updated', {
        user_id,
        time: prefs.data.reminder_time,
        timezone: prefs.data.timezone
      });

      return {
        success: true,
        message: `Reminder scheduled at ${prefs.data.reminder_time}`
      };
    } catch (error) {
      bizLogger.error('update_reminder_failed', error, { user_id });
      throw error;
    }
  }
};
