# BM25 检索实现

const natural = require('natural');
const { stopwords } = require('natural');

class BM25Index {
  constructor() {
    this.tokenizer = new natural.WordTokenizer();
    this.bm25 = new natural.BM25();
    this.documents = [];
  }

  /**
   * 添加文档
   * @param {Array} docs - [{ id, content, ...metadata }]
   */
  addDocuments(docs) {
    this.documents = docs;
    
    // 分词并添加到 BM25
    docs.forEach(doc => {
      const tokens = this.tokenizer.tokenize(doc.content.toLowerCase());
      // 去除停用词
      const filtered = tokens.filter(t => !stopwords.includes(t));
      this.bm25.add(tokens, doc);
    });
  }

  /**
   * 搜索
   * @param {string} query - 查询文本
   * @param {number} limit - 返回数量
   */
  search(query, limit = 10) {
    const tokens = this.tokenizer.tokenize(query.toLowerCase());
    const filtered = tokens.filter(t => !stopwords.includes(t));
    
    const results = this.bm25.getRankedDocuments(filtered, (doc) => {
      return doc.content;
    });
    
    return results
      .slice(0, limit)
      .map((doc, index) => ({
        id: doc.id,
        score: doc.score,
        content: doc.content,
        metadata: doc,
        rank: index
      }));
  }

  /**
   * 清除索引
   */
  clear() {
    this.bm25 = new natural.BM25();
    this.documents = [];
  }
}

module.exports = BM25Index;
