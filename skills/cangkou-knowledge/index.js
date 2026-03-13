#!/usr/bin/env node
/**
 * cangkou-knowledge Skill - 知识库管理
 */

const { OpenClaw } = require('openclaw');
const fs = require('fs').promises;
const path = require('path');

class KnowledgeSkill {
  constructor() {
    this.questionBank = null;
    this.knowledgePoints = null;
  }
  
  async init() {
    if (!this.questionBank) {
      // 加载现成题库
      const qbPath = path.join(__dirname, '../../data/question_bank.json');
      const qbContent = await fs.readFile(qbPath, 'utf8');
      this.questionBank = JSON.parse(qbContent);
      
      // 加载知识点
      const kpPath = path.join(__dirname, '../../data/knowledge_points.json');
      const kpContent = await fs.readFile(kpPath, 'utf8');
      this.knowledgePoints = JSON.parse(kpContent);
    }
  }
  
  async getQuestions(params) {
    await this.init();
    
    const { knowledge_point, difficulty, count = 5, exclude_used = true } = params;
    
    let questions = this.questionBank.questions.filter(q => 
      q.knowledge_point === knowledge_point
    );
    
    // 按难度过滤
    if (difficulty) {
      questions = questions.filter(q => q.difficulty === difficulty);
    }
    
    // 排除已用题目（需传入已用题目ID列表）
    if (exclude_used && params.exclude_ids) {
      questions = questions.filter(q => !params.exclude_ids.includes(q.id));
    }
    
    // 随机选择
    const selected = this._sampleArray(questions, Math.min(count, questions.length));
    
    return {
      questions: selected,
      total_available: questions.length
    };
  }
  
  async generateQuestions(params) {
    const { knowledge_point, difficulty = 'medium', count = 3 } = params;
    
    try {
      // 调用 AI 生成器
      const { AIGenerator } = require('../../utils/ai_generator');
      const generator = new AIGenerator();
      const questions = await generator.generate_batch(knowledge_point, difficulty, count);
      
      // 保存到题库（可选）
      await this._saveGeneratedQuestions(questions);
      
      return {
        questions,
        total_available: questions.length
      };
    } catch (error) {
      console.error('AI生成失败:', error);
      throw error;
    }
  }
  
  async recordAnswer(params) {
    const { user_id, question_id, user_answer, is_correct, time_spent_seconds } = params;
    
    // 获取题目信息
    const question = this._getQuestionById(question_id);
    if (!question) {
      throw new Error(`Question ${question_id} not found`);
    }
    
    // 更新用户进度（通过 cangkou-core）
    // 这里只记录答题记录，实际进度更新由 cangkou-core 处理
    
    const knowledge_point = question.knowledge_point;
    
    // 计算知识点统计数据
    const stats = await this._getKnowledgePointStats(user_id, knowledge_point);
    stats.total_questions++;
    if (is_correct) stats.correct_count++;
    stats.accuracy = stats.correct_count / stats.total_questions;
    stats.last_updated = new Date().toISOString();
    
    // 保存到数据库
    await this._saveProgressRecord({
      user_id,
      question_id,
      knowledge_point,
      user_answer,
      correct_answer: question.correct_answer,
      is_correct,
      time_spent_seconds,
      answered_at: new Date().toISOString()
    });
    
    // 更新知识点掌握状态
    const mastered = stats.accuracy >= 0.8 && stats.total_questions >= 10;
    
    return {
      knowledge_point_updated: {
        point: knowledge_point,
        ...stats,
        mastered
      }
    };
  }
  
  async getWeakPoints(params) {
    const { user_id, threshold = 0.7 } = params;
    
    // 查询该用户所有知识点的进度
    const progress = await this._getUserAllProgress(user_id);
    
    const weakPoints = [];
    for (const [point, stats] of Object.entries(progress)) {
      if (stats.total_questions >= 5 && stats.accuracy < threshold) {
        weakPoints.push({
          point,
          accuracy: stats.accuracy,
          total_questions: stats.total_questions,
          recommended_practice: Math.ceil((threshold - stats.accuracy) * 20)
        });
      }
    }
    
    // 按推荐练习量排序
    weakPoints.sort((a, b) => b.recommended_practice - a.recommended_practice);
    
    return { weak_points: weakPoints };
  }
  
  _sampleArray(array, count) {
    if (array.length <= count) return array;
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }
  
  _getQuestionById(id) {
    const all = this.questionBank.questions;
    return all.find(q => q.id === id);
  }
  
  async _saveGeneratedQuestions(questions) {
    // 将 AI 生成的题目追加到题库文件
    if (this.questionBank) {
      this.questionBank.questions.push(...questions);
      const qbPath = path.join(__dirname, '../../data/question_bank.json');
      await fs.writeFile(qbPath, JSON.stringify(this.questionBank, null, 2));
    }
  }
  
  async _getKnowledgePointStats(user_id, knowledge_point) {
    // 从数据库查询该用户该知识点的历史答题记录
    // 这里简化为返回模拟数据，实际需查询 feishu_bitable_app_table_record
    return {
      total_questions: 0,
      correct_count: 0,
      accuracy: 0
    };
  }
  
  async _saveProgressRecord(record) {
    // 保存答题记录到 tasks 表或专门的 records 表
    // 实际实现需调用 feishu_bitable_app_table_record create
  }
  
  async _getUserAllProgress(user_id) {
    // 查询用户所有知识点的进度汇总
    return {};
  }
}

module.exports = {
  actions: {
    getQuestions: async (ctx, params) => {
      const skill = new KnowledgeSkill();
      await skill.init();
      return skill.getQuestions(params);
    },
    
    generateQuestions: async (ctx, params) => {
      const skill = new KnowledgeSkill();
      await skill.init();
      return skill.generateQuestions(params);
    },
    
    recordAnswer: async (ctx, params) => {
      const skill = new KnowledgeSkill();
      await skill.init();
      return skill.recordAnswer(params);
    },
    
    getWeakPoints: async (ctx, params) => {
      const skill = new KnowledgeSkill();
      await skill.init();
      return skill.getWeakPoints(params);
    }
  },
  metadata: {
    name: 'cangkou-knowledge',
    version: '1.0.0',
    description: '考公学习伴侣知识库Skill',
    author: 'Your Name',
    tags: ['education', 'question-bank', 'knowledge']
  }
};
