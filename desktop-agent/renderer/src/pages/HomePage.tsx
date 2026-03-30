import React from 'react';
import { Link } from 'react-router-dom';

interface HomePageProps {
  user: any;
}

export default function HomePage({ user }: HomePageProps) {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1>📚 考公学习伴侣</h1>
        <p>你好，{user?.name || '用户'}！</p>
      </div>

      <div style={styles.welcomeCard}>
        <h2>欢迎回来</h2>
        <p>今天的学习任务已准备就绪，点击下方按钮开始学习。</p>
        <Link to="/task" style={styles.button}>
          开始今日任务
        </Link>
      </div>

      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statValue}>15</div>
          <div style={styles.statLabel}>学习天数</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>127</div>
          <div style={styles.statLabel}>答题数</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>78%</div>
          <div style={styles.statLabel}>正确率</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>1,850</div>
          <div style={styles.statLabel}>总积分</div>
        </div>
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    flex: 1,
    padding: '20px',
    paddingBottom: '80px',
  },
  header: {
    textAlign: 'center',
    marginBottom: '30px',
  },
  welcomeCard: {
    background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    color: 'white',
    padding: '30px',
    borderRadius: '16px',
    marginBottom: '30px',
    textAlign: 'center',
  },
  button: {
    display: 'inline-block',
    marginTop: '20px',
    padding: '12px 30px',
    background: 'white',
    color: '#4facfe',
    borderRadius: '25px',
    textDecoration: 'none',
    fontWeight: '600',
    fontSize: '16px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '15px',
  },
  statCard: {
    background: 'white',
    padding: '20px',
    borderRadius: '12px',
    textAlign: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  statValue: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#4facfe',
  },
  statLabel: {
    fontSize: '14px',
    color: '#666',
    marginTop: '5px',
  },
};
