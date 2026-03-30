import axios from 'axios';
import { API_BASE_URL } from '../constants';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器（添加 Token）
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token'); // RN 中需用 AsyncStorage
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器（错误处理）
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      // Token 过期，跳转登录
      localStorage.removeItem('access_token');
      // 导航到登录页
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (code: string) => api.post('/api/v1/auth/login', { code }),
  logout: () => api.post('/api/v1/auth/logout'),
  refresh: (refreshToken: string) => api.post('/api/v1/auth/refresh', { refresh_token: refreshToken }),
};

export const taskApi = {
  getTodayTask: (userId: string) => api.get(`/api/v1/tasks/today?user_id=${userId}`),
  submitAnswer: (taskId: string, answer: { user_answer: string; time_spent_seconds: number }) =>
    api.post(`/api/v1/tasks/${taskId}/answer`, answer),
  skipQuestion: (taskId: string) => api.post(`/api/v1/tasks/${taskId}/skip`),
  getTaskHistory: (userId: string, limit?: number) =>
    api.get(`/api/v1/tasks/history?user_id=${userId}&limit=${limit || 20}`),
};

export const statsApi = {
  getDailyProgress: (userId: string, taskId?: string) =>
    api.get(`/api/v1/stats/daily?user_id=${userId}${taskId ? `&task_id=${taskId}` : ''}`),
  getKnowledgeMastery: (userId: string) => api.get(`/api/v1/stats/knowledge?user_id=${userId}`),
  getTimeDistribution: (userId: string, period: 'week' | 'month' = 'week') =>
    api.get(`/api/v1/stats/time-distribution?user_id=${userId}&period=${period}`),
  getScoreTrend: (userId: string, days: number = 30) =>
    api.get(`/api/v1/stats/score-trend?user_id=${userId}&days=${days}`),
};

export const userApi = {
  getProfile: (userId: string) => api.get(`/api/v1/users/${userId}`),
  updateProfile: (userId: string, data: any) => api.patch(`/api/v1/users/${userId}`, data),
  getPreferences: (userId: string) => api.get(`/api/v1/users/${userId}/preferences`),
  updatePreferences: (userId: string, preferences: any) =>
    api.patch(`/api/v1/users/${userId}/preferences`, preferences),
};

export default api;
