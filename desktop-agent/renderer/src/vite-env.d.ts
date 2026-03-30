// 全局类型声明
interface User {
  id: string;
  open_id: string;
  name: string;
  avatar?: string;
  department?: string;
}

interface Task {
  id: string;
  day_number: number;
  knowledge_point: string;
  estimated_minutes: number;
  points_available: number;
  streak: number;
  questions: Question[];
}

interface Question {
  id: string;
  content: string;
  options: string[];
  correct_answer: string;
  explanation: string;
  knowledge_points: string[];
  difficulty: number;
}

declare global {
  interface Window {
    electronAPI?: {
      getUserInfo: () => Promise<User | null>;
      getTodayTask: () => Promise<Task | null>;
      submitAnswer: (answer: any) => Promise<any>;
      syncData: () => Promise<any>;
      getStats: () => Promise<any>;
      onNotification: (callback: (notification: any) => void) => void;
    };
  }
}

export {};
