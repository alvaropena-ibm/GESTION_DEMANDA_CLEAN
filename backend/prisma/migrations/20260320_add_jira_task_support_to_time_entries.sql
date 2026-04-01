-- Migration: Add jira_task_id support to time_entries table
-- Date: 2026-03-20
-- Description: Allow time_entries to reference jira_tasks instead of only projects

-- Step 1: Add jira_task_id column (nullable)
ALTER TABLE time_entries 
ADD COLUMN IF NOT EXISTS jira_task_id UUID;

-- Step 2: Add foreign key constraint to jira_tasks
ALTER TABLE time_entries
ADD CONSTRAINT fk_time_entries_jira_task
FOREIGN KEY (jira_task_id) 
REFERENCES jira_tasks(id) 
ON DELETE CASCADE;

-- Step 3: Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_time_entries_jira_task_id 
ON time_entries(jira_task_id);

-- Step 4: Make project_id nullable (since we now have jira_task_id as alternative)
ALTER TABLE time_entries 
ALTER COLUMN project_id DROP NOT NULL;

-- Step 5: Add check constraint to ensure at least one reference exists
ALTER TABLE time_entries
ADD CONSTRAINT chk_time_entries_has_reference
CHECK (project_id IS NOT NULL OR jira_task_id IS NOT NULL);

-- Verification: Check the table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'time_entries'
ORDER BY ordinal_position;

-- Success message
SELECT 'Migration completed successfully! time_entries now supports jira_tasks.' as status;