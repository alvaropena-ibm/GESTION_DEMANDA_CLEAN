-- Migration: Create time_entries table for time tracking/claims
-- Date: 2026-01-27
-- Description: Creates the time_entries table to store historical time tracking data

CREATE TABLE IF NOT EXISTS time_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    resource_id UUID NOT NULL,
    work_date DATE NOT NULL,
    task_title VARCHAR(255) NOT NULL,
    task_description TEXT,
    activity VARCHAR(50) NOT NULL,
    hours DECIMAL(10, 2) NOT NULL,
    module VARCHAR(100),
    team VARCHAR(50) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign keys
    CONSTRAINT fk_time_entries_project FOREIGN KEY (project_id) 
        REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_time_entries_resource FOREIGN KEY (resource_id) 
        REFERENCES resources(id) ON DELETE CASCADE,
    
    -- Constraints
    CONSTRAINT chk_hours_positive CHECK (hours > 0),
    CONSTRAINT chk_activity_valid CHECK (activity IN (
        'Análisis', 'Diseño', 'Desarrollo', 'Testing', 'Documentación',
        'Reuniones', 'Code Review', 'Despliegue', 'Soporte', 'Formación', 'Otros'
    ))
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_time_entries_project ON time_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_resource ON time_entries(resource_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_work_date ON time_entries(work_date);
CREATE INDEX IF NOT EXISTS idx_time_entries_team ON time_entries(team);
CREATE INDEX IF NOT EXISTS idx_time_entries_resource_date ON time_entries(resource_id, work_date);

-- Add comments
COMMENT ON TABLE time_entries IS 'Stores historical time tracking entries (claims) for resources on projects';
COMMENT ON COLUMN time_entries.work_date IS 'Date when the work was performed';
COMMENT ON COLUMN time_entries.task_title IS 'Brief title/summary of the task performed';
COMMENT ON COLUMN time_entries.task_description IS 'Detailed description of the work performed';
COMMENT ON COLUMN time_entries.activity IS 'Type of activity performed';
COMMENT ON COLUMN time_entries.hours IS 'Number of hours worked (can be decimal)';
COMMENT ON COLUMN time_entries.module IS 'Optional module or component identifier';