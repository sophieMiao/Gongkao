const { PrismaClient } = require('@prisma/client');
const QuestionBank = require('./question-bank');
const AIQuestionGenerator = require('./ai-generator');
const { sendFeishuMessage } = require('./feishu-sender');

const prisma = new PrismaClient();

class TaskScheduler {
  constructor(prismaClient, user) {
    this.prisma = prismaClient;
    this.user = user;
    this.questionBank = new QuestionBank(prismaClient);
    this.aiGenerator = new AIQuestionGenerator();
  }

  /**
   * 为指定用户生成并发送今日任务
   */
  async generateAndSendDailyTask() {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    console.log(`📅 为用户 ${this.user.name} 生成 ${todayStr} 的任务...`);
    
    // 1. 获取用户进度和薄弱点
    const weakPoints = await this.identifyWeakPoints();
    
    // 2. 计算今日任务量
    const taskCount = this.calculateDailyTaskCount();
    
    // 3. 选择题目（优先薄弱点）
    const questions = await this.selectQuestions(weakPoints, taskCount);
    
    // 4. 丰富题目数据（添加解析、知识点标签、相似题）
    await this.enrichQuestions(questions);
    
    // 5. 保存任务到数据库
    await this.saveTasks(questions, todayStr);
    
    // 6. 发送飞书消息
    await this.sendDailyTaskCard(questions, todayStr);
    
    console.log(`  ✅ 完成：${questions.length} 道题目`);
  }

  /**
   * 丰富题目数据 - 添加解析、知识点标签、相似题推荐
   */
  async enrichQuestions(questions) {
    for (const q of questions) {
      // 如果已有解析，跳过
      if (q.explanation) continue;
      
      // 调用 xingce-agent 生成详细解析
      try {
        const xingceAgent = require('../src/agents/xingce-agent');
        const agent = new xingceAgent();
        
        const prompt = `请为这道题目生成详细解析和学习建议。
题目：${q.content}
选项：${q.options ? q.options.join('；') : '无'}
正确答案：${q.correct_answer}

要求：
1. 分步骤解析，说明解题思路
2. 指出常见错误和陷阱
3. 提供1-2个解题技巧
4. 列出3个相关的知识点标签（如：中心理解、关键词法、转折关系）
5. 如果这道题属于某个知识点，建议3道同类题（给出题目ID或简要描述）

输出JSON格式：
{
  "explanation": "详细解析文本",
  "knowledge_points": ["知识点1", "知识点2", "知识点3"],
  "tips": ["技巧1", "技巧2"],
  "similar_questions": [
    {"id": "q001", "title": "...", "difficulty": "medium"},
    {"id": "q002", "title": "...", "difficulty": "easy"}
  ]
}`;
        
        const result = await agent.handle(prompt);
        const json = agent._parseJSONResponse(result.answer);
        
        if (json) {
          q.explanation = json.explanation || result.explanation || '暂无解析';
          q.knowledge_tags = json.knowledge_points || [q.knowledge_point];
          q.similar_questions = json.similar_questions || [];
        } else {
          // 降级：使用LLM直接返回的文本作为解析
          q.explanation = result.answer || result.explanation || '暂无解析';
          q.knowledge_tags = [q.knowledge_point];
          q.similar_questions = [];
        }
      } catch (error) {
        console.error(`生成解析失败: ${q.id}`, error);
        q.explanation = '解析生成失败，请联系管理员';
        q.knowledge_tags = [q.knowledge_point];
        q.similar_questions = [];
      }
    }
  }

  /**
   * 识别用户薄弱知识点
   */
  async identifyWeakPoints() {
    // 查询最近30天的答题记录
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const results = await this.prisma.$queryRaw`
      SELECT 
        knowledge_point,
        COUNT(*) as total_questions,
        SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct_count,
        AVG(CASE WHEN is_correct THEN 1.0 ELSE 0.0 END) as accuracy
      FROM "DailyTask"
      WHERE 
        "user_id" = ${this.user.id} 
        AND status = 'completed'
        AND created_at >= ${thirtyDaysAgo}
      GROUP BY knowledge_point
      HAVING COUNT(*) >= 5  -- 至少有5题数据
      ORDER BY accuracy ASC
      LIMIT 5
    `;
    
    return results.map(r => ({
      point: r.knowledge_point,
      accuracy: parseFloat(r.accuracy),
      total: parseInt(r.total_questions),
      correct: parseInt(r.correct_count)
    }));
  }

  /**
   * 计算今日任务量
   */
  calculateDailyTaskCount() {
    const now = new Date();
    const examDate = this.user.exam_date ? new Date(this.user.exam_date) : null;
    
    if (!examDate) {
      return 8; // 默认8题
    }
    
    const daysRemaining = Math.max(1, Math.floor((examDate - now) / (24 * 60 * 60 * 1000)));
    let baseCount = 5;
    
    if (daysRemaining > 180) baseCount = 3;
    else if (daysRemaining > 90) baseCount = 5;
    else if (daysRemaining > 30) baseCount = 7;
    else if (daysRemaining > 14) baseCount = 10;
    else baseCount = 12;
    
    // 根据当前完成率调整
    if (this.user.streak < 3) {
      baseCount = Math.max(3, Math.floor(baseCount * 0.8)); // 新手降低难度
    }
    
    return baseCount;
  }

  /**
   * 选择题目
   */
  async selectQuestions(weakPoints, count) {
    const questions = [];
    const weakPointNames = weakPoints.map(w => w.point);
    
    // 1. 优先从薄弱点选题（每个最多2题）
    for (const wp of weakPoints.slice(0, 3)) {
      if (questions.length >= count) break;
      
      const needed = Math.min(2, count - questions.length);
      const qs = await this.questionBank.getRandomByPoint(wp.point, needed);
      
      // 如果题库不够，用 AI 生成
      if (qs.length < needed) {
        const aiQs = await this.aiGenerator.generateForPoint(wp.point, needed - qs.length);
        questions.push(...qs, ...aiQs);
      } else {
        questions.push(...qs);
      }
    }
    
    // 2. 剩余题目从其他知识点随机选
    if (questions.length < count) {
      const remaining = count - questions.length;
      const qs = await this.questionBank.getRandomExcluding(questions, remaining, weakPointNames);
      questions.push(...qs);
    }
    
    // 3. 如果还不够（题库不足），用 AI 补充
    if (questions.length < count) {
      const needed = count - questions.length;
      const allModules = ['数量关系', '判断推理', '言语理解', '资料分析', '常识判断'];
      const randomModule = allModules[Math.floor(Math.random() * allModules.length)];
      const aiQs = await this.aiGenerator.generateForModule(randomModule, needed);
      questions.push(...aiQs);
    }
    
    return questions.slice(0, count);
  }

  /**
   * 保存任务到数据库
   */
  async saveTasks(questions, date) {
    for (q of questions) {
      await this.prisma.dailyTask.create({
        data: {
          user_id: this.user.id,
          task_date: new Date(date),
          task_type: this.inferTaskType(q.knowledge_point),
          knowledge_point: q.knowledge_point,
          question_content: q.content,
          options: q.options || null,
          correct_answer: q.correct_answer,
          explanation: q.explanation || null,
          knowledge_tags: q.knowledge_tags || null,
          similar_questions: q.similar_questions || null,
          user_answer: null,
          is_correct: null,
          time_spent_seconds: null,
          points_available: this.calculatePoints(q.difficulty),
          points_earned: 0,
          status: 'pending'
        }
      });
    }
  }

  /**
   * 发送每日任务卡片
   */
  async sendDailyTaskCard(questions, date) {
    // 按知识点分组
    const grouped = {};
    questions.forEach(q => {
      if (!grouped[q.knowledge_point]) {
        grouped[q.knowledge_point] = [];
      }
      grouped[q.knowledge_point].push(q);
    });
    
    // 计算总积分
    const totalPoints = questions.reduce((sum, q) => sum + this.calculatePoints(q.difficulty), 0);
    
    // 计算学习天数
    const dayNumber = await this.calculateDayNumber();
    
    // 构建任务列表文本
    let tasksList = '';
    Object.entries(grouped).forEach(([point, qs], idx) => {
      const diffIcon = qs[0].difficulty === 'hard' ? '🔥' : qs[0].difficulty === 'medium' ? '⚡' : '💡';
      tasksList += `${idx + 1}. ${point} (${qs.length}题, ${diffIcon})\n`;
    });
    
    const card = {
      msg_type: 'interactive',
      content: {
        config: { wide_screen_mode: true },
        elements: [
          {
            tag: 'header',
            template: 'blue',
            title: {
              content: `📚 考公学习伴侣 | 第${dayNumber}天任务`,
              tag: 'plain_text'
            }
          },
          {
            tag: 'div',
            fields: [
              {
                tag: 'lark_md',
                content: `**今日学习目标（${questions.length * 2}分钟）**\n\n${tasksList}`
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
                url: `https://kaogong.example.com/task?date=${date}&user=${this.user.id}`
              },
              {
                tag: 'button',
                text: { content: '稍后提醒', tag: 'plain_text' },
                type: 'default',
                url: `https://kaogong.example.com/remind?date=${date}&user=${this.user.id}`
              }
            ]
          },
          {
            tag: 'div',
            fields: [
              {
                tag: 'lark_md',
                content: `───────────────\n💎 **完成任务可获得：${totalPoints}积分**\n🔥 **当前连续：${this.user.streak}天** | **等级：Lv.${this.user.level}**`
              }
            ]
          }
        ]
      }
    };
    
    await sendFeishuMessage(this.user.open_id, card);
  }

  /**
   * 辅助方法
   */
  inferTaskType(knowledgePoint) {
    if (knowledgePoint.includes('数量关系') || knowledgePoint.includes('行程') || knowledgePoint.includes('工程')) {
      return '数量关系';
    } else if (knowledgePoint.includes('图形') || knowledgePoint.includes('逻辑')) {
      return '判断推理';
    } else if (knowledgePoint.includes('言语') || knowledgePoint.includes('选词')) {
      return '言语理解';
    } else if (knowledgePoint.includes('资料')) {
      return '资料分析';
    } else if (knowledgePoint.includes('常识') || knowledgePoint.includes('时政')) {
      return '常识判断';
    }
    return '行测';
  }

  calculatePoints(difficulty) {
    switch (difficulty) {
      case 'hard': return 15;
      case 'medium': return 12;
      default: return 10;
    }
  }

  async calculateDayNumber() {
    const regDate = new Date(this.user.registered_at);
    const today = new Date();
    const diff = Math.floor((today - regDate) / (24 * 60 * 60 * 1000));
    return diff + 1;
  }
}

module.exports = { TaskScheduler };
