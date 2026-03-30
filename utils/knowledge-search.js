/**
 * 知识点搜索工具
 * 支持关键词搜索、分类浏览、关联知识点推荐
 */

const fs = require('fs');
const path = require('path');

class KnowledgeSearch {
  constructor(dataPath = './data') {
    this.dataPath = dataPath;
    this.knowledgePoints = [];
    this.questions = [];
    this.index = {}; // 倒排索引
    this.loadData();
  }

  async loadData() {
    try {
      // 加载知识点
      const kpPath = path.join(this.dataPath, 'knowledge_points.json');
      if (fs.existsSync(kpPath)) {
        const data = fs.readFileSync(kpPath, 'utf8');
        this.knowledgePoints = JSON.parse(data);
      }

      // 加载题库（用于统计）
      const qbPath = path.join(this.dataPath, 'question_bank.json');
      if (fs.existsSync(qbPath)) {
        const data = fs.readFileSync(qbPath, 'utf8');
        this.questions = JSON.parse(data);
      }

      // 构建索引
      this.buildIndex();
    } catch (error) {
      console.error('Failed to load knowledge data:', error);
    }
  }

  buildIndex() {
    this.index = {};

    // 为知识点建立索引
    this.knowledgePoints.forEach(kp => {
      this.indexKeywords(kp.id, kp.name);
      this.indexKeywords(kp.id, kp.description || '');
      if (kp.category) {
        this.indexKeywords(kp.id, `category:${kp.category}`);
      }
      if (kp.parentId) {
        this.indexKeywords(kp.id, `parent:${kp.parentId}`);
      }
    });

    // 为题目建立索引（关联知识点）
    this.questions.forEach(q => {
      q.knowledgePoints.forEach(kpId => {
        if (!this.index[kpId]) {
          this.index[kpId] = { documents: [] };
        }
        this.index[kpId].documents.push({
          type: 'question',
          id: q.id,
          content: q.content
        });
      });
    });
  }

  indexKeywords(docId, text) {
    if (!text) return;

    const words = this.tokenize(text);
    words.forEach(word => {
      if (!this.index[word]) {
        this.index[word] = { documents: [] };
      }
      this.index[word].documents.push({ type: 'knowledge_point', id: docId });
    });
  }

  tokenize(text) {
    // 中文分词（简化版）
    return text
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 0);
  }

  /**
   * 关键词搜索
   */
  search(keywords, options = {}) {
    const {
      category = null,
      limit = 20,
      includeQuestions = false
    } = options;

    const keywordTokens = this.tokenize(keywords);
    const scores = {};

    keywordTokens.forEach(token => {
      if (this.index[token]) {
        this.index[token].documents.forEach(doc => {
          if (category && doc.type === 'knowledge_point') {
            const kp = this.knowledgePoints.find(k => k.id === doc.id);
            if (kp && kp.category !== category) return;
          }

          scores[doc.id] = (scores[doc.id] || 0) + 1;
        });
      }
    });

    // 排序并取 top
    const rankedIds = Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(entry => entry[0]);

    // 构建结果
    const results = rankedIds.map(id => {
      const kp = this.knowledgePoints.find(k => k.id === id);
      if (!kp) return null;

      const questionCount = this.questions.filter(q => q.knowledgePoints.includes(id)).length;

      return {
        ...kp,
        question_count: questionCount,
        match_score: scores[id]
      };
    }).filter(Boolean);

    // 如果需要包含题目
    if (includeQuestions) {
      results.forEach(result => {
        result.related_questions = this.questions
          .filter(q => q.knowledgePoints.includes(result.id))
          .slice(0, 5)
          .map(q => ({
            id: q.id,
            content: q.content,
            type: q.type,
            difficulty: q.difficulty
          }));
      });
    }

    return results;
  }

  /**
   * 按分类获取知识点
   */
  getByCategory(category) {
    return this.knowledgePoints
      .filter(kp => kp.category === category)
      .map(kp => ({
        ...kp,
        question_count: this.questions.filter(q => q.knowledgePoints.includes(kp.id)).length
      }));
  }

  /**
   * 获取知识点详情
   */
  getDetail(knowledgeId) {
    const kp = this.knowledgePoints.find(k => k.id === knowledgeId);
    if (!kp) return null;

    const relatedQuestions = this.questions
      .filter(q => q.knowledgePoints.includes(knowledgeId))
      .map(q => ({
        id: q.id,
        content: q.content,
        type: q.type,
        difficulty: q.difficulty,
        answer: q.answer
      }));

    // 查找同级知识点
    const siblings = this.knowledgePoints
      .filter(k => k.parentId === kp.parentId && k.id !== kp.id)
      .map(k => ({ id: k.id, name: k.name }));

    // 查找子知识点
    const children = this.knowledgePoints
      .filter(k => k.parentId === kp.id)
      .map(k => ({ id: k.id, name: k.name }));

    return {
      ...kp,
      siblings,
      children,
      related_questions: relatedQuestions,
      stats: {
        total_questions: relatedQuestions.length,
        avg_difficulty: relatedQuestions.reduce((sum, q) => sum + q.difficulty, 0) / relatedQuestions.length || 0
      }
    };
  }

  /**
   * 知识点路径（父级链）
   */
  getPath(knowledgeId) {
    const path = [];
    let current = this.knowledgePoints.find(k => k.id === knowledgeId);

    while (current) {
      path.unshift(current);
      if (!current.parentId) break;
      current = this.knowledgePoints.find(k => k.id === current.parentId);
    }

    return path;
  }

  /**
   * 推荐学习路径
   */
  recommendPath(startKnowledge, targetKnowledge) {
    // 简单实现：返回从 start 到 target 的路径（如果存在父子关系）
    const startPath = this.getPath(startKnowledge);
    const targetPath = this.getPath(targetKnowledge);

    // 找到最近公共祖先
    let lcaIndex = -1;
    for (let i = 0; i < Math.min(startPath.length, targetPath.length); i++) {
      if (startPath[i].id === targetPath[i].id) {
        lcaIndex = i;
      } else {
        break;
      }
    }

    if (lcaIndex === -1) {
      return {
        success: false,
        message: '知识点之间没有直接关联路径'
      };
    }

    const path = [
      ...startPath.slice(lcaIndex + 1).map(k => ({ id: k.id, name: k.name, direction: 'up' })),
      ...targetPath.slice(lcaIndex).map(k => ({ id: k.id, name: k.name, direction: 'down' }))
    ];

    return {
      success: true,
      path,
      length: path.length
    };
  }

  /**
   * 列出所有分类
   */
  listCategories() {
    const categories = new Set();
    this.knowledgePoints.forEach(kp => {
      if (kp.category) categories.add(kp.category);
    });
    return Array.from(categories).sort();
  }

  /**
   * 刷新数据（热重载）
   */
  async reload() {
    this.knowledgePoints = [];
    this.questions = [];
    this.index = {};
    await this.loadData();
  }
}

module.exports = KnowledgeSearch;
