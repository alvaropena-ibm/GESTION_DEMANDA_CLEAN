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
    const conditions = ['UPPER(te.team) = UPPER($1)'];
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
            te.jira_task_id,
            te.resource_id,
            te.work_date as date,
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
            jt.code as jira_task_code,
            jt.title as jira_task_title,
            r.code as resource_code,
            r.name as resource_name,
            COALESCE(jt.code, p.code) as projectCode
        FROM time_entries te
        LEFT JOIN projects p ON te.project_id = p.id
        LEFT JOIN jira_tasks jt ON te.jira_task_id = jt.id
        LEFT JOIN resources r ON te.resource_id = r.id
        WHERE ${whereClause}
        ORDER BY te.work_date DESC
    `;

    const result = await query(sql, params);

    // Transform rows to include nested objects
    const timeEntries = result.rows.map(row => ({
        id: row.id,
        projectId: row.project_id,
        jiraTaskId: row.jira_task_id,
        projectCode: row.projectcode, // Use COALESCE result
        resourceId: row.resource_id,
        date: row.date,
        taskTitle: row.task_title,
        taskDescription: row.task_description,
        activity: row.activity,
        hours: parseFloat(row.hours),
        module: row.module,
        team: row.team,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        project: {
            id: row.project_id || row.jira_task_id,
            code: row.projectcode,
            title: row.project_title || row.jira_task_title
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
        jiraTaskId,
        resourceName,
        resourceEmail,
        workDate,
        taskTitle,
        taskDescription,
        activity,
        hours,
        module
    } = body;

    // 1. Verificar que el proyecto o jira_task existe
    let finalProjectId = projectId;
    let finalJiraTaskId = jiraTaskId;
    
    if (jiraTaskId) {
        // Si se proporciona jiraTaskId, verificar que existe en jira_tasks
        const jiraTaskCheckSql = `
            SELECT id FROM jira_tasks 
            WHERE id = $1 AND team = $2
        `;
        const jiraTaskResult = await query(jiraTaskCheckSql, [jiraTaskId, userTeam]);

        if (jiraTaskResult.rows.length === 0) {
            throw new NotFoundError('Jira task not found');
        }
        
        // jiraTaskId es válido, projectId puede ser null
        finalProjectId = null;
    } else if (projectId) {
        // Si se proporciona projectId (legacy), verificar que existe en projects
        const projectCheckSql = `
            SELECT id FROM projects 
            WHERE id = $1 AND team = $2
        `;
        const projectResult = await query(projectCheckSql, [projectId, userTeam]);

        if (projectResult.rows.length === 0) {
            throw new NotFoundError('Project not found');
        }
        
        finalJiraTaskId = null;
    } else {
        throw new ValidationError('Either projectId or jiraTaskId must be provided');
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
        resourceId = resourceResult.rows[0].id;
    } else {
        console.log(`Creating new resource: ${resourceName} (${resourceEmail || 'no email'})`);
        
        const resourceCode = generateResourceCode(resourceName);
        
        const createResourceSql = `
            INSERT INTO resources (code, name, email, team, default_capacity, active)
            VALUES ($1, $2, $3, $4, 160, true)
            RETURNING id
        `;
        const newResourceResult = await query(createResourceSql, [
            resourceCode, 
            resourceName, 
            resourceEmail || null,
            userTeam
        ]);
        resourceId = newResourceResult.rows[0].id;
        resourceCreated = true;
        
        console.log(`Resource created with ID: ${resourceId}, Email: ${resourceEmail || 'not provided'}`);
    }

    // 3. Verificar si ya existe una entrada para esta combinación
    const checkExistingSql = `
        SELECT id FROM time_entries 
        WHERE resource_id = $1 
        AND work_date = $2 
        AND task_title = $3 
        AND activity = $4
        AND COALESCE(module, '') = COALESCE($5, '')
        AND team = $6
        AND (
            (jira_task_id = $7 AND $7 IS NOT NULL) OR
            (project_id = $8 AND $8 IS NOT NULL)
        )
    `;
    
    const existingResult = await query(checkExistingSql, [
        resourceId,
        workDate,
        taskTitle,
        activity,
        module || '',
        userTeam,
        finalJiraTaskId,
        finalProjectId
    ]);

    let insertResult;
    
    if (existingResult.rows.length > 0) {
        // Ya existe, actualizar las horas
        const existingId = existingResult.rows[0].id;
        const updateSql = `
            UPDATE time_entries 
            SET hours = $1,
                task_description = $2,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
            RETURNING *
        `;
        
        insertResult = await query(updateSql, [
            parseFloat(hours),
            taskDescription || null,
            existingId
        ]);
    } else {
        // No existe, crear nueva entrada
        const insertSql = `
            INSERT INTO time_entries 
            (project_id, jira_task_id, resource_id, work_date, task_title, task_description, activity, hours, module, team)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `;

        insertResult = await query(insertSql, [
            finalProjectId,
            finalJiraTaskId,
            resourceId,
            workDate,
            taskTitle,
            taskDescription || null,
            activity,
            parseFloat(hours),
            module || null,
            userTeam
        ]);
    }

    // Obtener datos completos con joins
    const timeEntryResult = await getTimeEntryById(insertResult.rows[0].id, userTeam);
    
    // getTimeEntryById ya devuelve successResponse con { data: { timeEntry: ... } }
    // Extraemos el timeEntry del resultado
    const timeEntry = JSON.parse(timeEntryResult.body).data.timeEntry;

    return successResponse(
        {
            timeEntry: timeEntry,
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
    const checkSql = `SELECT id FROM time_entries WHERE id = $1 AND team = $2`;
    const checkResult = await query(checkSql, [id, userTeam]);

    if (checkResult.rows.length === 0) {
        throw new NotFoundError('Time entry not found');
    }

    validateTimeEntry(body, true);

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

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    if (updates.length === 1) {
        return await getTimeEntryById(id, userTeam);
    }

    params.push(id);
    params.push(userTeam);

    const updateSql = `
        UPDATE time_entries 
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex} AND team = $${paramIndex + 1}
        RETURNING *
    `;

    await query(updateSql, params);
    const timeEntryResponse = await getTimeEntryById(id, userTeam);
    
    // getTimeEntryById ya devuelve successResponse con { data: { timeEntry: ... } }
    // Extraemos el timeEntry del resultado
    const timeEntry = JSON.parse(timeEntryResponse.body).data.timeEntry;

    return successResponse({
        timeEntry: timeEntry,
        message: 'Time entry updated successfully'
    });
}

/**
 * DELETE /time-entries/{id}
 * Delete time entry
 */
async function deleteTimeEntry(id, userTeam) {
    const checkSql = `SELECT id FROM time_entries WHERE id = $1 AND team = $2`;
    const checkResult = await query(checkSql, [id, userTeam]);

    if (checkResult.rows.length === 0) {
        throw new NotFoundError('Time entry not found');
    }

    const deleteSql = `DELETE FROM time_entries WHERE id = $1 AND team = $2`;
    await query(deleteSql, [id, userTeam]);

    return successResponse({
        message: 'Time entry deleted successfully'
    });
}

/**
 * Generate unique resource code from name
 */
function generateResourceCode(name) {
    const parts = name.trim().split(' ');
    let code = '';
    
    if (parts.length >= 2) {
        code = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    } else {
        code = name.substring(0, 2).toUpperCase();
    }
    
    const timestamp = Date.now().toString().slice(-4);
    return `${code}${timestamp}`;
}