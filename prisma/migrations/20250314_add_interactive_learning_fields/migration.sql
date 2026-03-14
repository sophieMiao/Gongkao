-- 迁移：为 daily_task 表添加新字段以支持增强的练习反馈功能
-- 执行日期：2025-03-14
-- 描述：添加 detailed_explanation, knowledge_tags, similar_questions 等字段

-- 1. 添加 explanation 字段（详细解析）
ALTER TABLE "DailyTask" ADD COLUMN IF NOT EXISTS "explanation" TEXT;

-- 2. 添加 knowledge_tags 字段（知识点标签数组）
ALTER TABLE "DailyTask" ADD COLUMN IF NOT EXISTS "knowledge_tags" JSONB;

-- 3. 添加 similar_questions 字段（推荐同类题）
ALTER TABLE "DailyTask" ADD COLUMN IF NOT EXISTS "similar_questions" JSONB;

-- 4. 添加 estimated_minutes 字段（预计用时，分钟）
ALTER TABLE "DailyTask" ADD COLUMN IF NOT EXISTS "estimated_minutes" INTEGER DEFAULT 5;

-- 5. 添加 difficulty 字段（题目难度）
ALTER TABLE "DailyTask" ADD COLUMN IF NOT EXISTS "difficulty" VARCHAR(20) DEFAULT 'medium';

-- 6. 为 ProgressSnapshot 添加 module_scores 字段（各模块分数）
ALTER TABLE "ProgressSnapshot" ADD COLUMN IF NOT EXISTS "module_scores" JSONB;

-- 7. 创建复合索引以提升查询性能
CREATE INDEX IF NOT EXISTS "idx_daily_task_user_date_status" ON "DailyTask" ("user_id", "task_date", "status");
CREATE INDEX IF NOT EXISTS "idx_daily_task_knowledge_point" ON "DailyTask" ("knowledge_point");
CREATE INDEX IF NOT EXISTS "idx_progress_snapshot_user_date" ON "ProgressSnapshot" ("user_id", "snapshot_date");

-- 8. 更新现有记录的默认值（可选）
UPDATE "DailyTask" SET 
  estimated_minutes = 5,
  difficulty = 'medium'
WHERE estimated_minutes IS NULL;

COMMIT;

-- 迁移完成 ✅
-- 接下来需要：
-- 1. 运行: npx prisma migrate dev --name add-interactive-learning-fields
-- 2. 验证: npx prisma studio