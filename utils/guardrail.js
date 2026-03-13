/**
 * Guardrail - 安全拦截系统
 * 防止恶意输入、敏感内容、注入攻击
 */

class Guardrail {
  constructor(config = {}) {
    this.config = {
      enabled: true,
      sensitiveWords: config.sensitiveWords || [],
      maxInputLength: 10000,
      maxTokensPerRequest: 4000,
      allowDomains: config.allowDomains || [], // 白名单域名
      ...config
    };
    
    // 加载敏感词库
    this.sensitiveWords = this._loadSensitiveWords();
    
    // 统计
    this.stats = {
      blocked: 0,
      warnings: 0
    };
  }

  /**
   * 检查用户输入
   * @returns {Promise<{safe: boolean, reason?: string, sanitized?: string}>}
   */
  async checkInput(text, context = {}) {
    if (!this.config.enabled) {
      return { safe: true, sanitized: text };
    }

    // 1. 长度检查
    if (text.length > this.config.maxInputLength) {
      this.stats.blocked++;
      return {
        safe: false,
        reason: `输入过长（最大${this.config.maxInputLength}字符）`
      };
    }

    // 2. 敏感词检测
    const sensitiveCheck = this._checkSensitiveWords(text);
    if (!sensitiveCheck.pass) {
      this.stats.blocked++;
      return {
        safe: false,
        reason: '包含敏感内容',
        details: sensitiveCheck.matches
      };
    }

    // 3. Prompt 注入检测
    const injectionCheck = this._checkPromptInjection(text);
    if (!injectionCheck.pass) {
      this.stats.blocked++;
      return {
        safe: false,
        reason: '检测到可能的注入攻击',
        details: injectionCheck.patterns
      };
    }

    // 4. 内容安全审核（调用第三方API或本地模型）
    const safetyCheck = await this._contentSafetyCheck(text);
    if (!safetyCheck.safe) {
      this.stats.blocked++;
      return {
        safe: false,
        reason: '内容不符合安全规范',
        details: safetyCheck.categories
      };
    }

    // 5. 输入清洗（移除潜在危险字符）
    const sanitized = this._sanitize(text);

    return { safe: true, sanitized };
  }

  /**
   * 检查输出（AI生成的内容）
   */
  async checkOutput(text, context = {}) {
    if (!this.config.enabled) {
      return { safe: true, sanitized: text };
    }

    // 类似检查逻辑
    const sensitiveCheck = this._checkSensitiveWords(text);
    if (!sensitiveCheck.pass) {
      this.stats.blocked++;
      return { safe: false, reason: '输出包含敏感内容' };
    }

    const sanitized = this._sanitize(text);
    return { safe: true, sanitized };
  }

  /**
   * 敏感词检测
   */
  _checkSensitiveWords(text) {
    const matches = [];
    for (const word of this.sensitiveWords) {
      if (text.includes(word)) {
        matches.push(word);
      }
    }
    
    return {
      pass: matches.length === 0,
      matches
    };
  }

  /**
   * Prompt 注入检测
   * 检测常见的注入模式：忽略指令、系统提示注入等
   */
  _checkPromptInjection(text) {
    const patterns = [
      /忽略.*指令/,
      /ignore.*instructions?/i,
      /system:\s*/,
      /你变成了/,
      /你是一个新的/,
      /忘记.*之前/,
      /不要.*遵循/,
      /角色扮演/,
      / pretend /i,
      /act as /i,
      /<\|im_start\|>/,  // 某些模型的特殊token
      /\[系统\]/,
      /\[SYSTEM\]/
    ];

    const matched = patterns.filter(p => p.test(text));
    
    return {
      pass: matched.length === 0,
      patterns: matched.map(p => p.toString())
    };
  }

  /**
   * 内容安全审核（调用百度/阿里内容审核API或本地模型）
   */
  async _contentSafetyCheck(text) {
    // TODO: 集成真实的内容审核服务
    
    // 简单规则：检测明显的不当言论
    const unsafePatterns = [
      /暴力/,
      /色情/,
      /反动/,
      /恐怖/,
      /赌博/,
      /毒品/
    ];
    
    const matched = unsafePatterns.filter(p => p.test(text));
    
    return {
      safe: matched.length === 0,
      categories: matched
    };
  }

  /**
   * 输入清洗
   */
  _sanitize(text) {
    // 移除潜在的 HTML/JS 标签（虽然我们是文本应用）
    let sanitized = text.replace(/<script\b[^<]*>(.*?)<\/script>/gi, '');
    sanitized = sanitized.replace(/<[^>]+>/g, '');
    
    // 移除控制字符
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
    
    return sanitized.trim();
  }

  /**
   * 加载敏感词库（从文件或数据库）
   */
  _loadSensitiveWords() {
    // 基础敏感词（实际应从配置文件或数据库加载）
    const baseWords = [
      '反动',
      '色情',
      '暴力',
      '恐怖',
      '赌博',
      '毒品',
      '诈骗',
      '谣言'
    ];
    
    // 合并配置的敏感词
    return [...new Set([...baseWords, ...this.config.sensitiveWords])];
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * 重置统计
   */
  resetStats() {
    this.stats = { blocked: 0, warnings: 0 };
  }
}

module.exports = Guardrail;
