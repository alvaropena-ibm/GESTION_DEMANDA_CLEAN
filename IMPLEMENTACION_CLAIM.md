# 📋 IMPLEMENTACIÓN COMPLETA - MÓDULO CLAIM (IMPUTACIÓN DE HORAS)

## 📌 RESUMEN EJECUTIVO

Este documento detalla la implementación completa del módulo de **Claim (Imputación de Horas)** para el sistema de gestión de demanda. Incluye cambios en base de datos, backend (AWS Lambda), y frontend.

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
    const { projectId, resourceId, startDate, endDate, activity } = queryParams;

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
            p.id as project_id,
            p.code as project_code,
            p.title as project_title,
            r.id as resource_id,
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
            p.id as project_id,
            p.code as project_code,
            p.title as project_title,
            p.description as project_description,
            r.id as resource_id,
            r.code as resource_code,
            r.name as resource_name
        FROM time_entries te
        LEFT JOIN projects p ON te.project_id = p.id
        LEFT JOIN resources r ON te.resource_id = r.id
        WHERE te.id = $1 AND te.team = $2
    `;

    const result = await query(sql, [id, userTeam]);

    if (result.rows.length === 0) {
        throw new

### 2.3. Librerías Auxiliares

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

**Archivo:** `backend/lambda-functions/time-entries/lib/db.js`

```javascript
const { PrismaClient } = require('@prisma/client');

let prismaInstance = null;

function getPrismaClient() {
    if (!prismaInstance) {
        prismaInstance = new PrismaClient();
    }
    return prismaInstance;
}

async function disconnectPrisma() {
    if (prismaInstance) {
        await prismaInstance.$disconnect();
        prismaInstance = null;
    }
}

module.exports = {
    getPrismaClient,
    disconnectPrisma
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
    "@prisma/client": "^5.8.0",
    "prisma": "^5.8.0"
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

# Generate Prisma Client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Create deployment package
echo "📦 Creating deployment package..."
zip -r function.zip . -x "*.git*" "node_modules/@prisma/engines/*" "*.md"

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

### 4.1. Actualizar API Service

**Archivo:** `frontend/js/services/api.js`

Añadir funciones para time entries:

```javascript
// Time Entries API
export const timeEntriesAPI = {
    /**
     * Get all time entries with optional filters
     */
    async getAll(filters = {}) {
        const params = new URLSearchParams(filters);
        return await makeRequest(`/time-entries?${params.toString()}`);
    },

    /**
     * Get single time entry by ID
     */
    async getById(id) {
        return await makeRequest(`/time-entries/${id}`);
    },

    /**
     * Create new time entry
     */
    async create(data) {
        return await makeRequest('/time-entries', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    /**
     * Update existing time entry
     */
    async update(id, data) {
        return await makeRequest(`/time-entries/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    /**
     * Delete time entry
     */
    async delete(id) {
        return await makeRequest(`/time-entries/${id}`, {
            method: 'DELETE'
        });
    }
};
```

### 4.2. Actualizar claimModal.js - Función saveClaim

**Archivo:** `frontend/js/components/claimModal.js`

Reemplazar la función `saveClaim`:

```javascript
/**
 * Save claim (create or update)
 */
export async function saveClaim() {
    const form = document.getElementById('claimForm');
    
    if (!form || !form.checkValidity()) {
        if (form) {
            form.reportValidity();
        }
        return;
    }

    const claimId = document.getElementById('claimId').value;
    const isUpdate = !!claimId;

    // Get logged user name
    const userName = sessionStorage.getItem('user_name') || 'Usuario Desconocido';

    const formData = {
        projectId: document.getElementById('claimProjectId').value,
        resourceName: userName,  // Auto-assign logged user
        workDate: document.getElementById('claimDate').value,
        taskTitle: document.getElementById('claimTaskTitle').value,
        taskDescription: document.getElementById('claimTaskDescription').value,
        activity: document.getElementById('claimActivity').value,
        hours: parseFloat(document.getElementById('claimHours').value),
        module: document.getElementById('claimModule').value || null
    };

    try {
        let result;
        if (isUpdate) {
            result = await timeEntriesAPI.update(claimId, formData);
            showNotification('Imputación actualizada correctamente', 'success');
        } else {
            result = await timeEntriesAPI.create(formData);
            if (result.data.resourceCreated) {
                showNotification('Imputación creada. Nuevo recurso creado automáticamente.', 'success');
            } else {
                showNotification('Imputación creada correctamente', 'success');
            }
        }

        closeClaimModal();
        
        // Reload table
        loadTimeEntries();
        
    } catch (error) {
        console.error('Error saving claim:', error);
        showNotification('Error al guardar la imputación: ' + error.message, 'error');
    }
}
```

### 4.3. Añadir Funciones para Cargar y Gestionar Tabla

**Archivo:** `frontend/js/components/claimModal.js`

Añadir al final del archivo:

```javascript
/**
 * Load time entries and populate table
 */
async function loadTimeEntries() {
    try {
        const result = await timeEntriesAPI.getAll();
        const timeEntries = result.data?.timeEntries || [];
        
        renderTimeEntriesTable(timeEntries);
        updateTotals(timeEntries);
        
    } catch (error) {
        console.error('Error loading time entries:', error);
        showNotification('Error al cargar las imputaciones', 'error');
    }
}

/**
 * Render time entries table
 */
function renderTimeEntriesTable(timeEntries) {
    const tbody = document.getElementById('claim-table-body');
    
    if (!tbody) return;
    
    if (timeEntries.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 2rem; color: #718096;">
                    No hay imputaciones registradas. Haz clic en "Nueva Imputación" para comenzar.
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = timeEntries.map(entry => `
        <tr>
            <td>${entry.project?.code || '-'}</td>
            <td>${entry.project?.title || '-'}</td>
            <td>${entry.taskTitle}</td>
            <td>${entry.taskDescription || '-'}</td>
            <td>${entry.activity}</td>
            <td style="text-align: center;">${formatDate(entry.workDate)}</td>
            <td style="text-align: center;">${entry.hours}h</td>
            <td>${entry.module || '-'}</td>
            <td style="text-align: center;">
                <button class="btn btn-sm btn-secondary" onclick="editTimeEntry('${entry.id}')" title="Editar">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 16px; height: 16px;">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                    </svg>
                </button>
                <button class="btn btn-sm btn-danger" onclick="confirmDeleteTimeEntry('${entry.id}')" title="Eliminar">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 16px; height: 16px;">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                </button>
            </td>
        </tr>
    `).join('');
}

/**
 * Edit time entry - load data into modal
 */
async function editTimeEntry(id) {
    try {
        const result = await timeEntriesAPI.getById(id);
        const entry = result.data?.timeEntry;
        
        if (!entry) {
            showNotification('Imputación no encontrada', 'error');
            return;
        }
        
        // Populate form
        document.getElementById('claimId').value = entry.id;
        document.getElementById('claimProjectId').value = entry.projectId;
        document.getElementById('claimDate').value = entry.workDate.split('T')[0];
        document.getElementById('claimTaskTitle').value = entry.taskTitle;
        document.getElementById('claimTaskDescription').value = entry.taskDescription || '';
        document.getElementById('claimActivity').value = entry.activity;
        document.getElementById('claimHours').value = entry.hours;
        document.getElementById('claimModule').value = entry.module || '';
        
        // Load tasks for selected project
        await loadTasksForProject(entry.projectId);
        
        // Open modal
        openClaimModal();
        
    } catch (error) {
        console.error('Error loading time entry:', error);
        showNotification('Error al cargar la imputación', 'error');
    }
}

/**
 * Confirm delete time entry
 */
function confirmDeleteTimeEntry(id) {
    if (confirm('¿Estás seguro de que deseas eliminar esta imputación?')) {
        deleteTimeEntry(id);
    }
}

/**
 * Delete time entry
 */
async function deleteTimeEntry(id) {
    try {
        await timeEntriesAPI.delete(id);
        showNotification('Imputación eliminada correctamente', 'success');
        loadTimeEntries();
    } catch (error) {
        console.error('Error deleting time entry:', error);
        showNotification('Error al eliminar la imputación', 'error');
    }
}

/**
 * Update totals (today, week, month)
 */
function updateTotals(timeEntries) {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    // Start of week (Monday)
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1);
    
    // Start of month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    let totalToday = 0;
    let totalWeek = 0;
    let totalMonth = 0;
    
    timeEntries.forEach(entry => {
        const entryDate = new Date(entry.workDate);
        const hours = parseFloat(entry.hours);
        
        if (entry.workDate.split('T')[0] === today) {
            totalToday += hours;
        }
        
        if (entryDate >= startOfWeek) {
            totalWeek += hours;
        }
        
        if (entryDate >= startOfMonth) {
            totalMonth += hours;
        }
    });
    
    document.getElementById('claim-total-today').textContent = `${totalToday.toFixed(1)}h`;
    document.getElementById('claim-total-week').textContent = `${totalWeek.toFixed(1)}h`;
    document.getElementById('claim-total-month').textContent = `${totalMonth.toFixed(1)}h`;
}

/**
 * Format date for display
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

// Make functions globally available
window.editTimeEntry = editTimeEntry;
window.confirmDeleteTimeEntry = confirmDeleteTimeEntry;
window.deleteTimeEntry = deleteTimeEntry;
window.loadTimeEntries = loadTimeEntries;

// Load time entries when initializing
document.addEventListener('DOMContentLoaded', () => {
    // Load time entries when Claim tab is activated
    const claimTab = document.querySelector('[data-tab="claim-tab"]');
    if (claimTab) {
        claimTab.addEventListener('click', () => {
            setTimeout(loadTimeEntries, 100);
        });
    }
});
```

### 4.4. Añadir Estilos para Botones

**Archivo:** `frontend/css/components.css`

Añadir estilos para botones pequeños:

```css
/* Small buttons for table actions */
.btn-sm {
    padding: 0.25rem 0.5rem;
    font-size: 0.875rem;
    border-radius: 0.25rem;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.2s;
}

.btn-sm svg {
    width: 16px;
    height: 16px;
}

.btn-sm.btn-secondary {
    background: #718096;
    color: white;
    border-color: #718096;
}

.btn-sm.btn-secondary:hover {
    background: #4a5568;
    border-color: #4a5568;
}

.btn-sm.btn-danger {
    background: #f56565;
    color: white;
    border-color: #f56565;
}

.btn-sm.btn-danger:hover {
    background: #c53030;
    border-color: #c53030;
}
```

---

## 📋 5. CHECKLIST DE IMPLEMENTACIÓN

### 5.1. Backend

- [ ] **Base de Datos**
  - [ ] Ejecutar migración SQL para crear tabla `time_entries`
  - [ ] Actualizar schema Prisma (`backend/database/schema/schema.prisma`)
  - [ ] Actualizar schema Lambda (`backend/lambda-all-handlers/prisma/schema.prisma`)
  - [ ] Regenerar cliente Prisma: `npx prisma generate`

- [ ] **Lambda Function**
  - [ ] Crear carpeta `backend/lambda-functions/time-entries/`
  - [ ] Crear `timeEntriesHandler.js` (handler principal)
  - [ ] Crear `lib/validators.js` (validaciones)
  - [ ] Crear `lib/errors.js` (clases de error)
  - [ ] Crear `lib/response.js` (respuestas HTTP)
  - [ ] Crear `lib/db.js` (conexión Prisma)
  - [ ] Crear `package.json`
  - [ ] Instalar dependencias: `npm install`

- [ ] **AWS Configuration**
  - [ ] Crear Lambda Function en AWS
  - [ ] Configurar variables de entorno (DATABASE_URL)
  - [ ] Configurar timeout (30s) y memoria (512MB)
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

- [ ] **Edge Cases**
  - [ ] Validación de horas (máximo 24h)
  - [ ] Validación de fechas
  - [ ] Manejo de errores de API
  - [ ] Verificar permisos por equipo (x-user-team)

---

## 📚 6. NOTAS ADICIONALES

### 6.1. Creación Automática de Recursos

**Comportamiento:**
- Al crear una imputación, si el usuario no existe como recurso, se crea automáticamente
- El código del recurso se genera automáticamente: iniciales + timestamp
- Ejemplo: "Juan Pérez" → código "JP1234"
- Capacidad por defecto: 160 horas/mes
- Estado: activo

### 6.2. Seguridad

- Todas las operaciones filtran por `team` del usuario
- No se puede acceder a imputaciones de otros equipos
- Header `x-user-team` es obligatorio en todas las peticiones

### 6.3. Validaciones

**Horas:**
- Mínimo: 0.5 horas
- Máximo: 24 horas
- Formato: decimal (ej: 1.5, 2.25)

**Actividades válidas:**
- Análisis, Diseño, Desarrollo, Testing
- Documentación, Reuniones, Code Review
- Despliegue, Soporte, Formación, Otros

**Campos obligatorios:**
- Proyecto, Recurso, Fecha, Título tarea, Actividad, Horas

### 6.4. Performance

- Índices en: project_id, resource_id, work_date, team
- Orden por defecto: fecha descendente (más recientes primero)
- Incluye relaciones con proyectos y recursos en consultas

---

## 🚀 7. DEPLOYMENT CHECKLIST

### Pre-deployment
- [ ] Backup de base de datos
- [ ] Verificar variables de entorno
- [ ] Comprobar que Prisma schema está sincronizado

### Deployment
1. [ ] Ejecutar migración SQL en producción
2. [ ] Desplegar Lambda function
3. [ ] Configurar API Gateway
4. [ ] Desplegar frontend
5. [ ] Limpiar caché del navegador

### Post-deployment
- [ ] Verificar que la tabla existe: `SELECT * FROM time_entries LIMIT 1;`
- [ ] Probar crear imputación desde UI
- [ ] Verificar logs de CloudWatch
- [ ] Comprobar métricas de Lambda (errores, duration)

---

## 🆘 8. TROUBLESHOOTING

### Error: "Time entry not found"
- Verificar que el ID existe en la base de datos
- Comprobar que el `team` del usuario coincide

### Error: "Project not found"
- El proyecto no existe o pertenece a otro equipo
- Verificar filtro por team

### No se crea el recurso automáticamente
- Verificar logs de Lambda
- Comprobar permisos de escritura en tabla `resources`
- Validar que el nombre no esté vacío

### Tabla no se actualiza después de guardar
- Verificar que `loadTimeEntries()` se llama después de `saveClaim()`
- Comprobar respuesta de API en Network tab
- Limpiar caché del navegador

---

## 📞 9. CONTACTO Y SOPORTE

Para dudas o problemas durante la implementación:
- Revisar logs de CloudWatch para Lambda
- Verificar console del navegador (F12)
- Comprobar estado de API Gateway
- Validar conexión a base de datos

---

**Documento creado:** 27/01/2026  
**Versión:** 1.0  
**Estado:** LISTO PARA IMPLEMENTACIÓN
