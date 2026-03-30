import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage';
import TaskPage from './pages/TaskPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';

// 声明 window.electronAPI 类型
declare global {
  interface Window {
    electronAPI?: {
      getUserInfo: () => Promise<any>;
      getTodayTask: () => Promise<any>;
      submitAnswer: (answer: any) => Promise<any>;
      syncData: () => Promise<any>;
      getStats: () => Promise<any>;
    };
  }
}

const navigation = [
  { name: '首页', href: '/', icon: '🏠' },
  { name: '任务', href: '/task', icon: '📝' },
  { name: '数据', href: '/dashboard', icon: '📊' },
  { name: '我的', href: '/profile', icon: '👤' },
];

function Navigation() {
  const location = useLocation();
  
  return (
    <nav style={styles.nav}>
      {navigation.map((item) => {
        const isActive = location.pathname === item.href;
        return (
          <Link
            key={item.name}
            to={item.href}
            style={{
              ...styles.navItem,
              ...(isActive ? styles.navItemActive : {}),
            }}
          >
            <span style={styles.navIcon}>{item.icon}</span>
            <span style={styles.navLabel}>{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 初始化：获取用户信息
    const initApp = async () => {
      try {
        // 优先从 localStorage 获取
        const cachedUser = localStorage.getItem('user_info');
        if (cachedUser) {
          setUser(JSON.parse(cachedUser));
        }

        // 如果 electron API 可用，从主进程获取
        if (window.electronAPI) {
          const mainUser = await window.electronAPI.getUserInfo();
          if (mainUser) {
            setUser(mainUser);
            localStorage.setItem('user_info', JSON.stringify(mainUser));
          }
        }
      } catch (error) {
        console.error('Init app failed:', error);
      } finally {
        setLoading(false);
      }
    };

    initApp();
  }, []);

  if (loading) {
    return (
      <div style={styles.loading}>
        <div>加载中...</div>
      </div>
    );
  }

  return (
    <Router>
      <div style={styles.app}>
        <Routes>
          <Route path="/" element={<HomePage user={user} />} />
          <Route path="/task" element={<TaskPage user={user} />} />
          <Route path="/dashboard" element={<DashboardPage user={user} />} />
          <Route path="/profile" element={<ProfilePage user={user} />} />
        </Routes>
        <Navigation />
      </div>
    </Router>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  app: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: '#f5f7fa',
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '18px',
    color: '#666',
  },
  nav: {
    display: 'flex',
    justifyContent: 'space-around',
    backgroundColor: 'white',
    borderTop: '1px solid #eee',
    padding: '8px 0',
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
  },
  navItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '8px 16px',
    textDecoration: 'none',
    color: '#666',
    fontSize: '12px',
  },
  navItemActive: {
    color: '#4facfe',
  },
  navIcon: {
    fontSize: '22px',
    marginBottom: '4px',
  },
  navLabel: {
    fontSize: '12px',
  },
};
