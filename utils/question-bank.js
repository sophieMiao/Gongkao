const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

class QuestionBank {
  constructor(prismaClient) {
    this.prisma = prismaClient;
  }

  /**
   * 根据知识点随机获取题目
   */
  async getRandomByPoint(knowledgePoint, count = 1) {
    const questions = await this.prisma.questionbank.findMany({
      where: { knowledge_point: knowledgePoint },
      orderBy: { id: 'asc' },
      take: count
    });
    
    // 如果不够，随机再取一些
    if (questions.length < count) {
      const more = await this.prisma.questionbank.findMany({
        where: { knowledge_point: knowledgePoint },
        orderBy: { RANDOM() },
        take: count - questions.length
      });
      questions.push(...more);
    }
    
    return questions.map(q => ({
      id: q.question_id,
      content: q.content,
      options: q.options || [],
      correct_answer: q.correct_answer,
      explanation: q.explanation || '',
      knowledge_point: q.knowledge_point,
      difficulty: q.difficulty,
      source: q.source
    }));
  }

  /**
   * 排除已选题目后随机获取
   */
  async getRandomExcluding(selectedQuestions, count = 1, excludePoints = []) {
    // 简化实现：随机取 count 题
    const questions = await this.prisma.questionbank.findMany({
      where: {
        knowledge_point: { notIn: excludePoints }
      },
      orderBy: { RANDOM() },
      take: count
    });
    
    return questions.map(q => ({
      id: q.question_id,
      content: q.content,
      options: q.options || [],
      correct_answer: q.correct_answer,
      explanation: q.explanation || '',
      knowledge_point: q.knowledge_point,
      difficulty: q.difficulty,
      source: q.source
    }));
  }

  /**
   * 根据题目ID获取题目
   */
  async getById(questionId) {
    const q = await this.prisma.questionbank.findUnique({
      where: { question_id: questionId }
    });
    
    if (!q) return null;
    
    return {
      id: q.question_id,
      content: q.content,
      options: q.options || [],
      correct_answer: q.correct_answer,
      explanation: q.explanation || '',
      knowledge_point: q.knowledge_point,
      difficulty: q.difficulty,
      source: q.source
    };
  }
}

module.exports = QuestionBank;
