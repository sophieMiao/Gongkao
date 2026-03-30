// 基础类型定义

export interface User {
  id: string;
  open_id: string;
  name: string;
  avatar?: string;
  department?: string;
}

export interface Task {
  id: string;
  day_number: number;
  knowledge_point: string;
  estimated_minutes: number;
  points_available: number;
  streak: number;
  questions: Question[];
}

export interface Question {
  id: string;
  content: string;
  options: string[];
  correct_answer: string;
  explanation: string;
  knowledge_points: string[];
  difficulty: number;
}

export interface Answer {
  questionId: string;
  userAnswer: string;
  isCorrect: boolean;
  timeSpentSeconds: number;
}

export interface DailyStats {
  date: string;
  totalQuestions: number;
  correctAnswers: number;
  pointsEarned: number;
  timeSpentMinutes: number;
}

export interface KnowledgePointMastery {
  id: string;
  name: string;
  mastered: number;
  total: number;
  percentage: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
