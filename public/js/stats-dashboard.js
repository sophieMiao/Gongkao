/**
 * 学习数据仪表板组件
 * 提供多种图表展示学习进度、知识点掌握、时间分布等
 */

class StatsDashboard {
  constructor() {
    this.charts = {};
    this.data = {
      dailyProgress: [],
      knowledgeMastery: [],
      timeDistribution: [],
      scoreTrend: []
    };
  }

  /**
   * 初始化仪表板
   */
  async init(userId, taskId) {
    await this.fetchData(userId, taskId);
    this.renderAllCharts();
    this.startAutoRefresh(60000); // 每分钟自动刷新
  }

  /**
   * 从后端获取数据
   */
  async fetchData(userId, taskId) {
    try {
      // 获取今日进度
      const progressRes = await fetch(`/api/v1/stats/daily?user_id=${userId}&task_id=${taskId}`);
      if (progressRes.ok) {
        this.data.dailyProgress = await progressRes.json();
      }

      // 获取知识点掌握情况
      const masteryRes = await fetch(`/api/v1/stats/knowledge?user_id=${userId}`);
      if (masteryRes.ok) {
        this.data.knowledgeMastery = await masteryRes.json();
      }

      // 获取学习时间分布
      const timeRes = await fetch(`/api/v1/stats/time-distribution?user_id=${userId}&period=week`);
      if (timeRes.ok) {
        this.data.timeDistribution = await timeRes.json();
      }

      // 获取分数趋势
      const scoreRes = await fetch(`/api/v1/stats/score-trend?user_id=${userId}&period=30`);
      if (scoreRes.ok) {
        this.data.scoreTrend = await scoreRes.json();
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      // 使用模拟数据
      this.loadMockData();
    }
  }

  /**
   * 加载模拟数据（用于演示）
   */
  loadMockData() {
    this.data.dailyProgress = [
      { time: '08:00', correct: 2, total: 3 },
      { time: '10:00', correct: 5, total: 7 },
      { time: '14:00', correct: 3, total: 4 },
      { time: '16:00', correct: 4, total: 5 },
      { time: '20:00', correct: 6, total: 8 }
    ];

    this.data.knowledgeMastery = [
      { name: '数量关系', mastered: 75, total: 100 },
      { name: '判断推理', mastered: 60, total: 80 },
      { name: '资料分析', mastered: 85, total: 90 },
      { name: '言语理解', mastered: 55, total: 70 },
      { name: '常识判断', mastered: 40, total: 60 }
    ];

    this.data.timeDistribution = [
      { period: '早晨', minutes: 25 },
      { period: '上午', minutes: 40 },
      { period: '下午', minutes: 30 },
      { period: '晚上', minutes: 35 }
    ];

    this.data.scoreTrend = [
      { date: '03-01', score: 65 },
      { date: '03-05', score: 68 },
      { date: '03-10', score: 72 },
      { date: '03-15', score: 75 },
      { date: '03-20', score: 78 },
      { date: '03-25', score: 80 },
      { date: '03-30', score: 83 }
    ];
  }

  /**
   * 渲染所有图表
   */
  renderAllCharts() {
    this.renderProgressChart();
    this.renderKnowledgeChart();
    this.renderTimeDistributionChart();
    this.renderScoreTrendChart();
  }

  /**
   * 渲染进度趋势图
   */
  renderProgressChart() {
    const ctx = document.getElementById('progress-chart');
    if (!ctx) return;

    if (this.charts.progress) {
      this.charts.progress.destroy();
    }

    const labels = this.data.dailyProgress.map(p => p.time);
    const correctData = this.data.dailyProgress.map(p => p.correct);
    const totalData = this.data.dailyProgress.map(p => p.total);

    this.charts.progress = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: '正确题数',
            data: correctData,
            borderColor: '#4caf50',
            backgroundColor: 'rgba(76, 175, 80, 0.1)',
            fill: true,
            tension: 0.4
          },
          {
            label: '总题数',
            data: totalData,
            borderColor: '#2196f3',
            backgroundColor: 'rgba(33, 150, 243, 0.1)',
            fill: true,
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          title: {
            display: true,
            text: '今日学习进度'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1 }
          }
        }
      }
    });
  }

  /**
   * 渲染知识点掌握图（雷达图）
   */
  renderKnowledgeChart() {
    const ctx = document.getElementById('knowledge-chart');
    if (!ctx) return;

    if (this.charts.knowledge) {
      this.charts.knowledge.destroy();
    }

    const labels = this.data.knowledgeMastery.map(k => k.name);
    const masteredData = this.data.knowledgeMastery.map(k => (k.mastered / k.total) * 100);
    const totalData = this.data.knowledgeMastery.map(k => 100);

    this.charts.knowledge = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: labels,
        datasets: [
          {
            label: '掌握度',
            data: masteredData,
            borderColor: '#4caf50',
            backgroundColor: 'rgba(76, 175, 80, 0.2)',
            pointBackgroundColor: '#4caf50'
          },
          {
            label: '目标',
            data: totalData,
            borderColor: '#ff9800',
            backgroundColor: 'rgba(255, 152, 0, 0.1)',
            borderDash: [5, 5]
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          title: {
            display: true,
            text: '知识点掌握情况'
          }
        },
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: value => value + '%'
            }
          }
        }
      }
    });
  }

  /**
   * 渲染时间分布图（饼图）
   */
  renderTimeDistributionChart() {
    const ctx = document.getElementById('time-distribution-chart');
    if (!ctx) return;

    if (this.charts.timeDistribution) {
      this.charts.timeDistribution.destroy();
    }

    const labels = this.data.timeDistribution.map(t => t.period);
    const data = this.data.timeDistribution.map(t => t.minutes);

    this.charts.timeDistribution = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: [
            '#4facfe',
            '#00f2fe',
            '#667eea',
            '#764ba2'
          ],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          title: {
            display: true,
            text: '学习时间分布'
          }
        }
      }
    });
  }

  /**
   * 渲染分数趋势图（折线图）
   */
  renderScoreTrendChart() {
    const ctx = document.getElementById('score-trend-chart');
    if (!ctx) return;

    if (this.charts.scoreTrend) {
      this.charts.scoreTrend.destroy();
    }

    const labels = this.data.scoreTrend.map(s => s.date);
    const scores = this.data.scoreTrend.map(s => s.score);

    this.charts.scoreTrend = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: '预测分数',
          data: scores,
          borderColor: '#9c27b0',
          backgroundColor: 'rgba(156, 39, 176, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 5,
          pointHoverRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          title: {
            display: true,
            text: '分数趋势（30天）'
          }
        },
        scales: {
          y: {
            beginAtZero: false,
            min: 50,
            max: 100,
            ticks: {
              callback: value => value + '分'
            }
          }
        }
      }
    });
  }

  /**
   * 启动自动刷新
   */
  startAutoRefresh(intervalMs) {
    setInterval(() => {
      const urlParams = new URLSearchParams(window.location.search);
      const taskId = urlParams.get('task_id');
      const userId = urlParams.get('user');
      if (userId && taskId) {
        this.fetchData(userId, taskId).then(() => {
          this.renderAllCharts();
        });
      }
    }, intervalMs);
  }

  /**
   * 销毁所有图表
   */
  destroy() {
    Object.values(this.charts).forEach(chart => {
      if (chart) chart.destroy();
    });
    this.charts = {};
  }
}

// 全局实例
window.statsDashboard = new StatsDashboard();
