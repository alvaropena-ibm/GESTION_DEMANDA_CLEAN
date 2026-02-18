-- Migration: Create jira_tasks table
-- Date: 2026-02-05
-- Description: Creates jira_tasks table for SCOM - SAP LCORP Jira tasks

-- Create jira_tasks table
CREATE TABLE IF NOT EXISTS jira_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(20),
    priority VARCHAR(20) NOT NULL,
    start_date DATE,
    end_date DATE,
    status INTEGER NOT NULL,
    domain INTEGER NOT NULL,
    team VARCHAR(50) NOT NULL,
    jira_issue_key VARCHAR(255),
    jira_url TEXT,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT jira_tasks_code_team_unique UNIQUE (code, team)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_jira_tasks_code ON jira_tasks(code);
CREATE INDEX IF NOT EXISTS idx_jira_tasks_type ON jira_tasks(type);
CREATE INDEX IF NOT EXISTS idx_jira_tasks_status ON jira_tasks(status);
CREATE INDEX IF NOT EXISTS idx_jira_tasks_domain ON jira_tasks(domain);
CREATE INDEX IF NOT EXISTS idx_jira_tasks_team ON jira_tasks(team);
CREATE INDEX IF NOT EXISTS idx_jira_tasks_jira_key ON jira_tasks(jira_issue_key);

-- Add comment to table
COMMENT ON TABLE jira_tasks IS 'Stores tasks imported from SCOM - SAP LCORP Jira project';

-- Add comments to important columns
COMMENT ON COLUMN jira_tasks.code IS 'Task code/key (e.g., SCOM-123)';
COMMENT ON COLUMN jira_tasks.jira_issue_key IS 'Original Jira issue key';
COMMENT ON COLUMN jira_tasks.jira_url IS 'Direct URL to Jira issue';
COMMENT ON COLUMN jira_tasks.team IS 'Team that owns this task';

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON jira_tasks TO your_app_user;

COMMIT;