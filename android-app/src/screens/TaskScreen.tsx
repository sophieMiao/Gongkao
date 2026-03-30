import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Animated,
} from 'react-native';
import { Question } from '../types';
import { submitAnswer } from '../services/api';
import { useAuth } from '../hooks/useAuth';

interface TaskScreenProps {
  route: any;
  navigation: any;
}

export default function TaskScreen({ route, navigation }: TaskScreenProps) {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [timeSpent, setTimeSpent] = useState(0);
  const [loading, setLoading] = useState(false);
  
  const timerInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // TODO: 从 API 加载任务数据
    // const fetchTask = async () => { ... };
    // fetchTask();

    // 模拟数据
    const mockQuestions: Question[] = [
      {
        id: 'q1',
        content: '甲乙合作完成一项工程需要10天，甲单独做需要15天，乙单独做需要多少天？',
        options: ['20天', '25天', '30天', '35天'],
        correct_answer: 'C',
        explanation: '甲的工作效率为1/15，合作效率为1/10，所以乙的效率为1/10-1/15=1/30，乙单独完成需要30天。',
        knowledge_points: ['工程问题', '数量关系'],
        difficulty: 0.6,
      },
      {
        id: 'q2',
        content: '一项工作，甲单独做20天完成，乙单独做30天完成，两人合作多少天能完成？',
        options: ['10天', '12天', '15天', '18天'],
        correct_answer: 'B',
        explanation: '甲效率1/20，乙效率1/30，合作效率1/20+1/30=1/12，需要12天完成。',
        knowledge_points: ['工程问题', '数量关系'],
        difficulty: 0.5,
      },
    ];

    setQuestions(mockQuestions);
    startTimer();

    return () => {
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }
    };
  }, []);

  const startTimer = () => {
    timerInterval.current = setInterval(() => {
      setTimeSpent(prev => prev + 1);
    }, 1000);
  };

  const handleSelectAnswer = (answer: string) => {
    if (showExplanation) return;
    setSelectedAnswer(answer);
  };

  const handleSubmit = async () => {
    if (!selectedAnswer) {
      Alert.alert('提示', '请选择答案');
      return;
    }

    setLoading(true);
    const currentQuestion = questions[currentIndex];
    const correct = selectedAnswer === currentQuestion.correct_answer;
    setIsCorrect(correct);
    setShowExplanation(true);

    try {
      await submitAnswer(currentQuestion.id, {
        user_answer: selectedAnswer,
        time_spent_seconds: timeSpent,
      });
    } catch (error) {
      console.error('Failed to submit answer:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
      setIsCorrect(null);
      setTimeSpent(0);
    } else {
      // 任务完成
      Alert.alert(
        '任务完成！',
        `用时: ${Math.floor(timeSpent / 60)}分${timeSpent % 60}秒\n正确率: ${Math.round((questions.filter((_, i) => i < currentIndex).length / questions.length) * 100)}%`,
        [{ text: '确定', onPress: () => navigation.goBack() }]
      );
    }
  };

  const handleSkip = () => {
    Alert.alert('确认跳过', '跳过将不会获得积分，确定吗？', [
      { text: '取消', style: 'cancel' },
      { text: '确定', onPress: () => handleNext() },
    ]);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentQuestion = questions[currentIndex];
  if (!currentQuestion) {
    return (
      <View style={styles.container}>
        <Text>加载中...</Text>
      </View>
    );
  }

  const letters = ['A', 'B', 'C', 'D'];

  return (
    <View style={styles.container}>
      {/* 顶部进度条 */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${((currentIndex + 1) / questions.length) * 100}%` }]} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* 题目信息 */}
        <View style={styles.questionHeader}>
          <Text style={styles.questionNumber}>第 {currentIndex + 1}/{questions.length} 题</Text>
          <View style={styles.timerContainer}>
            <Text style={styles.timer}>{formatTime(timeSpent)}</Text>
          </View>
        </View>

        {/* 知识点标签 */}
        <View style={styles.knowledgeContainer}>
          {currentQuestion.knowledge_points.map((kp, idx) => (
            <View key={idx} style={styles.knowledgeTag}>
              <Text style={styles.knowledgeText}>{kp}</Text>
            </View>
          ))}
        </View>

        {/* 题目内容 */}
        <Text style={styles.questionText}>{currentQuestion.content}</Text>

        {/* 选项列表 */}
        <View style={styles.optionsContainer}>
          {currentQuestion.options.map((option, idx) => {
            const letter = letters[idx];
            const isSelected = selectedAnswer === letter;
            const isCorrectAnswer = currentQuestion.correct_answer === letter;
            const showCorrect = showExplanation && isCorrectAnswer;
            const showWrong = showExplanation && isSelected && !isCorrectAnswer;

            return (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.option,
                  isSelected && styles.optionSelected,
                  showCorrect && styles.optionCorrect,
                  showWrong && styles.optionWrong,
                ]}
                onPress={() => handleSelectAnswer(letter)}
                disabled={showExplanation}
              >
                <View style={styles.optionLetter}>
                  <Text style={styles.optionLetterText}>{letter}</Text>
                </View>
                <Text style={styles.optionText}>{option}</Text>
                {showCorrect && <Text style={styles.checkMark}>✓</Text>}
                {showWrong && <Text style={styles.checkMark}>✗</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 解析 */}
        {showExplanation && (
          <View style={styles.explanationContainer}>
            <Text style={styles.explanationTitle}>💡 解析</Text>
            <Text style={styles.explanationText}>{currentQuestion.explanation}</Text>
          </View>
        )}
      </ScrollView>

      {/* 底部操作按钮 */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipButtonText}>跳过</Text>
        </TouchableOpacity>

        {!showExplanation ? (
          <TouchableOpacity
            style={[styles.submitButton, selectedAnswer && styles.submitButtonActive]}
            onPress={handleSubmit}
            disabled={!selectedAnswer || loading}
          >
            <Text style={styles.submitButtonText}>{loading ? '提交中...' : '提交答案'}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
            <Text style={styles.nextButtonText}>
              {currentIndex < questions.length - 1 ? '下一题' : '完成'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e0e0e0',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4caf50',
  },
  content: {
    padding: 20,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  questionNumber: {
    fontSize: 16,
    color: '#666',
  },
  timerContainer: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  timer: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976d2',
    fontVariant: ['tabular-nums'],
  },
  knowledgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
  },
  knowledgeTag: {
    backgroundColor: '#ffecb3',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  knowledgeText: {
    fontSize: 12,
    color: '#f57c00',
  },
  questionText: {
    fontSize: 18,
    lineHeight: 26,
    color: '#333',
    marginBottom: 25,
  },
  optionsContainer: {
    marginBottom: 20,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    marginBottom: 12,
    position: 'relative',
  },
  optionSelected: {
    borderColor: '#4facfe',
    backgroundColor: '#e6f2ff',
  },
  optionCorrect: {
    borderColor: '#4caf50',
    backgroundColor: '#e8f5e9',
  },
  optionWrong: {
    borderColor: '#f44336',
    backgroundColor: '#ffebee',
  },
  optionLetter: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  optionLetterText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    color: '#333',
  },
  checkMark: {
    fontSize: 24,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  explanationContainer: {
    backgroundColor: '#fff8e1',
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
    padding: 16,
    borderRadius: 8,
    marginTop: 10,
  },
  explanationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f57c00',
    marginBottom: 8,
  },
  explanationText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#666',
  },
  footer: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  skipButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    marginRight: 10,
  },
  skipButtonText: {
    fontSize: 16,
    color: '#666',
  },
  submitButton: {
    flex: 2,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
  },
  submitButtonActive: {
    backgroundColor: 'linear-gradient(135deg, #4facfe, #00f2fe)',
    backgroundColor: '#4facfe',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  nextButton: {
    flex: 2,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#4facfe',
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
