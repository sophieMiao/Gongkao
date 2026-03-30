# Android 应用开发规范

## 技术栈选择

### 方案对比

| 特性 | React Native | Flutter | 原生 Android |
|------|--------------|---------|--------------|
| 开发语言 | JavaScript/TypeScript | Dart | Kotlin/Java |
| 性能 | 接近原生 | 原生级别 | 原生 |
| 热重载 | ✅ | ✅ | ❌ |
| UI 一致性 | 依赖组件库 | ✅ 自带 Material/Cupertino | 原生 |
| 包大小 | ~7MB | ~10MB | ~5MB |
| 学习成本 | 低（Web 开发者） | 中（Dart 生态） | 高 |
| 生态 | 丰富 | 快速增长 | 最丰富 |
| 与 Web 共享代码 | ✅ 可共享逻辑层 | 部分共享（通过插件） | ❌ |

## 推荐：React Native

**理由：**
1. 已有 Web 版（HTML/JS），可共享业务逻辑
2. 学习曲线平缓（基于 React）
3. 快速开发，热重载
4. 社区成熟，组件丰富

## 项目结构

```
android-app/
├── src/
│   ├── components/     # 可复用组件
│   │   ├── TaskCard.tsx
│   │   ├── QuestionView.tsx
│   │   ├── Dashboard.tsx
│   │   └── Navigation.tsx
│   ├── screens/        # 页面
│   │   ├── HomeScreen.tsx
│   │   ├── TaskScreen.tsx
│   │   ├── DashboardScreen.tsx
│   │   ├── ProfileScreen.tsx
│   │   └── SettingsScreen.tsx
│   ├── services/       # 服务层
│   │   ├── api.ts      # API 调用
│   │   ├── auth.ts     # 认证
│   │   ├── storage.ts  # 本地存储 (AsyncStorage)
│   │   └── notifications.ts # 推送通知
│   ├── utils/          # 工具函数
│   ├── hooks/          # 自定义 hooks
│   ├── constants/      # 常量
│   └── assets/         # 静态资源
├── android/            # 原生 Android 项目
├── ios/                # 原生 iOS 项目（可选）
├── App.tsx             # 入口组件
├── package.json        # 依赖
├── metro.config.js     # Metro bundler 配置
├── babel.config.js     # Babel 配置
├── tsconfig.json       # TypeScript 配置
└── README.md           # 说明文档
```

## 核心功能实现计划

### 1. 认证与用户管理
- 登录/注册（手机号 + 验证码 或 飞书 OAuth）
- JWT Token 管理
- 用户信息缓存

### 2. 每日任务
- 任务卡片展示（类似 Web 版）
- 答题界面（选项选择、提交）
- 计时器
- 积分计算
- 本地缓存（离线答题）

### 3. 数据同步
- 与后端 API 同步
- 冲突处理（时间戳策略）
- 增量同步

### 4. 推送通知
- 每日任务提醒（8:00）
- 学习提醒（自定义时间）
- 系统级通知

### 5. 数据可视化
- Chart.js / React Native Chart Kit
- 学习进度、正确率、知识点掌握

### 6. 离线支持
- AsyncStorage 缓存
- 离线答题队列
- 网络恢复后自动同步

## 组件设计

### TaskCard (任务卡片)
```tsx
interface TaskCardProps {
  dayNumber: number;
  knowledgePoint: string;
  estimatedMinutes: number;
  points: number;
  streak: number;
  questions: Question[];
  onStart: () => void;
  onRemind: () => void;
}
```

### QuestionView (答题视图)
```tsx
interface QuestionViewProps {
  question: Question;
  selectedAnswer?: string;
  timeSpent: number;
  onSubmit: (answer: string) => void;
  onSkip: () => void;
  showExplanation?: boolean;
}
```

### Dashboard (数据仪表板)
- 复用 Web 版的 Chart.js 图表（通过 WebView 或 react-native-chart-kit）
- 学习统计卡片
- 知识点掌握进度条

## 导航结构

```tsx
<TabNavigator>
  <Tab.Screen name="Home" component={HomeScreen} />
  <Tab.Screen name="Task" component={TaskScreen} />
  <Tab.Screen name="Dashboard" component={DashboardScreen} />
  <Tab.Screen name="Profile" component={ProfileScreen} />
</TabNavigator>
```

## API 集成

后端需要提供：
- `GET /api/v1/tasks/today` - 获取今日任务
- `POST /api/v1/tasks/:id/answer` - 提交答案
- `GET /api/v1/stats/*` - 获取统计数据
- `GET /api/v1/users/profile` - 获取用户信息

## 下一步

1. 初始化 React Native 项目
2. 安装依赖（@react-navigation, axios, async-storage, react-native-chart-kit 等）
3. 创建基础导航和屏幕框架
4. 实现 API 服务层
5. 逐个开发页面和组件

---

## 快速开始

```bash
# 1. 初始化项目
npx react-native init GongkaoAndroid --template react-native-template-typescript

# 2. 安装依赖
cd GongkaoAndroid
npm install @react-navigation/native @react-navigation/bottom-tabs
npm install axios @react-native-async-storage/async-storage
npm install react-native-screens react-native-safe-area-context
npm install react-native-chart-kit

# 3. 运行
npx react-native run-android
```

---

**预计耗时：4 小时（00:30 - 04:30）**
