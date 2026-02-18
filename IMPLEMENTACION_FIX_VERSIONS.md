# Implementación de fixVersions para Jira

## 📋 Resumen
Se ha implementado el soporte completo para el campo `fixVersions` de Jira, permitiendo almacenar y consultar las versiones asociadas a cada issue importado desde Jira.

## 🎯 Problema Resuelto
Los issues de Jira (como DAR-5373 del proyecto Darwin) tienen configurado el campo `fixVersions`, pero este no se estaba guardando en la base de datos durante la importación.

## ✅ Cambios Implementados

### 1. Base de Datos
**Archivos:**
- `backend/prisma/migrations/20260213_add_fix_versions.sql`
- `backend/prisma/migrations/run_migration_fix_versions.js`

**Cambios:**
```sql
-- Agregado campo fix_versions a tabla projects
ALTER TABLE projects 
ADD COLUMN fix_versions JSONB DEFAULT '[]'::jsonb;

-- Agregado campo fix_versions a tabla jira_tasks
ALTER TABLE jira_tasks 
ADD COLUMN fix_versions JSONB DEFAULT '[]'::jsonb;

-- Índices para búsquedas eficientes
CREATE INDEX idx_projects_fix_versions ON projects USING GIN (fix_versions);
CREATE INDEX idx_jira_tasks_fix_versions ON jira_tasks USING GIN (fix_versions);
```

**Estado:** ✅ Migración ejecutada exitosamente

### 2. Backend - jiraHandler.js
**Archivo:** `backend/lambda-functions/jira/jiraHandler.js`

**Modificaciones:**
1. Extracción y procesamiento de fixVersions:
```javascript
// Process fixVersions - extract relevant data
const fixVersions = (issue.fields.fixVersions || []).map(fv => ({
    id: fv.id,
    name: fv.name,
    released: fv.released || false,
    releaseDate: fv.releaseDate || null
}));
```

2. Inclusión en recordData:
```javascript
const recordData = {
    // ... otros campos
    fix_versions: JSON.stringify(fixVersions)
};
```

3. Actualización de queries SQL:
- **UPDATE:** Agregado `fix_versions = $11::jsonb`
- **INSERT:** Agregado campo `fix_versions` con valor `$13::jsonb`

**Estado:** ✅ Desplegado a AWS Lambda (gestion-demanda-jira-handler)

### 3. Deployment
**Archivo:** `backend/lambda-functions/jira/deploy.sh`

**Script creado para deployment automático:**
```bash
#!/bin/bash
FUNCTION_NAME="gestion-demanda-jira-handler"
# Crea ZIP, despliega y espera actualización
```

**Estado:** ✅ Deployment completado exitosamente

## 📊 Estructura de Datos

### Formato en Base de Datos (JSONB)
```json
[
  {
    "id": "12345",
    "name": "Version 1.0",
    "released": false,
    "releaseDate": "2026-03-01"
  },
  {
    "id": "12346",
    "name": "Version 2.0",
    "released": true,
    "releaseDate": "2026-01-15"
  }
]
```

## 🔍 Consultas Útiles

### Ver fixVersions de un proyecto específico
```sql
SELECT code, title, fix_versions 
FROM projects 
WHERE code = 'DAR-5373';
```

### Buscar proyectos con una versión específica
```sql
SELECT code, title 
FROM projects 
WHERE fix_versions @> '[{"name": "Version 1.0"}]'::jsonb;
```

### Contar proyectos por versión
```sql
SELECT 
    jsonb_array_elements(fix_versions)->>'name' as version_name,
    COUNT(*) as project_count
FROM projects
WHERE fix_versions != '[]'::jsonb
GROUP BY version_name
ORDER BY project_count DESC;
```

## 🧪 Pruebas

### 1. Importar Issue de Prueba
Importa el issue DAR-5373 desde el proyecto Darwin:
```
POST /api/jira/import
{
  "issueKeys": ["DAR-5373"],
  "team": "DARWIN",
  "source": "NC"
}
```

### 2. Verificar en Base de Datos
```sql
SELECT code, title, fix_versions 
FROM projects 
WHERE code = 'DAR-5373';
```

### 3. Verificar en API
```
GET /api/projects?code=DAR-5373
```

## 📝 Notas Técnicas

### Ventajas de JSONB
- ✅ Búsquedas eficientes con índices GIN
- ✅ Consultas flexibles con operadores JSONB
- ✅ No requiere esquema fijo
- ✅ Soporta arrays de objetos complejos

### Compatibilidad
- ✅ Funciona con tabla `projects` (source: NC)
- ✅ Funciona con tabla `jira_tasks` (source: SCOM)
- ✅ Compatible con importación y sincronización

### Performance
- Índices GIN creados para búsquedas rápidas
- Formato JSONB optimizado para PostgreSQL
- Sin impacto en queries existentes

## 🚀 Deployment Info

**Función Lambda:** `gestion-demanda-jira-handler`
**Última actualización:** 2026-02-13 12:23:34 UTC
**Estado:** Successful
**Runtime:** Node.js 18.x
**Región:** eu-west-1

## 📅 Historial

- **2026-02-13:** Implementación inicial de fixVersions
  - Migración de base de datos
  - Modificación de jiraHandler
  - Deployment a AWS Lambda

## 🔗 Referencias

- Proyecto Jira: Darwin (DAR)
- Issue de ejemplo: DAR-5373
- Jira URL: https://naturgy-adn.atlassian.net