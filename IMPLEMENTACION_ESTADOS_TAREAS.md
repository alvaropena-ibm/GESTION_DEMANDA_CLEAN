# Implementación de Estados Diferenciados para Tareas

## Resumen
Se han implementado estados específicos para las tareas, diferentes a los estados de los proyectos, según los requisitos proporcionados.

## Estados de Tareas Implementados

Los siguientes 14 estados están ahora disponibles para las tareas:

1. TAREAS POR HACER
2. CONCEPTUALIZACIÓN
3. CIERRE REQUISITOS
4. EN VALORACIÓN
5. VALE PDTE. APROB
6. EN SD
7. SD PDTE APROB
8. EN DESARROLLO
9. EN VALIDACIÓN SSII
10. UAT
11. READY TO PROMOTE
12. FINALIZADO
13. CANCELADO
14. WAITING

## Cambios Realizados

### 1. Base de Datos

**Archivo:** `backend/prisma/migrations/20260217_update_task_statuses.sql`
- Migración SQL que actualiza la tabla `app_config` con los nuevos estados de tareas
- Mantiene separados los estados de proyectos (`project_statuses`) y tareas (`task_statuses`)

**Archivo:** `backend/prisma/migrations/run_migration_task_statuses.js`
- Script Node.js para ejecutar la migración
- Incluye verificación de la configuración después de la migración

### 2. Backend

**Archivo:** `backend/lambda-functions/statuses/statusesHandler.js`
- Actualizado para soportar parámetro `type` en la query string
- Permite obtener estados de proyectos (`?type=project`) o tareas (`?type=task`)
- Por defecto devuelve estados de proyectos para mantener compatibilidad

### 3. Frontend

#### Servicio API
**Archivo:** `frontend/js/services/api.js`
- Añadidos métodos específicos:
  - `getProjectStatuses()`: Obtiene estados de proyectos
  - `getTaskStatuses()`: Obtiene estados de tareas
  - `getStatuses(type)`: Método genérico con parámetro de tipo

#### Componentes Actualizados

Los siguientes componentes ahora usan `getTaskStatuses()`:

1. **taskModal.js** - Modal de edición de tareas
2. **jiraTasksModal.js** - Modal de tareas de Jira
3. **conceptTasksModal.js** - Modal de tareas conceptuales
4. **createTaskModal.js** - Modal de creación de tareas

El siguiente componente usa explícitamente `getProjectStatuses()`:

1. **projectModal.js** - Modal de proyectos

## Verificación

### Script de Verificación
**Archivo:** `backend/verify_task_statuses.js`
- Script para verificar la configuración de estados en la base de datos
- Muestra ambas configuraciones (proyectos y tareas)
- Confirma que ambas están correctamente configuradas

### Ejecución
```bash
cd backend
node verify_task_statuses.js
```

## Migración Ejecutada

La migración se ejecutó exitosamente el 17/02/2026:
- ✅ Estados de proyectos: 7 estados configurados
- ✅ Estados de tareas: 14 estados configurados

## Compatibilidad

- Los estados de proyectos existentes se mantienen sin cambios
- La API es retrocompatible: sin parámetro `type`, devuelve estados de proyectos
- Los componentes de proyectos siguen funcionando con sus estados originales

## Próximos Pasos

1. Desplegar los cambios del backend (statusesHandler.js)
2. Desplegar los cambios del frontend
3. Verificar en el entorno de producción que los dropdowns muestran los estados correctos
4. Actualizar cualquier documentación de usuario si es necesario

## Notas Técnicas

- Los estados se almacenan en formato JSON en la tabla `app_config`
- La clave `project_statuses` contiene los estados de proyectos
- La clave `task_statuses` contiene los estados de tareas
- Ambas configuraciones son independientes y pueden modificarse por separado