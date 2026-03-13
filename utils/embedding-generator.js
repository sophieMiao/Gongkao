# Embedding 生成器

const { OpenAI } = require('openai');
const { PythonShell } = require('python-shell');

class EmbeddingGenerator {
  constructor() {
    this.provider = process.env.EMBEDDING_PROVIDER || 'openai'; // openai/stepfun/local
    this.model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
    
    if (this.provider === 'openai') {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }
  }

  /**
   * 生成单个文本的 embedding
   */
  async generate(text) {
    switch (this.provider) {
      case 'openai':
        return await this._generateOpenAI(text);
      case 'stepfun':
        return await this._generateStepFun(text);
      case 'local':
        return await this._generateLocal(text);
      default:
        throw new Error(`Unknown embedding provider: ${this.provider}`);
    }
  }

  /**
   * 批量生成（提高效率）
   */
  async generateBatch(texts) {
    const results = [];
    const batchSize = 10; // API 限制
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const embeddings = await this._generateBatch(batch);
      results.push(...embeddings);
    }
    
    return results;
  }

  async _generateOpenAI(text) {
    const response = await this.openai.embeddings.create({
      model: this.model,
      input: text
    });
    
    return response.data[0].embedding;
  }

  async _generateBatch(texts) {
    const response = await this.openai.embeddings.create({
      model: this.model,
      input: texts
    });
    
    return response.data.map(d => d.embedding);
  }

  async _generateStepFun(text) {
    // StepFun 暂时没有 embedding API，可以使用兼容 OpenAI 的接口
    // 或者使用其他方案
    throw new Error('StepFun embedding not yet supported');
  }

  async _generateLocal(text) {
    // 使用 Python 的 sentence-transformers
    return new Promise((resolve, reject) => {
      const pyshell = new PythonShell('embedding_local.py', {
        mode: 'text',
        pythonPath: 'python3'
      });
      
      pyshell.send(text);
      pyshell.end(err => {
        if (err) reject(err);
      });
      
      pyshell.on('message', (message) => {
        try {
          const result = JSON.parse(message);
          resolve(result.embedding);
        } catch (e) {
          reject(e);
        }
      });
    });
  }
}

module.exports = EmbeddingGenerator;
