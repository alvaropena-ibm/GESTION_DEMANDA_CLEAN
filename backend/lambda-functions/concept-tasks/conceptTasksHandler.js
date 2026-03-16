"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;

const { query } = require("./lib/db");
const response_1 = require("./lib/response");
const errors_1 = require("./lib/errors");
const validators_1 = require("./lib/validators");

const handler = async (event) => {
    const method = event.httpMethod;
    const pathParameters = event.pathParameters || {};
    const taskId = pathParameters.id;
    
    try {
        if (method === 'OPTIONS') {
            return (0, response_1.optionsResponse)();
        }
        
        switch (method) {
            case 'GET':
                if (taskId) {
                    return await getConceptTaskById(taskId);
                } else {
                    return await listConceptTasks(event.queryStringParameters || {});
                }
            case 'POST':
                return await createConceptTask(event.body);
            case 'PUT':
                if (!taskId) {
                    return (0, response_1.errorResponse)('Task ID is required for update', 400);
                }
                return await updateConceptTask(taskId, event.body);
            case 'DELETE':
                if (!taskId) {
                    return (0, response_1.errorResponse)('Task ID is required for delete', 400);
                }
                return await deleteConceptTask(taskId);
            default:
                return (0, response_1.errorResponse)(`Method ${method} not allowed`, 405);
        }
    } catch (error) {
        console.error('Error in conceptTasksHandler:', error);
        const { statusCode, message } = (0, errors_1.handleError)(error);
        return (0, response_1.errorResponse)(message, statusCode, error);
    }
};

exports.handler = handler;

async function listConceptTasks(queryParams) {
    const { projectId, jiraTaskId } = queryParams;
    
    let sql = `
        SELECT 
            t.*,
            json_build_object(
                'id', jt.id,
                'code', jt.code,
                'title', jt.title,
                'type', jt.type
            ) as jira_task
        FROM concept_tasks t
        LEFT JOIN jira_tasks jt ON t.jira_task_id = jt.id
        WHERE jt.id IS NOT NULL
    `;
    
    const params = [];
    
    // Support both jiraTaskId (new) and projectId (legacy) during transition
    if (jiraTaskId) {
        sql += ` AND t.jira_task_id = $1`;
        params.push(jiraTaskId);
    } else if (projectId) {
        // Legacy support: convert projectId to jiraTaskId
        sql += ` AND t.jira_task_id = (SELECT id FROM jira_tasks WHERE code = (SELECT code FROM projects WHERE id = $1))`;
        params.push(projectId);
    }
    
    sql += ` ORDER BY t.created_at DESC`;
    
    const result = await query(sql, params);
    
    return (0, response_1.successResponse)({
        tasks: result.rows,
        count: result.rows.length
    });
}

async function getConceptTaskById(taskId) {
    try {
        (0, validators_1.validateUUID)(taskId, 'taskId');
    } catch (error) {
        if (error instanceof errors_1.ValidationError) {
            return (0, response_1.errorResponse)(error.message, 400);
        }
        throw error;
    }
    
    const sql = `
        SELECT 
            t.*,
            row_to_json(jt.*) as jira_task
        FROM concept_tasks t
        LEFT JOIN jira_tasks jt ON t.jira_task_id = jt.id
        WHERE t.id = $1
    `;
    
    const result = await query(sql, [taskId]);
    
    if (result.rows.length === 0) {
        throw new errors_1.NotFoundError('ConceptTask', taskId);
    }
    
    return (0, response_1.successResponse)(result.rows[0]);
}

async function createConceptTask(body) {
    if (!body) {
        return (0, response_1.errorResponse)('Request body is required', 400);
    }
    
    const data = JSON.parse(body);
    
    // Validations - support both jiraTaskId (new) and projectId (legacy)
    if (!data.jiraTaskId && !data.projectId) {
        return (0, response_1.errorResponse)('jiraTaskId or projectId is required', 400);
    }
    if (!data.title) {
        return (0, response_1.errorResponse)('title is required', 400);
    }
    if (!data.hours || data.hours <= 0) {
        return (0, response_1.errorResponse)('hours must be greater than 0', 400);
    }
    
    // Get jiraTaskId - either directly or by converting projectId
    let jiraTaskId = data.jiraTaskId;
    if (!jiraTaskId && data.projectId) {
        // Legacy support: convert projectId to jiraTaskId
        const conversionResult = await query(
            'SELECT jt.id FROM jira_tasks jt INNER JOIN projects p ON jt.code = p.code WHERE p.id = $1',
            [data.projectId]
        );
        if (conversionResult.rows.length > 0) {
            jiraTaskId = conversionResult.rows[0].id;
        } else {
            return (0, response_1.errorResponse)(`Cannot find jira_task for project ID '${data.projectId}'`, 404);
        }
    }
    
    // Check if jira_task exists
    const jiraTaskCheck = await query('SELECT id FROM jira_tasks WHERE id = $1', [jiraTaskId]);
    if (jiraTaskCheck.rows.length === 0) {
        return (0, response_1.errorResponse)(`JiraTask with ID '${jiraTaskId}' not found`, 404);
    }
    
    // Insert task with jira_task_id
    const insertSql = `
        INSERT INTO concept_tasks (
            jira_task_id, title, description, hours, skill_name
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    `;
    
    const insertParams = [
        jiraTaskId,
        data.title,
        data.description || null,
        data.hours,
        data.skillName || null
    ];
    
    const result = await query(insertSql, insertParams);
    const task = result.rows[0];
    
    // Get task with jira_task info
    const detailsSql = `
        SELECT 
            t.*,
            json_build_object('id', jt.id, 'code', jt.code, 'title', jt.title) as jira_task
        FROM concept_tasks t
        LEFT JOIN jira_tasks jt ON t.jira_task_id = jt.id
        WHERE t.id = $1
    `;
    
    const detailsResult = await query(detailsSql, [task.id]);
    
    return (0, response_1.createdResponse)(detailsResult.rows[0]);
}

async function updateConceptTask(taskId, body) {
    try {
        (0, validators_1.validateUUID)(taskId, 'taskId');
    } catch (error) {
        if (error instanceof errors_1.ValidationError) {
            return (0, response_1.errorResponse)(error.message, 400);
        }
        throw error;
    }
    
    if (!body) {
        return (0, response_1.errorResponse)('Request body is required', 400);
    }
    
    const data = JSON.parse(body);
    
    // Check if task exists
    const existingResult = await query('SELECT id FROM concept_tasks WHERE id = $1', [taskId]);
    if (existingResult.rows.length === 0) {
        throw new errors_1.NotFoundError('ConceptTask', taskId);
    }
    
    // Build update query dynamically
    const updates = [];
    const params = [];
    let paramIndex = 1;
    
    if (data.title) {
        updates.push(`title = $${paramIndex++}`);
        params.push(data.title);
    }
    if (data.description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        params.push(data.description);
    }
    if (data.hours) {
        updates.push(`hours = $${paramIndex++}`);
        params.push(data.hours);
    }
    if (data.skillName !== undefined) {
        updates.push(`skill_name = $${paramIndex++}`);
        params.push(data.skillName);
    }
    
    if (updates.length === 0) {
        return (0, response_1.errorResponse)('No fields to update', 400);
    }
    
    params.push(taskId);
    const updateSql = `
        UPDATE concept_tasks
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
    `;
    
    await query(updateSql, params);
    
    // Get updated task with jira_task info
    const detailsSql = `
        SELECT 
            t.*,
            json_build_object('id', jt.id, 'code', jt.code, 'title', jt.title) as jira_task
        FROM concept_tasks t
        LEFT JOIN jira_tasks jt ON t.jira_task_id = jt.id
        WHERE t.id = $1
    `;
    
    const detailsResult = await query(detailsSql, [taskId]);
    
    return (0, response_1.successResponse)(detailsResult.rows[0]);
}

async function deleteConceptTask(taskId) {
    try {
        (0, validators_1.validateUUID)(taskId, 'taskId');
    } catch (error) {
        if (error instanceof errors_1.ValidationError) {
            return (0, response_1.errorResponse)(error.message, 400);
        }
        throw error;
    }
    
    const existingResult = await query('SELECT id FROM concept_tasks WHERE id = $1', [taskId]);
    if (existingResult.rows.length === 0) {
        throw new errors_1.NotFoundError('ConceptTask', taskId);
    }
    
    await query('DELETE FROM concept_tasks WHERE id = $1', [taskId]);
    
    return (0, response_1.noContentResponse)();
}
