"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;

const { query } = require("./lib/db");
const response_1 = require("./lib/response");
const { getJiraConfigForTeam } = require("./jiraConfig");

const handler = async (event) => {
    console.log('Jira Handler - Event:', JSON.stringify(event));
    
    const method = event.httpMethod;
    const path = event.path;
    
    try {
        if (method === 'GET' && path.includes('/issues')) {
            return await listJiraIssues(event);
        }
        
        if (method === 'GET' && path.includes('/projects')) {
            return await listJiraProjects(event);
        }
        
        if (method === 'POST' && path.includes('/import')) {
            return await importFromJira(event);
        }
        
        if (method === 'POST' && path.includes('/sync/')) {
            return await syncProject(event);
        }
        
        return (0, response_1.errorResponse)('Ruta no encontrada', 404);
    } catch (error) {
        console.error('Error en Jira Handler:', error);
        return (0, response_1.errorResponse)(
            error instanceof Error ? error.message : 'Error interno del servidor'
        );
    }
};

exports.handler = handler;

async function listJiraIssues(event) {
    const userTeam = event.headers['x-user-team'] || event.headers['X-User-Team'];
    
    if (!userTeam) {
        return (0, response_1.errorResponse)('Team header (x-user-team) required', 400);
    }
    
    try {
        const jiraConfig = getJiraConfigForTeam(userTeam);
        const projectKey = event.queryStringParameters?.projectKey;
        
        let jqlQuery;
        if (projectKey) {
            jqlQuery = `project = '${projectKey}' AND status != 'Closed'`;
            console.log(`[listJiraIssues] Team: ${userTeam}, Filtering by project: ${projectKey}`);
        } else if (event.queryStringParameters?.jqlQuery) {
            jqlQuery = event.queryStringParameters.jqlQuery;
            console.log(`[listJiraIssues] Team: ${userTeam}, Using custom JQL`);
        } else {
            jqlQuery = jiraConfig.defaultJql;
            console.log(`[listJiraIssues] Team: ${userTeam}, Using default JQL`);
        }
        
        console.log(`[listJiraIssues] JQL: ${jqlQuery}`);
        
        const issues = await fetchJiraIssues(jiraConfig.url, jiraConfig.auth, jqlQuery);
        
        // Log fixVersions para debug (solo primer issue)
        if (issues.length > 0 && issues[0].fields.fixVersions) {
            console.log('[DEBUG] fixVersions estructura:', JSON.stringify(issues[0].fields.fixVersions, null, 2));
        }
        
        return (0, response_1.successResponse)({
            issues: issues.map(issue => ({
                id: issue.id,
                key: issue.key,
                summary: issue.fields.summary,
                description: extractPlainText(issue.fields.description),
                issueType: issue.fields.issuetype.name,
                status: issue.fields.status.name,
                priority: issue.fields.priority?.name || 'Medium',
                created: issue.fields.created,
                updated: issue.fields.updated,
                duedate: issue.fields.duedate,
                fixVersions: issue.fields.fixVersions || [],
                dominioPrincipal: issue.fields.customfield_10694?.value || 'Sin dominio',
                prioridadNegocio: issue.fields.customfield_11346?.value || 'Media',
                esProyecto: issue.fields.issuetype.name === 'Proyecto' ? 'Si' : 'No'
            })),
            total: issues.length
        });
    } catch (error) {
        console.error('Error listando issues de Jira:', error);
        return (0, response_1.errorResponse)(
            error instanceof Error ? error.message : 'Error conectando con Jira'
        );
    }
}

async function listJiraProjects(event) {
    const jiraUrl = event.queryStringParameters?.jiraUrl;
    const apiToken = event.queryStringParameters?.apiToken;
    const email = event.queryStringParameters?.email;
    
    if (!jiraUrl || !apiToken || !email) {
        return (0, response_1.errorResponse)('Se requiere jiraUrl, apiToken y email', 400);
    }
    
    try {
        const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
        const response = await fetch(`${jiraUrl}/rest/api/3/project`, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Error de Jira: ${response.status} ${response.statusText}`);
        }
        
        const projects = await response.json();
        
        return (0, response_1.successResponse)({
            projects: projects.map((p) => ({
                id: p.id,
                key: p.key,
                name: p.name,
                projectTypeKey: p.projectTypeKey,
                style: p.style
            }))
        });
    } catch (error) {
        console.error('Error listando proyectos de Jira:', error);
        return (0, response_1.errorResponse)(
            error instanceof Error ? error.message : 'Error conectando con Jira'
        );
    }
}

async function importFromJira(event) {
    if (!event.body) {
        return (0, response_1.errorResponse)('Body requerido', 400);
    }
    
    const body = JSON.parse(event.body);
    const { projectKeys, issueKeys, jqlQuery, team, source } = body;
    
    console.log('[1] Validando campos...');
    if (!team) {
        return (0, response_1.errorResponse)('Campo requerido: team', 400);
    }
    
    // Validar source: 'NC' para projects, 'SCOM' para jira_tasks
    const validSources = ['NC', 'SCOM'];
    const importSource = source || 'NC'; // Default a NC para compatibilidad
    
    if (!validSources.includes(importSource)) {
        return (0, response_1.errorResponse)(`Source debe ser 'NC' o 'SCOM'`, 400);
    }
    
    console.log(`[1.1] Source: ${importSource} (${importSource === 'NC' ? 'projects table' : 'jira_tasks table'})`);
    
    try {
        console.log('[2] Obteniendo configuración de Jira para el equipo...');
        const jiraConfig = getJiraConfigForTeam(team);
        
        let issues = [];
        console.log('[3] Iniciando fetch de issues desde Jira...');
        
        if (issueKeys && issueKeys.length > 0) {
            console.log(`[3a] Importando por issueKeys: ${issueKeys.length} issues`);
            const jql = `key IN (${issueKeys.map((k) => `'${k}'`).join(',')})`;
            issues = await fetchJiraIssues(jiraConfig.url, jiraConfig.auth, jql);
        } else if (projectKeys && projectKeys.length > 0) {
            console.log(`[3b] Importando por projectKeys: ${projectKeys}`);
            for (const projectKey of projectKeys) {
                const projectIssues = await fetchJiraIssues(
                    jiraConfig.url,
                    jiraConfig.auth,
                    `project = ${projectKey}`
                );
                issues = issues.concat(projectIssues);
            }
        } else if (jqlQuery) {
            console.log(`[3c] Importando con JQL: ${jqlQuery}`);
            issues = await fetchJiraIssues(jiraConfig.url, jiraConfig.auth, jqlQuery);
        } else {
            return (0, response_1.errorResponse)(
                'Se requiere issueKeys, projectKeys o jqlQuery',
                400
            );
        }
        
        console.log(`[4] Encontrados ${issues.length} issues en Jira`);
        
        const importedProjects = [];
        const updatedProjects = [];
        
        // Determinar tabla según source
        const tableName = importSource === 'NC' ? 'projects' : 'jira_tasks';
        console.log(`[4.1] Usando tabla: ${tableName}`);
        
        for (const issue of issues) {
            // Check if record exists
            const existingResult = await query(
                `SELECT id FROM ${tableName} WHERE code = $1 AND team = $2`,
                [issue.key, team]
            );
            
            try {
                const startDate = new Date(issue.fields.created);
                // Process fixVersions - extract relevant data
                const fixVersions = (issue.fields.fixVersions || []).map(fv => ({
                    id: fv.id,
                    name: fv.name,
                    released: fv.released || false,
                    releaseDate: fv.releaseDate || null
                }));
                
                const recordData = {
                    type: mapIssueTypeToProjectType(issue.fields.issuetype.name),
                    title: issue.fields.summary,
                    description: extractPlainText(issue.fields.description),
                    domain: mapJiraDomainToLocal(issue.fields.customfield_10694?.value),
                    priority: mapJiraPriorityToLocal(issue.fields.customfield_11346?.value),
                    status: mapJiraStatusToLocal(issue.fields.status.name),
                    start_date: startDate,
                    end_date: issue.fields.duedate ? new Date(issue.fields.duedate) : null,
                    jira_issue_key: issue.key,
                    jira_url: `${jiraConfig.url}/browse/${issue.key}`,
                    fix_versions: JSON.stringify(fixVersions)
                };
                
                if (existingResult.rows.length > 0) {
                    // SINCRONIZAR: Actualizar registro existente
                    console.log(`[5a] ${issue.key} ya existe en ${tableName}, sincronizando...`);
                    
                    const updateSql = `
                        UPDATE ${tableName}
                        SET type = $1, title = $2, description = $3, domain = $4,
                            priority = $5, status = $6, start_date = $7, end_date = $8,
                            jira_issue_key = $9, jira_url = $10, fix_versions = $11::jsonb, updated_at = NOW()
                        WHERE id = $12
                        RETURNING *
                    `;
                    
                    const result = await query(updateSql, [
                        recordData.type,
                        recordData.title,
                        recordData.description,
                        recordData.domain,
                        recordData.priority,
                        recordData.status,
                        recordData.start_date,
                        recordData.end_date,
                        recordData.jira_issue_key,
                        recordData.jira_url,
                        recordData.fix_versions,
                        existingResult.rows[0].id
                    ]);
                    
                    updatedProjects.push({
                        project: result.rows[0],
                        action: 'updated'
                    });
                    console.log(`[5a] ${issue.key} sincronizado exitosamente en ${tableName}`);
                } else {
                    // IMPORTAR: Crear nuevo registro
                    console.log(`[5b] ${issue.key} no existe en ${tableName}, creando...`);
                    
                    const insertSql = `
                        INSERT INTO ${tableName} (
                            code, team, type, title, description, domain,
                            priority, status, start_date, end_date,
                            jira_issue_key, jira_url, fix_versions
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
                        RETURNING *
                    `;
                    
                    const result = await query(insertSql, [
                        issue.key,
                        team,
                        recordData.type,
                        recordData.title,
                        recordData.description,
                        recordData.domain,
                        recordData.priority,
                        recordData.status,
                        recordData.start_date,
                        recordData.end_date,
                        recordData.jira_issue_key,
                        recordData.jira_url,
                        recordData.fix_versions
                    ]);
                    
                    importedProjects.push({
                        project: result.rows[0],
                        action: 'created'
                    });
                    console.log(`[5b] ${issue.key} creado exitosamente en ${tableName}`);
                }
            } catch (error) {
                console.error(`Error procesando ${issue.key}:`, error);
            }
        }
        
        const allProjects = [...importedProjects, ...updatedProjects];
        
        return (0, response_1.successResponse)({
            message: `Procesados ${allProjects.length} proyectos: ${importedProjects.length} importados, ${updatedProjects.length} sincronizados`,
            imported: importedProjects.map(p => ({
                code: p.project.code,
                title: p.project.title,
                action: 'created'
            })),
            updated: updatedProjects.map(p => ({
                code: p.project.code,
                title: p.project.title,
                action: 'updated'
            })),
            totalIssues: issues.length,
            stats: {
                created: importedProjects.length,
                updated: updatedProjects.length,
                total: allProjects.length
            }
        });
    } catch (error) {
        console.error('Error importando desde Jira:', error);
        return (0, response_1.errorResponse)(
            error instanceof Error ? error.message : 'Error importando proyectos'
        );
    }
}

async function syncProject(event) {
    const projectId = event.pathParameters?.projectId;
    
    if (!projectId) {
        return (0, response_1.errorResponse)('projectId requerido', 400);
    }
    
    if (!event.body) {
        return (0, response_1.errorResponse)('Body requerido', 400);
    }
    
    const body = JSON.parse(event.body);
    const { jiraUrl, apiToken, email } = body;
    
    if (!jiraUrl || !apiToken || !email) {
        return (0, response_1.errorResponse)(
            'Campos requeridos: jiraUrl, apiToken, email',
            400
        );
    }
    
    try {
        // Get project with assignments
        const projectResult = await query(
            `SELECT p.*, 
                    COALESCE(
                        json_agg(
                            jsonb_build_object(
                                'id', a.id,
                                'jiraIssueKey', a.jira_issue_key
                            )
                        ) FILTER (WHERE a.id IS NOT NULL),
                        '[]'
                    ) as assignments
             FROM projects p
             LEFT JOIN assignments a ON p.id = a.project_id
             WHERE p.id = $1
             GROUP BY p.id`,
            [projectId]
        );
        
        if (projectResult.rows.length === 0) {
            return (0, response_1.errorResponse)('Proyecto no encontrado', 404);
        }
        
        const project = projectResult.rows[0];
        
        if (!project.jira_project_key) {
            return (0, response_1.errorResponse)(
                'Este proyecto no está vinculado a Jira',
                400
            );
        }
        
        const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
        const jql = `project = ${project.jira_project_key}`;
        const issues = await fetchJiraIssues(jiraUrl, auth, jql);
        
        let updated = 0;
        let created = 0;
        
        for (const issue of issues) {
            const existingAssignment = project.assignments.find(
                a => a.jiraIssueKey === issue.key
            );
            
            const estimatedHours = issue.fields.customfield_10016
                ? issue.fields.customfield_10016 * 8
                : 8;
            
            if (existingAssignment) {
                await query(
                    `UPDATE assignments
                     SET title = $1, description = $2, hours = $3
                     WHERE id = $4`,
                    [
                        issue.fields.summary,
                        extractPlainText(issue.fields.description),
                        estimatedHours,
                        existingAssignment.id
                    ]
                );
                updated++;
            } else {
                const startDate = new Date(issue.fields.created);
                
                await query(
                    `INSERT INTO assignments (
                        project_id, title, description, hours, date,
                        month, year, team, jira_issue_key, jira_issue_id
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                    [
                        project.id,
                        issue.fields.summary,
                        extractPlainText(issue.fields.description),
                        estimatedHours,
                        startDate,
                        startDate.getMonth() + 1,
                        startDate.getFullYear(),
                        project.team,
                        issue.key,
                        issue.id
                    ]
                );
                created++;
            }
        }
        
        await query(
            'UPDATE projects SET updated_at = NOW() WHERE id = $1',
            [project.id]
        );
        
        return (0, response_1.successResponse)({
            message: 'Proyecto sincronizado con éxito',
            projectCode: project.code,
            updated,
            created,
            total: issues.length
        });
    } catch (error) {
        console.error('Error sincronizando proyecto:', error);
        return (0, response_1.errorResponse)(
            error instanceof Error ? error.message : 'Error sincronizando proyecto'
        );
    }
}

async function fetchJiraIssues(jiraUrl, auth, jql) {
    const allIssues = [];
    const seenKeys = new Set();
    let lastKey = null;
    const maxResults = 100;
    const timeoutMs = 30000;
    const MAX_PAGES = 20;
    let pageCount = 0;
    
    console.log('[fetchJiraIssues] Iniciando fetch con paginación por key...');
    
    while (pageCount < MAX_PAGES) {
        pageCount++;
        const url = `${jiraUrl}/rest/api/3/search/jql`;
        
        let paginatedJql = `${jql} ORDER BY key DESC`;
        if (lastKey) {
            const baseJql = jql.replace(/\s+ORDER\s+BY\s+.*/i, '').trim();
            paginatedJql = `${baseJql} AND key < '${lastKey}' ORDER BY key DESC`;
        }
        
        console.log(`[fetchJiraIssues] Página ${pageCount}, lastKey=${lastKey || 'ninguno'}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        
        try {
            const params = new URLSearchParams({
                jql: paginatedJql,
                startAt: '0',
                maxResults: maxResults.toString(),
                fields: 'summary,description,issuetype,status,priority,created,updated,duedate,fixVersions,customfield_10016,customfield_10694,customfield_11346'
            });
            
            const fullUrl = `${url}?${params.toString()}`;
            console.log(`[fetchJiraIssues] JQL: ${paginatedJql.substring(0, 100)}...`);
            
            const response = await fetch(fullUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Accept': 'application/json'
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[fetchJiraIssues] Error ${response.status}: ${errorText}`);
                throw new Error(`Error de Jira: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            const issuesReceived = data.issues?.length || 0;
            
            console.log(`[fetchJiraIssues] Recibidos ${issuesReceived} issues`);
            
            if (issuesReceived === 0) {
                console.log(`[fetchJiraIssues] No hay más issues. Total final: ${allIssues.length} issues únicos`);
                break;
            }
            
            let newIssuesCount = 0;
            for (const issue of data.issues) {
                if (!seenKeys.has(issue.key)) {
                    seenKeys.add(issue.key);
                    allIssues.push(issue);
                    newIssuesCount++;
                }
            }
            
            lastKey = data.issues[data.issues.length - 1].key;
            console.log(`[fetchJiraIssues] ${newIssuesCount} nuevos, último key: ${lastKey}, total acumulado: ${allIssues.length}`);
            
            if (newIssuesCount === 0) {
                console.log(`[fetchJiraIssues] Todos duplicados. Total final: ${allIssues.length} issues únicos`);
                break;
            }
            
            if (issuesReceived < maxResults) {
                console.log(`[fetchJiraIssues] Última página (${issuesReceived} < ${maxResults}). Total final: ${allIssues.length} issues`);
                break;
            }
        } catch (error) {
            clearTimeout(timeoutId);
            if (error?.name === 'AbortError') {
                throw new Error(`Timeout conectando con Jira después de ${timeoutMs}ms`);
            }
            throw error;
        }
    }
    
    console.log(`[fetchJiraIssues] Completado. Total: ${allIssues.length} issues en ${pageCount} páginas`);
    return allIssues;
}

function mapJiraDomainToLocal(domain) {
    if (!domain) return 0;
    
    const domainLower = domain.toLowerCase();
    
    if (domainLower.includes('ventas') || domainLower.includes('contratación') || domainLower.includes('contratacion'))
        return 1;
    if (domainLower.includes('ciclo de vida') || domainLower.includes('producto'))
        return 2;
    if (domainLower.includes('facturación') || domainLower.includes('facturacion') || domainLower.includes('cobro'))
        return 3;
    if (domainLower.includes('atención') || domainLower.includes('atencion'))
        return 4;
    if (domainLower.includes('operación') || domainLower.includes('operacion') || domainLower.includes('sistemas') || domainLower.includes('ciberseguridad'))
        return 5;
    if (domainLower.includes('datos'))
        return 6;
    if (domainLower.includes('portabilidad'))
        return 7;
    if (domainLower.includes('integración') || domainLower.includes('integracion'))
        return 8;
    
    return 0;
}

function mapIssueTypeToProjectType(issueType) {
    if (!issueType) return 'Evolutivo';
    
    const type = issueType.toLowerCase();
    if (type === 'proyecto') {
        return 'Proyecto';
    }
    
    return 'Evolutivo';
}

function mapJiraPriorityToLocal(prioridadNegocio) {
    if (!prioridadNegocio) return 'media';
    
    const priority = prioridadNegocio.toLowerCase();
    
    if (priority.includes('muy alta')) return 'muy-alta';
    if (priority.includes('alta')) return 'alta';
    if (priority.includes('media')) return 'media';
    if (priority.includes('baja') && !priority.includes('muy')) return 'baja';
    if (priority.includes('muy baja')) return 'muy-baja';
    
    return 'media';
}

function mapJiraStatusToLocal(jiraStatus) {
    const status = jiraStatus.toLowerCase();
    
    if (status.includes('idea')) return 1;
    if (status.includes('concepto')) return 2;
    if (status.includes('viabilidad')) return 3;
    if (status.includes('diseño') || status.includes('diseno')) return 4;
    if (status.includes('desarrollo')) return 5;
    if (status.includes('implantado')) return 6;
    if (status.includes('finalizado')) return 7;
    if (status.includes('on hold')) return 8;
    if (status.includes('cancelado')) return 9;
    
    return 1; // Por defecto: Idea
}

function extractPlainText(description) {
    if (!description) return '';
    if (typeof description === 'string') return description;
    
    if (description.type === 'doc' && description.content) {
        return extractTextFromADF(description.content);
    }
    
    return JSON.stringify(description);
}

function extractTextFromADF(content) {
    let text = '';
    
    for (const node of content) {
        if (node.type === 'text') {
            text += node.text;
        } else if (node.type === 'paragraph' || node.type === 'heading') {
            if (node.content) {
                text += extractTextFromADF(node.content) + '\n';
            }
        } else if (node.content) {
            text += extractTextFromADF(node.content);
        }
    }
    
    return text.trim();
}
