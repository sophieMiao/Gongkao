import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Image,
} from 'react-native';
import Card from '../components/Card';
import Button from '../components/Button';
import { getTodayTask, startTask } from '../services/api';
import { Task } from '../types';
import { useAuth } from '../hooks/useAuth';

export default function HomeScreen({ navigation }: any) {
  const { user } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTask = async () => {
    try {
      const data = await getTodayTask(user?.id);
      setTask(data);
    } catch (error) {
      console.error('Failed to fetch task:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTask();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTask();
  };

  const handleStartTask = async () => {
    if (!task) return;
    try {
      await startTask(task.id, user?.id);
      navigation.navigate('TaskDetail', { taskId: task.id, userId: user?.id });
    } catch (error) {
      console.error('Failed to start task:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>加载中...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* 欢迎区域 */}
      <View style={styles.welcomeSection}>
        <Text style={styles.greeting}>你好，{user?.name || '用户'}！</Text>
        <Text style={styles.subtitle}>今天是第 {task?.day_number || 0} 天学习</Text>
      </View>

      {/* 今日任务卡片 */}
      {task && (
        <Card style={styles.taskCard}>
          <Text style={styles.cardTitle}>📚 今日任务</Text>
          <Text style={styles.knowledgePoint}>{task.knowledge_point}</Text>
          
          <View style={styles.metaContainer}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>⏱️ 预计</Text>
              <Text style={styles.metaValue}>{task.estimated_minutes} 分钟</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>💎 积分</Text>
              <Text style={styles.metaValue}>{task.points_available}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>🔥 连续</Text>
              <Text style={styles.metaValue}>{task.streak} 天</Text>
            </View>
          </View>

          <Button
            title="开始学习"
            onPress={handleStartTask}
            style={styles.startButton}
          />
        </Card>
      )}

      {/* 快速统计 */}
      <View style={styles.statsRow}>
        <Card style={[styles.statCard, { backgroundColor: '#e3f2fd' }]}>
          <Text style={styles.statValue}>15</Text>
          <Text style={styles.statLabel}>学习天数</Text>
        </Card>
        <Card style={[styles.statCard, { backgroundColor: '#e8f5e9' }]}>
          <Text style={styles.statValue}>127</Text>
          <Text style={styles.statLabel}>答题数</Text>
        </Card>
        <Card style={[styles.statCard, { backgroundColor: '#fff3e0' }]}>
          <Text style={styles.statValue}>78%</Text>
          <Text style={styles.statLabel}>正确率</Text>
        </Card>
      </View>

      {/* 底部提示 */}
      <Text style={styles.footer}>坚持每天学习，早日上岸！🚀</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  welcomeSection: {
    padding: 20,
    backgroundColor: 'white',
    marginBottom: 10,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  taskCard: {
    margin: 15,
    padding: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  knowledgePoint: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4caf50',
    marginBottom: 20,
  },
  metaContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  metaItem: {
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  startButton: {
    marginTop: 10,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    marginHorizontal: 4,
    padding: 15,
    alignItems: 'center',
    borderRadius: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  footer: {
    textAlign: 'center',
    padding: 20,
    color: '#999',
    fontSize: 14,
  },
});
