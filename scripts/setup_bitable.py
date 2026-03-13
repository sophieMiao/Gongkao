#!/usr/bin/env python3
"""
飞书多维表格初始化脚本
自动创建考公学习伴侣所需的表结构
"""

import os
import json
import asyncio
from feishu_bitable_app import FeishuBitableApp
from feishu_bitable_app_table import FeishuBitableAppTable
from feishu_bitable_app_table_field import FeishuBitableAppTableField

# 配置
APP_TOKEN = os.getenv('BITABLE_APP_TOKEN')

async def create_app_if_not_exists():
    """如果App不存在则创建（这里假设已存在）"""
    print(f"使用现有多维表格 App: {APP_TOKEN}")
    return APP_TOKEN

async def create_table(table_name, fields):
    """创建数据表"""
    print(f"\n创建表: {table_name}")
    
    # 检查表是否已存在
    result = FeishuBitableAppTable(
        action="list",
        app_token=APP_TOKEN
    )
    existing = result.get('data', {}).get('items', [])
    
    for table in existing:
        if table.get('name') == table_name:
            print(f"  表 {table_name} 已存在，跳过")
            return table.get('id')
    
    # 创建新表
    table_def = {
        "name": table_name,
        "fields": fields
    }
    
    result = FeishuBitableAppTable(
        action="create",
        app_token=APP_TOKEN,
        table=table_def
    )
    
    table_id = result.get('data', {}).get('table_id')
    print(f"  ✓ 表创建成功: {table_id}")
    return table_id

async def setup_all_tables():
    """创建所有必需的表"""
    
    # 1. 用户表
    user_fields = [
        {"field_name": "user_id", "type": 1},          # 文本
        {"field_name": "name", "type": 1},             # 文本
        {"field_name": "target_region", "type": 3},    # 单选
        {"field_name": "exam_type", "type": 3},        # 单选
        {"field_name": "target_score_xingce", "type": 2},  # 数字
        {"field_name": "target_score_shenlun", "type": 2}, # 数字
        {"field_name": "exam_date", "type": 5},        # 日期
        {"field_name": "level", "type": 2},            # 数字
        {"field_name": "total_points", "type": 2},     # 数字
        {"field_name": "streak", "type": 2},           # 数字
        {"field_name": "registered_at", "type": 1001}  # 创建时间
    ]
    
    users_table_id = await create_table("users", user_fields)
    
    # 2. 每日任务表
    task_fields = [
        {"field_name": "task_id", "type": 1},
        {"field_name": "user_id", "type": 1},
        {"field_name": "date", "type": 5},
        {"field_name": "task_type", "type": 3},
        {"field_name": "knowledge_point", "type": 1},
        {"field_name": "question_content", "type": 1},
        {"field_name": "options", "type": 1},
        {"field_name": "correct_answer", "type": 1},
        {"field_name": "user_answer", "type": 1},
        {"field_name": "is_correct", "type": 7},       # 复选框
        {"field_name": "time_spent", "type": 2},
        {"field_name": "points_available", "type": 2},
        {"field_name": "status", "type": 3},
        {"field_name": "created_at", "type": 1001}
    ]
    
    tasks_table_id = await create_table("tasks", task_fields)
    
    # 3. 进度表
    progress_fields = [
        {"field_name": "user_id", "type": 1},
        {"field_name": "date", "type": 5},
        {"field_name": "knowledge_point", "type": 1},
        {"field_name": "total_questions", "type": 2},
        {"field_name": "correct_count", "type": 2},
        {"field_name": "accuracy", "type": 2},
        {"field_name": "estimated_score", "type": 2},
        {"field_name": "daily_points_earned", "type": 2},
        {"field_name": "status", "type": 3},
        {"field_name": "created_at", "type": 1001}
    ]
    
    progress_table_id = await create_table("progress", progress_fields)
    
    # 4. 知识点表（可选，用于快速查询）
    kp_fields = [
        {"field_name": "knowledge_point", "type": 1},
        {"field_name": "module", "type": 1},
        {"field_name": "category", "type": 1},
        {"field_name": "description", "type": 1},
        {"field_name": "difficulty_levels", "type": 1},
        {"field_name": "estimated_needed", "type": 2}
    ]
    
    knowledge_table_id = await create_table("knowledge_points", kp_fields)
    
    # 保存表 ID 到 .env 或配置文件
    print("\n✅ 所有表创建完成！")
    print("请将以下 Table IDs 保存到你的 .env 文件：")
    print(f"USERS_TABLE_ID={users_table_id}")
    print(f"TASKS_TABLE_ID={tasks_table_id}")
    print(f"PROGRESS_TABLE_ID={progress_table_id}")
    print(f"KNOWLEDGE_TABLE_ID={knowledge_table_id}")
    
    # 写入配置文件
    config = {
        "bitable": {
            "app_token": APP_TOKEN,
            "tables": {
                "users": users_table_id,
                "tasks": tasks_table_id,
                "progress": progress_table_id,
                "knowledge": knowledge_table_id
            }
        }
    }
    
    with open('config/bitable_config.json', 'w') as f:
        json.dump(config, f, indent=2)
    
    print("\n配置已保存到 config/bitable_config.json")
    
    return {
        "users": users_table_id,
        "tasks": tasks_table_id,
        "progress": progress_table_id,
        "knowledge": knowledge_table_id
    }

async def main():
    print("🚀 开始初始化飞书多维表格...")
    
    # 检查环境变量
    if not APP_TOKEN:
        print("❌ 请先设置 BITABLE_APP_TOKEN 环境变量")
        return
    
    try:
        await create_app_if_not_exists()
        await setup_all_tables()
        print("\n✨ 初始化完成！")
    except Exception as e:
        print(f"❌ 错误: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
