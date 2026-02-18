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
    const assignmentId = pathParameters.id;
    const userTeam = event.headers['x-user-team'] || event.headers['X-User-Team'];
    
    try {
        if (method === 'OPTIONS') {
            return (0, response_1.optionsResponse)();
        }
        
        switch (method) {
            case 'GET':
                if (assignmentId) {
                    return await getAssignmentById(assignmentId);
                } else {
                    return await listAssignments(event.queryStringParameters || {}, userTeam);
                }
            case 'POST':
                return await createAssignment(event.body);
            case 'PUT':
                if (!assignmentId) {
                    return (0, response_1.errorResponse)('Assignment ID is required for update', 400);
                }
                return await updateAssignment(assignmentId, event.body);
            case 'DELETE':
                if (assignmentId) {
                    return await deleteAssignment(assignmentId);
                } else if (event.queryStringParameters?.projectId) {
                    return await deleteProjectAssignments(event.queryStringParameters.projectId);
                } else {
                    return (0, response_1.errorResponse)('Assignment ID or projectId query parameter is required for delete', 400);
                }
            default:
                return (0, response_1.errorResponse)(`Method ${method} not allowed`, 405);
        }
    } catch (error) {
        console.error('Error in assignmentsHandler:', error);
        const { statusCode, message } = (0, errors_1.handleError)(error);
        return (0, response_1.errorResponse)(message, statusCode, error);
    }
};

exports.handler = handler;

async function listAssignments(queryParams, userTeam) {
    const { projectId, resourceId, month, year, skillName } = queryParams;
    
    let sql = `
        SELECT 
            a.*,
            json_build_object(
                'id', p.id,
                'code', p.code,
                'title', p.title,
                'type', p.type,
                'priority', p.priority,
                'status', p.status
            ) as project,
            json_build_object(
                'id', r.id,
                'code', r.code,
                'name', r.name,
                'email', r.email,
                'active', r.active
            ) as resource
        FROM assignments a
        LEFT JOIN projects p ON a.project_id = p.id
        LEFT JOIN resources r ON a.resource_id = r.id
        WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (projectId) {
        sql += ` AND a.project_id = $${paramIndex++}`;
        params.push(projectId);
    }
    
    if (resourceId) {
        sql += ` AND a.resource_id = $${paramIndex++}`;
        params.push(resourceId);
    }
    
    if (month) {
        sql += ` AND a.month = $${paramIndex++}`;
        params.push(parseInt(month, 10));
    }
    
    if (year) {
        sql += ` AND a.year = $${paramIndex++}`;
        params.push(parseInt(year, 10));
    }
    
    if (skillName) {
        sql += ` AND a."skillName" = $${paramIndex++}`;
        params.push(skillName);
    }
    
    if (userTeam) {
        sql += ` AND r.team = $${paramIndex++}`;
        params.push(userTeam);
    }
    
    sql += ` ORDER BY a.year DESC, a.month DESC`;
    
    const result = await query(sql, params);
    
    return (0, response_1.successResponse)({
        assignments: result.rows,
        count: result.rows.length
    });
}

async function getAssignmentById(assignmentId) {
    try {
        (0, validators_1.validateUUID)(assignmentId, 'assignmentId');
    } catch (error) {
        if (error instanceof errors_1.ValidationError) {
            return (0, response_1.errorResponse)(error.message, 400);
        }
        throw error;
    }
    
    const sql = `
        SELECT 
            a.*,
            row_to_json(p.*) as project,
            row_to_json(r.*) as resource
        FROM assignments a
        LEFT JOIN projects p ON a.project_id = p.id
        LEFT JOIN resources r ON a.resource_id = r.id
        WHERE a.id = $1
    `;
    
    const result = await query(sql, [assignmentId]);
    
    if (result.rows.length === 0) {
        throw new errors_1.NotFoundError('Assignment', assignmentId);
    }
    
    return (0, response_1.successResponse)(result.rows[0]);
}

async function createAssignment(body) {
    if (!body) {
        return (0, response_1.errorResponse)('Request body is required', 400);
    }
    
    const data = JSON.parse(body);
    
    // Validations
    if (!data.projectId) {
        return (0, response_1.errorResponse)('projectId is required', 400);
    }
    if (!data.title) {
        return (0, response_1.errorResponse)('title is required', 400);
    }
    
    const hasDate = !!data.date;
    const hasMonthYear = data.month && data.year;
    
    if (!hasDate && !hasMonthYear) {
        return (0, response_1.errorResponse)('Either date or (month and year) is required', 400);
    }
    
    if (!data.hours || data.hours <= 0) {
        return (0, response_1.errorResponse)('hours must be greater than 0', 400);
    }
    
    // Check if project exists
    const projectCheck = await query('SELECT id FROM projects WHERE id = $1', [data.projectId]);
    if (projectCheck.rows.length === 0) {
        return (0, response_1.errorResponse)(`Project with ID '${data.projectId}' not found`, 404);
    }
    
    // If resourceId provided, validate and check capacity
    if (data.resourceId) {
        const resourceCheck = await query(
            'SELECT id, name, active, default_capacity FROM resources WHERE id = $1',
            [data.resourceId]
        );
        
        if (resourceCheck.rows.length === 0) {
            return (0, response_1.errorResponse)(`Resource with ID '${data.resourceId}' not found`, 404);
        }
        
        const resource = resourceCheck.rows[0];
        
        if (!resource.active) {
            return (0, response_1.errorResponse)('Cannot assign inactive resource to project', 400);
        }
        
        // Capacity validation for date-based assignments
        if (hasDate) {
            const assignmentDate = new Date(data.date);
            
            // Get existing assignments for this resource on this date (excluding current project)
            const existingAssignments = await query(
                `SELECT COALESCE(SUM(hours), 0) as total_hours 
                 FROM assignments 
                 WHERE resource_id = $1 
                 AND date = $2 
                 AND project_id != $3`,
                [data.resourceId, assignmentDate, data.projectId]
            );
            
            const assignedHoursToday = parseFloat(existingAssignments.rows[0].total_hours);
            
            // Get absences for this resource on this date (commented out - table doesn't exist yet)
            // const absences = await query(
            //     `SELECT COALESCE(SUM(hours_per_day), 0) as absence_hours
            //      FROM absences
            //      WHERE resource_id = $1
            //      AND start_date <= $2
            //      AND end_date >= $2`,
            //     [data.resourceId, assignmentDate]
            // );
            
            const absenceHoursToday = 0; // parseFloat(absences.rows[0].absence_hours);
            
            // Calculate daily capacity: (monthly capacity / 20 working days) - absences
            const baseDailyCapacity = Math.floor(resource.default_capacity / 20);
            const dailyCapacity = baseDailyCapacity - absenceHoursToday;
            
            if (assignedHoursToday + data.hours > dailyCapacity) {
                throw new errors_1.BusinessRuleError(
                    `Assignment would exceed daily resource capacity for ${assignmentDate.toISOString().split('T')[0]}. Available: ${dailyCapacity - assignedHoursToday} hours, Requested: ${data.hours} hours, Assigned: ${assignedHoursToday} hours, Absences: ${absenceHoursToday} hours`,
                    'DAILY_CAPACITY_EXCEEDED'
                );
            }
        }
    }
    
    // Extract month and year from date if provided
    let month = null;
    let year = null;
    let dateObj = null;
    
    if (hasDate) {
        dateObj = new Date(data.date);
        month = dateObj.getMonth() + 1; // getMonth() returns 0-11, we need 1-12
        year = dateObj.getFullYear();
    } else if (hasMonthYear) {
        month = data.month;
        year = data.year;
    }
    
    // Insert assignment
    const insertSql = `
        INSERT INTO assignments (
            project_id, resource_id, title, description, skill_name, team, module,
            date, month, year, hours
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
    `;
    
    const insertParams = [
        data.projectId,
        data.resourceId || null,
        data.title,
        data.description || null,
        data.skillName || null,
        data.team || null,
        data.module || null,
        dateObj,
        month,
        year,
        data.hours
    ];
    
    const result = await query(insertSql, insertParams);
    const assignment = result.rows[0];
    
    // Get related project and resource info
    const detailsSql = `
        SELECT 
            a.*,
            json_build_object('id', p.id, 'code', p.code, 'title', p.title) as project,
            json_build_object('id', r.id, 'code', r.code, 'name', r.name) as resource
        FROM assignments a
        LEFT JOIN projects p ON a.project_id = p.id
        LEFT JOIN resources r ON a.resource_id = r.id
        WHERE a.id = $1
    `;
    
    const detailsResult = await query(detailsSql, [assignment.id]);
    
    return (0, response_1.createdResponse)(detailsResult.rows[0]);
}

async function updateAssignment(assignmentId, body) {
    try {
        (0, validators_1.validateUUID)(assignmentId, 'assignmentId');
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
    
    // Check if assignment exists
    const existingResult = await query('SELECT * FROM assignments WHERE id = $1', [assignmentId]);
    if (existingResult.rows.length === 0) {
        throw new errors_1.NotFoundError('Assignment', assignmentId);
    }
    
    const existing = existingResult.rows[0];
    
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
    if (data.skillName !== undefined) {
        updates.push(`skill_name = $${paramIndex++}`);
        params.push(data.skillName);
    }
    if (data.module !== undefined) {
        updates.push(`module = $${paramIndex++}`);
        params.push(data.module);
    }
    if (data.month) {
        updates.push(`month = $${paramIndex++}`);
        params.push(data.month);
    }
    if (data.year) {
        updates.push(`year = $${paramIndex++}`);
        params.push(data.year);
    }
    if (data.hours) {
        updates.push(`hours = $${paramIndex++}`);
        params.push(data.hours);
    }
    if (data.resourceId !== undefined) {
        updates.push(`resource_id = $${paramIndex++}`);
        params.push(data.resourceId);
    }
    
    if (updates.length === 0) {
        return (0, response_1.errorResponse)('No fields to update', 400);
    }
    
    params.push(assignmentId);
    const updateSql = `
        UPDATE assignments
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
    `;
    
    const result = await query(updateSql, params);
    
    // Get related info
    const detailsSql = `
        SELECT 
            a.*,
            json_build_object('id', p.id, 'code', p.code, 'title', p.title) as project,
            json_build_object('id', r.id, 'code', r.code, 'name', r.name) as resource
        FROM assignments a
        LEFT JOIN projects p ON a.project_id = p.id
        LEFT JOIN resources r ON a.resource_id = r.id
        WHERE a.id = $1
    `;
    
    const detailsResult = await query(detailsSql, [assignmentId]);
    
    return (0, response_1.successResponse)(detailsResult.rows[0]);
}

async function deleteProjectAssignments(projectId) {
    console.log('Deleting all assignments for project:', projectId);
    
    const countResult = await query(
        'SELECT COUNT(*) as count FROM assignments WHERE project_id = $1',
        [projectId]
    );
    
    console.log('Found', countResult.rows[0].count, 'assignments to delete');
    
    const deleteResult = await query(
        'DELETE FROM assignments WHERE project_id = $1',
        [projectId]
    );
    
    console.log('Deleted', deleteResult.rowCount, 'assignments');
    
    return (0, response_1.successResponse)({
        message: `Deleted ${deleteResult.rowCount} assignments from project`,
        deletedCount: deleteResult.rowCount
    });
}

async function deleteAssignment(assignmentId) {
    try {
        (0, validators_1.validateUUID)(assignmentId, 'assignmentId');
    } catch (error) {
        if (error instanceof errors_1.ValidationError) {
            return (0, response_1.errorResponse)(error.message, 400);
        }
        throw error;
    }
    
    const existingResult = await query('SELECT id FROM assignments WHERE id = $1', [assignmentId]);
    if (existingResult.rows.length === 0) {
        throw new errors_1.NotFoundError('Assignment', assignmentId);
    }
    
    await query('DELETE FROM assignments WHERE id = $1', [assignmentId]);
    
    return (0, response_1.noContentResponse)();
}
