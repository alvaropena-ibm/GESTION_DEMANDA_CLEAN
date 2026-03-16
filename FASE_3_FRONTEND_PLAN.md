# FASE 3: Frontend - Plan de Migración

## 🎯 Objetivo
Actualizar el frontend para usar `jira_tasks` en lugar de `projects` en las funciones relacionadas con asignaciones y tareas de conceptualización.

## 📋 Análisis de Cambios Necesarios

### 1. **main.js** - Funciones de Modal
**Ubicación:** `frontend/js/main.js`

#### Funciones a Actualizar:

##### a) `openConceptTasksModal(projectCode)` - Línea ~450
**ANTES:**
```javascript
function openConceptTasksModal(projectCode) {
    const project = allProjects.find(p => p.code === projectCode);
    openAssignmentView(project.id, project.code, project.title);
}
```

**DESPUÉS:**
```javascript
function openConceptTasksModal(projectCode) {
    const project = allProjects.find(p => p.code === projectCode);
    // Buscar jira_task correspondiente
    const jiraTask = allProjects.find(p => p.code === projectCode);
    openAssignmentView(jiraTask.id, jiraTask.code, jiraTask.title);
}
```

**NOTA:** En realidad, como `allProjects` ahora contiene datos de `jira_tasks`, el cambio es mínimo. Solo necesitamos asegurarnos de que `openAssignmentView` use el ID correcto.

---

### 2. **assignmentView.js** - Llamadas API
**Ubicación:** `frontend/js/components/assignmentView.js`

#### Cambios Necesarios:

##### a) Función `loadConceptTasks()`
**ANTES:**
```javascript
const response = await fetch(
    `${API_CONFIG.BASE_URL}/concept-tasks?projectId=${projectId}`,
    { headers }
);
```

**DESPUÉS:**
```javascript
const response = await fetch(
    `${API_CONFIG.BASE_URL}/concept-tasks?jiraTaskId=${projectId}`,
    { headers }
);
```

##### b) Función `createConceptTask()`
**ANTES:**
```javascript
body: JSON.stringify({
    projectId: projectId,
    title, description, hours, skillName
})
```

**DESPUÉS:**
```javascript
body: JSON.stringify({
    jiraTaskId: projectId,
    title, description, hours, skillName
})
```

##### c) Función `loadAssignments()`
**ANTES:**
```javascript
const response = await fetch(
    `${API_CONFIG.BASE_URL}/assignments?projectId=${projectId}`,
    { headers }
);
```

**DESPUÉS:**
```javascript
const response = await fetch(
    `${API_CONFIG.BASE_URL}/assignments?jiraTaskId=${projectId}`,
    { headers }
);
```

##### d) Función `saveAssignment()`
**ANTES:**
```javascript
body: JSON.stringify({
    projectId: projectId,
    resourceId, title, description, ...
})
```

**DESPUÉS:**
```javascript
body: JSON.stringify({
    jiraTaskId: projectId,
    resourceId, title, description, ...
})
```

---

### 3. **Iconos en Tablas** - Cambiar de Projects a Tasks
**Ubicación:** `frontend/js/main.js`

#### Tabla de Proyectos (Projects Tab):
- ✅ **Mantener** icono de "Asignación de Recursos" (personas)
- ✅ **Mantener** icono de "Tareas Conceptualización" (clipboard)
- **Razón:** Los proyectos siguen necesitando asignaciones

#### Tabla de Tareas (Tasks Tab):
- ✅ **Añadir** icono de "Asignación de Recursos" (personas)
- ✅ **Añadir** icono de "Tareas Conceptualización" (clipboard)
- **Razón:** Las tareas de Jira ahora también pueden tener asignaciones

---

## 🔄 Estrategia de Implementación

### Paso 1: Actualizar assignmentView.js
- Cambiar parámetros de `projectId` a `jiraTaskId` en llamadas API
- Mantener compatibilidad con backend (que acepta ambos)

### Paso 2: Añadir iconos a tabla de Tasks
- Copiar lógica de iconos de tabla de Projects
- Adaptar para usar datos de `jira_tasks`

### Paso 3: Probar funcionalidad
- Verificar que se pueden crear asignaciones desde Projects
- Verificar que se pueden crear asignaciones desde Tasks
- Verificar que se pueden crear concept tasks desde ambos

---

## 📝 Cambios Detallados por Archivo

### 1. `frontend/js/components/assignmentView.js`
**Líneas a modificar:** ~50, ~150, ~250, ~350
**Cambios:** 4 ocurrencias de `projectId` → `jiraTaskId`
**Tiempo estimado:** 10 minutos

### 2. `frontend/js/main.js` - Tabla de Tasks
**Líneas a modificar:** ~1800-1900 (función `updateTasksTable`)
**Cambios:** Añadir columna de acciones con iconos
**Tiempo estimado:** 20 minutos

### 3. `frontend/js/main.js` - Event Handlers
**Líneas a modificar:** ~300-400
**Cambios:** Añadir handlers para iconos de tasks
**Tiempo estimado:** 10 minutos

---

## ✅ Checklist de Implementación

- [ ] Actualizar `assignmentView.js` - loadConceptTasks()
- [ ] Actualizar `assignmentView.js` - createConceptTask()
- [ ] Actualizar `assignmentView.js` - loadAssignments()
- [ ] Actualizar `assignmentView.js` - saveAssignment()
- [ ] Añadir iconos a tabla de Tasks
- [ ] Añadir event handlers para iconos de Tasks
- [ ] Probar asignaciones desde Projects
- [ ] Probar asignaciones desde Tasks
- [ ] Verificar concept tasks desde Projects
- [ ] Verificar concept tasks desde Tasks

---

## 🎯 Resultado Esperado

### Funcionalidad Final:
1. ✅ Usuarios pueden asignar recursos desde **Projects** (como antes)
2. ✅ Usuarios pueden asignar recursos desde **Tasks** (nuevo)
3. ✅ Usuarios pueden crear concept tasks desde **Projects** (como antes)
4. ✅ Usuarios pueden crear concept tasks desde **Tasks** (nuevo)
5. ✅ Backend acepta tanto `projectId` como `jiraTaskId` (compatibilidad)

### Ventajas:
- ✅ Más flexibilidad para gestionar asignaciones
- ✅ Consistencia entre Projects y Tasks
- ✅ Mejor experiencia de usuario
- ✅ Preparado para futuras funcionalidades

---

## ⏱️ Tiempo Estimado Total
**40-50 minutos**

---

**Fecha:** 2026-03-13  
**Estado:** Plan creado, listo para implementación