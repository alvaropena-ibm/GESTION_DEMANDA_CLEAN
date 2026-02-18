-- Migration: Add delivery_hours column to projects table
-- Date: 2026-02-09
-- Description: Adds delivery_hours column to track delivered hours for each project

-- Add delivery_hours column (nullable, default NULL)
ALTER TABLE projects 
ADD COLUMN delivery_hours DECIMAL(10,2) DEFAULT NULL;

-- Add comment to column
COMMENT ON COLUMN projects.delivery_hours IS 'Horas entregadas/realizadas del proyecto';

COMMIT;