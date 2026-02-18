-- Migration: Add module column to assignments table
-- Date: 2026-02-03
-- Description: Adds module field to track which module an assignment belongs to

-- Add module column
ALTER TABLE assignments 
ADD COLUMN module VARCHAR(100) NULL;

-- Create index for better query performance
CREATE INDEX idx_assignments_module ON assignments(module);

-- Add comment to column
COMMENT ON COLUMN assignments.module IS 'Module associated with the assignment (e.g., Frontend, Backend, Database)';