-- Migration: Add fix_versions field to projects and jira_tasks tables
-- Date: 2026-02-13
-- Description: Add JSONB field to store Jira fixVersions data

-- Add fix_versions to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS fix_versions JSONB DEFAULT '[]'::jsonb;

-- Add fix_versions to jira_tasks table
ALTER TABLE jira_tasks 
ADD COLUMN IF NOT EXISTS fix_versions JSONB DEFAULT '[]'::jsonb;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_projects_fix_versions ON projects USING GIN (fix_versions);
CREATE INDEX IF NOT EXISTS idx_jira_tasks_fix_versions ON jira_tasks USING GIN (fix_versions);

-- Add comments
COMMENT ON COLUMN projects.fix_versions IS 'Jira fix versions stored as JSONB array';
COMMENT ON COLUMN jira_tasks.fix_versions IS 'Jira fix versions stored as JSONB array';