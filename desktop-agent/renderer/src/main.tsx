import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// 检查是否在 Electron 环境中
const isElectron = () => {
  return window && (window as any).electronAPI;
};

// 初始化应用
async function init() {
  // 如果是 Electron，可以获取用户信息等
  if (isElectron()) {
    try {
      const userInfo = await (window as any).electronAPI.getUserInfo();
      console.log('User info from main:', userInfo);
      // 将用户信息保存到 localStorage 或状态管理
      localStorage.setItem('user_info', JSON.stringify(userInfo));
    } catch (error) {
      console.error('Failed to get user info:', error);
    }
  }

  // 渲染 React 应用
  const root = ReactDOM.createRoot(document.getElementById('root')!);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

// DOM 加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
