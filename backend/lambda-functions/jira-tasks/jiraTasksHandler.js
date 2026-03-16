/**
 * Jira Tasks Handler
 * Manages CRUD operations for jira_tasks table (SCOM - SAP LCORP)
 */

const { Pool } = require('pg');

// Database connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('rds.amazonaws.com') ? {
        rejectUnauthorized: false
    } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

/**
 * CORS headers
 */
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,x-user-team',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

/**
 * Success response
 */
function successResponse(data, statusCode = 200) {
    return {
        statusCode,
        headers: corsHeaders,
        body: JSON.stringify({ success: true, data })
    };
}

/**
 * Error response
 */
function errorResponse(message, statusCode = 500) {
    return {
        statusCode,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: message })
    };
}

/**
 * Get all jira tasks
 */
async function getAllTasks(team) {
    const query = `
        SELECT 
            id, code, title, description, type, priority,
            start_date as "startDate",
            end_date as "endDate",
            status, domain, team,
            jira_issue_key as "jiraIssueKey",
            jira_url as "jiraUrl",
            fix_versions as "fixVersions",
            created_at as "createdAt",
            updated_at as "updatedAt"
        FROM jira_tasks
        WHERE UPPER(team) = UPPER($1)
        ORDER BY created_at DESC
    `;
    
    const result = await pool.query(query, [team]);
    return result.rows;
}

/**
 * Get task by ID
 */
async function getTaskById(id, team) {
    const query = `
        SELECT 
            id, code, title, description, type, priority,
            start_date as "startDate",
            end_date as "endDate",
            status, domain, team,
            jira_issue_key as "jiraIssueKey",
            jira_url as "jiraUrl",
            fix_versions as "fixVersions",
            created_at as "createdAt",
            updated_at as "updatedAt"
        FROM jira_tasks
        WHERE id = $1 AND UPPER(team) = UPPER($2)
    `;
    
    const result = await pool.query(query, [id, team]);
    
    if (result.rows.length === 0) {
        throw new Error('Task not found');
    }
    
    return result.rows[0];
}

/**
 * Create new task
 */
async function createTask(taskData, team) {
    const {
        code, title, description, type, priority,
        startDate, endDate, status, domain,
        jiraIssueKey, jiraUrl, fixVersions
    } = taskData;
    
    // Validation
    if (!code || !title || !priority || status === undefined || domain === undefined) {
        throw new Error('Missing required fields: code, title, priority, status, domain');
    }
    
    const query = `
        INSERT INTO jira_tasks (
            code, title, description, type, priority,
            start_date, end_date, status, domain, team,
            jira_issue_key, jira_url, fix_versions
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING 
            id, code, title, description, type, priority,
            start_date as "startDate",
            end_date as "endDate",
            status, domain, team,
            jira_issue_key as "jiraIssueKey",
            jira_url as "jiraUrl",
            fix_versions as "fixVersions",
            created_at as "createdAt",
            updated_at as "updatedAt"
    `;
    
    const values = [
        code, title, description || null, type || null, priority,
        startDate || null, endDate || null, status, domain, team,
        jiraIssueKey || null, jiraUrl || null,
        fixVersions ? JSON.stringify(fixVersions) : null
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
}

/**
 * Update task
 */
async function updateTask(id, taskData, team) {
    const {
        code, title, description, type, priority,
        startDate, endDate, status, domain,
        jiraIssueKey, jiraUrl, fixVersions
    } = taskData;
    
    const query = `
        UPDATE jira_tasks
        SET 
            code = COALESCE($1, code),
            title = COALESCE($2, title),
            description = $3,
            type = $4,
            priority = COALESCE($5, priority),
            start_date = $6,
            end_date = $7,
            status = COALESCE($8, status),
            domain = COALESCE($9, domain),
            jira_issue_key = $10,
            jira_url = $11,
            fix_versions = $12,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $13 AND UPPER(team) = UPPER($14)
        RETURNING 
            id, code, title, description, type, priority,
            start_date as "startDate",
            end_date as "endDate",
            status, domain, team,
            jira_issue_key as "jiraIssueKey",
            jira_url as "jiraUrl",
            fix_versions as "fixVersions",
            created_at as "createdAt",
            updated_at as "updatedAt"
    `;
    
    const values = [
        code, title, description, type, priority,
        startDate, endDate, status, domain,
        jiraIssueKey, jiraUrl,
        fixVersions ? JSON.stringify(fixVersions) : null,
        id, team
    ];
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
        throw new Error('Task not found or unauthorized');
    }
    
    return result.rows[0];
}

/**
 * Delete task
 */
async function deleteTask(id, team) {
    const query = `
        DELETE FROM jira_tasks
        WHERE id = $1 AND UPPER(team) = UPPER($2)
        RETURNING id
    `;
    
    const result = await pool.query(query, [id, team]);
    
    if (result.rows.length === 0) {
        throw new Error('Task not found or unauthorized');
    }
    
    return { id: result.rows[0].id, message: 'Task deleted successfully' };
}

/**
 * Get assignments for a jira task
 */
async function getTaskAssignments(taskId, team) {
    const query = `
        SELECT 
            a.*,
            json_build_object(
                'id', r.id,
                'code', r.code,
                'name', r.name,
                'email', r.email,
                'active', r.active
            ) as resource
        FROM assignments a
        LEFT JOIN resources r ON a.resource_id = r.id
        LEFT JOIN jira_tasks jt ON a.jira_task_id = jt.id
        WHERE a.jira_task_id = $1 AND UPPER(jt.team) = UPPER($2)
        ORDER BY a.year DESC, a.month DESC
    `;
    
    const result = await pool.query(query, [taskId, team]);
    return result.rows;
}

/**
 * Get concept tasks for a jira task
 */
async function getTaskConceptTasks(taskId, team) {
    const query = `
        SELECT t.*
        FROM concept_tasks t
        LEFT JOIN jira_tasks jt ON t.jira_task_id = jt.id
        WHERE t.jira_task_id = $1 AND UPPER(jt.team) = UPPER($2)
        ORDER BY t.created_at DESC
    `;
    
    const result = await pool.query(query, [taskId, team]);
    return result.rows;
}

/**
 * Create assignment for a jira task
 */
async function createTaskAssignment(taskId, assignmentData, team) {
    const {
        resourceId, title, description, skillName, module,
        date, month, year, hours
    } = assignmentData;
    
    // Validation
    if (!title) {
        throw new Error('Missing required field: title');
    }
    
    const hasDate = !!date;
    const hasMonthYear = month && year;
    
    if (!hasDate && !hasMonthYear) {
        throw new Error('Either date or (month and year) is required');
    }
    
    if (!hours || hours <= 0) {
        throw new Error('hours must be greater than 0');
    }
    
    // Verify jira_task exists and belongs to team
    const taskCheck = await pool.query(
        'SELECT id FROM jira_tasks WHERE id = $1 AND UPPER(team) = UPPER($2)',
        [taskId, team]
    );
    
    if (taskCheck.rows.length === 0) {
        throw new Error('JiraTask not found or unauthorized');
    }
    
    // Extract month and year from date if provided
    let finalMonth = month;
    let finalYear = year;
    let dateObj = null;
    
    if (hasDate) {
        dateObj = new Date(date);
        finalMonth = dateObj.getMonth() + 1;
        finalYear = dateObj.getFullYear();
    }
    
    // Insert assignment
    const insertQuery = `
        INSERT INTO assignments (
            jira_task_id, resource_id, title, description, skill_name, module,
            date, month, year, hours
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
    `;
    
    const values = [
        taskId,
        resourceId || null,
        title,
        description || null,
        skillName || null,
        module || null,
        dateObj,
        finalMonth,
        finalYear,
        hours
    ];
    
    const result = await pool.query(insertQuery, values);
    return result.rows[0];
}

/**
 * Create concept task for a jira task
 */
async function createTaskConceptTask(taskId, conceptTaskData, team) {
    const { title, description, hours, skillName } = conceptTaskData;
    
    // Validation
    if (!title) {
        throw new Error('Missing required field: title');
    }
    if (!hours || hours <= 0) {
        throw new Error('hours must be greater than 0');
    }
    
    // Verify jira_task exists and belongs to team
    const taskCheck = await pool.query(
        'SELECT id FROM jira_tasks WHERE id = $1 AND UPPER(team) = UPPER($2)',
        [taskId, team]
    );
    
    if (taskCheck.rows.length === 0) {
        throw new Error('JiraTask not found or unauthorized');
    }
    
    // Insert concept task
    const insertQuery = `
        INSERT INTO concept_tasks (
            jira_task_id, title, description, hours, skill_name
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    `;
    
    const values = [
        taskId,
        title,
        description || null,
        hours,
        skillName || null
    ];
    
    const result = await pool.query(insertQuery, values);
    return result.rows[0];
}

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    // Handle OPTIONS request for CORS
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: ''
        };
    }
    
    try {
        // Get user team from headers
        const team = event.headers['x-user-team'] || event.headers['X-User-Team'];
        
        if (!team) {
            return errorResponse('Missing x-user-team header', 400);
        }
        
        const method = event.httpMethod;
        const pathParameters = event.pathParameters || {};
        const taskId = pathParameters.id;
        const resource = pathParameters.resource; // 'assignments' or 'concept-tasks'
        
        let body = {};
        if (event.body) {
            try {
                body = JSON.parse(event.body);
            } catch (e) {
                return errorResponse('Invalid JSON in request body', 400);
            }
        }
        
        // Handle sub-resource routes: /jira-tasks/{id}/assignments or /jira-tasks/{id}/concept-tasks
        if (taskId && resource) {
            if (resource === 'assignments') {
                if (method === 'GET') {
                    // GET /jira-tasks/{id}/assignments
                    const assignments = await getTaskAssignments(taskId, team);
                    return successResponse({ assignments, count: assignments.length });
                } else if (method === 'POST') {
                    // POST /jira-tasks/{id}/assignments
                    const assignment = await createTaskAssignment(taskId, body, team);
                    return successResponse(assignment, 201);
                } else {
                    return errorResponse(`Method ${method} not allowed for assignments`, 405);
                }
            } else if (resource === 'concept-tasks') {
                if (method === 'GET') {
                    // GET /jira-tasks/{id}/concept-tasks
                    const conceptTasks = await getTaskConceptTasks(taskId, team);
                    return successResponse({ tasks: conceptTasks, count: conceptTasks.length });
                } else if (method === 'POST') {
                    // POST /jira-tasks/{id}/concept-tasks
                    const conceptTask = await createTaskConceptTask(taskId, body, team);
                    return successResponse(conceptTask, 201);
                } else {
                    return errorResponse(`Method ${method} not allowed for concept-tasks`, 405);
                }
            } else {
                return errorResponse(`Unknown resource: ${resource}`, 404);
            }
        }
        
        // Route to appropriate handler for main jira_tasks resource
        switch (method) {
            case 'GET':
                if (taskId) {
                    // Get single task
                    const task = await getTaskById(taskId, team);
                    return successResponse(task);
                } else {
                    // Get all tasks
                    const tasks = await getAllTasks(team);
                    return successResponse({ tasks });
                }
                
            case 'POST':
                // Create new task
                const newTask = await createTask(body, team);
                return successResponse(newTask, 201);
                
            case 'PUT':
                // Update task
                if (!taskId) {
                    return errorResponse('Task ID is required for update', 400);
                }
                const updatedTask = await updateTask(taskId, body, team);
                return successResponse(updatedTask);
                
            case 'DELETE':
                // Delete task
                if (!taskId) {
                    return errorResponse('Task ID is required for delete', 400);
                }
                const deleteResult = await deleteTask(taskId, team);
                return successResponse(deleteResult);
                
            default:
                return errorResponse(`Method ${method} not allowed`, 405);
        }
        
    } catch (error) {
        console.error('Error:', error);
        return errorResponse(error.message, error.statusCode || 500);
    }
};