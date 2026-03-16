# Plan de Migración: Assignments y ConceptTasks a JiraTasks

## 📋 Resumen del Cambio

**Objetivo:** Cambiar las relaciones de `assignments` y `concept_tasks` para que apunten a `jira_tasks` en lugar de `projects`.

**Impacto:** 
- Base de datos (schema + migración)
- Backend (4 lambdas)
- Frontend (múltiples componentes)

---

## 🗄️ FASE 1: Base de Datos

### 1.1 Cambios en Schema Prisma

**Archivo:** `backend/database/schema/schema.prisma`

#### Modelo Assignment
```prisma
// ANTES
model Assignment {
  projectId    String    @map("project_id") @db.Uuid
  project      Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
}

// DESPUÉS
model Assignment {
  jiraTaskId   String?   @map("jira_task_id") @db.Uuid
  jiraTask     JiraTask? @relation(fields: [jiraTaskId], references: [id], onDelete: Cascade)
}
```

#### Modelo ConceptTask
```prisma
// ANTES
model ConceptTask {
  projectId   String   @map("project_id") @db.Uuid
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
}

// DESPUÉS
model ConceptTask {
  jiraTaskId  String?  @map("jira_task_id") @db.Uuid
  jiraTask    JiraTask? @relation(fields: [jiraTaskId], references: [id], onDelete: Cascade)
}
```

#### Modelo JiraTask (añadir relaciones)
```prisma
model JiraTask {
  // ... campos existentes ...
  assignments     Assignment[]
  conceptTasks    ConceptTask[]
}
```

#### Modelo Project (eliminar relaciones)
```prisma
model Project {
  // ELIMINAR estas líneas:
  // assignments            Assignment[]
  // conceptTasks           ConceptTask[]
}
```

### 1.2 Script de Migración SQL

**Archivo:** `backend/prisma/migrations/20260312_migrate_to_jira_tasks.sql`

```sql
-- Paso 1: Añadir nueva columna jira_task_id a assignments (nullable)
ALTER TABLE assignments ADD COLUMN jira_task_id UUID;

-- Paso 2: Crear índice para la nueva columna
CREATE INDEX idx_assignments_jira_task ON assignments(jira_task_id);

-- Paso 3: Migrar datos existentes (mapear project_id a jira_task_id)
-- Esto requiere que exista una correspondencia entre projects y jira_tasks por código
UPDATE assignments a
SET jira_task_id = jt.id
FROM projects p
INNER JOIN jira_tasks jt ON p.code = jt.code AND p.team = jt.team
WHERE a.project_id = p.id;

-- Paso 4: Hacer project_id nullable (para permitir transición)
ALTER TABLE assignments ALTER COLUMN project_id DROP NOT NULL;

-- Paso 5: Añadir nueva columna jira_task_id a concept_tasks (nullable)
ALTER TABLE concept_tasks ADD COLUMN jira_task_id UUID;

-- Paso 6: Crear índice para la nueva columna
CREATE INDEX idx_concept_tasks_jira_task ON concept_tasks(jira_task_id);

-- Paso 7: Migrar datos existentes
UPDATE concept_tasks ct
SET jira_task_id = jt.id
FROM projects p
INNER JOIN jira_tasks jt ON p.code = jt.code AND p.team = jt.team
WHERE ct.project_id = p.id;

-- Paso 8: Hacer project_id nullable
ALTER TABLE concept_tasks ALTER COLUMN project_id DROP NOT NULL;

-- Paso 9: Añadir foreign key constraints
ALTER TABLE assignments 
ADD CONSTRAINT fk_assignments_jira_task 
FOREIGN KEY (jira_task_id) REFERENCES jira_tasks(id) ON DELETE CASCADE;

ALTER TABLE concept_tasks 
ADD CONSTRAINT fk_concept_tasks_jira_task 
FOREIGN KEY (jira_task_id) REFERENCES jira_tasks(id) ON DELETE CASCADE;

-- NOTA: NO eliminamos project_id todavía para permitir rollback si es necesario
-- Se puede eliminar en una migración posterior una vez verificado que todo funciona
```

---

## 🔧 FASE 2: Backend (Lambdas)

### 2.1 Assignments Handler

**Archivo:** `backend/lambda-functions/assignments/assignmentsHandler.js`

**Cambios necesarios:**

1. **GET /assignments** - Cambiar join de `projects` a `jira_tasks`
```javascript
// ANTES
const query = `
  SELECT a.*, p.code as project_code, p.title as project_title
  FROM assignments a
  LEFT JOIN projects p ON a.project_id = p.id
  WHERE UPPER(r.team) = UPPER($1)
`;

// DESPUÉS
const query = `
  SELECT a.*, jt.code as jira_task_code, jt.title as jira_task_title
  FROM assignments a
  LEFT JOIN jira_tasks jt ON a.jira_task_id = jt.id
  WHERE UPPER(jt.team) = UPPER($1)
`;
```

2. **POST /assignments** - Cambiar validación y creación
```javascript
// ANTES
if (!projectId) throw new Error('projectId is required');

// DESPUÉS
if (!jiraTaskId) throw new Error('jiraTaskId is required');
```

3. **PUT /assignments/:id** - Actualizar lógica de update

4. **DELETE /assignments/:id** - Sin cambios necesarios

### 2.2 Concept Tasks Handler

**Archivo:** `backend/lambda-functions/concept-tasks/conceptTasksHandler.js`

**Cambios similares a assignments:**

1. GET - Cambiar join a `jira_tasks`
2. POST - Validar `jiraTaskId` en lugar de `projectId`
3. PUT - Actualizar lógica
4. DELETE - Sin cambios

### 2.3 Projects Handler

**Archivo:** `backend/lambda-functions/projects/projectsHandler.js`

**Cambios:**
- Eliminar endpoints que devuelven assignments/concept_tasks relacionados
- O mantenerlos pero que devuelvan arrays vacíos (para compatibilidad)

### 2.4 Jira Tasks Handler

**Archivo:** `backend/lambda-functions/jira-tasks/jiraTasksHandler.js`

**Añadir nuevos endpoints:**

1. **GET /jira-tasks/:id/assignments** - Obtener assignments de una tarea
2. **GET /jira-tasks/:id/concept-tasks** - Obtener concept tasks de una tarea
3. **POST /jira-tasks/:id/assignments** - Crear assignment para una tarea
4. **POST /jira-tasks/:id/concept-tasks** - Crear concept task para una tarea

---

## 🎨 FASE 3: Frontend

### 3.1 Componentes a Modificar

#### 3.1.1 main.js
**Cambios:**
- `openTasksModal(taskCode)` - Cambiar para buscar en `jira_tasks` en lugar de `projects`
- `openConceptTasksModal(taskCode)` - Cambiar para buscar en `jira_tasks`
- Actualizar tabla de tareas para mostrar iconos de asignación

#### 3.1.2 taskModal.js (Resource Assignment Modal)
**Cambios:**
- Cambiar parámetro de `projectCode` a `jiraTaskCode`
- Actualizar llamadas API para usar `/jira-tasks/:id/assignments`

#### 3.1.3 conceptTasksModal.js
**Cambios:**
- Cambiar parámetro de `projectId` a `jiraTaskId`
- Actualizar llamadas API para usar `/jira-tasks/:id/concept-tasks`

#### 3.1.4 assignmentView.js
**Cambios:**
- Cambiar de recibir `projectId` a `jiraTaskId`
- Actualizar todas las llamadas API

### 3.2 Tabla de Tareas (tasks-tab)

**Añadir columna de acciones:**
```html
<td>
    <span class="action-icon" data-action="assignments" data-task="${task.code}">
        <!-- Icono de asignación de recursos -->
    </span>
    <span class="action-icon" data-action="concept-tasks" data-task="${task.code}">
        <!-- Icono de tareas de conceptualización -->
    </span>
</td>
```

### 3.3 Tabla de Proyectos (projects-tab)

**Opciones:**
1. **Opción A:** Eliminar iconos de asignación (ya no aplican a proyectos)
2. **Opción B:** Mantener pero mostrar mensaje "Migrado a Trabajos"

---

## 📊 FASE 4: Datos y Compatibilidad

### 4.1 Estrategia de Migración de Datos

**Escenario 1: Todos los projects tienen jira_task equivalente**
- Migración directa usando código como clave

**Escenario 2: Algunos projects no tienen jira_task**
- Crear jira_tasks automáticamente para esos projects
- O mantener project_id como fallback

### 4.2 Período de Transición

**Fase de compatibilidad (opcional):**
1. Mantener ambas columnas (`project_id` y `jira_task_id`) por 1-2 semanas
2. Backend acepta ambos parámetros
3. Frontend usa solo `jira_task_id`
4. Después de verificación, eliminar `project_id`

---

## ✅ FASE 5: Testing y Validación

### 5.1 Tests de Base de Datos
- [ ] Verificar migración de datos
- [ ] Verificar integridad referencial
- [ ] Verificar índices creados

### 5.2 Tests de Backend
- [ ] GET assignments por jira_task
- [ ] POST assignment con jira_task_id
- [ ] GET concept_tasks por jira_task
- [ ] POST concept_task con jira_task_id

### 5.3 Tests de Frontend
- [ ] Abrir modal de asignación desde tabla de tareas
- [ ] Crear assignment desde tarea
- [ ] Abrir modal de concept tasks desde tabla de tareas
- [ ] Crear concept task desde tarea
- [ ] Verificar que proyectos ya no muestran estos modales

### 5.4 Tests de Integración
- [ ] Flujo completo: Crear tarea → Asignar recursos → Ver assignments
- [ ] Flujo completo: Crear tarea → Añadir concept tasks → Ver tasks
- [ ] Verificar KPIs y reportes

---

## 🚀 FASE 6: Despliegue

### 6.1 Orden de Despliegue

1. **Base de Datos** (primero)
   - Ejecutar migración SQL
   - Verificar datos migrados

2. **Backend** (segundo)
   - Desplegar lambdas actualizadas
   - Verificar endpoints

3. **Frontend** (tercero)
   - Desplegar archivos JS actualizados
   - Limpiar caché de CloudFront

### 6.2 Rollback Plan

Si algo falla:
1. Revertir frontend (usar versión anterior)
2. Revertir lambdas
3. Revertir migración SQL (si es posible)

---

## 📝 Checklist de Implementación

### Base de Datos
- [ ] Actualizar schema.prisma
- [ ] Crear script de migración SQL
- [ ] Ejecutar migración en desarrollo
- [ ] Verificar datos migrados
- [ ] Ejecutar migración en producción

### Backend
- [ ] Actualizar assignmentsHandler.js
- [ ] Actualizar conceptTasksHandler.js
- [ ] Actualizar jiraTasksHandler.js
- [ ] Actualizar projectsHandler.js (opcional)
- [ ] Desplegar lambdas

### Frontend
- [ ] Actualizar main.js
- [ ] Actualizar taskModal.js
- [ ] Actualizar conceptTasksModal.js
- [ ] Actualizar assignmentView.js
- [ ] Actualizar tabla de tareas
- [ ] Actualizar tabla de proyectos
- [ ] Desplegar frontend

### Testing
- [ ] Tests unitarios backend
- [ ] Tests integración
- [ ] Tests E2E frontend
- [ ] Validación con usuarios

---

## ⚠️ Consideraciones Importantes

1. **Datos Huérfanos:** ¿Qué pasa con assignments/concept_tasks que no tienen jira_task equivalente?
2. **Performance:** Verificar que los nuevos índices mejoran el rendimiento
3. **Reportes:** Actualizar cualquier reporte que use la relación antigua
4. **Documentación:** Actualizar documentación técnica
5. **Capacitación:** Informar a usuarios del cambio en la UI

---

## 🎯 Próximos Pasos

1. **Revisar y aprobar este plan**
2. **Decidir estrategia de migración de datos**
3. **Comenzar con Fase 1 (Base de Datos)**
4. **Implementar cambios incrementalmente**
5. **Testing exhaustivo en cada fase**

---

**Fecha de creación:** 2026-03-12
**Autor:** Sistema de Gestión de Demanda
**Estado:** Pendiente de aprobación