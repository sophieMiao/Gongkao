import { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } from 'electron';
import { join } from 'path';
import { DataSyncService } from './services/sync';
import { NotificationService } from './services/notifications';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
const syncService = new DataSyncService();
const notificationService = new NotificationService();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, 'preload.js'),
    },
    icon: join(__dirname, '../build/icon.png'),
    show: false, // 等待 ready-to-show
  });

  // 加载 Web 版增强页面 (复用现有代码)
  mainWindow.loadFile(join(__dirname, '../public/dashboard.html'));

  // 准备就绪后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // 关闭窗口时隐藏到托盘 (不退出)
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  // 开发工具 (仅开发环境)
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

function createTray() {
  // 托盘图标 (需要准备图标文件)
  const iconPath = join(__dirname, '../build/icon.png');
  const icon = nativeImage.createFromPath(iconPath);

  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开主窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      },
    },
    {
      label: '今日任务',
      click: () => {
        // 打开任务页面
        if (mainWindow) {
          mainWindow.loadFile(join(__dirname, '../public/task-enhanced.html'));
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: '设置',
      click: () => {
        // 打开设置页面
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('考公学习伴侣');
  tray.setContextMenu(contextMenu);

  // 单击托盘图标显示/隐藏窗口
  tray.on('click', () => {
    if (mainWindow && mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      } else {
        createWindow();
      }
    }
  });
}

// IPC 通信处理
function setupIpcHandlers() {
  // 获取用户信息
  ipcMain.handle('get-user-info', async () => {
    return await syncService.getUserInfo();
  });

  // 获取今日任务
  ipcMain.handle('get-today-task', async () => {
    return await syncService.getTodayTask();
  });

  // 提交答案
  ipcMain.handle('submit-answer', async (_, answer: any) => {
    return await syncService.submitAnswer(answer);
  });

  // 同步数据
  ipcMain.handle('sync-data', async () => {
    return await syncService.fullSync();
  });

  // 获取统计数据
  ipcMain.handle('get-stats', async () => {
    return await syncService.getStats();
  });
}

// App 事件
app.whenReady().then(() => {
  createWindow();
  createTray();
  setupIpcHandlers();
  notificationService.createChannels();

  // 定时同步 (每5分钟)
  setInterval(() => {
    syncService.syncIfNeeded();
  }, 5 * 60 * 1000);

  // 每日任务提醒 (早上8点)
  const cron = require('node-cron');
  cron.schedule('0 8 * * *', () => {
    notificationService.scheduleDailyTaskReminder();
  });
});

app.on('window-all-closed', () => {
  // 所有窗口关闭时不退出 (托盘还会运行)
  if (process.platform !== 'darwin') {
    // macOS 上通常保留应用运行
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

// 自动更新
if (process.env.NODE_ENV === 'production') {
  const { autoUpdater } = require('electron-updater');
  autoUpdater.checkForUpdatesAndNotify();
}
