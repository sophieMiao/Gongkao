/**
 * 飞书卡片消息构建器
 * 创建美观、交互式的飞书卡片消息
 */

module.exports = {
  /**
   * 构建每日任务卡片
   */
  buildDailyTaskCard(context, { user_name, day_number, tasks, total_points, streak_days, level, start_button_text = '开始学习', remind_button_text = '稍后提醒' }) {
    const taskList = tasks.map((task, index) => `
      <div style="display: flex; align-items: flex-start; margin-bottom: 12px;">
        <div style="background: #3370ff; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 12px; flex-shrink: 0;">${index + 1}</div>
        <div style="flex: 1;">
          <div style="font-weight: 500; margin-bottom: 4px;">${task.knowledgePoint} (${task.questionCount}题) ${task.emoji || ''}</div>
          <div style="font-size: 12px; color: #666;">预计 ${task.estimatedMinutes} 分钟 | 难度: ${this.getDifficultyLabel(task.difficulty)}</div>
        </div>
      </div>
    `).join('');

    return {
      msg_type: 'interactive',
      content: {
        elements: [
          {
            tag: 'markdown',
            content: `### 📚 考公学习伴侣 | 第${day_number}天任务\n\n**${user_name}，今天的学习目标（${this.estimateTotalMinutes(tasks)}分钟）：**\n\n${taskList}\n\n───────────────`
          },
          {
            tag: 'action',
            actions: [
              {
                tag: 'button',
                text: {
                  content: `💎 完成任务可获得：${total_points}积分`,
                  color: 'default'
                },
                type: 'primary',
                value: `reward_info_${day_number}`
              }
            ]
          },
          {
            tag: 'markdown',
            content: `🔥 当前连续：${streak_days}天 | 等级：Lv.${level}\n\n*点击下方按钮开始今日学习*`
          },
          {
            tag: 'action',
            actions: [
              {
                tag: 'button',
                text: {
                  content: start_button_text,
                  color: 'success'
                },
                type: 'primary',
                value: `start_task_${day_number}`
              },
              {
                tag: 'button',
                text: {
                  content: remind_button_text,
                  color: 'default'
                },
                type: 'default',
                value: `remind_task_${day_number}`
              }
            ]
          }
        ]
      }
    };
  },

  /**
   * 构建周报卡片
   */
  buildWeeklyReportCard(context, { user_name, week_number, completion_rate, avg_accuracy, total_points, breakthroughs, goal_gap }) {
    const completionColor = this.getRateColor(completion_rate);
    const accuracyColor = this.getRateColor(avg_accuracy);

    return {
      msg_type: 'interactive',
      content: {
        elements: [
          {
            tag: 'markdown',
            content: `### 📊 第${week_number}周学习报告\n\n**${user_name}，这周你表现很棒！**\n\n`
          },
          {
            tag: 'markdown',
            content: `✅ **完成率**: ${(completion_rate * 100).toFixed(0)}%\n📈 **平均正确率**: ${(avg_accuracy * 100).toFixed(0)}%\n🏆 **获得积分**: ${total_points}\n⭐ **知识点突破**: ${breakthroughs.join('、') || '无'}\n\n距离目标分数还差：${goal_gap}分\n\n下周继续加油！🚀`
          },
          {
            tag: 'action',
            actions: [
              {
                tag: 'button',
                text: {
                  content: '查看详情',
                  color: 'primary'
                },
                type: 'primary',
                value: `weekly_report_detail_${week_number}`
              }
            ]
          }
        ]
      }
    };
  },

  /**
   * 构建学习提醒卡片
   */
  buildReminderCard(context, { user_name, task_summary, time_left_minutes }) {
    return {
      msg_type: 'interactive',
      content: {
        elements: [
          {
            tag: 'markdown',
            content: `### 🔔 学习提醒\n\n**${user_name}**，你今天的任务还没完成哦！\n\n**任务概览**: ${task_summary}\n\n剩余时间：${time_left_minutes} 分钟\n\n点击下方按钮继续学习👇'
          },
          {
            tag: 'action',
            actions: [
              {
                tag: 'button',
                text: {
                  content: '开始学习',
                  color: 'success'
                },
                type: 'primary',
                value: 'continue_task'
              },
              {
                tag: 'button',
                text: {
                  content: '明天再做',
                  color: 'default'
                },
                type: 'default',
                value: 'postpone_task'
              }
            ]
          }
        ]
      }
    };
  },

  /**
   * 构建知识点掌握卡片
   */
  buildMasteryCard(context, { user_name, knowledge_points }) {
    const items = knowledge_points.map(kp => {
      const barLength = Math.round(kp.mastery_level * 20); // 0-20 字符
      const bar = '█'.repeat(barLength) + '░'.repeat(20 - barLength);
      return `**${kp.name}**\n${bar} ${(kp.mastery_level * 100).toFixed(0)}%\n`;
    }).join('\n');

    return {
      msg_type: 'interactive',
      content: {
        elements: [
          {
            tag: 'markdown',
            content: `### 📈 知识点掌握情况\n\n${user_name}，这是你的知识点掌握进度：\n\n${items}`
          },
          {
            tag: 'action',
            actions: [
              {
                tag: 'button',
                text: {
                  content: '针对性练习薄弱项',
                  color: 'primary'
                },
                type: 'primary',
                value: 'practice_weak_points'
              }
            ]
          }
        ]
      }
    };
  },

  // 辅助函数

  getDifficultyLabel(difficulty) {
    if (difficulty <= 0.33) return '⭐ 简单';
    if (difficulty <= 0.66) return '⭐⭐ 中等';
    return '⭐⭐⭐ 困难';
  },

  estimateTotalMinutes(tasks) {
    return tasks.reduce((sum, task) => sum + (task.estimatedMinutes || 5), 0);
  },

  getRateColor(rate) {
    if (rate >= 0.8) return '🟢';
    if (rate >= 0.6) return '🟡';
    return '🔴';
  }
};
