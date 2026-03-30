import React, { useState, useEffect } from 'react';

interface DashboardPageProps {
  user: any;
}

export default function DashboardPage({ user }: DashboardPageProps) {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      let data;
      if (window.electronAPI) {
        data = await window.electronAPI.getStats();
      } else {
        // 模拟数据
        data = {
          totalQuestions: 127,
          correctAnswers: 99,
          accuracy: 78,
          totalTime: 3600,
        };
      }
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  if (!stats) {
    return <div style={styles.container}>加载中...</div>;
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>📊 学习数据</h2>

      <div style={styles.summaryGrid}>
        <div style={styles.summaryCard}>
          <div style={styles.summaryValue}>{stats.totalQuestions}</div>
          <div style={styles.summaryLabel}>答题总数</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryValue}>{stats.correctAnswers}</div>
          <div style={styles.summaryLabel}>答对题数</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryValue}>{stats.accuracy.toFixed(0)}%</div>
          <div style={styles.summaryLabel}>正确率</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryValue}>{Math.floor(stats.totalTime / 60)}分</div>
          <div style={styles.summaryLabel}>学习时长</div>
        </div>
      </div>

      <div style={styles.chartCard}>
        <h3>📈 分数趋势</h3>
        <div style={styles.chartPlaceholder}>
          [图表区域 - 集成 Chart.js 或 ECharts]
          <br />
          显示 30 天分数变化趋势
        </div>
      </div>

      <div style={styles.chartCard}>
        <h3>🎯 知识点掌握</h3>
        <div style={styles.chartPlaceholder}>
          [雷达图 - 知识点掌握度]
          <br />
          数量关系、判断推理、资料分析等
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
    backgroundColor: '#f5f7fa',
  },
  title: {
    textAlign: 'center',
    marginBottom: '20px',
    color: '#333',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '15px',
    marginBottom: '20px',
  },
  summaryCard: {
    background: 'white',
    padding: '20px',
    borderRadius: '12px',
    textAlign: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  summaryValue: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#4facfe',
  },
  summaryLabel: {
    fontSize: '14px',
    color: '#666',
    marginTop: '8px',
  },
  chartCard: {
    background: 'white',
    padding: '20px',
    borderRadius: '12px',
    marginBottom: '15px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  chartPlaceholder: {
    height: '200px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#999',
    background: '#f9f9f9',
    borderRadius: '8px',
    marginTop: '15px',
  },
};
