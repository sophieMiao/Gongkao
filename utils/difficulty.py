#!/usr/bin/env python3
"""
难度自适应算法模块
"""

from typing import List, Dict
from dataclasses import dataclass
from datetime import datetime, timedelta

@dataclass
class UserProgress:
    user_id: str
    knowledge_points: Dict[str, Dict]  # point -> {accuracy, total, correct, last_updated}
    overall_accuracy: float
    streak_days: int
    level: int
    recent_performance: List[float]  # 最近N次的正确率列表

class DifficultyEngine:
    """
    难度自适应引擎
    根据用户表现动态调整题目难度
    """
    
    def __init__(self):
        self.min_difficulty = 0.1  # 最低难度系数
        self.max_difficulty = 1.0   # 最高难度系数
        self.adjustment_step = 0.05  # 每次调整幅度
        
        # 各知识点难度系数缓存
        self.kp_difficulty = {}  # knowledge_point -> difficulty factor
        
    def get_difficulty_factor(self, knowledge_point: str, user_progress: UserProgress) -> float:
        """获取某个知识点的难度系数"""
        
        # 默认难度
        base_difficulty = 0.5
        
        # 如果该知识点有历史数据
        if knowledge_point in user_progress.knowledge_points:
            kp_data = user_progress.knowledge_points[knowledge_point]
            accuracy = kp_data['accuracy']
            
            # 根据正确率调整：正确率越高，难度越大
            if accuracy >= 0.9:
                factor = 0.9
            elif accuracy >= 0.8:
                factor = 0.7
            elif accuracy >= 0.7:
                factor = 0.5
            elif accuracy >= 0.6:
                factor = 0.3
            else:
                factor = 0.2
        else:
            # 新知识点，使用中等难度
            factor = base_difficulty
        
        # 考虑全局正确率趋势
        if user_progress.recent_performance:
            recent_avg = sum(user_progress.recent_performance[-5:]) / min(5, len(user_progress.recent_performance))
            if recent_avg > 0.85:
                factor += 0.1  # 整体表现好，适当提升
            elif recent_avg < 0.5:
                factor = max(self.min_difficulty, factor - 0.15)  # 整体表现差，降低难度
        
        # 限制在范围内
        factor = max(self.min_difficulty, min(self.max_difficulty, factor))
        
        return factor
    
    def select_questions(self, question_pool: List[Dict], knowledge_point: str, 
                        count: int, user_progress: UserProgress) -> List[Dict]:
        """从题库中选择合适难度的题目"""
        
        difficulty_factor = self.get_difficulty_factor(knowledge_point, user_progress)
        
        # 根据难度系数过滤题目
        # 题库中每道题都应有 difficulty 字段 (0.0-1.0)
        filtered = [q for q in question_pool 
                   if q['knowledge_point'] == knowledge_point 
                   and abs(q.get('difficulty_numeric', 0.5) - difficulty_factor) < 0.2]
        
        # 如果过滤后不够，放宽条件
        if len(filtered) < count:
            filtered = [q for q in question_pool 
                       if q['knowledge_point'] == knowledge_point]
        
        # 随机选择指定数量
        import random
        selected = random.sample(filtered, min(count, len(filtered)))
        
        # 如果还不够，允许重复（使用不同题号变体）
        while len(selected) < count and len(question_pool) > 0:
            extra = random.choice(question_pool)
            if extra not in selected:
                selected.append(extra)
        
        return selected[:count]
    
    def adjust_based_on_recent(self, user_progress: UserProgress) -> Dict:
        """根据近期表现给出难度调整建议"""
        
        if len(user_progress.recent_performance) < 3:
            return {"adjustment": 0, "reason": "数据不足"}
        
        recent = user_progress.recent_performance[-3:]
        avg = sum(recent) / len(recent)
        
        if avg >= 0.9:
            return {
                "adjustment": +0.1,
                "reason": "连续表现优秀，提升难度",
                "suggestion": "增加hard题型比例"
            }
        elif avg >= 0.8:
            return {
                "adjustment": +0.05,
                "reason": "表现良好，适度提升",
                "suggestion": "保持medium为主，适当加入hard"
            }
        elif avg >= 0.6:
            return {
                "adjustment": 0,
                "reason": "表现合格，维持当前难度",
                "suggestion": "继续medium题型"
            }
        else:
            return {
                "adjustment": -0.1,
                "reason": "正确率偏低，降低难度",
                "suggestion": "增加easy题型，巩固基础"
            }

class ProgressAssessor:
    """
    进度评估器
    计算当前预估分数，判断是否达标
    """
    
    def __init__(self, target_scores: Dict[str, int]):
        self.target_scores = target_scores  # {'行测': 70, '申论': 65}
        
    def estimate_score(self, user_progress: UserProgress, module: str) -> float:
        """估算当前模块得分"""
        
        # 获取该模块相关知识点
        relevant_points = self._get_module_points(module)
        
        if not relevant_points:
            return 0.0
        
        # 计算加权平均正确率
        total_weight = 0
        weighted_accuracy = 0
        
        for point in relevant_points:
            if point in user_progress.knowledge_points:
                kp_data = user_progress.knowledge_points[point]
                accuracy = kp_data['accuracy']
                weight = kp_data.get('weight', 1.0)  # 各知识点权重可配置
                
                weighted_accuracy += accuracy * weight
                total_weight += weight
        
        if total_weight == 0:
            return 0.0
        
        avg_accuracy = weighted_accuracy / total_weight
        
        # 转换为百分制分数（假设满分100）
        # 正确率80%对应80分，线性映射
        estimated_score = avg_accuracy * 100
        
        # 考虑题目难度系数修正（可选）
        # 如果做的题目偏容易，实际分数可能虚高，可打95折
        estimated_score *= 0.95
        
        return round(estimated_score, 1)
    
    def _get_module_points(self, module: str) -> List[str]:
        """获取模块包含的知识点"""
        # 这里可以从配置文件或数据库读取
        module_map = {
            '数量关系': ['数量关系-工程问题', '数量关系-行程问题', '数量关系-概率统计'],
            '判断推理': ['判断推理-图形推理', '判断推理-逻辑判断'],
            '言语理解': ['言语理解-选词填空', '言语理解-片段阅读'],
            '资料分析': ['资料分析-速算技巧'],
            '常识判断': ['常识判断-时政热点']
        }
        return module_map.get(module, [])
    
    def is_goal_reached(self, user_progress: UserProgress) -> Dict:
        """判断是否达到目标分数"""
        
        results = {}
        all_reached = True
        
        for module, target in self.target_scores.items():
            estimated = self.estimate_score(user_progress, module)
            reached = estimated >= target
            
            results[module] = {
                'target': target,
                'estimated': estimated,
                'reached': reached,
                'gap': target - estimated
            }
            
            if not reached:
                all_reached = False
        
        # 还需检查其他条件：连续天数、知识点覆盖
        conditions_met = {
            'score_goals': all_reached,
            'streak_requirement': user_progress.streak_days >= 7,
            'mastery_check': self._check_knowledge_mastery(user_progress)
        }
        
        return {
            'all_conditions_met': all(conditions_met.values()),
            'conditions': conditions_met,
            'module_results': results,
            'overall_estimated': sum(r['estimated'] for r in results.values()) / len(results)
        }
    
    def _check_knowledge_mastery(self, user_progress: UserProgress) -> bool:
        """检查核心知识点是否都达到掌握度"""
        required_points = [
            '数量关系-工程问题',
            '数量关系-行程问题',
            '判断推理-图形推理',
            '判断推理-逻辑判断',
            '言语理解-选词填空',
            '言语理解-片段阅读'
        ]
        
        for point in required_points:
            if point in user_progress.knowledge_points:
                if user_progress.knowledge_points[point]['accuracy'] < 0.8:
                    return False
            else:
                return False  # 未练习过的知识点视为未掌握
        
        return True

class TaskScheduler:
    """
    任务调度器
    根据剩余时间、目标难度生成每日任务计划
    """
    
    def __init__(self, exam_date: str):
        self.exam_date = datetime.strptime(exam_date, '%Y-%m-%d')
        
    def calculate_intensity(self, days_remaining: int, progress: UserProgress) -> float:
        """计算学习强度（每日任务量系数）"""
        
        base_intensity = 1.0
        
        # 时间紧迫性调整
        if days_remaining > 180:
            intensity = 0.6  # 早期，轻松一些
        elif days_remaining > 90:
            intensity = 1.0  # 中期，正常强度
        elif days_remaining > 60:
            intensity = 1.2  # 后期，加强
        elif days_remaining > 30:
            intensity = 1.5  # 冲刺期
        else:
            intensity = 2.0  # 最后一个月，高强度
        
        # 根据当前达标情况调整
        estimated_score = sum(progress.recent_performance[-10:]) / min(10, len(progress.recent_performance)) * 100 if progress.recent_performance else 0
        target_avg = sum(progress.target_scores.values()) / len(progress.target_scores)
        gap_ratio = (target_avg - estimated_score) / target_avg if estimated_score > 0 else 1.0
        
        if gap_ratio > 0.3:
            intensity *= 1.2  # 差距大，需要更多练习
        elif gap_ratio < 0.1:
            intensity *= 0.9  # 接近目标，可以稍缓
        
        return intensity
    
    def generate_daily_plan(self, progress: UserProgress, question_bank_stats: Dict) -> Dict:
        """生成每日学习计划"""
        
        today = datetime.now()
        days_remaining = (self.exam_date - today).days
        days_remaining = max(1, days_remaining)
        
        intensity = self.calculate_intensity(days_remaining, progress)
        
        # 基础任务数
        base_tasks = 5
        daily_tasks = max(3, int(base_tasks * intensity))
        
        # 分配各模块任务
        distribution = self._distribute_tasks(daily_tasks, progress, question_bank_stats)
        
        return {
            'date': today.strftime('%Y-%m-%d'),
            'days_remaining': days_remaining,
            'intensity': round(intensity, 2),
            'total_tasks': daily_tasks,
            'distribution': distribution,
            'estimated_minutes': daily_tasks * 3  # 每道题约3分钟
        }
    
    def _distribute_tasks(self, total_tasks: int, progress: UserProgress, 
                         bank_stats: Dict) -> List[Dict]:
        """分配各模块任务量"""
        
        # 找出薄弱模块（正确率低的）
        weak_modules = self._identify_weak_modules(progress)
        
        distribution = []
        remaining = total_tasks
        
        # 优先分配薄弱模块
        for module, accuracy in weak_modules[:3]:  # 前3个薄弱点
            if remaining <= 0:
                break
            allocate = max(1, min(remaining // 2, 3))  # 每个薄弱模块最多3题
            distribution.append({
                'module': module,
                'count': allocate,
                'reason': f'薄弱环节（正确率{accuracy:.0%}）'
            })
            remaining -= allocate
        
        # 剩余任务平均分配给所有模块
        all_modules = list(bank_stats.keys())
        if remaining > 0 and all_modules:
            per_module = max(1, remaining // len(all_modules))
            for module in all_modules:
                if remaining <= 0:
                    break
                distribution.append({
                    'module': module,
                    'count': min(per_module, remaining),
                    'reason': '常规练习'
                })
                remaining -= min(per_module, remaining)
        
        return distribution
    
    def _identify_weak_modules(self, progress: UserProgress) -> List[tuple]:
        """识别薄弱模块"""
        module_accuracies = {}
        
        for point, data in progress.knowledge_points.items():
            module = point.split('-')[0]
            if module not in module_accuracies:
                module_accuracies[module] = {'correct': 0, 'total': 0}
            module_accuracies[module]['correct'] += data['correct']
            module_accuracies[module]['total'] += data['total']
        
        # 计算各模块正确率并排序
        results = []
        for module, stats in module_accuracies.items():
            if stats['total'] >= 5:  # 至少5题数据
                acc = stats['correct'] / stats['total']
                results.append((module, acc))
        
        results.sort(key=lambda x: x[1])  # 按正确率升序
        return results

# 测试
if __name__ == "__main__":
    # 模拟用户进度
    progress = UserProgress(
        user_id="test",
        knowledge_points={
            '数量关系-工程问题': {'accuracy': 0.75, 'total': 20, 'correct': 15},
            '数量关系-行程问题': {'accuracy': 0.60, 'total': 15, 'correct': 9},
            '判断推理-图形推理': {'accuracy': 0.85, 'total': 25, 'correct': 21}
        },
        overall_accuracy=0.73,
        streak_days=5,
        level=3,
        recent_performance=[0.7, 0.8, 0.75, 0.85, 0.7]
    )
    
    engine = DifficultyEngine()
    assessor = ProgressAssessor({'行测': 70, '申论': 65})
    scheduler = TaskScheduler('2025-11-30')
    
    print("难度系数:", engine.get_difficulty_factor('数量关系-工程问题', progress))
    print("预估分数:", assessor.estimate_score(progress, '数量关系'))
    print("是否达标:", assessor.is_goal_reached(progress))
    print("今日计划:", scheduler.generate_daily_plan(progress, {
        '数量关系': 100,
        '判断推理': 80,
        '言语理解': 120
    }))
