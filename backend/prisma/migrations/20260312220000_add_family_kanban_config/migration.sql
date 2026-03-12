-- Add persisted kanban board configuration on family level
ALTER TABLE "families"
ADD COLUMN "kanbanConfig" JSONB DEFAULT '{}'::jsonb;
