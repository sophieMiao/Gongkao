import { Notification } from 'electron';
import storage from './storage';

class NotificationService {
  createChannels() {
    // Electron 使用系统通知，无需显式创建 channel
  }

  scheduleDailyTaskReminder() {
    const notification = new Notification({
      title: '📚 考公学习伴侣',
      body: '今天的学习任务已生成，快来完成任务吧！',
      silent: false,
    });

    notification.show();
  }

  scheduleReminder(title: string, message: string, delayMs: number = 0) {
    setTimeout(() => {
      const notification = new Notification({ title, body: message });
      notification.show();
    }, delayMs);
  }

  sendTaskCompletedNotification(points: number, accuracy: number) {
    new Notification({
      title: '✅ 任务完成！',
      body: `获得 ${points} 积分，正确率 ${accuracy}%`,
    }).show();
  }
}

export default new NotificationService();
