// 基础类型定义

declare module 'openclaw' {
  interface OpenClaw {
    loadSkills(): Promise<void>;
    getSkill(name: string): Skill | null;
  }

  interface Skill {
    [action: string]: (context: SkillContext, params: any) => Promise<any>;
  }

  interface SkillContext {
    tools: {
      [toolName: string]: (...args: any[]) => Promise<any>;
    };
    session: {
      get: (key: string) => any;
      set: (key: string, value: any) => void;
    };
  }
}

// 用户相关
interface User {
  id: string;
  open_id: string;
  name: string;
  avatar?: string;
  department?: string;
}

// 学习任务
interface DailyTask {
  id: string;
  userId: string;
  date: string;
  tasks: TaskItem[];
  completed: boolean;
  score?: number;
  duration?: number;
  mood?: 'great' | 'good' | 'neutral' | 'bad' | 'terrible';
}

interface TaskItem {
  knowledgePoint: string;
  questionCount: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  estimatedMinutes: number;
}

// 题目
interface Question {
  id: string;
  content: string;
  type: 'choice' | 'fill' | 'essay';
  options?: string[];
  answer: string;
  explanation: string;
  knowledgePoints: string[];
  difficulty: number; // 0-1
  source: 'bank' | 'ai';
}

// 知识点
interface KnowledgePoint {
  id: string;
  name: string;
  category: string;
  description?: string;
  parentId?: string;
}

// API 响应
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 飞书消息
interface FeishuMessage {
  msg_type: 'text' | 'post' | 'interactive';
  content: any;
  receive_id: string;
  receive_id_type: 'open_id' | 'chat_id';
}

// 环境变量
interface EnvConfig {
  STEPFUN_API_KEY: string;
  FEISHU_APP_ID: string;
  FEISHU_APP_SECRET: string;
  FEISHU_VERIFICATION_TOKEN: string;
  POSTGRES_PASSWORD: string;
  APP_URL?: string;
  PORT?: number;
  DATABASE_URL?: string;
  REDIS_URL?: string;
}
