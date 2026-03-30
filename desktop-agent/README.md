# Agent 桌面应用开发规范

## 技术栈: Electron + React + TypeScript

### 选择理由
- ✅ 可复用 Web 端代码 (task-enhanced.html, dashboard.html)
- ✅ 热重载开发体验
- ✅ 丰富的系统集成 API (托盘、通知、文件系统)
- ✅ 跨平台 (Windows/macOS/Linux)

## 项目结构

```
desktop-agent/
├── package.json
├── main.ts           # Electron 主进程
├── preload.ts        # 预加载脚本
├── renderer/         # 渲染进程 (React)
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── index.css
│   │   └── components/
│   ├── public/       # 静态资源 (复用 Web 版)
│   └── index.html
├── builder/          # 打包配置
│   ├── electron-builder.yml
│   └── icons/
└── README.md
```

## 核心功能实现

### 1. 系统托盘集成
```typescript
// main.ts
import { Tray, Menu, app, nativeImage } from 'electron';

class SystemTray {
  private tray: Tray | null = null;

  create() {
    const icon = nativeImage.createFromPath('assets/icon.png');
    this.tray = new Tray(icon);

    const contextMenu = Menu.buildFromTemplate([
      { label: '打开主窗口', click: () => this.showWindow() },
      { label: '今日任务', click: () => this.openTask() },
      { type: 'separator' },
      { label: '设置', click: () => this.openSettings() },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() },
    ]);

    this.tray.setToolTip('考公学习伴侣');
    this.tray.setContextMenu(contextMenu);

    this.tray.on('click', () => this.showWindow());
  }

  private showWindow() {
    // 显示/隐藏主窗口
  }

  private openTask() {
    // 打开任务页面
  }
}
```

### 2. 本地数据同步
```typescript
// src/services/sync.ts
class DataSyncService {
  private db: any; // SQLite 或 lowdb

  async init() {
    // 初始化本地数据库
  }

  async syncWithServer(userId: string) {
    // 增量同步：拉取服务器更新，推送本地修改
    const localChanges = await this.getPendingChanges();
    await this.uploadChanges(localChanges);
    await this.downloadChanges(userId);
    await this.markChangesSynced();
  }

  async queueOfflineAnswer(answer: any) {
    // 离线时保存到本地队列
    await this.db.answers.add({
      ...answer,
      synced: false,
      timestamp: Date.now(),
    });
  }

  async syncQueue() {
    // 网络恢复后同步队列
    const queue = await this.db.answers.filter({ synced: false }).toArray();
    for (const answer of queue) {
      try {
        await api.submitAnswer(answer);
        await this.db.answers.update(answer.id, { synced: true });
      } catch (error) {
        console.error('Sync failed for answer:', answer.id);
      }
    }
  }
}
```

### 3. 离线模式支持
- Service Worker 缓存 (已实现)
- 本地 IndexedDB/SQLite 存储
- 自动检测网络状态
- 离线答题队列

### 4. 自动更新
```typescript
// 使用 electron-updater
import { autoUpdater } from 'electron-updater';

class UpdateService {
  checkForUpdates() {
    autoUpdater.checkForUpdatesAndNotify();
  }
}
```

### 5. 窗口管理
```typescript
// 主窗口 + 任务窗口
- 主窗口: 数据仪表板 (dashboard.html)
- 任务窗口: 每日答题 (task-enhanced.html)
- 支持多窗口
- 窗口状态持久化 (位置、大小)
```

## 开发步骤

### Step 1: 初始化项目
```bash
cd desktop-agent
npm init -y
npm install electron electron-builder react react-dom typescript
npm install -D @types/react @types/react-dom @types/node
npx tsc --init
```

### Step 2: 创建主进程 (main.ts)
- 窗口管理
- 系统托盘
- 菜单栏
- IPC 通信

### Step 3: 创建渲染进程
- 复用 Web 版 HTML/CSS/JS
- 通过 preload 暴露 API 给渲染进程
- 本地数据访问

### Step 4: 构建配置
- electron-builder 配置
- 图标资源
- 安装包生成 (dmg/exe)

---

## 预计耗时: 4 小时 (04:30 - 08:30)

## 交付物
- `desktop-agent/` 完整项目
- 可执行文件 (Windows/macOS)
- 打包脚本
- 用户文档

---

**立即开始创建项目文件**
