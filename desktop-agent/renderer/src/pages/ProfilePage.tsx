import React from 'react';
import { Link } from 'react-router-dom';

interface ProfilePageProps {
  user: any;
}

export default function ProfilePage({ user }: ProfilePageProps) {
  const menuItems = [
    { icon: '📚', label: '我的学习计划', onClick: () => {} },
    { icon: '📝', label: '错题本', onClick: () => {} },
    { icon: '🎯', label: '目标设置', onClick: () => {} },
    { icon: '🔔', label: '提醒设置', onClick: () => {} },
    { icon: '⚙️', label: '偏好设置', onClick: () => {} },
    { icon: '📖', label: '使用帮助', onClick: () => {} },
    { icon: 'ℹ️', label: '关于', onClick: () => {} },
  ];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.avatar}>
          {user?.avatar ? (
            <img src={user.avatar} alt="avatar" style={styles.avatarImage} />
          ) : (
            <div style={styles.avatarPlaceholder}>
              {user?.name?.charAt(0) || 'U'}
            </div>
          )}
        </div>
        <h2 style={styles.userName}>{user?.name || '未登录'}</h2>
        <p style={styles.userDept}>{user?.department || '点击登录'}</p>
      </div>

      <div style={styles.statsRow}>
        <div style={styles.statItem}>
          <div style={styles.statValue}>15</div>
          <div style={styles.statLabel}>学习天数</div>
        </div>
        <div style={styles.statItem}>
          <div style={styles.statValue}>127</div>
          <div style={styles.statLabel}>答题数</div>
        </div>
        <div style={styles.statItem}>
          <div style={styles.statValue}>78%</div>
          <div style={styles.statLabel}>正确率</div>
        </div>
      </div>

      <div style={styles.menuContainer}>
        {menuItems.map((item, idx) => (
          <div
            key={idx}
            style={styles.menuItem}
            onClick={item.onClick}
          >
            <span style={styles.menuIcon}>{item.icon}</span>
            <span style={styles.menuLabel}>{item.label}</span>
            <span style={styles.menuArrow}>›</span>
          </div>
        ))}
      </div>

      <div style={styles.footer}>
        <p>版本 2.0.0-enhanced</p>
        <p style={{ fontSize: '12px', marginTop: '4px' }}>基于 Electron 构建</p>
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
    paddingBottom: '80px',
  },
  header: {
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: 'white',
    padding: '30px 20px',
    alignItems: 'center',
  },
  avatar: {
    marginBottom: '15px',
  },
  avatarImage: {
    width: '80px',
    height: '80px',
    borderRadius: '40px',
  },
  avatarPlaceholder: {
    width: '80px',
    height: '80px',
    borderRadius: '40px',
    background: '#4facfe',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '32px',
    color: 'white',
    fontWeight: 'bold',
  },
  userName: {
    fontSize: '22px',
    fontWeight: 'bold',
    marginBottom: '5px',
  },
  userDept: {
    fontSize: '14px',
    opacity: 0.9,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingVertical: '15px',
    marginBottom: '15px',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#f0f0f0',
  },
  statValue: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: '12px',
    color: '#666',
    marginTop: '4px',
  },
  menuContainer: {
    backgroundColor: 'white',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: '15px',
    paddingHorizontal: '20px',
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
    cursor: 'pointer',
  },
  menuIcon: {
    fontSize: '24px',
    marginRight: '15px',
  },
  menuLabel: {
    flex: 1,
    fontSize: '16px',
    color: '#333',
  },
  menuArrow: {
    fontSize: '24px',
    color: '#ccc',
  },
  footer: {
    textAlign: 'center',
    padding: '20px',
    color: '#999',
    fontSize: '12px',
  },
};
