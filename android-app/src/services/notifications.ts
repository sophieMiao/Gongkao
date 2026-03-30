import PushNotification from 'react-native-push-notification';
import { Platform } from 'react-native';
import storage from './storage';

class NotificationService {
  constructor() {
    this.configure();
  }

  configure() {
    PushNotification.configure({
      onRegister: (token) => {
        console.log('Push notification token:', token);
        // 发送 token 到后端
        this.sendTokenToServer(token);
      },

      onNotification: (notification) => {
        console.log('Push notification received:', notification);
        
        if (notification.userInteraction) {
          // 用户点击了通知
          this.handleNotificationOpen(notification);
        } else {
          // 应用在前台收到通知
          this.showLocalNotification(notification);
        }
      },

      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },

      popInitialNotification: true,
      requestPermissions: Platform.OS === 'ios',
    });
  }

  async sendTokenToServer(token: string) {
    try {
      const userId = await storage.getUserInfo();
      // TODO: 调用 API 保存 token
      // await api.notifications.registerToken(userId.id, token);
    } catch (error) {
      console.error('Failed to send push token:', error);
    }
  }

  scheduleDailyTaskReminder(time: string = '08:00') {
    const [hours, minutes] = time.split(':').map(Number);
    
    PushNotification.localNotificationSchedule({
      channelId: 'daily-task',
      title: '📚 考公学习伴侣',
      message: '今天的学习任务已生成，快来完成任务吧！',
      date: new Date(Date.now() + 1000 * 60 * 5), // 5秒后（测试用）
      allowWhileIdle: true,
    });

    // 实际使用时：
    // const now = new Date();
    // const scheduledDate = new Date();
    // scheduledDate.setHours(hours, minutes, 0, 0);
    // if (scheduledDate < now) {
    //   scheduledDate.setDate(scheduledDate.getDate() + 1);
    // }
  }

  scheduleReminder(title: string, message: string, delaySeconds: number = 60) {
    PushNotification.localNotificationSchedule({
      channelId: 'reminder',
      title,
      message,
      date: new Date(Date.now() + delaySeconds * 1000),
      allowWhileIdle: true,
    });
  }

  cancelAllNotifications() {
    PushNotification.cancelAllLocalNotifications();
  }

  showLocalNotification(notification: any) {
    // 应用在前台时显示系统通知
    PushNotification.localNotification({
      channelId: notification.channelId || 'default',
      title: notification.title,
      message: notification.message,
    });
  }

  handleNotificationOpen(notification: any) {
    // 处理通知点击，导航到对应页面
    const { screen, params } = notification.data || {};
    if (screen) {
      // 使用 navigation 导航
      // navigation.navigate(screen, params);
    }
  }

  // 创建通知频道（Android 8+）
  createChannels() {
    if (Platform.OS === 'android') {
      PushNotification.createChannel(
        {
          channelId: 'daily-task',
          channelName: '每日任务提醒',
          channelDescription: '每天学习任务提醒',
          importance: 4,
          vibrate: true,
        },
        (created) => console.log(`Channel created: ${created}`)
      );

      PushNotification.createChannel(
        {
          channelId: 'reminder',
          channelName: '学习提醒',
          channelDescription: '自定义学习提醒',
          importance: 3,
          vibrate: true,
        },
        (created) => console.log(`Channel created: ${created}`)
      );
    }
  }
}

export default new NotificationService();
