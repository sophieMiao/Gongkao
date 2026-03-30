import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_INFO: 'user_info',
  TASK_CACHE: 'task_cache',
  ANSWER_QUEUE: 'answer_queue', // 离线答题队列
  SETTINGS: 'settings',
};

export const storage = {
  // 通用存取
  get: async (key: string): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error(`Failed to get ${key}:`, error);
      return null;
    }
  },

  set: async (key: string, value: string): Promise<boolean> => {
    try {
      await AsyncStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.error(`Failed to set ${key}:`, error);
      return false;
    }
  },

  remove: async (key: string): Promise<boolean> => {
    try {
      await AsyncStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Failed to remove ${key}:`, error);
      return false;
    }
  },

  clear: async (): Promise<boolean> => {
    try {
      await AsyncStorage.clear();
      return true;
    } catch (error) {
      console.error('Failed to clear storage:', error);
      return false;
    }
  },

  // Token 管理
  getToken: async (): Promise<string | null> => {
    return await storage.get(STORAGE_KEYS.ACCESS_TOKEN);
  },

  setToken: async (token: string): Promise<boolean> => {
    return await storage.set(STORAGE_KEYS.ACCESS_TOKEN, token);
  },

  removeToken: async (): Promise<boolean> => {
    return await storage.remove(STORAGE_KEYS.ACCESS_TOKEN);
  },

  // 用户信息
  getUserInfo: async (): Promise<any | null> => {
    const data = await storage.get(STORAGE_KEYS.USER_INFO);
    return data ? JSON.parse(data) : null;
  },

  setUserInfo: async (user: any): Promise<boolean> => {
    return await storage.set(STORAGE_KEYS.USER_INFO, JSON.stringify(user));
  },

  removeUserInfo: async (): Promise<boolean> => {
    return await storage.remove(STORAGE_KEYS.USER_INFO);
  },

  // 任务缓存
  getTaskCache: async (): Promise<any | null> => {
    const data = await storage.get(STORAGE_KEYS.TASK_CACHE);
    return data ? JSON.parse(data) : null;
  },

  setTaskCache: async (task: any): Promise<boolean> => {
    return await storage.set(STORAGE_KEYS.TASK_CACHE, JSON.stringify(task));
  },

  // 离线答题队列
  getAnswerQueue: async (): Promise<any[]> => {
    const data = await storage.get(STORAGE_KEYS.ANSWER_QUEUE);
    return data ? JSON.parse(data) : [];
  },

  addToAnswerQueue: async (answer: any): Promise<boolean> => {
    const queue = await storage.getAnswerQueue();
    queue.push({ ...answer, timestamp: Date.now() });
    return await storage.set(STORAGE_KEYS.ANSWER_QUEUE, JSON.stringify(queue));
  },

  clearAnswerQueue: async (): Promise<boolean> => {
    return await storage.remove(STORAGE_KEYS.ANSWER_QUEUE);
  },

  // 设置
  getSettings: async (): Promise<any> => {
    const data = await storage.get(STORAGE_KEYS.SETTINGS);
    return data ? JSON.parse(data) : {
      reminderEnabled: true,
      reminderTime: '08:00',
      notificationEnabled: true,
    };
  },

  setSettings: async (settings: any): Promise<boolean> => {
    return await storage.set(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  },
};

export default storage;
