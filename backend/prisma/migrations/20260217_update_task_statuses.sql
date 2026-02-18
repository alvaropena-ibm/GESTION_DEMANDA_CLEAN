-- Migración para actualizar los estados de las tareas
-- Los estados de tareas son diferentes a los de proyectos

-- Primero, eliminar la configuración anterior de estados de tareas si existe
DELETE FROM app_config WHERE config_key = 'task_statuses';

-- Insertar los nuevos estados de tareas
INSERT INTO app_config (config_key, config_value, description, created_at, updated_at)
VALUES (
    'task_statuses',
    '["TAREAS POR HACER","CONCEPTUALIZACIÓN","CIERRE REQUISITOS","EN VALORACIÓN","VALE PDTE. APROB","EN SD","SD PDTE APROB","EN DESARROLLO","EN VALIDACIÓN SSII","UAT","READY TO PROMOTE","FINALIZADO","CANCELADO","WAITING"]',
    'Estados disponibles para las tareas (diferentes a los estados de proyectos)',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (config_key) DO UPDATE
SET 
    config_value = EXCLUDED.config_value,
    description = EXCLUDED.description,
    updated_at = CURRENT_TIMESTAMP;

-- Verificar que los estados de proyectos se mantienen separados
-- (no modificar project_statuses)