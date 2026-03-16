-- ============================================================================
-- MIGRACIÓN: Cambiar relaciones de assignments y concept_tasks a jira_tasks
-- Fecha: 2026-03-13
-- Descripción: Migra las relaciones de project_id a jira_task_id
-- ============================================================================

-- ============================================================================
-- PARTE 1: ASSIGNMENTS
-- ============================================================================

-- Paso 1: Añadir nueva columna jira_task_id a assignments (nullable)
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS jira_task_id UUID;

-- Paso 2: Crear índice para la nueva columna
CREATE INDEX IF NOT EXISTS idx_assignments_jira_task ON assignments(jira_task_id);

-- Paso 3: Migrar datos existentes (mapear project_id a jira_task_id)
-- Esto requiere que exista una correspondencia entre projects y jira_tasks por código
UPDATE assignments a
SET jira_task_id = jt.id
FROM projects p
INNER JOIN jira_tasks jt ON p.code = jt.code AND p.team = jt.team
WHERE a.project_id = p.id
  AND a.jira_task_id IS NULL;  -- Solo actualizar si no tiene valor

-- Paso 4: Hacer project_id nullable (para permitir transición)
ALTER TABLE assignments ALTER COLUMN project_id DROP NOT NULL;

-- Paso 5: Añadir foreign key constraint para jira_task_id
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_assignments_jira_task'
    ) THEN
        ALTER TABLE assignments 
        ADD CONSTRAINT fk_assignments_jira_task 
        FOREIGN KEY (jira_task_id) REFERENCES jira_tasks(id) ON DELETE CASCADE;
    END IF;
END $$;

-- ============================================================================
-- PARTE 2: CONCEPT_TASKS
-- ============================================================================

-- Paso 6: Añadir nueva columna jira_task_id a concept_tasks (nullable)
ALTER TABLE concept_tasks ADD COLUMN IF NOT EXISTS jira_task_id UUID;

-- Paso 7: Crear índice para la nueva columna
CREATE INDEX IF NOT EXISTS idx_concept_tasks_jira_task ON concept_tasks(jira_task_id);

-- Paso 8: Migrar datos existentes
UPDATE concept_tasks ct
SET jira_task_id = jt.id
FROM projects p
INNER JOIN jira_tasks jt ON p.code = jt.code AND p.team = jt.team
WHERE ct.project_id = p.id
  AND ct.jira_task_id IS NULL;  -- Solo actualizar si no tiene valor

-- Paso 9: Hacer project_id nullable
ALTER TABLE concept_tasks ALTER COLUMN project_id DROP NOT NULL;

-- Paso 10: Añadir foreign key constraint para jira_task_id
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_concept_tasks_jira_task'
    ) THEN
        ALTER TABLE concept_tasks 
        ADD CONSTRAINT fk_concept_tasks_jira_task 
        FOREIGN KEY (jira_task_id) REFERENCES jira_tasks(id) ON DELETE CASCADE;
    END IF;
END $$;

-- ============================================================================
-- VERIFICACIÓN DE LA MIGRACIÓN
-- ============================================================================

-- Verificar cuántos assignments se migraron
DO $$
DECLARE
    total_assignments INTEGER;
    migrated_assignments INTEGER;
    unmigrated_assignments INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_assignments FROM assignments;
    SELECT COUNT(*) INTO migrated_assignments FROM assignments WHERE jira_task_id IS NOT NULL;
    SELECT COUNT(*) INTO unmigrated_assignments FROM assignments WHERE jira_task_id IS NULL AND project_id IS NOT NULL;
    
    RAISE NOTICE '=== ASSIGNMENTS MIGRATION REPORT ===';
    RAISE NOTICE 'Total assignments: %', total_assignments;
    RAISE NOTICE 'Migrated to jira_tasks: %', migrated_assignments;
    RAISE NOTICE 'Not migrated (no matching jira_task): %', unmigrated_assignments;
END $$;

-- Verificar cuántos concept_tasks se migraron
DO $$
DECLARE
    total_concept_tasks INTEGER;
    migrated_concept_tasks INTEGER;
    unmigrated_concept_tasks INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_concept_tasks FROM concept_tasks;
    SELECT COUNT(*) INTO migrated_concept_tasks FROM concept_tasks WHERE jira_task_id IS NOT NULL;
    SELECT COUNT(*) INTO unmigrated_concept_tasks FROM concept_tasks WHERE jira_task_id IS NULL AND project_id IS NOT NULL;
    
    RAISE NOTICE '=== CONCEPT_TASKS MIGRATION REPORT ===';
    RAISE NOTICE 'Total concept_tasks: %', total_concept_tasks;
    RAISE NOTICE 'Migrated to jira_tasks: %', migrated_concept_tasks;
    RAISE NOTICE 'Not migrated (no matching jira_task): %', unmigrated_concept_tasks;
END $$;

-- ============================================================================
-- NOTAS IMPORTANTES
-- ============================================================================

-- NOTA 1: NO eliminamos project_id todavía para permitir rollback si es necesario
-- Se puede eliminar en una migración posterior una vez verificado que todo funciona

-- NOTA 2: Si hay assignments o concept_tasks que no se migraron (no tienen jira_task equivalente),
-- se deben crear los jira_tasks correspondientes o decidir qué hacer con esos registros

-- NOTA 3: Para hacer rollback de esta migración:
-- UPDATE assignments SET project_id = (SELECT p.id FROM projects p INNER JOIN jira_tasks jt ON p.code = jt.code WHERE jt.id = assignments.jira_task_id) WHERE jira_task_id IS NOT NULL;
-- UPDATE concept_tasks SET project_id = (SELECT p.id FROM projects p INNER JOIN jira_tasks jt ON p.code = jt.code WHERE jt.id = concept_tasks.jira_task_id) WHERE jira_task_id IS NOT NULL;
-- ALTER TABLE assignments DROP COLUMN jira_task_id;
-- ALTER TABLE concept_tasks DROP COLUMN jira_task_id;

-- ============================================================================
-- FIN DE LA MIGRACIÓN
-- ============================================================================