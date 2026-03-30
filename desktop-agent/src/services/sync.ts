import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import betterSqlite3 from 'better-sqlite3';

const isDev = process.env.NODE_ENV === 'development';

export class DataSyncService {
  private db: betterSqlite3.Database | null = null;
  private dbPath: string;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.dbPath = path.join(userDataPath, 'gongkao-data.db');
  }

  async init() {
    try {
      this.db = new betterSqlite3(this.dbPath);
      this.createTables();
      console.log('Database initialized at:', this.dbPath);
    } catch (error) {
      console.error('Failed to initialize database:', error);
    }
  }

  private createTables() {
    if (!this.db) return;

    // 用户表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        open_id TEXT UNIQUE,
        name TEXT NOT NULL,
        avatar TEXT,
        department TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // 任务表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        day_number INTEGER NOT NULL,
        knowledge_point TEXT NOT NULL,
        estimated_minutes INTEGER,
        points_available INTEGER,
        streak INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // 答题记录表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS answers (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        question_id TEXT NOT NULL,
        user_answer TEXT NOT NULL,
        is_correct BOOLEAN NOT NULL,
        time_spent_seconds INTEGER,
        synced BOOLEAN DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (task_id) REFERENCES tasks(id)
      )
    `);

    // 同步队列表 (用于离线时暂存未同步的数据)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        data TEXT NOT NULL,
        retries INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);
  }

  async getUserInfo(): Promise<any> {
    if (!this.db) await this.init();
    const stmt = this.db!.prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT 1');
    return stmt.get() as any;
  }

  async saveUserInfo(user: any): Promise<void> {
    if (!this.db) await this.init();
    const stmt = this.db!.prepare(`
      INSERT OR REPLACE INTO users (id, open_id, name, avatar, department)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(user.id, user.open_id, user.name, user.avatar, user.department);
  }

  async getTodayTask(): Promise<any> {
    if (!this.db) await this.init();
    const stmt = this.db!.prepare('SELECT * FROM tasks WHERE date("now") = date(created_at, "unixepoch") ORDER BY created_at DESC LIMIT 1');
    return stmt.get() as any;
  }

  async saveTask(task: any): Promise<void> {
    if (!this.db) await this.init();
    const stmt = this.db!.prepare(`
      INSERT OR REPLACE INTO tasks (id, user_id, day_number, knowledge_point, estimated_minutes, points_available, streak)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(task.id, task.user_id, task.day_number, task.knowledge_point, task.estimated_minutes, task.points_available, task.streak);
  }

  async submitAnswer(answer: any): Promise<void> {
    if (!this.db) await this.init();
    
    // 保存到本地
    const stmt = this.db!.prepare(`
      INSERT INTO answers (id, task_id, question_id, user_answer, is_correct, time_spent_seconds, synced)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      answer.id,
      answer.task_id,
      answer.question_id,
      answer.user_answer,
      answer.is_correct,
      answer.time_spent_seconds,
      false // 默认未同步
    );

    // 加入同步队列
    this.queueSync('answer', answer);
  }

  async getUnsyncedAnswers(): Promise<any[]> {
    if (!this.db) await this.init();
    const stmt = this.db!.prepare('SELECT * FROM answers WHERE synced = 0');
    return stmt.all() as any[];
  }

  async markAnswerSynced(answerId: string): Promise<void> {
    if (!this.db) await this.init();
    const stmt = this.db!.prepare('UPDATE answers SET synced = 1 WHERE id = ?');
    stmt.run(answerId);
  }

  private queueSync(type: string, data: any): void {
    if (!this.db) return;
    const stmt = this.db!.prepare('INSERT INTO sync_queue (type, data) VALUES (?, ?)');
    stmt.run(type, JSON.stringify(data));
  }

  async getSyncQueue(): Promise<any[]> {
    if (!this.db) await this.init();
    const stmt = this.db!.prepare('SELECT * FROM sync_queue ORDER BY created_at ASC');
    return stmt.all() as any[];
  }

  async clearSyncQueue(queueId: number): Promise<void> {
    if (!this.db) return;
    const stmt = this.db!.prepare('DELETE FROM sync_queue WHERE id = ?');
    stmt.run(queueId);
  }

  async fullSync(): Promise<{ uploaded: number; downloaded: number }> {
    if (!this.db) await this.init();

    const queue = await this.getSyncQueue();
    let uploaded = 0;

    // 上传本地未同步的数据
    for (const item of queue) {
      try {
        const data = JSON.parse(item.data);
        // TODO: 调用 API 上传
        // await api.submitAnswer(data);
        
        await this.clearSyncQueue(item.id);
        uploaded++;
      } catch (error) {
        console.error('Sync item failed:', item.id, error);
      }
    }

    // TODO: 下载服务器数据
    // const serverData = await api.getUpdates();
    // ... 处理下载

    return { uploaded, downloaded: 0 };
  }

  async syncIfNeeded(): Promise<void> {
    // 检查网络状态，如果在线则同步
    // 这里简化：总是尝试同步
    try {
      await this.fullSync();
    } catch (error) {
      console.error('Auto sync failed:', error);
    }
  }

  async getStats(): Promise<any> {
    if (!this.db) await this.init();
    
    const totalQuestions = this.db!.prepare('SELECT COUNT(*) as count FROM answers').get() as { count: number };
    const correctAnswers = this.db!.prepare('SELECT COUNT(*) as count FROM answers WHERE is_correct = 1').get() as { count: number };
    const totalTime = this.db!.prepare('SELECT SUM(time_spent_seconds) as sum FROM answers').get() as { sum: number };

    return {
      totalQuestions: totalQuestions.count,
      correctAnswers: correctAnswers.count,
      accuracy: totalQuestions.count > 0 ? (correctAnswers.count / totalQuestions.count) * 100 : 0,
      totalTime: totalTime.sum || 0,
    };
  }
}

export const dataSyncService = new DataSyncService();
