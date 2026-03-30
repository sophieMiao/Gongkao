import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { LineChart, PieChart, RadarChart } from 'react-native-chart-kit';
import { getDailyProgress, getKnowledgeMastery, getTimeDistribution, getScoreTrend } from '../services/api';
import { useAuth } from '../hooks/useAuth';

const screenWidth = Dimensions.get('window').width;

export default function DashboardScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>({});

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [progress, mastery, timeDist, scoreTrend] = await Promise.all([
        getDailyProgress(user?.id),
        getKnowledgeMastery(user?.id),
        getTimeDistribution(user?.id),
        getScoreTrend(user?.id),
      ]);

      setStats({
        progress: progress.data || [],
        mastery: mastery.data || [],
        timeDist: timeDist.data || [],
        scoreTrend: scoreTrend.data || [],
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      // 加载模拟数据
      setStats({
        progress: [
          { time: '08:00', correct: 2, total: 3 },
          { time: '10:00', correct: 5, total: 7 },
          { time: '14:00', correct: 3, total: 4 },
          { time: '16:00', correct: 4, total: 5 },
          { time: '20:00', correct: 6, total: 8 },
        ],
        mastery: [
          { name: '数量关系', mastered: 75, total: 100 },
          { name: '判断推理', mastered: 60, total: 80 },
          { name: '资料分析', mastered: 85, total: 90 },
          { name: '言语理解', mastered: 55, total: 70 },
          { name: '常识判断', mastered: 40, total: 60 },
        ],
        timeDist: [
          { period: '早晨', minutes: 25 },
          { period: '上午', minutes: 40 },
          { period: '下午', minutes: 30 },
          { period: '晚上', minutes: 35 },
        ],
        scoreTrend: [
          { date: '03-01', score: 65 },
          { date: '03-05', score: 68 },
          { date: '03-10', score: 72 },
          { date: '03-15', score: 75 },
          { date: '03-20', score: 78 },
          { date: '03-25', score: 80 },
          { date: '03-30', score: 83 },
        ],
      });
    } finally {
      setLoading(false);
    }
  };

  const renderProgressChart = () => {
    const data = stats.progress || [];
    if (data.length === 0) return null;

    return (
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>📈 今日学习进度</Text>
        <LineChart
          data={{
            labels: data.map(d => d.time),
            datasets: [
              {
                data: data.map(d => d.correct),
                color: () => '#4caf50',
              },
              {
                data: data.map(d => d.total),
                color: () => '#2196f3',
              },
            ],
          }}
          width={screenWidth - 40}
          height={220}
          chartConfig={{
            backgroundColor: '#ffffff',
            backgroundGradientFrom: '#ffffff',
            backgroundGradientTo: '#ffffff',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            style: { borderRadius: 16 },
          }}
          bezier
          style={styles.chart}
        />
      </View>
    );
  };

  const renderKnowledgeChart = () => {
    const data = stats.mastery || [];
    if (data.length === 0) return null;

    return (
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>🎯 知识点掌握</Text>
        <RadarChart
          data={{
            labels: data.map(d => d.name),
            datasets: [
              {
                data: data.map(d => (d.mastered / d.total) * 100),
                color: () => '#4caf50',
              },
            ],
          }}
          width={screenWidth - 40}
          height={220}
          chartConfig={{
            backgroundColor: '#ffffff',
            backgroundGradientFrom: '#ffffff',
            backgroundGradientTo: '#ffffff',
            colors: ['#4caf50'],
          }}
          style={styles.chart}
        />
      </View>
    );
  };

  const renderTimeDistributionChart = () => {
    const data = stats.timeDist || [];
    if (data.length === 0) return null;

    return (
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>⏰ 学习时间分布</Text>
        <PieChart
          data={data.map(d => ({
            name: d.period,
            population: d.minutes,
            color: ['#4facfe', '#00f2fe', '#667eea', '#764ba2'][Math.floor(Math.random() * 4)],
            legendFontColor: '#333',
            legendFontSize: 12,
          }))}
          width={screenWidth - 40}
          height={220}
          chartConfig={{
            backgroundColor: '#ffffff',
            backgroundGradientFrom: '#ffffff',
            backgroundGradientTo: '#ffffff',
          }}
          accessor="population"
          backgroundColor="transparent"
          paddingLeft="15"
          style={styles.chart}
        />
      </View>
    );
  };

  const renderScoreTrendChart = () => {
    const data = stats.scoreTrend || [];
    if (data.length === 0) return null;

    return (
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>📈 分数趋势 (30天)</Text>
        <LineChart
          data={{
            labels: data.map(d => d.date),
            datasets: [
              {
                data: data.map(d => d.score),
                color: () => '#9c27b0',
                strokeWidth: 3,
              },
            ],
          }}
          width={screenWidth - 40}
          height={220}
          chartConfig={{
            backgroundColor: '#ffffff',
            backgroundGradientFrom: '#ffffff',
            backgroundGradientTo: '#ffffff',
            decimalPlaces: 0,
            minY: 50,
            maxY: 100,
            style: { borderRadius: 16 },
          }}
          style={styles.chart}
        />
      </View>
    );
  };

  const renderSummaryCards = () => {
    const statsData = [
      { label: '学习天数', value: '15', color: '#e3f2fd' },
      { label: '答题总数', value: '127', color: '#e8f5e9' },
      { label: '正确率', value: '78%', color: '#fff3e0' },
      { label: '总积分', value: '1,850', color: '#f3e5f5' },
    ];

    return (
      <View style={styles.summaryRow}>
        {statsData.map((stat, idx) => (
          <View key={idx} style={[styles.summaryCard, { backgroundColor: stat.color }]}>
            <Text style={styles.summaryValue}>{stat.value}</Text>
            <Text style={styles.summaryLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>加载中...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>📊 学习数据</Text>

      {renderSummaryCards()}

      {renderProgressChart()}
      {renderKnowledgeChart()}
      {renderTimeDistributionChart()}
      {renderScoreTrendChart()}

      <View style={styles.footer}>
        <Text style={styles.footerText}>坚持每天学习，早日上岸！🚀</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  content: {
    padding: 15,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 15,
    color: '#333',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  summaryCard: {
    flex: 1,
    marginHorizontal: 4,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  chartCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  chart: {
    borderRadius: 16,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    color: '#999',
    fontSize: 14,
  },
});
