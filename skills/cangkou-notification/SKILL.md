# Skill: cangkou-notification

## 描述

负责所有通知推送的 Skill，包括每日任务提醒、周报生成、成就解锁通知等。

## 功能

- 每日学习任务卡片推送（通过飞书 IM）
- 每周进度报告
- 成就徽章通知
- 催学提醒（用户未按时完成任务）
- 达标恭喜消息

## 接口

### `send_daily_task_card`

推送每日任务卡片。

**参数**:
```json
{
  "user_id": "ou_xxx",
  "date": "2025-01-15",
  "tasks": [
    {
      "id": "task_001",
      "type": "行测",
      "knowledge_point": "数量关系-工程问题",
      "description": "完成3道工程问题选择题",
      "estimated_minutes": 5,
      "questions": ["q_001", "q_002", "q_003"]
    }
  ],
  "total_points_available": 150,
  "streak_days": 5,
  "user_level": 3
}
```

### `send_weekly_report`

发送周报。

**参数**:
```json
{
  "user_id": "ou_xxx",
  "week_start": "2025-01-08",
  "week_end": "2025-01-14",
  "stats": {
    "tasks_completed": 7,
    "tasks_total": 7,
    "average_accuracy": 0.78,
    "total_points_earned": 850,
    "knowledge_improvements": [
      {"point": "数量关系-工程问题", "accuracy_before": 0.65, "accuracy_after": 0.82}
    ]
  }
}
```

### `send_achievement_notification`

成就解锁通知。

**参数**:
```json
{
  "user_id": "ou_xxx",
  "achievement": {
    "id": "streak_7",
    "name": "连续学习7天",
    "description": "你已经连续7天完成学习任务！",
    "icon": "🔥",
    "reward_points": 200
  }
}
```

### `send_goal_reached`

达标恭喜消息。

**参数**:
```json
{
  "user_id": "ou_xxx",
  "goal": {
    "target_score": 70,
    "achieved_score": 71.5,
    "assessment_date": "2025-01-15",
    "remaining_days": 30
  },
  "certificate_url": "https://..."
}
```

## 消息卡片设计

### 每日任务卡片（飞书卡片消息）

```json
{
  "msg_type": "interactive",
  "content": {
    "config": {
      "wide_screen_mode": true
    },
    "elements": [
      {
        "tag": "header",
        "template": "blue",
        "title": {
          "content": "📚 考公学习伴侣 | 第{day}天任务",
          "tag": "plain_text"
        }
      },
      {
        "tag": "div",
        "fields": [
          {
            "tag": "lark_md",
            "content": "**今日学习目标（{total_minutes}分钟）**\n\n{tasks_list}"
          }
        ]
      },
      {
        "tag": "action",
        "actions": [
          {
            "tag": "button",
            "text": {
              "content": "开始学习",
              "tag": "plain_text"
            },
            "type": "primary",
            "url": "{task_url}"
          },
          {
            "tag": "button",
            "text": {
              "content": "稍后提醒",
              "tag": "plain_text"
            },
            "type": "default",
            "url": "{remind_url}"
          }
        ]
      },
      {
        "tag": "div",
        "fields": [
          {
            "tag": "lark_md",
            "content": "───────────────\n💎 **完成任务可获得：{points}积分**\n🔥 **当前连续：{streak}天** | **等级：Lv.{level}**"
          }
        ]
      }
    ]
  }
}
```

### 周报卡片

```json
{
  "msg_type": "interactive",
  "content": {
    "elements": [
      {
        "tag": "header",
        "template": "green",
        "title": {
          "content": "📊 本周学习报告",
          "tag": "plain_text"
        }
      },
      {
        "tag": "div",
        "fields": [
          {
            "tag": "lark_md",
            "content": "**{user_name}，这周你表现很棒！**\n\n✅ **完成率**：{completion_rate}%（{completed}/{total}天）\n📈 **平均正确率**：{accuracy}%（{improvement}）\n🏆 **获得积分**：{points}\n⭐ **知识点突破**：{highlights}\n\n📊 **预估分数**：{estimated_score}分\n🎯 **目标分数**：{target_score}分\n\n{next_week_suggestion}"
          }
        ]
      }
    ]
  }
}
```

## 定时任务配置

使用 OpenClaw 的 cron 功能：

```yaml
# config/schedule.yaml
cron:
  - name: "daily_task_dispatch"
    schedule: "0 8 * * *"  # 每天8:00
    skill: "cangkou-core"
    method: "generate_and_send_tasks"
    
  - name: "weekly_report"
    schedule: "0 9 * * 1"  # 每周一9:00
    skill: "cangkou-analytics"
    method: "generate_weekly_report"
    
  - name: "streak_reminder"
    schedule: "*/30 * * * *"  # 每30分钟检查未完成任务
    skill: "cangkou-notification"
    method: "check_and_remind"
```

## 状态检查

### 催学提醒逻辑

```python
def check_and_remind():
    # 查询所有已推送但未完成的任务（超过2小时未完成）
    pending_tasks = query_pending_tasks(older_than_hours=2)
    
    for task in pending_tasks:
        send_reminder(
            user_id=task.user_id,
            task_id=task.id,
            remaining_time=task.remaining_minutes
        )
```

## 测试

```bash
# 模拟发送每日任务
python -m skills.cangkou-notification send_daily_task --user ou_test --dry-run

# 生成周报模板
python -m skills.cangkou-notification generate_weekly_report --week last
```

## 注意事项

- 推送时间应避开深夜（23:00-08:00）
- 同一用户24小时内最多发送3条主动消息（遵守飞书频次限制）
- 卡片消息大小控制在 4KB 以内
- 重要通知可搭配表情符号增强吸引力（🔥💎🎯🏆）
