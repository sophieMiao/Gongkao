#!/usr/bin/env python3
"""
AI 题目生成器 - 使用 StepFun API 生成考公题目
"""

import os
import json
import asyncio
from typing import List, Dict
from stepfun_api import StepFun  # 假设的SDK，实际需根据StepFun文档调整

class AIGenerator:
    def __init__(self):
        self.api_key = os.getenv('STEPFUN_API_KEY')
        self.client = StepFun(api_key=self.api_key)
        
        # 生成提示词模板
        self.prompts = {
            'choice': self._build_choice_prompt,
            'short_answer': self._build_short_answer_prompt
        }
    
    def _build_choice_prompt(self, knowledge_point: str, difficulty: str) -> str:
        return f"""你是一位资深的公务员考试命题专家。请生成一道{knowledge_point}的单项选择题。

要求：
1. 难度：{difficulty}（easy/medium/hard）
2. 题干清晰，选项合理，只有一个正确答案
3. 提供详细解析，说明解题思路
4. 符合公务员考试命题风格，不偏不怪
5. 避免使用敏感内容

输出格式（严格JSON，不要markdown）：
{{
  "content": "题干内容",
  "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
  "correct_answer": "A/B/C/D",
  "explanation": "答案解析，包括知识点讲解"
}}"""
    
    def _build_short_answer_prompt(self, knowledge_point: str, difficulty: str) -> str:
        return f"""你是一位资深的公务员考试命题专家。请生成一道{knowledge_point}的简答题。

要求：
1. 难度：{difficulty}
2. 需要文字作答，答案长度适中（50-200字）
3. 提供参考答案和评分要点
4. 符合申论或简答题风格

输出格式（严格JSON）：
{{
  "content": "题目内容",
  "answer_requirement": "作答要求说明",
  "reference_answer": "参考答案",
  "scoring_criteria": "评分要点"
}}"""
    
    async def generate_question(self, knowledge_point: str, difficulty: str = 'medium', 
                              q_type: str = 'choice') -> Dict:
        """生成单个题目"""
        prompt = self.prompts[q_type](knowledge_point, difficulty)
        
        try:
            response = await self.client.chat.completions.create(
                model="step-3.5-flash",
                messages=[
                    {"role": "system", "content": "你是一位专业的公务员考试命题专家。"},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.8,
                max_tokens=800
            )
            
            content = response.choices[0].message.content.strip()
            
            # 清理可能存在的 markdown 标记
            if content.startswith('```json'):
                content = content[7:]
            if content.endswith('```'):
                content = content[:-3]
            content = content.strip()
            
            question = json.loads(content)
            question['id'] = f"ai_{knowledge_point.replace(' ', '_')}_{difficulty}_{hash(content)%10000}"
            question['knowledge_point'] = knowledge_point
            question['difficulty'] = difficulty
            question['source'] = f"AI生成-{difficulty}-{q_type}"
            
            return question
            
        except json.JSONDecodeError as e:
            print(f"JSON解析失败: {e}, 原始内容: {content}")
            raise
        except Exception as e:
            print(f"生成题目失败: {e}")
            raise
    
    async def generate_batch(self, knowledge_point: str, difficulty: str, 
                           count: int = 3) -> List[Dict]:
        """批量生成题目"""
        tasks = []
        for i in range(count):
            # 轻微随机化难度，增加多样性
            diff = difficulty
            if difficulty == 'medium' and i % 3 == 2:
                diff = 'hard'  # 每3题中有一题稍难
            tasks.append(self.generate_question(knowledge_point, diff))
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 过滤失败的生成
        valid = []
        for r in results:
            if isinstance(r, Exception):
                continue
            if r and 'content' in r:
                valid.append(r)
        
        return valid
    
    async def generate_for_weak_points(self, weak_points: List[Dict], 
                                      questions_per_point: int = 2) -> List[Dict]:
        """为薄弱知识点批量生成题目"""
        all_questions = []
        for wp in weak_points:
            point = wp['point']
            # 根据薄弱程度决定生成数量
            count = min(questions_per_point, wp.get('need', 2))
            
            questions = await self.generate_batch(point, 'medium', count)
            all_questions.extend(questions)
            
            # 避免API限流，稍作等待
            await asyncio.sleep(1)
        
        return all_questions

# 命令行测试
if __name__ == "__main__":
    async def test():
        gen = AIGenerator()
        questions = await gen.generate_batch("数量关系-工程问题", "medium", 2)
        print(json.dumps(questions, ensure_ascii=False, indent=2))
    
    asyncio.run(test())
