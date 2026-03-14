-- 迁移：添加学习计划监控和资料推荐系统相关表
-- 执行日期：2025-03-14
-- 描述：扩展用户档案、学习会话、资料反馈、计划调整记录

-- 1. 扩展 User 表
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "learning_style" VARCHAR(50);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "preferred_materials" JSONB;

-- 2. 扩展 DailyTask 表
ALTER TABLE "DailyTask" ADD COLUMN IF NOT EXISTS "used_material" VARCHAR(255);

-- 3. 扩展 ProgressSnapshot 表
ALTER TABLE "ProgressSnapshot" ADD COLUMN IF NOT EXISTS "study_minutes_today" INTEGER DEFAULT 0;
ALTER TABLE "ProgressSnapshot" ADD COLUMN IF NOT EXISTS "mood_today" VARCHAR(50);

-- 4. 创建新表：PlanAdjustment（计划调整记录）
CREATE TABLE IF NOT EXISTS "PlanAdjustment" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INT,
  "adjustment_date" TIMESTAMP NOT NULL DEFAULT NOW(),
  "reason" VARCHAR(100) NOT NULL, -- too_fast/too_slow/material_not_suitable/time_insufficient/other
  "reason_detail" TEXT,
  "original_plan" JSONB NOT NULL,
  "adjusted_plan" JSONB NOT NULL,
  "impact_modules" JSONB,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT "PlanAdjustment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL
);

-- 5. 创建新表：MaterialFeedback（资料反馈）
CREATE TABLE IF NOT EXISTS "MaterialFeedback" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INT NOT NULL,
  "material_name" VARCHAR(255) NOT NULL,
  "rating" INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  "feedback_text" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT "MaterialFeedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "MaterialFeedback_user_id_material_name_key" UNIQUE ("user_id", "material_name")
);

-- 6. 创建新表：StudySession（学习会话记录）
CREATE TABLE IF NOT EXISTS "StudySession" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INT NOT NULL,
  "start_time" TIMESTAMP NOT NULL,
  "end_time" TIMESTAMP,
  "duration_minutes" INT,
  "tasks_completed" INT,
  "correct_count" INT,
  "knowledge_points" JSONB,
  "mood_after" VARCHAR(50),
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT "StudySession_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE
);

-- 7. 创建索引
CREATE INDEX IF NOT EXISTS "idx_plan_adjustment_user_date" ON "PlanAdjustment" ("user_id", "adjustment_date");
CREATE INDEX IF NOT EXISTS "idx_material_feedback_user" ON "MaterialFeedback" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_material_feedback_name" ON "MaterialFeedback" ("material_name");
CREATE INDEX IF NOT EXISTS "idx_study_session_user_start" ON "StudySession" ("user_id", "start_time");
CREATE INDEX IF NOT EXISTS "idx_user_learning_style" ON "User" ("learning_style");

-- 8. 为 DailyTask.used_material 创建索引
CREATE INDEX IF NOT EXISTS "idx_daily_task_material" ON "DailyTask" ("used_material");

COMMIT;

-- 迁移完成 ✅
-- 下一步：
-- 1. 运行: npx prisma migrate dev --name add-study-plan-monitoring
-- 2. 更新 User 表，增加 learning_style 和 preferred_materials 字段
-- 3. 开发计划调整API和前端界面