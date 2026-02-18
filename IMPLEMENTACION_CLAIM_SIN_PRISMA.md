# 📋 IMPLEMENTACIÓN COMPLETA - MÓDULO CLAIM (IMPUTACIÓN DE HORAS)
## SIN PRISMA - USANDO PostgreSQL NATIVO

## 📌 RESUMEN EJECUTIVO

Este documento detalla la implementación completa del módulo de **Claim (Imputación de Horas)** usando **consultas SQL nativas** con el cliente `pg` de PostgreSQL (sin Prisma).

**Estado actual:**
- ✅ Frontend: Vista y modal completamente funcionales
- ✅ Selector de tareas: Carga tareas del proyecto automáticamente
- ⚠️ Backend: **PENDIENTE DE IMPLEMENTAR**

---

## 🗄️ 1. BASE DE DATOS

### 1.1. Crear Tabla `time_entries`

**Ubicación:** `backend/prisma/migrations/20260127_create_time_entries_table.sql`

```sql
-- Migration: Create time_entries table for time tracking/claims
-- Date: 2027-01-27
-- Description: Creates the time_entries table to store historical time tracking data

CREATE TABLE IF NOT EXISTS time_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    resource_id UUID NOT NULL,
    work_date DATE NOT NULL,
    task_title VARCHAR(255) NOT NULL,
    task_description TEXT,
    activity VARCHAR(50) NOT NULL,
    hours DECIMAL(10, 2) NOT NULL,
    module VARCHAR(100),
    team VARCHAR(50) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign keys
    CONSTRAINT fk_time_entries_project FOREIGN KEY (project_id) 
        REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_time_entries_resource FOREIGN KEY (resource_id) 
        REFERENCES resources(id) ON DELETE CASCADE,
    
    -- Constraints
    CONSTRAINT chk_hours_positive CHECK (hours > 0),
    CONSTRAINT chk_activity_valid CHECK (activity IN (
        'Análisis', 'Diseño', 'Desarrollo', 'Testing', 'Documentación',
        'Reuniones', 'Code Review', 'Despliegue', 'Soporte', 'Formación', 'Otros'
    ))
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_time_entries_project ON time_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_resource ON time_entries(resource_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_work_date ON time_entries(work_date);
CREATE INDEX IF NOT EXISTS idx_time_entries_team ON time_entries(team);
CREATE INDEX IF NOT EXISTS idx_time_entries_resource_date ON time_entries(resource_id, work_date);

-- Add comments
COMMENT ON TABLE time_entries IS 'Stores historical time tracking entries (claims) for resources on projects';
COMMENT ON COLUMN time_entries.work_date IS 'Date when the work was performed';
COMMENT ON COLUMN time_entries.task_title IS 'Brief title/summary of the task performed';
COMMENT ON COLUMN time_entries.task_description IS 'Detailed description of the work performed';
COMMENT ON COLUMN time_entries.activity IS 'Type of activity performed';
COMMENT ON COLUMN time_entries.hours IS 'Number of hours worked (can be decimal)';
COMMENT ON COLUMN time_entries.module IS 'Optional module or component identifier';
```

### 1.2. Ejecutar Migración

```bash
cd backend
# Aplicar migración SQL directamente en la base de datos
psql $DATABASE_URL -f prisma/migrations/20260127_create_time_entries_table.sql

# O si usas otro cliente:
# Ejecutar el SQL directamente en tu herramienta de base de datos (DBeaver, pgAdmin, etc.)
```

---

## ⚡ 2. BACKEND - AWS LAMBDA FUNCTIONS

### 2.1. Crear Lambda Function: `time-entries`

**Estructura de carpetas:**

```
backend/lambda-functions/time-entries/
├── timeEntriesHandler.js
├── package.json
├── package-lock.json
└── lib/
    ├── db.js
    ├── errors.js
    ├── response.js
    └── validators.js
```

### 2.2. Handler Principal

**Archivo:** `backend/lambda-functions/time-entries/timeEntriesHandler.js`

```javascript
const { query } = require('./lib/db');
const { successResponse, errorResponse } = require('./lib/response');
const { ValidationError, NotFoundError } = require('./lib/errors');
const { validateTimeEntry } = require('./lib/validators');

/**
 * Main Lambda Handler for Time Entries
 */
exports.handler = async (event) => {
    console.log('Time Entries Handler - Event:', JSON.stringify(event));

    const httpMethod = event.httpMethod;
    const userTeam = event.headers['x-user-team'] || event.headers['X-User-Team'];

    if (!userTeam) {
        return errorResponse(400, 'Missing x-user-team header');
    }

    try {
        switch (httpMethod) {
            case 'GET':
                if (event.pathParameters?.id) {
                    return await getTimeEntryById(event.pathParameters.id, userTeam);
                }
                return await getTimeEntries(event.queryStringParameters, userTeam);

            case 'POST':
                return await createTimeEntry(JSON.parse(event.body), userTeam);

            case 'PUT':
                if (!event.pathParameters?.id) {
                    return errorResponse(400, 'Missing time entry ID');
                }
                return await updateTimeEntry(event.pathParameters.id, JSON.parse(event.body), userTeam);

            case 'DELETE':
                if (!event.pathParameters?.id) {
                    return errorResponse(400, 'Missing time entry ID');
                }
                return await deleteTimeEntry(event.pathParameters.id, userTeam);

            default:
                return errorResponse(405, `Method ${httpMethod} not allowed`);
        }
    } catch (error) {
        console.error('Error in time entries handler:', error);
        
        if (error instanceof ValidationError) {
            return errorResponse(400, error.message);
        }
        if (error instanceof NotFoundError) {
            return errorResponse(404, error.message);
        }
        
        return errorResponse(500, 'Internal server error', error.message);
    }
};

/**
 * GET /time-entries
 * Get all time entries with optional filters
 */
async function getTimeEntries(queryParams = {}, userTeam) {
    const { projectId, resourceId, startDate, endDate, activity } = queryParams || {};

    // Build dynamic WHERE clause
    const conditions = ['te.team = $1'];
    const params = [userTeam];
    let paramIndex = 2;

    if (projectId) {
        conditions.push(`te.project_id = $${paramIndex}`);
        params.push(projectId);
        paramIndex++;
    }

    if (resourceId) {
        conditions.push(`te.resource_id = $${paramIndex}`);
        params.push(resourceId);
        paramIndex++;
    }

    if (activity) {
        conditions.push(`te.activity = $${paramIndex}`);
        params.push(activity);
        paramIndex++;
    }

    if (startDate) {
        conditions.push(`te.work_date >= $${paramIndex}`);
        params.push(startDate);
        paramIndex++;
    }

    if (endDate) {
        conditions.push(`te.work_date <= $${paramIndex}`);
        params.push(endDate);
        paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const sql = `
        SELECT 
            te.id,
            te.project_id,
            te.resource_id,
            te.work_date,
            te.task_title,
            te.task_description,
            te.activity,
            te.hours,
            te.module,
            te.team,
            te.created_at,
            te.updated_at,
            p.code as project_code,
            p.title as project_title,
            r.code as resource_code,
            r.name as resource_name
        FROM time_entries te
        LEFT JOIN projects p ON te.project_id = p.id
        LEFT JOIN resources r ON te.resource_id = r.id
        WHERE ${whereClause}
        ORDER BY te.work_date DESC
    `;

    const result = await query(sql, params);

    // Transform rows to include nested objects
    const timeEntries = result.rows.map(row => ({
        id: row.id,
        projectId: row.project_id,
        resourceId: row.resource_id,
        workDate: row.work_date,
        taskTitle: row.task_title,
        taskDescription: row.task_description,
        activity: row.activity,
        hours: parseFloat(row.hours),
        module: row.module,
        team: row.team,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        project: {
            id: row.project_id,
            code: row.project_code,
            title: row.project_title
        },
        resource: {
            id: row.resource_id,
            code: row.resource_code,
            name: row.resource_name
        }
    }));

    return successResponse({
        timeEntries,
        count: timeEntries.length
    });
}

/**
 * GET /time-entries/{id}
 * Get single time entry by ID
 */
async function getTimeEntryById(id, userTeam) {
    const sql = `
        SELECT 
            te.*,
            p.code as project_code,
            p.title as project_title,
            p.description as project_description,
            r.code as resource_code,
            r.name as resource_name
        FROM time_entries te
        LEFT JOIN projects p ON te.project_id = p.id
        LEFT JOIN resources r ON te.resource_id = r.id
        WHERE te.id = $1 AND te.team = $2
    `;

    const result = await query(sql, [id, userTeam]);

    if (result.rows.length === 0) {
        throw new NotFoundError('Time entry not found');
    }

    const row = result.rows[0];
    const timeEntry = {
        id: row.id,
        projectId: row.project_id,
        resourceId: row.resource_id,
        workDate: row.work_date,
        taskTitle: row.task_title,
        taskDescription: row.task_description,
        activity: row.activity,
        hours: parseFloat(row.hours),
        module: row.module,
        team: row.team,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        project: {
            id: row.project_id,
            code: row.project_code,
            title: row.project_title,
            description: row.project_description
        },
        resource: {
            id: row.resource_id,
            code: row.resource_code,
            name: row.resource_name
        }
    };

    return successResponse({ timeEntry });
}

/**
 * POST /time-entries
 * Create new time entry (with auto-create resource if needed)
 */
async function createTimeEntry(body, userTeam) {
    // Validate input
    validateTimeEntry(body);

    const {
        projectId,
        resourceName,  // Nombre completo del recurso (puede no existir aún)
        workDate,
        taskTitle,
        taskDescription,
        activity,
        hours,
        module
    } = body;

    // 1. Verificar que el proyecto existe
    const projectCheckSql = `
        SELECT id FROM projects 
        WHERE id = $1 AND team = $2
    `;
    const projectResult = await query(projectCheckSql, [projectId, userTeam]);

    if (projectResult.rows.length === 0) {
        throw new NotFoundError('Project not found');
    }

    // 2. Buscar o crear recurso
    let resourceId;
    let resourceCreated = false;

    const resourceCheckSql = `
        SELECT id FROM resources 
        WHERE name = $1 AND team = $2
    `;
    const resourceResult = await query(resourceCheckSql, [resourceName, userTeam]);

    if (resourceResult.rows.length > 0) {
        // Recurso existe
        resourceId = resourceResult.rows[0].id;
    } else {
        // Crear nuevo recurso
        console.log(`Creating new resource: ${resourceName}`);
        
        const resourceCode = generateResourceCode(resourceName);
        
        const createResourceSql = `
            INSERT INTO resources (code, name, team, default_capacity, active)
            VALUES ($1, $2, $3, 160, true)
            RETURNING id
        `;
        const newResourceResult = await query(createResourceSql, [resourceCode, resourceName, userTeam]);
        resourceId = newResourceResult.rows[0].id;
        resourceCreated = true;
        
        console.log(`Resource created with ID: ${resourceId}`);
    }

    // 3. Crear time entry
    const insertSql = `
        INSERT INTO time_entries 
        (project_id, resource_id, work_date, task_title, task_description, activity, hours, module, team)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
    `;

    const insertResult = await query(insertSql, [
        projectId,
        resourceId,
        workDate,
        taskTitle,
        taskDescription || null,
        activity,
        parseFloat(hours),
        module || null,
        userTeam
    ]);

    // Obtener datos completos con joins
    const timeEntry = await getTimeEntryById(insertResult.rows[0].id, userTeam);

    return successResponse(
        {
            timeEntry: timeEntry.data.timeEntry,
            message: 'Time entry created successfully',
            resourceCreated
        },
        201
    );
}

/**
 * PUT /time-entries/{id}
 * Update existing time entry
 */
async function updateTimeEntry(id, body, userTeam) {
    // Verificar que existe
    const checkSql = `
        SELECT id FROM time_entries 
        WHERE id = $1 AND team = $2
    `;
    const checkResult = await query(checkSql, [id, userTeam]);

    if (checkResult.rows.length === 0) {
        throw new NotFoundError('Time entry not found');
    }

    // Validar datos
    validateTimeEntry(body, true);

    // Build dynamic UPDATE clause
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (body.workDate) {
        updates.push(`work_date = $${paramIndex}`);
        params.push(body.workDate);
        paramIndex++;
    }

    if (body.taskTitle) {
        updates.push(`task_title = $${paramIndex}`);
        params.push(body.taskTitle);
        paramIndex++;
    }

    if (body.taskDescription !== undefined) {
        updates.push(`task_description = $${paramIndex}`);
        params.push(body.taskDescription);
        paramIndex++;
    }

    if (body.activity) {
        updates.push(`activity = $${paramIndex}`);
        params.push(body.activity);
        paramIndex++;
    }

    if (body.hours) {
        updates.push(`hours = $${paramIndex}`);
        params.push(parseFloat(body.hours));
        paramIndex++;
    }

    if (body.module !== undefined) {
        updates.push(`module = $${paramIndex}`);
        params.push(body.module);
        paramIndex++;
    }

    // Always update updated_at
    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    if (updates.length === 1) {
        // Only updated_at, no real changes
        return await getTimeEntryById(id, userTeam);
    }

    // Add id and team to params for WHERE clause
    params.push(id);
    params.push(userTeam);

    const updateSql = `
        UPDATE time_entries 
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex} AND team = $${paramIndex + 1}
        RETURNING *
    `;

    await query(updateSql, params);

    // Get updated entry with joins
    const timeEntry = await getTimeEntryById(id, userTeam);

    return successResponse({
        timeEntry: timeEntry.data.timeEntry,
        message: 'Time entry updated successfully'
    });
}

/**
 * DELETE /time-entries/{id}
 * Delete time entry
 */
async function deleteTimeEntry(id, userTeam) {
    // Verificar que existe
    const checkSql = `
        SELECT id FROM time_entries 
        WHERE id = $1 AND team = $2
    `;
    const checkResult = await query(checkSql, [id, userTeam]);

    if (checkResult.rows.length === 0) {
        throw new NotFoundError('Time entry not found');
    }

    // Delete
    const deleteSql = `
        DELETE FROM time_entries 
        WHERE id = $1 AND team = $2
    `;
    await query(deleteSql, [id, userTeam]);

    return successResponse({
        message: 'Time entry deleted successfully'
    });
}

/**
 * Generate unique resource code from name
 */
function generateResourceCode(name) {
    // Extraer iniciales y añadir timestamp
    const parts = name.trim().split(' ');
    let code = '';
    
    if (parts.length >= 2) {
        // Primera letra del nombre + primera letra del apellido
        code = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    } else {
        // Primeras 2 letras del nombre
        code = name.substring(0, 2).toUpperCase();
    }
    
    // Añadir timestamp corto para unicidad
    const timestamp = Date.now().toString().slice(-4);
    return `${code}${timestamp}`;
}
```

### 2.3. Librerías Auxiliares

**Archivo:** `backend/lambda-functions/time-entries/lib/db.js`

```javascript
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.query = exports.getPool = void 0;

const { Pool } = require('pg');

// Create a singleton pool instance
let pool = null;

function getPool() {
    if (!pool) {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false
            },
            max: 1, // Lambda: use only 1 connection per container
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
        });
        
        console.log('PostgreSQL pool created');
    }
    return pool;
}

exports.getPool = getPool;

/**
 * Execute a SQL query
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
async function query(text, params) {
    const pool = getPool();
    const start = Date.now();
    
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        
        if (process.env.LOG_QUERIES === 'true') {
            console.log('Query executed:', { text, duration, rows: result.rowCount });
        }
        
        return result;
    } catch (error) {
        console.error('Database query error:', {
            query: text,
            params,
            error: error.message
        });
        throw error;
    }
}

exports.query = query;
```

**Archivo:** `backend/lambda-functions/time-entries/lib/validators.js`

```javascript
const { ValidationError } = require('./errors');

const VALID_ACTIVITIES = [
    'Análisis', 'Diseño', 'Desarrollo', 'Testing', 'Documentación',
    'Reuniones', 'Code Review', 'Despliegue', 'Soporte', 'Formación', 'Otros'
];

function validateTimeEntry(data, isUpdate = false) {
    const errors = [];

    // Required fields for creation
    if (!isUpdate) {
        if (!data.projectId) errors.push('projectId is required');
        if (!data.resourceName) errors.push('resourceName is required');
        if (!data.workDate) errors.push('workDate is required');
        if (!data.taskTitle) errors.push('taskTitle is required');
        if (!data.activity) errors.push('activity is required');
        if (data.hours === undefined || data.hours === null) errors.push('hours is required');
    }

    // Validate fields if present
    if (data.taskTitle && data.taskTitle.length > 255) {
        errors.push('taskTitle must be 255 characters or less');
    }

    if (data.taskDescription && data.taskDescription.length > 5000) {
        errors.push('taskDescription must be 5000 characters or less');
    }

    if (data.activity && !VALID_ACTIVITIES.includes(data.activity)) {
        errors.push(`activity must be one of: ${VALID_ACTIVITIES.join(', ')}`);
    }

    if (data.hours !== undefined) {
        const hours = parseFloat(data.hours);
        if (isNaN(hours) || hours <= 0 || hours > 24) {
            errors.push('hours must be a positive number between 0.5 and 24');
        }
    }

    if (data.workDate) {
        const date = new Date(data.workDate);
        if (isNaN(date.getTime())) {
            errors.push('workDate must be a valid date');
        }
    }

    if (errors.length > 0) {
        throw new ValidationError(errors.join(', '));
    }

    return true;
}

module.exports = {
    validateTimeEntry,
    VALID_ACTIVITIES
};
```

**Archivo:** `backend/lambda-functions/time-entries/lib/errors.js`

```javascript
class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}

class NotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = 'NotFoundError';
    }
}

class ConflictError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ConflictError';
    }
}

module.exports = {
    ValidationError,
    NotFoundError,
    ConflictError
};
```

**Archivo:** `backend/lambda-functions/time-entries/lib/response.js`

```javascript
function successResponse(data, statusCode = 200) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,x-user-team',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        body: JSON.stringify({
            success: true,
            data
        })
    };
}

function errorResponse(statusCode, message, details = null) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,x-user-team',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        body: JSON.stringify({
            success: false,
            error: {
                message,
                details
            }
        })
    };
}

module.exports = {
    successResponse,
    errorResponse
};
```

### 2.4. Package.json

**Archivo:** `backend/lambda-functions/time-entries/package.json`

```json
{
  "name": "time-entries-lambda",
  "version": "1.0.0",
  "description": "Lambda function for time entries (claims) management",
  "main": "timeEntriesHandler.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "dependencies": {
    "pg": "^8.11.0"
  },
  "author": "",
  "license": "ISC"
}
```

### 2.5. Deployment Script

**Archivo:** `backend/deployment-scripts/deploy-time-entries.sh`

```bash
#!/bin/bash

# Deploy Time Entries Lambda Function
# Usage: ./deploy-time-entries.sh [dev|prod]

ENVIRONMENT=${1:-dev}
FUNCTION_NAME="time-entries-handler-${ENVIRONMENT}"
LAMBDA_DIR="../lambda-functions/time-entries"

echo "🚀 Deploying Time Entries Lambda Function to ${ENVIRONMENT}..."

cd $LAMBDA_DIR

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Create deployment package
echo "📦 Creating deployment package..."
zip -r function.zip . -x "*.git*" "*.md"

# Update Lambda function
echo "☁️ Uploading to AWS Lambda..."
aws lambda update-function-code \
    --function-name $FUNCTION_NAME \
    --zip-file fileb://function.zip \
    --region eu-west-1

# Clean up
rm function.zip

echo "✅ Deployment complete!"
```

---

## ☁️ 3. AWS CONFIGURATION

### 3.1. API Gateway Routes

Añadir los siguientes endpoints en API Gateway:

```
GET    /time-entries                    → Lista todas las imputaciones
GET    /time-entries?projectId={id}     → Filtra por proyecto
GET    /time-entries?resourceId={id}    → Filtra por recurso
GET    /time-entries?startDate={date}   → Filtra por rango de fechas
GET    /time-entries/{id}               → Obtiene una imputación específica
POST   /time-entries                    → Crea nueva imputación
PUT    /time-entries/{id}               → Actualiza imputación existente
DELETE /time-entries/{id}               → Elimina imputación
```

### 3.2. Lambda Configuration

```yaml
Function Name: time-entries-handler-prod
Runtime: Node.js 18.x
Handler: timeEntriesHandler.handler
Memory: 512 MB
Timeout: 30 seconds

Environment Variables:
  - DATABASE_URL: [PostgreSQL connection string]
  - NODE_ENV: production
  - LOG_QUERIES: false

IAM Role Permissions:
  - CloudWatch Logs (write)
  - VPC Access (if database is in VPC)
  - Secrets Manager (if using for database credentials)
```

### 3.3. CORS Configuration

```json
{
  "AllowOrigins": ["*"],
  "AllowMethods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  "AllowHeaders": [
    "Content-Type",
    "X-Amz-Date",
    "Authorization",
    "X-Api-Key",
    "X-Amz-Security-Token",
    "x-user-team"
  ],
  "ExposeHeaders": [],
  "MaxAge": 3600
}
```

---

## 🎨 4. FRONTEND MODIFICATIONS

> **Nota:** El frontend es idéntico independientemente de si el backend usa Prisma o SQL nativo.
> Consulta el archivo `IMPLEMENTACION_CLAIM.md` secciones 4.1 a 4.4 para:
> - Actualizar API Service (timeEntriesAPI)
> - Función saveClaim()
> - Funciones de carga y gestión de tabla
> - Estilos CSS para botones

---

## 📋 5. CHECKLIST DE IMPLEMENTACIÓN

### 5.1. Backend

- [ ] **Base de Datos**
  - [ ] Ejecutar migración SQL para crear tabla `time_entries`
  - [ ] Verificar que la tabla se creó correctamente

- [ ] **Lambda Function**
  - [ ] Crear carpeta `backend/lambda-functions/time-entries/`
  - [ ] Crear `timeEntriesHandler.js` (handler principal con SQL nativo)
  - [ ] Crear `lib/db.js` (conexión PostgreSQL con pg)
  - [ ] Crear `lib/validators.js` (validaciones)
  - [ ] Crear `lib/errors.js` (clases de error)
  - [ ] Crear `lib/response.js` (respuestas HTTP)
  - [ ] Crear `package.json` con dependencia `pg`
  - [ ] Instalar dependencias: `npm install`

- [ ] **AWS Configuration**
  - [ ] Crear Lambda Function en AWS
  - [ ] Configurar variables de entorno (DATABASE_URL, LOG_QUERIES)
  - [ ] Configurar timeout (30s) y memoria (512MB)
  - [ ] Configurar VPC (si la base de datos está en VPC)
  - [ ] Crear endpoints en API Gateway
  - [ ] Configurar CORS
  - [ ] Desplegar función Lambda

- [ ] **Deployment**
  - [ ] Crear script `deploy-time-entries.sh`
  - [ ] Dar permisos de ejecución: `chmod +x deploy-time-entries.sh`
  - [ ] Ejecutar deployment: `./deploy-time-entries.sh prod`

### 5.2. Frontend

- [ ] **API Service**
  - [ ] Añadir `timeEntriesAPI` en `frontend/js/services/api.js`
  - [ ] Probar endpoints desde consola del navegador

- [ ] **Claim Modal**
  - [ ] Actualizar función `saveClaim()` para llamar API
  - [ ] Añadir función `loadTimeEntries()`
  - [ ] Añadir función `renderTimeEntriesTable()`
  - [ ] Añadir función `editTimeEntry()`
  - [ ] Añadir función `deleteTimeEntry()`
  - [ ] Añadir función `updateTotals()`
  - [ ] Hacer funciones globalmente accesibles
  - [ ] Cargar imputaciones al activar pestaña Claim

- [ ] **Estilos**
  - [ ] Añadir estilos para botones pequeños (`.btn-sm`)
  - [ ] Verificar responsividad de la tabla

### 5.3. Testing

- [ ] **Funcionalidad Básica**
  - [ ] Crear nueva imputación (usuario existente)
  - [ ] Crear nueva imputación (usuario nuevo - auto-crear recurso)
  - [ ] Editar imputación existente
  - [ ] Eliminar imputación
  - [ ] Ver historial de imputaciones

- [ ] **Filtros**
  - [ ] Filtrar por proyecto
  - [ ] Filtrar por fecha
  - [ ] Buscar en tabla

- [ ] **Totales**
  - [ ] Verificar total horas hoy
  - [ ] Verificar total horas semana
  - [ ] Verificar total horas mes

---

## 📚 6. NOTAS IMPORTANTES - SIN PRISMA

### 6.1. Diferencias clave vs Prisma

**✅ Ventajas de usar SQL nativo (pg):**
- Menor tamaño del paquete Lambda
- Sin necesidad de generar cliente Prisma
- Consultas SQL más transparentes y controlables
- Mejor para equipos familiarizados con SQL

**⚠️ Consideraciones:**
- Manejo manual de tipos y conversiones
- Sin type safety de TypeScript
- Validación manual de parámetros más importante
- Construcción dinámica de queries requiere más cuidado

### 6.2. Patrón de conexión PostgreSQL

```javascript
// Usar singleton pattern para pool de conexiones
// Lambda reutiliza contenedores, pool se mantiene entre invocaciones
// max: 1 conexión por contenedor Lambda (buena práctica)
```

### 6.3. Seguridad en queries SQL

**Siempre usar parámetros parametrizados:**
```javascript
// ✅ CORRECTO
await query('SELECT * FROM users WHERE id = $1', [userId]);

// ❌ INCORRECTO (vulnerable a SQL injection)
await query(`SELECT * FROM users WHERE id = '${userId}'`);
```

### 6.4. Creación Automática de Recursos

- Al crear imputación, si usuario no existe como recurso, se crea automáticamente
- Código generado: iniciales + timestamp (ej: "JP1234")
- Capacidad por defecto: 160 horas/mes
- Estado: activo

---

## 🚀 7. DEPLOYMENT CHECKLIST

### Pre-deployment
- [ ] Backup de base de datos
- [ ] Verificar variables de entorno
- [ ] Probar queries SQL localmente

### Deployment
1. [ ] Ejecutar migración SQL en producción
2. [ ] Crear Lambda function con runtime Node.js 18.x
3. [ ] Subir código: `./deploy-time-entries.sh prod`
4. [ ] Configurar API Gateway endpoints
5. [ ] Configurar CORS
6. [ ] Desplegar frontend
7. [ ] Limpiar caché del navegador

### Post-deployment
- [ ] Verificar tabla: `SELECT COUNT(*) FROM time_entries;`
- [ ] Probar endpoint GET desde Postman/curl
- [ ] Crear imputación desde UI
- [ ] Verificar logs de CloudWatch
- [ ] Comprobar métricas de Lambda

---

## 🆘 8. TROUBLESHOOTING

### Error: "connection timeout"
- Verificar que Lambda está en misma VPC que base de datos
- Comprobar security groups permiten conexión
- Validar DATABASE_URL es correcta

### Error: "syntax error at or near"
- Revisar construcción dinámica de queries
- Verificar número de parámetros coincide ($1, $2, etc.)
- Probar query manualmente en psql

### No se crea el recurso automáticamente
- Verificar logs de Lambda en CloudWatch
- Comprobar permisos de escritura en tabla `resources`
- Validar que resourceName no esté vacío

### Tabla no se actualiza después de guardar
- Verificar que `loadTimeEntries()` se llama después de `saveClaim()`
- Comprobar respuesta de API en Network tab (F12)
- Limpiar caché del navegador (Cmd+Shift+R)

---

## 📊 9. COMPARATIVA: PRISMA VS SQL NATIVO

| Aspecto | Prisma | SQL Nativo (pg) |
|---------|--------|-----------------|
| **Tamaño paquete** | ~15-20 MB | ~2-3 MB |
| **Type safety** | ✅ Sí (TypeScript) | ❌ No |
| **Curva aprendizaje** | Media | Baja (si sabes SQL) |
| **Performance** | Bueno | Excelente |
| **Mantenimiento** | Auto-migración | Manual SQL |
| **Debugging** | Más difícil | SQL visible |
| **Flexibilidad** | Limitada | Total |

**Recomendación:** Usa SQL nativo (pg) para:
- Proyectos pequeños/medianos
- Equipos con experiencia en SQL
- Cuando el tamaño del paquete es crítico
- Queries complejas específicas

---

## 📞 10. SOPORTE Y RECURSOS

### Documentación
- **PostgreSQL Client (pg):** https://node-postgres.com/
- **AWS Lambda Node.js:** https://docs.aws.amazon.com/lambda/latest/dg/lambda-nodejs.html
- **SQL Injection Prevention:** https://node-postgres.com/features/queries#parameterized-query

### Para dudas durante implementación:
1. Revisar logs de CloudWatch
2. Verificar console del navegador (F12)
3. Comprobar estado de API Gateway
4. Validar conexión a base de datos
5. Probar queries en cliente PostgreSQL

---

**Documento creado:** 27/01/2026  
**Versión:** 2.0 (Sin Prisma)  
**Estado:** ✅ COMPLETO Y LISTO PARA IMPLEMENTACIÓN

---

## 📝 RESUMEN FINAL

Este documento contiene TODO lo necesario para implementar el módulo Claim **SIN PRISMA**, usando:

✅ **PostgreSQL nativo** con cliente `pg`  
✅ **Consultas SQL** directas y parametrizadas  
✅ **Handler completo** con CRUD operations  
✅ **Auto-creación de recursos** cuando no existen  
✅ **Validaciones** y manejo de errores robusto  
✅ **Deployment script** listo para usar  
✅ **Checklist completo** paso a paso  

**Para el frontend:** Consultar `IMPLEMENTACION_CLAIM.md` sección 4 (es idéntico en ambas versiones).

**¡Listo para implementar! 🚀**
