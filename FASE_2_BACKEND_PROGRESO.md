# FASE 2: Backend - Progreso de Actualización

## 📊 Estado Actual

### ✅ Completado

#### 1. assignmentsHandler.js - Parcialmente Actualizado
- ✅ **listAssignments()** - Actualizado para usar `jira_tasks` en lugar de `projects`
  - Cambiado JOIN de `projects` a `jira_tasks`
  - Añadido soporte para `jiraTaskId` parameter
  - Mantenida compatibilidad con `projectId` (legacy)
  - Retorna `jira_task` en lugar de `project`

### ⏳ Pendiente en assignmentsHandler.js

#### 2. getAssignmentById()
**Cambios necesarios:**
```javascript
// ANTES
LEFT JOIN projects p ON a.project_id = p.id

// DESPUÉS
LEFT JOIN jira_tasks jt ON a.jira_task_id = jt.id
```

#### 3. createAssignment()
**Cambios necesarios:**
- Aceptar `jiraTaskId` además de `projectId`
- Validar contra `jira_tasks` en lugar de `projects`
- Insertar `jira_task_id` en lugar de `project_id`
- Actualizar query de detalles para usar `jira_tasks`

**Código a cambiar:**
```javascript
// Validación
if (!data.jiraTaskId && !data.projectId) {
    return errorResponse('jiraTaskId or projectId is required', 400);
}

// Si viene projectId (legacy), convertir a jiraTaskId
let jiraTaskId = data.jiraTaskId;
if (!jiraTaskId && data.projectId) {
    const jiraTaskResult = await query(
        'SELECT id FROM jira_tasks WHERE code = (SELECT code FROM projects WHERE id = $1)',
        [data.projectId]
    );
    if (jiraTaskResult.rows.length > 0) {
        jiraTaskId = jiraTaskResult.rows[0].id;
    }
}

// Check if jira_task exists
const jiraTaskCheck = await query('SELECT id FROM jira_tasks WHERE id = $1', [jiraTaskId]);
if (jiraTaskCheck.rows.length === 0) {
    return errorResponse(`JiraTask with ID '${jiraTaskId}' not found`, 404);
}

// INSERT con jira_task_id
INSERT INTO assignments (
    jira_task_id, resource_id, title, ...
) VALUES ($1, $2, $3, ...)
```

#### 4. updateAssignment()
**Cambios necesarios:**
- Actualizar query de detalles para usar `jira_tasks`

#### 5. deleteProjectAssignments()
**Cambios necesarios:**
- Renombrar a `deleteJiraTaskAssignments()`
- Cambiar de `project_id` a `jira_task_id`
- Mantener compatibilidad con `projectId` parameter

---

## 📝 Archivos Pendientes

### 2. conceptTasksHandler.js
**Funciones a actualizar:**
- `listConceptTasks()` - Cambiar JOIN a `jira_tasks`
- `getConceptTaskById()` - Cambiar JOIN a `jira_tasks`
- `createConceptTask()` - Validar contra `jira_tasks`, insertar `jira_task_id`
- `updateConceptTask()` - Actualizar query de detalles
- `deleteConceptTask()` - Sin cambios necesarios

### 3. jiraTasksHandler.js
**Nuevos endpoints a añadir:**
- `GET /jira-tasks/:id/assignments` - Listar assignments de una tarea
- `GET /jira-tasks/:id/concept-tasks` - Listar concept tasks de una tarea
- `POST /jira-tasks/:id/assignments` - Crear assignment para una tarea
- `POST /jira-tasks/:id/concept-tasks` - Crear concept task para una tarea

### 4. projectsHandler.js (Opcional)
**Opciones:**
- **Opción A:** Eliminar endpoints de assignments/concept_tasks
- **Opción B:** Mantener pero redirigir a jira_tasks
- **Opción C:** Retornar arrays vacíos con mensaje de deprecación

---

## 🎯 Estrategia de Implementación

### Fase 2A: Completar assignmentsHandler.js
1. ✅ listAssignments() - COMPLETADO
2. ⏳ getAssignmentById()
3. ⏳ createAssignment()
4. ⏳ updateAssignment()
5. ⏳ deleteProjectAssignments()

### Fase 2B: Actualizar conceptTasksHandler.js
1. ⏳ listConceptTasks()
2. ⏳ getConceptTaskById()
3. ⏳ createConceptTask()
4. ⏳ updateConceptTask()
5. ⏳ deleteConceptTask()

### Fase 2C: Extender jiraTasksHandler.js
1. ⏳ GET /jira-tasks/:id/assignments
2. ⏳ GET /jira-tasks/:id/concept-tasks
3. ⏳ POST /jira-tasks/:id/assignments
4. ⏳ POST /jira-tasks/:id/concept-tasks

### Fase 2D: Desplegar Lambdas
1. ⏳ Desplegar assignmentsHandler
2. ⏳ Desplegar conceptTasksHandler
3. ⏳ Desplegar jiraTasksHandler
4. ⏳ Verificar endpoints

---

## 🔄 Compatibilidad Durante Transición

### Estrategia Dual-ID
Durante la transición, las lambdas aceptarán AMBOS parámetros:
- `jiraTaskId` (nuevo, preferido)
- `projectId` (legacy, convertido automáticamente)

**Ejemplo:**
```javascript
// Frontend puede enviar cualquiera de los dos
GET /assignments?jiraTaskId=xxx  // Nuevo
GET /assignments?projectId=yyy   // Legacy (se convierte internamente)
```

### Conversión Automática
```javascript
// Si viene projectId, convertir a jiraTaskId
if (projectId && !jiraTaskId) {
    const result = await query(
        'SELECT id FROM jira_tasks WHERE code = (SELECT code FROM projects WHERE id = $1)',
        [projectId]
    );
    jiraTaskId = result.rows[0]?.id;
}
```

---

## 📋 Checklist de Verificación

### Por cada función actualizada:
- [ ] Cambiado JOIN de `projects` a `jira_tasks`
- [ ] Cambiado `project_id` a `jira_task_id`
- [ ] Añadido soporte para `jiraTaskId` parameter
- [ ] Mantenida compatibilidad con `projectId` (legacy)
- [ ] Actualizado objeto de respuesta (`jira_task` en lugar de `project`)
- [ ] Probado con ambos parámetros (jiraTaskId y projectId)

### Por cada lambda:
- [ ] Todas las funciones actualizadas
- [ ] Tests unitarios pasando
- [ ] Desplegada en AWS
- [ ] Endpoints verificados
- [ ] Documentación actualizada

---

## 🚀 Próximos Pasos Inmediatos

1. **Completar assignmentsHandler.js** (4 funciones pendientes)
2. **Actualizar conceptTasksHandler.js** (5 funciones)
3. **Extender jiraTasksHandler.js** (4 nuevos endpoints)
4. **Desplegar y verificar**

---

**Fecha:** 2026-03-13
**Estado:** Fase 2 en progreso (20% completado)
**Siguiente:** Completar assignmentsHandler.js