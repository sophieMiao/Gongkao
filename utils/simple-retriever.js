/**
 * Simple Retriever - 轻量级知识检索
 * 用本地 JSON 文件 + 关键词匹配替代 Qdrant + BM25
 * 
 * 数据文件：
 * - data/knowledge_points.json: 知识点库
 * - data/question_bank.json: 题目库
 */

const fs = require('fs');
const path = require('path');

class SimpleRetriever {
  constructor(config = {}) {
    this.config = {
      knowledgeFile: config.knowledgeFile || path.join(__dirname, '../data/knowledge_points.json'),
      questionFile: config.questionFile || path.join(__dirname, '../data/question_bank.json'),
      maxResults: config.maxResults || 10,
      minScore: config.minScore || 0.1
    };
    
    this.knowledgePoints = [];
    this.questionBank = [];
    this._loaded = false;
  }

  /**
   * 异步加载数据（延迟加载，避免启动阻塞）
   */
  async load() {
    if (this._loaded) return;
    
    try {
      // 加载知识点
      if (fs.existsSync(this.config.knowledgeFile)) {
        const kpData = JSON.parse(fs.readFileSync(this.config.knowledgeFile, 'utf-8'));
        this.knowledgePoints = Array.isArray(kpData) ? kpData : kpData.knowledge_points || [];
      }
      
      // 加载题库
      if (fs.existsSync(this.config.questionFile)) {
        const qbData = JSON.parse(fs.readFileSync(this.config.questionFile, 'utf-8'));
        this.questionBank = Array.isArray(qbData) ? qbData : qbData.questions || [];
      }
      
      console.log(`[SimpleRetriever] 加载完成: ${this.knowledgePoints.length} 知识点, ${this.questionBank.length} 题目`);
      this._loaded = true;
    } catch (error) {
      console.error('[SimpleRetriever] 加载失败:', error);
      throw error;
    }
  }

  /**
   * 搜索（根据查询返回相关内容和题目）
   * @returns {Promise<{knowledge: [], questions: []}>}
   */
  async search(query, context = {}) {
    await this.load();
    
    const keywords = this._extractKeywords(query);
    const results = {
      knowledge: [],
      questions: [],
      all: []
    };
    
    // 1. 检索知识点
    for (const kp of this.knowledgePoints) {
      const score = this._calculateScore(kp.name + ' ' + (kp.description || ''), keywords);
      if (score > this.config.minScore) {
        results.knowledge.push({
          ...kp,
          score,
          type: 'knowledge_point'
        });
      }
    }
    
    // 2. 检索题目（按知识点和内容）
    for (const q of this.questionBank) {
      const searchText = [q.knowledge_point, q.content, ...(q.options || [])].join(' ');
      const score = this._calculateScore(searchText, keywords);
      if (score > this.config.minScore) {
        results.questions.push({
          ...q,
          score,
          type: 'question'
        });
      }
    }
    
    // 排序
    results.knowledge.sort((a, b) => b.score - a.score);
    results.questions.sort((a, b) => b.score - a.score);
    
    // 限制数量
    results.knowledge = results.knowledge.slice(0, this.config.maxResults);
    results.questions = results.questions.slice(0, this.config.maxResults);
    
    results.all = [...results.knowledge, ...results.questions].sort((a, b) => b.score - a.score);
    
    return results;
  }

  /**
   * 根据知识点获取题目
   */
  async getQuestionsByKnowledgePoint(knowledgePoint, limit = 5) {
    await this.load();
    
    return this.questionBank
      .filter(q => q.knowledge_point === knowledgePoint)
      .slice(0, limit);
  }

  /**
   * 获取随机题目（按难度）
   */
  async getRandomQuestions(difficulty = 'medium', count = 3, excludeIds = []) {
    await this.load();
    
    let filtered = this.questionBank;
    
    if (difficulty) {
      filtered = filtered.filter(q => q.difficulty === difficulty);
    }
    
    // 排除已用题目
    if (excludeIds.length > 0) {
      filtered = filtered.filter(q => !excludeIds.includes(q.id));
    }
    
    // 随机选择
    const shuffled = filtered.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  /**
   * 提取关键词（简化版：按空格和常见停用词分割）
   */
  _extractKeywords(text) {
    if (!text) return [];
    
    // 转小写，移除标点
    const clean = text.toLowerCase()
      .replace(/[，。！？、：；""''（）【】\s]+/g, ' ')
      .replace(/\d+/g, '') // 移除数字
      .trim();
    
    // 中文分词（简单按字符切分，也可引入 jieba）
    const words = clean.split(' ').filter(w => w.length > 0);
    
    // 停用词过滤
    const stopWords = ['的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这'];
    const keywords = words.filter(w => !stopWords.includes(w));
    
    return keywords;
  }

  /**
   * 计算简单相关性得分（关键词重叠度）
   */
  _calculateScore(text, keywords) {
    if (!keywords.length) return 0;
    
    const textLower = text.toLowerCase();
    let matches = 0;
    
    for (const kw of keywords) {
      if (textLower.includes(kw)) {
        matches += 1;
        // 完全匹配权重更高
        if (textLower === kw) matches += 2;
      }
    }
    
    return matches / keywords.length;
  }

  /**
   * 添加新题目（动态更新题库）
   */
  addQuestion(question) {
    this.questionBank.push({
      id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      ...question,
      created_at: new Date().toISOString()
    });
    
    // 持久化（可选）
    this._persist();
  }

  /**
   * 添加知识点
   */
  addKnowledgePoint(kp) {
    this.knowledgePoints.push({
      id: `kp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      ...kp,
      created_at: new Date().toISOString()
    });
    
    this._persist();
  }

  /**
   * 持久化到文件（用于动态添加后保存）
   */
  async _persist() {
    try {
      fs.writeFileSync(
        this.config.questionFile,
        JSON.stringify(this.questionBank, null, 2)
      );
      fs.writeFileSync(
        this.config.knowledgeFile,
        JSON.stringify(this.knowledgePoints, null, 2)
      );
    } catch (error) {
      console.error('[SimpleRetriever] 持久化失败:', error);
    }
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      knowledge_points: this.knowledgePoints.length,
      questions: this.questionBank.length,
      loaded: this._loaded
    };
  }
}

module.exports = SimpleRetriever;
