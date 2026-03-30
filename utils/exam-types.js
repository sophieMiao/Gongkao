/**
 * 考试类型管理
 * 支持多种考试：国考、省考、事业单位、教师招聘等
 */

const EXAM_TYPES = {
  'national': {
    id: 'national',
    name: '国家公务员考试（国考）',
    abbreviation: '国考',
    subjects: [
      { id: '行政职业能力测验', name: '行政职业能力测验', code: '行测' },
      { id: '申论', name: '申论', code: '申论' }
    ],
    score_weights: { '行政职业能力测验': 0.5, '申论': 0.5 },
    passing_line: 120, // 总分及格线
    description: '国家公务员招录考试，包括行测和申论'
  },
  'provincial': {
    id: 'provincial',
    name: '省级公务员考试',
    abbreviation: '省考',
    subjects: [
      { id: '行政职业能力测验', name: '行政职业能力测验', code: '行测' },
      { id: '申论', name: '申论', code: '申论' }
    ],
    score_weights: { '行政职业能力测验': 0.5, '申论': 0.5 },
    passing_line: 110,
    description: '各省公务员招录考试，科目与国考类似但难度略有差异'
  },
  'institution': {
    id: 'institution',
    name: '事业单位考试',
    abbreviation: '事业单位',
    subjects: [
      { id: '职业能力测验', name: '职业能力测验', code: '职测' },
      { id: '综合应用能力', name: '综合应用能力', code: '综应' }
    ],
    score_weights: { '职业能力测验': 0.5, '综合应用能力': 0.5 },
    passing_line: 100,
    description: '事业单位工作人员招聘考试'
  },
  'teacher': {
    id: 'teacher',
    name: '教师招聘考试',
    abbreviation: '教师招聘',
    subjects: [
      { id: '教育基础知识', name: '教育基础知识', code: '教基' },
      { id: '学科专业知识', name: '学科专业知识', code: '学科' },
      { id: '公共基础知识', name: '公共基础知识', code: '公基' }
    ],
    score_weights: { '教育基础知识': 0.4, '学科专业知识': 0.4, '公共基础知识': 0.2 },
    passing_line: 90,
    description: '中小学、幼儿园教师招聘考试'
  }
};

/**
 * 获取考试类型列表
 */
function getExamTypes() {
  return Object.values(EXAM_TYPES).map(type => ({
    id: type.id,
    name: type.name,
    abbreviation: type.abbreviation,
    description: type.description
  }));
}

/**
 * 获取考试类型详情
 */
function getExamTypeDetail(examTypeId) {
  return EXAM_TYPES[examTypeId] || null;
}

/**
 * 根据用户目标获取推荐的考试类型
 */
function recommendExamType(userProfile) {
  const { target_position, education_background, work_location } = userProfile;

  // 简单的推荐逻辑
  if (target_position.includes('公务员')) {
    if (work_location === 'central' || work_location === '国家') {
      return 'national';
    }
    return 'provincial';
  }

  if (target_position.includes('事业单位')) {
    return 'institution';
  }

  if (target_position.includes('教师')) {
    return 'teacher';
  }

  // 默认推荐省考
  return 'provincial';
}

/**
 * 计算目标分数（基于考试类型）
 */
function calculateTargetScore(examTypeId, currentLevel = 'medium') {
  const examType = getExamTypeDetail(examTypeId);
  if (!examType) return null;

  const baseScore = examType.passing_line;
  const difficultyMultipliers = {
    easy: 1.2,
    medium: 1.1,
    hard: 1.0
  };

  return Math.round(baseScore * difficultyMultipliers[currentLevel] || 1.1);
}

/**
 * 验证目标分数是否合理
 */
function validateTargetScore(examTypeId, targetScore) {
  const examType = getExamTypeDetail(examTypeId);
  if (!examType) {
    return { valid: false, error: 'Invalid exam type' };
  }

  const maxScore = 200; // 假设满分200
  if (targetScore < 0 || targetScore > maxScore) {
    return { valid: false, error: `目标分数必须在 0-${maxScore} 之间` };
  }

  if (targetScore < examType.passing_line) {
    return {
      valid: true,
      warning: `目标分数低于及格线 ${examType.passing_line} 分`
    };
  }

  return { valid: true };
}

module.exports = {
  EXAM_TYPES,
  getExamTypes,
  getExamTypeDetail,
  recommendExamType,
  calculateTargetScore,
  validateTargetScore
};
