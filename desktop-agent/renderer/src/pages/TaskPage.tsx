import React, { useState, useEffect } from 'react';

interface TaskPageProps {
  user: any;
}

export default function TaskPage({ user }: TaskPageProps) {
  const [task, setTask] = useState<any>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [timeSpent, setTimeSpent] = useState(0);

  useEffect(() => {
    loadTask();
    const timer = setInterval(() => setTimeSpent(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadTask = async () => {
    try {
      let taskData;
      if (window.electronAPI) {
        taskData = await window.electronAPI.getTodayTask();
      } else {
        // 浏览器环境，使用 localStorage 模拟
        const cached = localStorage.getItem('today_task');
        taskData = cached ? JSON.parse(cached) : null;
      }
      setTask(taskData);
    } catch (error) {
      console.error('Failed to load task:', error);
    }
  };

  const handleSubmit = async () => {
    if (!selectedAnswer) return;
    
    const question = task.questions[currentQuestion];
    const isCorrect = selectedAnswer === question.correct_answer;

    // 保存答案
    const answer = {
      id: `a_${Date.now()}`,
      task_id: task.id,
      question_id: question.id,
      user_answer: selectedAnswer,
      is_correct: isCorrect,
      time_spent_seconds: timeSpent,
    };

    if (window.electronAPI) {
      await window.electronAPI.submitAnswer(answer);
    } else {
      // 浏览器环境，暂存到 localStorage
      const answers = JSON.parse(localStorage.getItem('answers') || '[]');
      answers.push(answer);
      localStorage.setItem('answers', JSON.stringify(answers));
    }

    setShowExplanation(true);
  };

  const question = task?.questions?.[currentQuestion];

  if (!task || !question) {
    return <div style={styles.container}>加载中...</div>;
  }

  const letters = ['A', 'B', 'C', 'D'];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2>第 {task.day_number} 天任务</h2>
        <div style={styles.meta}>
          <span>⏱️ {Math.floor(timeSpent / 60)}:{(timeSpent % 60).toString().padStart(2, '0')}</span>
          <span>💎 {task.points_available} 积分</span>
        </div>
      </div>

      <div style={styles.progressBar}>
        <div style={{ ...styles.progressFill, width: `${((currentQuestion + 1) / task.questions.length) * 100}%` }} />
      </div>

      <div style={styles.content}>
        <div style={styles.knowledgeTag}>
          {task.knowledge_point}
        </div>

        <div style={styles.questionText}>
          {question.content}
        </div>

        <div style={styles.options}>
          {question.options.map((opt: string, idx: number) => {
            const letter = letters[idx];
            const isSelected = selectedAnswer === letter;
            const isCorrect = letter === question.correct_answer;
            
            return (
              <div
                key={idx}
                style={{
                  ...styles.option,
                  ...(isSelected ? styles.optionSelected : {}),
                  ...(showExplanation && isCorrect ? styles.optionCorrect : {}),
                  ...(showExplanation && isSelected && !isCorrect ? styles.optionWrong : {}),
                }}
                onClick={() => !showExplanation && setSelectedAnswer(letter)}
              >
                <span style={styles.optionLetter}>{letter}</span>
                <span style={styles.optionText}>{opt}</span>
                {showExplanation && isCorrect && <span style={styles.check}>✓</span>}
                {showExplanation && isSelected && !isCorrect && <span style={styles.checkWrong}>✗</span>}
              </div>
            );
          })}
        </div>

        {showExplanation && (
          <div style={styles.explanation}>
            <h4>💡 解析</h4>
            <p>{question.explanation}</p>
          </div>
        )}

        <div style={styles.actions}>
          <button
            style={{...styles.button, ...styles.secondaryButton}}
            onClick={() => currentQuestion < task.questions.length - 1 && setCurrentQuestion(q => q + 1)}
            disabled={currentQuestion === task.questions.length - 1}
          >
            跳过
          </button>
          
          {!showExplanation ? (
            <button
              style={{...styles.button, ...styles.primaryButton, ...(!selectedAnswer ? styles.buttonDisabled : {})}}
              onClick={handleSubmit}
              disabled={!selectedAnswer}
            >
              提交
            </button>
          ) : (
            <button
              style={{...styles.button, ...styles.primaryButton}}
              onClick={() => {
                if (currentQuestion < task.questions.length - 1) {
                  setCurrentQuestion(q => q + 1);
                  setSelectedAnswer(null);
                  setShowExplanation(false);
                } else {
                  alert('任务完成！');
                }
              }}
            >
              {currentQuestion < task.questions.length - 1 ? '下一题' : '完成'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#f5f7fa',
    paddingBottom: '70px',
  },
  header: {
    background: 'linear-gradient(135deg, #4facfe, #00f2fe)',
    color: 'white',
    padding: '20px',
  },
  meta: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '10px',
    fontSize: '14px',
    opacity: 0.9,
  },
  progressBar: {
    height: '4px',
    background: '#e0e0e0',
  },
  progressFill: {
    height: '100%',
    background: '#4caf50',
    transition: 'width 0.3s',
  },
  content: {
    flex: 1,
    padding: '20px',
  },
  knowledgeTag: {
    display: 'inline-block',
    background: '#ffecb3',
    color: '#f57c00',
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    marginBottom: '15px',
  },
  questionText: {
    fontSize: '18px',
    lineHeight: '1.6',
    marginBottom: '20px',
    color: '#333',
  },
  options: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '20px',
  },
  option: {
    display: 'flex',
    alignItems: 'center',
    padding: '15px',
    background: 'white',
    border: '2px solid #e0e0e0',
    borderRadius: '12px',
    cursor: 'pointer',
  },
  optionSelected: {
    borderColor: '#4facfe',
    background: '#e6f2ff',
  },
  optionCorrect: {
    borderColor: '#4caf50',
    background: '#e8f5e9',
  },
  optionWrong: {
    borderColor: '#f44336',
    background: '#ffebee',
  },
  optionLetter: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: '#e0e0e0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: '15px',
    fontWeight: 'bold',
    color: '#666',
  },
  optionText: {
    flex: 1,
    fontSize: '16px',
  },
  check: {
    fontSize: '24px',
    color: '#4caf50',
    fontWeight: 'bold',
  },
  checkWrong: {
    fontSize: '24px',
    color: '#f44336',
    fontWeight: 'bold',
  },
  explanation: {
    background: '#fff8e1',
    borderLeft: '4px solid #ffc107',
    padding: '15px',
    borderRadius: '8px',
    marginTop: '20px',
  },
  actions: {
    display: 'flex',
    gap: '10px',
    marginTop: '20px',
  },
  button: {
    flex: 1,
    padding: '12px',
    borderRadius: '10px',
    border: 'none',
    fontSize: '16px',
    cursor: 'pointer',
  },
  primaryButton: {
    background: '#4facfe',
    color: 'white',
  },
  secondaryButton: {
    background: '#f5f5f5',
    color: '#666',
  },
  buttonDisabled: {
    background: '#ccc',
    cursor: 'not-allowed',
  },
};
