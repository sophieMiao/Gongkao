#!/usr/bin/env python3
"""
数据库初始化脚本 - SaaS 版
创建 PostgreSQL 表结构并导入初始数据
"""

import os
import json
import asyncio
from datetime import datetime, timedelta
from prisma import Prisma

async def init_database():
    """初始化数据库"""
    db = Prisma()
    await db.connect()
    
    print("🗄️  开始初始化数据库...")
    
    # 1. 创建知识点（KnowledgePoint）
    print("\n1️⃣ 创建知识点...")
    kp_file = 'data/knowledge_points.json'
    if os.path.exists(kp_file):
        with open(kp_file, 'r', encoding='utf-8') as f:
            kp_data = json.load(f)
            
        for kp in kp_data['knowledge_points']:
            await db.knowledgepoint.upsert(
                where={'name': kp['name']},
                data={
                    'create': {
                        'name': kp['name'],
                        'module': kp['module'],
                        'category': kp.get('category'),
                        'description': kp.get('description'),
                        'difficulty_levels': kp.get('difficulty_levels', ['easy', 'medium', 'hard']),
                        'estimated_questions_needed': kp.get('estimated_questions_needed', 30),
                        'weight': kp.get('weight', 1.0)
                    },
                    'update': {
                        'module': kp['module'],
                        'category': kp.get('category'),
                        'description': kp.get('description'),
                        'difficulty_levels': kp.get('difficulty_levels', ['easy', 'medium', 'hard']),
                        'estimated_questions_needed': kp.get('estimated_questions_needed', 30),
                        'weight': kp.get('weight', 1.0)
                    }
                }
            )
        print(f"  ✓ 导入 {len(kp_data['knowledge_points'])} 个知识点")
    
    # 2. 导入题库（QuestionBank）
    print("\n2️⃣ 导入题库...")
    qb_file = 'data/question_bank.json'
    if os.path.exists(qb_file):
        with open(qb_file, 'r', encoding='utf-8') as f:
            qb_data = json.load(f)
            
        for q in qb_data['questions']:
            await db.questionbank.upsert(
                where={'question_id': q['id']},
                data={
                    'create': {
                        'question_id': q['id'],
                        'type': q.get('type', 'choice'),
                        'content': q['content'],
                        'options': q.get('options'),
                        'correct_answer': q['correct_answer'],
                        'explanation': q.get('explanation'),
                        'knowledge_point': q['knowledge_point'],
                        'difficulty': q.get('difficulty', 'medium'),
                        'source': q.get('source', '现成题库'),
                        'created_at': datetime.now()
                    },
                    'update': {
                        'type': q.get('type', 'choice'),
                        'content': q['content'],
                        'options': q.get('options'),
                        'correct_answer': q['correct_answer'],
                        'explanation': q.get('explanation'),
                        'knowledge_point': q['knowledge_point'],
                        'difficulty': q.get('difficulty', 'medium'),
                        'source': q.get('source', '现成题库')
                    }
                }
            )
        print(f"  ✓ 导入 {len(qb_data['questions'])} 道题目")
    
    # 3. 创建成就记录（可选）
    print("\n3️⃣ 初始化成就系统...")
    achievements = [
        {
            'id': 'first_login',
            'name': '初次见面',
            'description': '首次注册使用考公学习伴侣',
            'icon': '👋',
            'condition_type': 'any',
            'condition_value': 1,
            'reward_points': 50
        },
        {
            'id': 'streak_3',
            'name': '坚持三天',
            'description': '连续3天完成学习任务',
            'icon': '🔥',
            'condition_type': 'streak',
            'condition_value': 3,
            'reward_points': 100
        },
        {
            'id': 'streak_7',
            'name': '一周达人',
            'description': '连续7天完成学习任务',
            'icon': '🏆',
            'condition_type': 'streak',
            'condition_value': 7,
            'reward_points': 300
        },
        {
            'id': 'accuracy_80',
            'name': '正确率80%',
            'description': '单日答题正确率达到80%以上',
            'icon': '🎯',
            'condition_type': 'accuracy',
            'condition_value': 80,
            'reward_points': 150
        },
        {
            'id': 'master_10_points',
            'name': '掌握10个知识点',
            'description': '有10个知识点达到80%以上正确率',
            'icon': '📚',
            'condition_type': 'mastered_points',
            'condition_value': 10,
            'reward_points': 500
        }
    ]
    
    for ach in achievements:
        await db.achievement.upsert(
            where={'id': ach['id']},
            data=ach
        )
    print(f"  ✓ 创建 {len(achievements)} 个成就")
    
    await db.disconnect()
    print("\n✅ 数据库初始化完成！")

if __name__ == "__main__":
    asyncio.run(init_database())
