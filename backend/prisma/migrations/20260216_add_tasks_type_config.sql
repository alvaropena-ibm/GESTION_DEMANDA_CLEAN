-- Migration: Add tasks_type configuration for each team
-- Date: 2026-02-16
-- Description: Configure task types for each team (SAP, SAPLCORP, Mulesoft, Darwin)
-- Values: Soporte_PAP, Tareas_Varias

-- Insert tasks_type configuration for SAP team
INSERT INTO app_config (config_key, config_value, config_type, team, description, is_active, created_at, updated_at)
VALUES (
    'tasks_type',
    '["Soporte_PAP", "Tareas_Varias"]',
    'json',
    'SAP',
    'Tipos de tareas disponibles para el equipo SAP',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (config_key, team) DO UPDATE
SET config_value = EXCLUDED.config_value,
    updated_at = CURRENT_TIMESTAMP;

-- Insert tasks_type configuration for SAPLCORP team
INSERT INTO app_config (config_key, config_value, config_type, team, description, is_active, created_at, updated_at)
VALUES (
    'tasks_type',
    '["Soporte_PAP", "Tareas_Varias"]',
    'json',
    'SAPLCORP',
    'Tipos de tareas disponibles para el equipo SAPLCORP',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (config_key, team) DO UPDATE
SET config_value = EXCLUDED.config_value,
    updated_at = CURRENT_TIMESTAMP;

-- Insert tasks_type configuration for Mulesoft team
INSERT INTO app_config (config_key, config_value, config_type, team, description, is_active, created_at, updated_at)
VALUES (
    'tasks_type',
    '["Soporte_PAP", "Tareas_Varias"]',
    'json',
    'Mulesoft',
    'Tipos de tareas disponibles para el equipo Mulesoft',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (config_key, team) DO UPDATE
SET config_value = EXCLUDED.config_value,
    updated_at = CURRENT_TIMESTAMP;

-- Insert tasks_type configuration for Darwin team
INSERT INTO app_config (config_key, config_value, config_type, team, description, is_active, created_at, updated_at)
VALUES (
    'tasks_type',
    '["Soporte_PAP", "Tareas_Varias"]',
    'json',
    'Darwin',
    'Tipos de tareas disponibles para el equipo Darwin',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (config_key, team) DO UPDATE
SET config_value = EXCLUDED.config_value,
    updated_at = CURRENT_TIMESTAMP;

-- Verify insertions
SELECT config_key, config_value, team, created_at 
FROM app_config 
WHERE config_key = 'tasks_type'
ORDER BY team;
