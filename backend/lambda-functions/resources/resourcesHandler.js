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
    const resourceId = pathParameters.id;
    
    if (method === 'OPTIONS') {
        return (0, response_1.optionsResponse)();
    }
    
    try {
        switch (method) {
            case 'GET':
                if (resourceId) {
                    return await getResourceById(resourceId);
                } else {
                    return await listResources(event.queryStringParameters || {}, event.headers || {});
                }
            case 'POST':
                return await createResource(event.body);
            case 'PUT':
                if (!resourceId) {
                    return (0, response_1.errorResponse)('Resource ID is required for update', 400);
                }
                return await updateResource(resourceId, event.body);
            case 'DELETE':
                if (!resourceId) {
                    return (0, response_1.errorResponse)('Resource ID is required for delete', 400);
                }
                return await deleteResource(resourceId);
            default:
                return (0, response_1.errorResponse)(`Method ${method} not allowed`, 405);
        }
    } catch (error) {
        console.error('Error in resourcesHandler:', error);
        const { statusCode, message } = (0, errors_1.handleError)(error);
        return (0, response_1.errorResponse)(message, statusCode, error);
    }
};

exports.handler = handler;

async function listResources(queryParams, headers) {
    const { active, skill, team: queryTeam } = queryParams;
    const team = headers['x-user-team'] || queryTeam;
    
    let sql = `
        SELECT 
            r.*,
            COALESCE(
                json_agg(
                    DISTINCT jsonb_build_object(
                        'skillName', rs.skill_name,
                        'proficiency', rs.proficiency
                    )
                ) FILTER (WHERE rs.skill_name IS NOT NULL),
                '[]'
            ) as "resourceSkills",
            COALESCE(
                json_agg(
                    DISTINCT jsonb_build_object(
                        'id', a.id,
                        'projectId', a.project_id,
                        'month', a.month,
                        'year', a.year,
                        'hours', a.hours
                    )
                ) FILTER (WHERE a.id IS NOT NULL),
                '[]'
            ) as assignments,
            COALESCE(
                json_agg(
                    DISTINCT jsonb_build_object(
                        'id', c.id,
                        'month', c.month,
                        'year', c.year,
                        'totalHours', c.total_hours
                    )
                ) FILTER (WHERE c.id IS NOT NULL),
                '[]'
            ) as capacities
        FROM resources r
        LEFT JOIN resource_skills rs ON r.id = rs.resource_id
        LEFT JOIN assignments a ON r.id = a.resource_id
        LEFT JOIN capacity c ON r.id = c.resource_id
        WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (active !== undefined) {
        sql += ` AND r.active = $${paramIndex++}`;
        params.push(active === 'true');
    }
    if (team) {
        sql += ` AND UPPER(r.team) = UPPER($${paramIndex++})`;
        params.push(team);
    }
    if (skill) {
        sql += ` AND EXISTS (
            SELECT 1 FROM resource_skills rs2 
            WHERE rs2.resource_id = r.id 
            AND rs2.skill_name = $${paramIndex++}
        )`;
        params.push(skill);
    }
    
    sql += `
        GROUP BY r.id
        ORDER BY r.name ASC
    `;
    
    const result = await query(sql, params);
    
    const resourcesWithMetrics = result.rows.map((resource) => {
        const totalAssignedHours = resource.assignments.reduce((sum, assignment) => 
            sum + Number(assignment.hours), 0
        );
        const uniqueProjects = new Set(
            resource.assignments.map(a => a.projectId).filter(id => id)
        );
        
        return {
            ...resource,
            skillsCount: resource.resourceSkills.length,
            totalAssignedHours,
            activeProjectsCount: uniqueProjects.size,
        };
    });
    
    return (0, response_1.successResponse)({
        resources: resourcesWithMetrics,
        count: resourcesWithMetrics.length,
    });
}

async function getResourceById(resourceId) {
    try {
        (0, validators_1.validateUUID)(resourceId, 'resourceId');
    } catch (error) {
        if (error instanceof errors_1.ValidationError) {
            return (0, response_1.errorResponse)(error.message, 400);
        }
        throw error;
    }
    
    const sql = `
        SELECT 
            r.*,
            COALESCE(
                json_agg(
                    DISTINCT jsonb_build_object(
                        'skillName', rs.skill_name,
                        'proficiency', rs.proficiency
                    )
                ) FILTER (WHERE rs.skill_name IS NOT NULL),
                '[]'
            ) as "resourceSkills",
            COALESCE(
                json_agg(
                    DISTINCT jsonb_build_object(
                        'id', a.id,
                        'projectId', a.project_id,
                        'month', a.month,
                        'year', a.year,
                        'hours', a.hours,
                        'project', jsonb_build_object(
                            'id', p.id,
                            'code', p.code,
                            'title', p.title,
                            'type', p.type,
                            'priority', p.priority
                        )
                    )
                ) FILTER (WHERE a.id IS NOT NULL),
                '[]'
            ) as assignments,
            COALESCE(
                json_agg(
                    DISTINCT jsonb_build_object(
                        'id', c.id,
                        'month', c.month,
                        'year', c.year,
                        'totalHours', c.total_hours
                    )
                ) FILTER (WHERE c.id IS NOT NULL),
                '[]'
            ) as capacities
        FROM resources r
        LEFT JOIN resource_skills rs ON r.id = rs.resource_id
        LEFT JOIN assignments a ON r.id = a.resource_id
        LEFT JOIN projects p ON a.project_id = p.id
        LEFT JOIN capacity c ON r.id = c.resource_id
        WHERE r.id = $1
        GROUP BY r.id
    `;
    
    const result = await query(sql, [resourceId]);
    
    if (result.rows.length === 0) {
        throw new errors_1.NotFoundError('Resource', resourceId);
    }
    
    const resource = result.rows[0];
    
    const totalAssignedHours = resource.assignments.reduce((sum, assignment) => 
        sum + Number(assignment.hours), 0
    );
    const uniqueProjects = new Set(
        resource.assignments.map(a => a.projectId).filter(id => id)
    );
    
    return (0, response_1.successResponse)({
        ...resource,
        metrics: {
            totalAssignedHours,
            activeProjectsCount: uniqueProjects.size,
            skillsCount: resource.resourceSkills.length,
        },
    });
}

async function getMaxResourceHours() {
    try {
        const result = await query(
            `SELECT config_value 
             FROM app_config 
             WHERE config_key = 'max_resource_hours' 
             AND team IS NULL 
             LIMIT 1`,
            []
        );
        
        if (result.rows.length > 0 && result.rows[0].config_value) {
            const maxHours = parseInt(result.rows[0].config_value, 10);
            if (!isNaN(maxHours) && maxHours > 0) {
                console.log(`Loaded max_resource_hours from config: ${maxHours}`);
                return maxHours;
            }
        }
    } catch (error) {
        console.warn('Could not load max_resource_hours config, using default 180:', error);
    }
    
    console.log('Using default max_resource_hours: 180');
    return 180;
}

async function createResource(body) {
    if (!body) {
        return (0, response_1.errorResponse)('Request body is required', 400);
    }
    
    const data = JSON.parse(body);
    
    // Generate code if not provided
    if (!data.code) {
        const nameParts = data.name.trim().split(' ');
        const initials = nameParts.map((part) => part.charAt(0).toUpperCase()).join('');
        const timestamp = Date.now().toString().slice(-4);
        data.code = `${initials}${timestamp}`;
    }
    
    const maxResourceHours = await getMaxResourceHours();
    if (data.defaultCapacity !== undefined && data.defaultCapacity > maxResourceHours) {
        return (0, response_1.errorResponse)(
            `Default capacity cannot exceed ${maxResourceHours} hours`,
            400
        );
    }
    
    try {
        (0, validators_1.validateResourceData)(data);
    } catch (error) {
        if (error instanceof errors_1.ValidationError) {
            return (0, response_1.errorResponse)(error.message, 400, { errors: error.validationErrors });
        }
        throw error;
    }
    
    // Ensure unique code
    let finalCode = data.code;
    let existingResource = await query('SELECT id FROM resources WHERE code = $1', [finalCode]);
    let suffix = 1;
    
    while (existingResource.rows.length > 0) {
        finalCode = `${data.code}${suffix}`;
        existingResource = await query('SELECT id FROM resources WHERE code = $1', [finalCode]);
        suffix++;
    }
    
    // Check email uniqueness within team
    if (data.email && data.email.trim() !== '') {
        const emailCheck = await query(
            'SELECT id FROM resources WHERE email = $1 AND team = $2',
            [data.email, data.team]
        );
        
        if (emailCheck.rows.length > 0) {
            return (0, response_1.errorResponse)(
                `A record with this email already exists in team ${data.team}`,
                409
            );
        }
    }
    
    // Insert resource
    const insertSql = `
        INSERT INTO resources (
            code, name, email, team, default_capacity, active
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
    `;
    
    const insertParams = [
        finalCode,
        data.name,
        data.email || null,
        data.team,
        data.defaultCapacity || 160,
        data.active !== undefined ? data.active : true
    ];
    
    const result = await query(insertSql, insertParams);
    const resource = result.rows[0];
    
    // Insert skills if provided
    if (data.skills && data.skills.length > 0) {
        for (const skill of data.skills) {
            await query(
                `INSERT INTO resource_skills (resource_id, skill_name, proficiency)
                 VALUES ($1, $2, $3)`,
                [resource.id, skill.name || skill.skillName, skill.proficiency || null]
            );
        }
    }
    
    // Get resource with skills
    const detailsSql = `
        SELECT 
            r.*,
            COALESCE(
                json_agg(
                    jsonb_build_object(
                        'skillName', rs.skill_name,
                        'proficiency', rs.proficiency
                    )
                ) FILTER (WHERE rs.skill_name IS NOT NULL),
                '[]'
            ) as "resourceSkills"
        FROM resources r
        LEFT JOIN resource_skills rs ON r.id = rs.resource_id
        WHERE r.id = $1
        GROUP BY r.id
    `;
    
    const detailsResult = await query(detailsSql, [resource.id]);
    
    return (0, response_1.createdResponse)(detailsResult.rows[0]);
}

async function updateResource(resourceId, body) {
    try {
        (0, validators_1.validateUUID)(resourceId, 'resourceId');
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
    
    // Validations
    const errors = [];
    
    if (data.name !== undefined) {
        if (!data.name || data.name.trim() === '') {
            errors.push({ field: 'name', message: 'Resource name cannot be empty' });
        } else if (data.name.length > 255) {
            errors.push({ field: 'name', message: 'Resource name must be 255 characters or less' });
        }
    }
    
    if (data.email !== undefined && data.email !== null && data.email.trim() !== '') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(data.email)) {
            errors.push({ field: 'email', message: 'Invalid email format' });
        }
        if (data.email.length > 255) {
            errors.push({ field: 'email', message: 'Email must be 255 characters or less' });
        }
    }
    
    if (data.team !== undefined) {
        if (!data.team || data.team.trim() === '') {
            errors.push({ field: 'team', message: 'Team cannot be empty' });
        }
    }
    
    const maxResourceHours = await getMaxResourceHours();
    if (data.defaultCapacity !== undefined) {
        if (data.defaultCapacity < 0) {
            errors.push({ field: 'defaultCapacity', message: 'Default capacity must be non-negative' });
        }
        if (data.defaultCapacity > maxResourceHours) {
            errors.push({ field: 'defaultCapacity', message: `Default capacity cannot exceed ${maxResourceHours} hours` });
        }
    }
    
    if (errors.length > 0) {
        return (0, response_1.errorResponse)('Validation failed', 400, { errors });
    }
    
    // Check if resource exists
    const existingResult = await query('SELECT * FROM resources WHERE id = $1', [resourceId]);
    if (existingResult.rows.length === 0) {
        throw new errors_1.NotFoundError('Resource', resourceId);
    }
    
    const existingResource = existingResult.rows[0];
    
    // Check code uniqueness if changed
    if (data.code && data.code !== existingResource.code) {
        const codeCheck = await query('SELECT id FROM resources WHERE code = $1', [data.code]);
        if (codeCheck.rows.length > 0) {
            return (0, response_1.errorResponse)(
                `Resource with code '${data.code}' already exists`,
                409
            );
        }
    }
    
    // Check email uniqueness if changed
    if (data.email !== undefined && data.email !== null && data.email.trim() !== '') {
        const teamToCheck = data.team || existingResource.team;
        const emailCheck = await query(
            'SELECT id FROM resources WHERE email = $1 AND team = $2 AND id != $3',
            [data.email, teamToCheck, resourceId]
        );
        
        if (emailCheck.rows.length > 0) {
            return (0, response_1.errorResponse)(
                `A record with this email already exists in team ${teamToCheck}`,
                409
            );
        }
    }
    
    // Update skills if provided
    if (data.skills !== undefined) {
        console.log('Skills detected, updating...');
        
        // Delete existing skills
        const deleteResult = await query(
            'DELETE FROM resource_skills WHERE resource_id = $1',
            [resourceId]
        );
        console.log('Deleted existing skills:', deleteResult.rowCount);
        
        // Insert new skills
        if (Array.isArray(data.skills) && data.skills.length > 0) {
            console.log('Creating new skills:', data.skills);
            for (const skillName of data.skills) {
                await query(
                    'INSERT INTO resource_skills (resource_id, skill_name, proficiency) VALUES ($1, $2, $3)',
                    [resourceId, skillName, null]
                );
            }
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
    if (data.name) {
        updates.push(`name = $${paramIndex++}`);
        params.push(data.name);
    }
    if (data.email !== undefined) {
        updates.push(`email = $${paramIndex++}`);
        params.push(data.email);
    }
    if (data.team) {
        updates.push(`team = $${paramIndex++}`);
        params.push(data.team);
    }
    if (data.defaultCapacity !== undefined) {
        updates.push(`default_capacity = $${paramIndex++}`);
        params.push(data.defaultCapacity);
    }
    if (data.active !== undefined) {
        updates.push(`active = $${paramIndex++}`);
        params.push(data.active);
    }
    
    if (updates.length > 0) {
        params.push(resourceId);
        const updateSql = `
            UPDATE resources
            SET ${updates.join(', ')}
            WHERE id = $${paramIndex}
        `;
        
        await query(updateSql, params);
    }
    
    // Get updated resource with skills
    const detailsSql = `
        SELECT 
            r.*,
            COALESCE(
                json_agg(
                    jsonb_build_object(
                        'skillName', rs.skill_name,
                        'proficiency', rs.proficiency
                    )
                ) FILTER (WHERE rs.skill_name IS NOT NULL),
                '[]'
            ) as "resourceSkills"
        FROM resources r
        LEFT JOIN resource_skills rs ON r.id = rs.resource_id
        WHERE r.id = $1
        GROUP BY r.id
    `;
    
    const detailsResult = await query(detailsSql, [resourceId]);
    
    return (0, response_1.successResponse)(detailsResult.rows[0]);
}

async function deleteResource(resourceId) {
    try {
        (0, validators_1.validateUUID)(resourceId, 'resourceId');
    } catch (error) {
        if (error instanceof errors_1.ValidationError) {
            return (0, response_1.errorResponse)(error.message, 400);
        }
        throw error;
    }
    
    const existingResult = await query('SELECT id FROM resources WHERE id = $1', [resourceId]);
    if (existingResult.rows.length === 0) {
        throw new errors_1.NotFoundError('Resource', resourceId);
    }
    
    await query('DELETE FROM resources WHERE id = $1', [resourceId]);
    
    return (0, response_1.noContentResponse)();
}
