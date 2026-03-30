import { contextBridge, ipcRenderer } from 'electron';

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 用户相关
  getUserInfo: () => ipcRenderer.invoke('get-user-info'),
  
  // 任务相关
  getTodayTask: () => ipcRenderer.invoke('get-today-task'),
  submitAnswer: (answer: any) => ipcRenderer.invoke('submit-answer', answer),
  
  // 同步
  syncData: () => ipcRenderer.invoke('sync-data'),
  
  // 统计
  getStats: () => ipcRenderer.invoke('get-stats'),
  
  // 通知
  onNotification: (callback: (notification: any) => void) => {
    ipcRenderer.on('notification', (_, notification) => callback(notification));
  },
});

// 类型声明 (供 TypeScript 使用)
declare global {
  interface Window {
    electronAPI: {
      getUserInfo: () => Promise<any>;
      getTodayTask: () => Promise<any>;
      submitAnswer: (answer: any) => Promise<any>;
      syncData: () => Promise<any>;
      getStats: () => Promise<any>;
      onNotification: (callback: (notification: any) => void) => void;
    };
  }
}
