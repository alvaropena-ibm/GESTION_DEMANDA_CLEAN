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
    const projectId = pathParameters.id;
    
    if (method === 'OPTIONS') {
        return (0, response_1.optionsResponse)();
    }
    
    try {
        const userTeam = event.headers['x-user-team'] || event.headers['X-User-Team'];
        console.log('User team from headers:', userTeam);
        
        switch (method) {
            case 'GET':
                if (projectId) {
                    return await getProjectById(projectId);
                } else {
                    console.log('Calling listProjects with userTeam:', userTeam);
                    return await listProjects(event.queryStringParameters || {}, userTeam);
                }
            case 'POST':
                return await createProject(event.body);
            case 'PUT':
                if (!projectId) {
                    return (0, response_1.errorResponse)('Project ID is required for update', 400);
                }
                return await updateProject(projectId, event.body);
            case 'DELETE':
                if (!projectId) {
                    return (0, response_1.errorResponse)('Project ID is required for delete', 400);
                }
                return await deleteProject(projectId);
            default:
                return (0, response_1.errorResponse)(`Method ${method} not allowed`, 405);
        }
    } catch (error) {
        console.error('Error in projectsHandler:', error);
        const { statusCode, message } = (0, errors_1.handleError)(error);
        return (0, response_1.errorResponse)(message, statusCode, error);
    }
};

exports.handler = handler;

async function listProjects(queryParams, userTeam) {
    const { type, status, domain, priority } = queryParams;
    
    let sql = `
        SELECT 
            p.*,
            COALESCE(
                json_agg(
                    DISTINCT jsonb_build_object(
                        'id', psb.id,
                        'skillName', psb.skill_name,
                        'month', psb.month,
                        'year', psb.year,
                        'hours', psb.hours
                    )
                ) FILTER (WHERE psb.id IS NOT NULL),
                '[]'
            ) as "projectSkillBreakdowns",
            COALESCE(
                json_agg(
                    DISTINCT jsonb_build_object(
                        'id', a.id,
                        'resourceId', a.resource_id,
                        'skillName', a.skill_name,
                        'month', a.month,
                        'year', a.year,
                        'hours', a.hours
                    )
                ) FILTER (WHERE a.id IS NOT NULL),
                '[]'
            ) as assignments
        FROM projects p
        LEFT JOIN project_skill_breakdown psb ON p.id = psb.project_id
        LEFT JOIN assignments a ON p.id = a.project_id
        WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (type) {
        sql += ` AND p.type = $${paramIndex++}`;
        params.push(type);
    }
    if (status) {
        sql += ` AND p.status = $${paramIndex++}`;
        params.push(parseInt(status, 10));
    }
    if (domain) {
        sql += ` AND p.domain = $${paramIndex++}`;
        params.push(parseInt(domain, 10));
    }
    if (priority) {
        sql += ` AND p.priority = $${paramIndex++}`;
        params.push(priority);
    }
    // TEMPORALMENTE DESHABILITADO - Mostrar todos los proyectos
    // if (userTeam && userTeam !== 'ALL') {
    //     sql += ` AND UPPER(p.team) = UPPER($${paramIndex++})`;
    //     params.push(userTeam);
    // }
    console.log('Team filter DISABLED - showing all projects. UserTeam was:', userTeam);
    
    sql += `
        GROUP BY p.id
        ORDER BY p.created_at DESC
    `;
    
    const result = await query(sql, params);
    
    const projectsWithTotals = result.rows.map((project) => {
        const totalHours = project.projectSkillBreakdowns.reduce((sum, breakdown) => 
            sum + Number(breakdown.hours), 0
        );
        const assignedHours = project.assignments.reduce((sum, assignment) => 
            sum + Number(assignment.hours), 0
        );
        const uniqueResources = new Set(
            project.assignments.map(a => a.resourceId).filter(id => id)
        );
        
        return {
            ...project,
            totalCommittedHours: totalHours,
            totalAssignedHours: assignedHours,
            assignedResourcesCount: uniqueResources.size,
        };
    });
    
    return (0, response_1.successResponse)({
        projects: projectsWithTotals,
        count: projectsWithTotals.length,
    });
}

async function getProjectById(projectId) {
    try {
        (0, validators_1.validateUUID)(projectId, 'projectId');
    } catch (error) {
        if (error instanceof errors_1.ValidationError) {
            return (0, response_1.errorResponse)(error.message, 400);
        }
        throw error;
    }
    
    const sql = `
        SELECT 
            p.*,
            COALESCE(
                json_agg(
                    DISTINCT jsonb_build_object(
                        'id', psb.id,
                        'skillName', psb.skill_name,
                        'month', psb.month,
                        'year', psb.year,
                        'hours', psb.hours
                    ) ORDER BY psb.year, psb.month
                ) FILTER (WHERE psb.id IS NOT NULL),
                '[]'
            ) as "projectSkillBreakdowns",
            COALESCE(
                json_agg(
                    DISTINCT jsonb_build_object(
                        'id', a.id,
                        'resourceId', a.resource_id,
                        'skillName', a.skill_name,
                        'month', a.month,
                        'year', a.year,
                        'hours', a.hours,
                        'resource', jsonb_build_object(
                            'id', r.id,
                            'code', r.code,
                            'name', r.name,
                            'email', r.email
                        )
                    ) ORDER BY a.year, a.month
                ) FILTER (WHERE a.id IS NOT NULL),
                '[]'
            ) as assignments
        FROM projects p
        LEFT JOIN project_skill_breakdown psb ON p.id = psb.project_id
        LEFT JOIN assignments a ON p.id = a.project_id
        LEFT JOIN resources r ON a.resource_id = r.id
        WHERE p.id = $1
        GROUP BY p.id
    `;
    
    const result = await query(sql, [projectId]);
    
    if (result.rows.length === 0) {
        throw new errors_1.NotFoundError('Project', projectId);
    }
    
    const project = result.rows[0];
    
    const totalCommittedHours = project.projectSkillBreakdowns.reduce((sum, breakdown) => 
        sum + Number(breakdown.hours), 0
    );
    const totalAssignedHours = project.assignments.reduce((sum, assignment) => 
        sum + Number(assignment.hours), 0
    );
    const uniqueResources = new Set(
        project.assignments.map(a => a.resourceId).filter(id => id)
    );
    
    return (0, response_1.successResponse)({
        ...project,
        metrics: {
            totalCommittedHours,
            totalAssignedHours,
            assignedResourcesCount: uniqueResources.size,
            completionPercentage: totalCommittedHours > 0
                ? Math.round((totalAssignedHours / totalCommittedHours) * 100)
                : 0,
        },
    });
}

async function createProject(body) {
    if (!body) {
        return (0, response_1.errorResponse)('Request body is required', 400);
    }
    
    const data = JSON.parse(body);
    
    try {
        (0, validators_1.validateProjectData)(data);
    } catch (error) {
        if (error instanceof errors_1.ValidationError) {
            return (0, response_1.errorResponse)(error.message, 400, { errors: error.validationErrors });
        }
        throw error;
    }
    
    // Check if project with same code and team exists
    const existingCheck = await query(
        'SELECT id FROM projects WHERE code = $1 AND team = $2',
        [data.code, data.team]
    );
    
    if (existingCheck.rows.length > 0) {
        return (0, response_1.errorResponse)(
            `Project with code '${data.code}' already exists for team '${data.team}'`,
            409
        );
    }
    
    const insertSql = `
        INSERT INTO projects (
            code, title, description, type, priority,
            start_date, end_date, status, domain, team, delivery_hours
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
    `;
    
    const insertParams = [
        data.code,
        data.title,
        data.description || null,
        data.type && data.type.trim() !== '' ? data.type : null,
        data.priority,
        data.startDate ? new Date(data.startDate) : null,
        data.endDate ? new Date(data.endDate) : null,
        data.status,
        data.domain,
        data.team,
        data.deliveryHours ? parseFloat(data.deliveryHours) : null
    ];
    
    const result = await query(insertSql, insertParams);
    
    return (0, response_1.createdResponse)(result.rows[0]);
}

async function updateProject(projectId, body) {
    try {
        (0, validators_1.validateUUID)(projectId, 'projectId');
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
    
    try {
        (0, validators_1.validateProjectData)(data);
    } catch (error) {
        if (error instanceof errors_1.ValidationError) {
            return (0, response_1.errorResponse)(error.message, 400, { errors: error.validationErrors });
        }
        throw error;
    }
    
    // Check if project exists
    const existingResult = await query('SELECT * FROM projects WHERE id = $1', [projectId]);
    if (existingResult.rows.length === 0) {
        throw new errors_1.NotFoundError('Project', projectId);
    }
    
    const existingProject = existingResult.rows[0];
    
    // Check for code/team uniqueness if changed
    if ((data.code && data.code !== existingProject.code) || 
        (data.team && data.team !== existingProject.team)) {
        const codeToCheck = data.code || existingProject.code;
        const teamToCheck = data.team || existingProject.team;
        
        const duplicateCheck = await query(
            'SELECT id FROM projects WHERE code = $1 AND team = $2 AND id != $3',
            [codeToCheck, teamToCheck, projectId]
        );
        
        if (duplicateCheck.rows.length > 0) {
            return (0, response_1.errorResponse)(
                `Project with code '${codeToCheck}' already exists for team '${teamToCheck}'`,
                409
            );
        }
    }
    
    // Build update query dynamically
    const updates = [];
    const params = [];
    let paramIndex = 1;
    
    if (data.code) {
        updates.push(`code = $${paramIndex++}`);
        params.push(data.code);
    }
    if (data.title) {
        updates.push(`title = $${paramIndex++}`);
        params.push(data.title);
    }
    if (data.description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        params.push(data.description);
    }
    if (data.type !== undefined) {
        updates.push(`type = $${paramIndex++}`);
        params.push(data.type && data.type.trim() !== '' ? data.type : null);
    }
    if (data.priority) {
        updates.push(`priority = $${paramIndex++}`);
        params.push(data.priority);
    }
    if (data.startDate !== undefined) {
        updates.push(`start_date = $${paramIndex++}`);
        params.push(data.startDate ? new Date(data.startDate) : null);
    }
    if (data.endDate !== undefined) {
        updates.push(`end_date = $${paramIndex++}`);
        params.push(data.endDate ? new Date(data.endDate) : null);
    }
    if (data.status) {
        updates.push(`status = $${paramIndex++}`);
        params.push(data.status);
    }
    if (data.domain) {
        updates.push(`domain = $${paramIndex++}`);
        params.push(data.domain);
    }
    if (data.team) {
        updates.push(`team = $${paramIndex++}`);
        params.push(data.team);
    }
    if (data.deliveryHours !== undefined) {
        updates.push(`delivery_hours = $${paramIndex++}`);
        params.push(data.deliveryHours ? parseFloat(data.deliveryHours) : null);
    }
    
    if (updates.length === 0) {
        return (0, response_1.errorResponse)('No fields to update', 400);
    }
    
    params.push(projectId);
    const updateSql = `
        UPDATE projects
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
    `;
    
    const result = await query(updateSql, params);
    
    return (0, response_1.successResponse)(result.rows[0]);
}

async function deleteProject(projectId) {
    try {
        (0, validators_1.validateUUID)(projectId, 'projectId');
    } catch (error) {
        if (error instanceof errors_1.ValidationError) {
            return (0, response_1.errorResponse)(error.message, 400);
        }
        throw error;
    }
    
    const existingResult = await query('SELECT id FROM projects WHERE id = $1', [projectId]);
    if (existingResult.rows.length === 0) {
        throw new errors_1.NotFoundError('Project', projectId);
    }
    
    await query('DELETE FROM projects WHERE id = $1', [projectId]);
    
    return (0, response_1.noContentResponse)();
}
