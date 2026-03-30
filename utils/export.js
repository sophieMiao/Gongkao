/**
 * 错题本导出工具
 * 支持 PDF 和 Excel 格式导出
 */

const fs = require('fs');
const path = require('path');

// Excel 导出（使用 json2csv 或类似库，这里先提供框架）
async function exportToExcel(wrongQuestions, user, outputPath) {
  // TODO: 实现 Excel 导出
  // 可以使用 exceljs 或 json2csv
  console.log('Excel export not yet implemented');
  return outputPath;
}

// PDF 导出（使用 pdfkit 或 similar）
async function exportToPDF(wrongQuestions, user, outputPath) {
  // TODO: 实现 PDF 导出
  console.log('PDF export not yet implemented');
  return outputPath;
}

// 错题本数据结构
class WrongQuestionBook {
  constructor(userId, userName) {
    this.userId = userId;
    this.userName = userName;
    this.questions = [];
    this.exportDate = new Date();
  }

  addQuestion(question, userAnswer, correctAnswer, wrongReason) {
    this.questions.push({
      questionId: question.id,
      content: question.content,
      type: question.type,
      options: question.options,
      correctAnswer: correctAnswer,
      userAnswer: userAnswer,
      explanation: question.explanation,
      knowledgePoints: question.knowledgePoints,
      wrongReason,
      wrongDate: new Date().toISOString()
    });
  }

  getStats() {
    const byKnowledge = {};
    const byType = {};

    this.questions.forEach(q => {
      q.knowledgePoints.forEach(kp => {
        byKnowledge[kp] = (byKnowledge[kp] || 0) + 1;
      });
      byType[q.type] = (byType[q.type] || 0) + 1;
    });

    return {
      total: this.questions.length,
      byKnowledge,
      byType
    };
  }

  async export(format = 'pdf', outputDir = '/tmp') {
    const fileName = `错题本_${this.userName}_${this.exportDate.toISOString().split('T')[0]}`;
    const outputPath = path.join(outputDir, `${fileName}.${format}`);

    switch (format) {
      case 'excel':
      case 'xlsx':
        return await exportToExcel(this.questions, this.user, outputPath);
      case 'pdf':
        return await exportToPDF(this.questions, this.user, outputPath);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }
}

// 从数据库查询错题
async function fetchWrongQuestions(userId, limit = 100) {
  // TODO: 实现数据库查询
  // SELECT * FROM user_answers WHERE user_id = ? AND is_correct = false ORDER BY created_at DESC LIMIT ?
  return [];
}

module.exports = {
  WrongQuestionBook,
  fetchWrongQuestions,
  exportToExcel,
  exportToPDF
};
