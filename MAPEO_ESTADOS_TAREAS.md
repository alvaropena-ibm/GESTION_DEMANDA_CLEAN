# Mapeo de Estados de Tareas (Jira → Base de Datos)

## Estados Configurados en la Base de Datos

Los estados de tareas en `jira_tasks` se almacenan como IDs numéricos:

| ID | Estado en BD | Estado en Jira (SCOM) |
|----|--------------|----------------------|
| 1  | TAREAS POR HACER | To Do / Por Hacer |
| 2  | CONCEPTUALIZACIÓN | Conceptualización |
| 3  | CIERRE REQUISITOS | Cierre Requisitos |
| 4  | EN VALORACIÓN | En Valoración |
| 5  | VALE PDTE. APROB | Vale Pendiente Aprobación |
| 6  | EN SD | En SD |
| 7  | SD PDTE APROB | SD Pendiente Aprobación |
| 8  | EN DESARROLLO | In Progress / En Desarrollo |
| 9  | EN VALIDACIÓN SSII | En Validación SSII |
| 10 | UAT | UAT |
| 11 | READY TO PROMOTE | Ready to Promote |
| 12 | FINALIZADO | Done / Finalizado |
| 13 | CANCELADO | Cancelled / Cancelado |
| 14 | WAITING | Waiting / En Espera |

## Problema Identificado

Cuando se importa una tarea desde Jira con estado "UAT", se está guardando con ID **5** (VALE PDTE. APROB) en lugar de ID **10** (UAT).

## Solución

El mapeo de estados de Jira a IDs debe actualizarse en el componente `jiraModal.js` para que coincida con la tabla anterior.

### Mapeo Correcto de Estados de Jira

```javascript
const jiraStatusToId = {
    // Estados básicos
    'To Do': 1,
    'Por Hacer': 1,
    'Conceptualización': 2,
    'Cierre Requisitos': 3,
    'En Valoración': 4,
    'Vale Pendiente Aprobación': 5,
    'Vale Pdte. Aprob': 5,
    'En SD': 6,
    'SD Pendiente Aprobación': 7,
    'SD Pdte Aprob': 7,
    'In Progress': 8,
    'En Desarrollo': 8,
    'En Validación SSII': 9,
    'UAT': 10,  // ← IMPORTANTE: UAT debe ser 10, no 5
    'Ready to Promote': 11,
    'Done': 12,
    'Finalizado': 12,
    'Cancelled': 13,
    'Cancelado': 13,
    'Waiting': 14,
    'En Espera': 14
};
```

## Verificación

Para verificar que el mapeo es correcto:

1. Importar una tarea con estado "UAT" desde Jira
2. Verificar en la base de datos que el campo `status` tiene valor `10`
3. Verificar en la interfaz que se muestra "UAT" correctamente