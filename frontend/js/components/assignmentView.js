/**
 * Assignment View Component
 * Manages resource assignment with Excel-like interface using Handsontable
 * Shows two separate tables: Assigned tasks and Pending tasks
 */

import { API_CONFIG } from '../config/data.js';
import { showNotification } from '../utils/helpers.js';
import { CreateTaskModal } from './createTaskModal.js';

// Create task modal instance
let createTaskModalInstance = null;

// Handsontable instance
let hotInstance = null;

// Current project being edited
let currentProjectCode = null;
let currentProjectId = null;

// All assignments data
let allAssignments = [];

// Resources and domains for dropdowns
let resourcesList = [];
let domainsList = [];

/**
 * Generate date range: -30 days to +120 days from today
 */
function generateDateRange() {
    const dates = [];
    const today = new Date();
    
    // Start 30 days before today
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 30);
    
    // End 120 days after today
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 120);
    
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
        dates.push({
            date: new Date(currentDate),
            key: `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`,
            display: `${currentDate.getDate()}/${currentDate.getMonth() + 1}`
        });
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dates;
}

/**
 * Open the assignment view for a project
 * @param {number} projectId - The project ID
 * @param {string} projectCode - The project code
 * @param {string} projectTitle - The project title (optional)
 */
export async function openAssignmentView(projectId, projectCode, projectTitle = '') {
    console.log('Opening assignment view for project:', projectId, projectCode, projectTitle);
    
    currentProjectId = projectId;
    currentProjectCode = projectCode;
    
    try {
        // Get authentication tokens
        const awsAccessKey = sessionStorage.getItem('aws_access_key');
        const userTeam = sessionStorage.getItem('user_team');
        
        if (!awsAccessKey || !userTeam) {
            showNotification('No se encontraron credenciales de autenticación', 'error');
            return;
        }
        
        // Load tasks/assignments for this project
        allAssignments = await loadProjectTasks(projectId, awsAccessKey, userTeam);
        
        // Try to load resources for dropdowns (non-blocking)
        try {
            resourcesList = await loadResources(awsAccessKey, userTeam);
            // NOTE: domainsList commented out - not currently used but kept for future use
            // If needed in the future, uncomment the following lines:
            // [resourcesList, domainsList] = await Promise.all([
            //     loadResources(awsAccessKey, userTeam),
            //     loadDomains(awsAccessKey, userTeam)
            // ]);
        } catch (error) {
            console.warn('Could not load resources, will use manual input:', error);
            resourcesList = [];
            // domainsList = [];  // Uncomment if domains loading is re-enabled
        }
        
        // Create and show the assignment modal
        createAssignmentModal(projectCode, projectTitle, allAssignments);
        
    } catch (error) {
        console.error('Error opening assignment view:', error);
        showNotification('Error al cargar las tareas del proyecto', 'error');
    }
}

/**
 * Load tasks/assignments for a project
 */
async function loadProjectTasks(projectId, awsAccessKey, userTeam) {
    console.log('Loading concept tasks for project:', projectId);
    
    const response = await fetch(`${API_CONFIG.BASE_URL}/concept-tasks?projectId=${projectId}`, {
        headers: {
            'Authorization': awsAccessKey,
            'x-user-team': userTeam
        }
    });
    
    if (!response.ok) {
        throw new Error('Error al cargar tareas');
    }
    
    const data = await response.json();
    const tasks = data.data?.tasks || data.tasks || [];
    
    console.log('Concept tasks loaded:', tasks.length);
    return tasks;
}

/**
 * Load resources from API
 */
async function loadResources(awsAccessKey, userTeam) {
    const response = await fetch(`${API_CONFIG.BASE_URL}/resources`, {
        headers: {
            'Authorization': awsAccessKey,
            'x-user-team': userTeam
        }
    });
    
    if (!response.ok) {
        throw new Error('Error al cargar recursos');
    }
    
    const data = await response.json();
    return data.data?.resources || data.resources || [];
}

/**
 * Load domains from API
 */
async function loadDomains(awsAccessKey, userTeam) {
    const response = await fetch(`${API_CONFIG.BASE_URL}/domains`, {
        headers: {
            'Authorization': awsAccessKey,
            'x-user-team': userTeam
        }
    });
    
    if (!response.ok) {
        throw new Error('Error al cargar dominios');
    }
    
    const data = await response.json();
    return data.data?.domains || data.domains || [];
}

/**
 * Create and display the assignment modal with single unified Handsontable
 */
function createAssignmentModal(projectCode, projectTitle, assignments) {
    // Separate assignments into assigned and pending for statistics
    const assignedTasks = assignments.filter(a => a.resourceId);
    const pendingTasks = assignments.filter(a => !a.resourceId);
    
    const totalHours = assignments.reduce((sum, a) => sum + (parseFloat(a.hours) || 0), 0);
    const assignedHours = assignedTasks.reduce((sum, a) => sum + (parseFloat(a.hours) || 0), 0);
    const pendingHours = pendingTasks.reduce((sum, a) => sum + (parseFloat(a.hours) || 0), 0);
    
    // Build title with project code and title
    const modalTitleText = projectTitle 
        ? `Tareas Conceptualización - ${projectCode} - ${projectTitle}`
        : `Tareas Conceptualización - ${projectCode}`;
    
    // Create modal HTML with single table
    const modalHTML = `
        <style>
            #assignmentModal #tasks-table-body tr {
                height: auto !important;
                min-height: 40px !important;
                opacity: 1 !important;
                display: table-row !important;
            }
            #assignmentModal #tasks-table-body td {
                height: auto !important;
                min-height: 40px !important;
                padding: 12px !important;
                display: table-cell !important;
            }
        </style>
        <div id="assignmentModal" class="modal-overlay" style="display: flex;">
            <div class="modal-container" style="max-width: 1400px; width: 95%; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center;">
                    <h2>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 24px; height: 24px; display: inline-block; margin-right: 8px; vertical-align: middle;">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                        </svg>
                        ${modalTitleText}
                    </h2>
                    <button class="modal-close" onclick="window.closeAssignmentView()">&times;</button>
                </div>
                <div class="modal-body">
                    <!-- Statistics Bar -->
                    <div style="display: flex; gap: 1.5rem; margin-bottom: 1.5rem; padding: 1rem; background: #f8f9fa; border-radius: 8px;">
                        <div style="flex: 1; text-align: center;">
                            <div style="font-size: 2rem; font-weight: bold; color: #2c3e50;">${assignments.length}</div>
                            <div style="font-size: 0.875rem; color: #718096;">Total Tareas</div>
                        </div>
                        <div style="flex: 1; text-align: center;">
                            <div style="font-size: 2rem; font-weight: bold; color: #3498db;">${totalHours.toFixed(1)}</div>
                            <div style="font-size: 0.875rem; color: #718096;">Horas Totales</div>
                        </div>
                    </div>
                    
                    <!-- Tasks Table -->
                    <div style="margin-bottom: 1rem; overflow-x: auto;">
                            <table id="tasks-table">
                            <thead>
                                <tr>
                                    <th style="text-align: left;">ID</th>
                                    <th style="text-align: left;">Título</th>
                                    <th style="text-align: left;">Descripción</th>
                                    <th style="text-align: left;">Skills</th>
                                    <th style="text-align: center;">Horas Estimadas</th>
                                    <th style="text-align: center;">Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="tasks-table-body">
                                <!-- Tasks will be populated here -->
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; border-top: 1px solid #e2e8f0;">
                    <div style="display: flex; gap: 0.75rem;">
                        <button type="button" class="btn btn-secondary" onclick="window.closeAssignmentView()">Cerrar</button>
                    </div>
                    <div style="display: flex; gap: 0.75rem;">
                        <button type="button" id="create-task-btn" class="btn btn-success" style="display: flex; align-items: center; gap: 0.5rem; background: #2d7a6e; border-color: #2d7a6e; color: white;">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="white" style="width: 18px; height: 18px;">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                            Crear Tarea
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if any
    const existingModal = document.getElementById('assignmentModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Add active class to make modal visible
    const modal = document.getElementById('assignmentModal');
    modal.classList.add('active');
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    
    // Populate tasks table
    populateTasksTable(assignments);
    
    // Attach event listener to "Crear Tarea" button
    const createTaskBtn = document.getElementById('create-task-btn');
    if (createTaskBtn) {
        createTaskBtn.addEventListener('click', () => openTaskModalFromAssignment());
    }
    
    // Attach event listener to "Eliminar Seleccionadas" button
    const deleteSelectedBtn = document.getElementById('delete-selected-btn');
    if (deleteSelectedBtn) {
        deleteSelectedBtn.addEventListener('click', () => deleteSelectedTasks());
    }
    
    // Add ESC key listener to close modal
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            closeAssignmentView();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);
}

/**
 * Delete selected tasks
 */
async function deleteSelectedTasks() {
    if (!hotInstance) return;
    
    // Get all data from table
    const data = hotInstance.getSourceData();
    
    // Find selected rows
    const selectedRows = data.filter(row => row.selected === true);
    
    if (selectedRows.length === 0) {
        showNotification('No hay tareas seleccionadas para eliminar', 'warning');
        return;
    }
    
    // Collect all assignment IDs from selected rows
    const allAssignmentIds = [];
    selectedRows.forEach(row => {
        if (row.allIds && Array.isArray(row.allIds)) {
            allAssignmentIds.push(...row.allIds);
        }
    });
    
    // Confirm deletion
    const confirmed = confirm(
        `¿Estás seguro de que deseas eliminar ${selectedRows.length} tarea(s) seleccionada(s)?\n\n` +
        `Se eliminarán ${allAssignmentIds.length} registro(s) de asignación en total.\n` +
        `Esta acción no se puede deshacer.`
    );
    
    if (!confirmed) return;
    
    try {
        const awsAccessKey = sessionStorage.getItem('aws_access_key');
        const userTeam = sessionStorage.getItem('user_team');
        
        if (!awsAccessKey || !userTeam) {
            showNotification('No se encontraron credenciales de autenticación', 'error');
            return;
        }
        
        let successCount = 0;
        let errorCount = 0;
        
        // Delete all assignments
        for (const assignmentId of allAssignmentIds) {
            try {
                const response = await fetch(`${API_CONFIG.BASE_URL}/assignments/${assignmentId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': awsAccessKey,
                        'x-user-team': userTeam
                    }
                });
                
                if (!response.ok) {
                    errorCount++;
                    console.error(`Error deleting assignment ${assignmentId}`);
                } else {
                    successCount++;
                }
            } catch (err) {
                errorCount++;
                console.error(`Error deleting assignment ${assignmentId}:`, err);
            }
        }
        
        console.log(`Deleted ${successCount} assignments (${errorCount} errors)`);
        
        if (successCount > 0) {
            showNotification(`${selectedRows.length} tarea(s) eliminada(s) correctamente (${successCount} registros)`, 'success');
            
            // Refresh the assignment view
            const projectId = currentProjectId;
            const projectCode = currentProjectCode;
            closeAssignmentView();
            await openAssignmentView(projectId, projectCode);
        } else {
            showNotification('No se pudieron eliminar las tareas', 'error');
        }
        
    } catch (error) {
        console.error('Error deleting selected tasks:', error);
        showNotification('Error al eliminar las tareas seleccionadas', 'error');
    }
}

/**
 * Open Create Task Modal from assignment view
 */
function openTaskModalFromAssignment() {
    // Initialize create task modal if not already done
    if (!createTaskModalInstance) {
        createTaskModalInstance = new CreateTaskModal();
        createTaskModalInstance.init();
        
        // Set callback to refresh view when task is created
        createTaskModalInstance.setOnTaskCreatedCallback(async () => {
            console.log('Task created, refreshing assignment view...');
            // Save current project info
            const projectId = currentProjectId;
            const projectCode = currentProjectCode;
            // Refresh the assignment view WITHOUT closing it
            await refreshAssignmentView(projectId, projectCode);
        });
    }
    
    // Open create task modal with current project
    createTaskModalInstance.open(currentProjectId, currentProjectCode);
}

/**
 * Get skill abbreviation for display
 */
function getSkillAbbreviation(skillName) {
    const abbreviations = {
        'Project Management': 'PM',
        'Conceptualización': 'Concep',
        'Análisis': 'Ana',
        'Diseño': 'Dis',
        'Construcción': 'Cons',
        'QA': 'QA',
        'Despliegue': 'Depl',
        'General': 'Gen'
    };
    return abbreviations[skillName] || skillName;
}

/**
 * Populate tasks table with HTML
 */
function populateTasksTable(assignments) {
    const tableBody = document.getElementById('tasks-table-body');
    
    if (!tableBody) {
        console.error('Tasks table body not found');
        return;
    }
    
    // Clear existing rows
    tableBody.innerHTML = '';
    
    if (assignments.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #718096; font-style: italic;">No hay tareas en este proyecto</td></tr>';
        return;
    }
    
    // Group assignments by task-resource pair and sum hours
    const groupedMap = new Map();
    
    assignments.forEach(assignment => {
        // Create a unique key for grouping: title + resourceId (or 'pending' if no resource)
        const key = `${assignment.title}|${assignment.resourceId || 'pending'}`;
        
        if (!groupedMap.has(key)) {
            groupedMap.set(key, {
                id: assignment.id,
                allIds: [],
                title: assignment.title || '',
                description: assignment.description || '',
                skillName: assignment.skillName || '-',
                hours: 0,
                resourceId: assignment.resourceId || null,
                resourceName: assignment.resourceId ? getResourceName(assignment.resourceId) : '-',
                isPending: !assignment.resourceId
            });
        }
        
        const group = groupedMap.get(key);
        group.allIds.push(assignment.id);
        group.hours += parseFloat(assignment.hours) || 0;
    });
    
    // Convert map to array
    const groupedTasks = Array.from(groupedMap.values());
    
    // Populate table rows
    groupedTasks.forEach(task => {
        const row = document.createElement('tr');
        
        // Apply white background and ensure visibility (override any CSS that might hide rows)
        row.style.backgroundColor = '#ffffff';
        row.style.setProperty('background-color', '#ffffff', 'important');
        row.style.opacity = '1';
        row.style.setProperty('opacity', '1', 'important');
        row.style.height = 'auto';
        row.style.minHeight = '40px';
        row.style.setProperty('height', 'auto', 'important');
        row.style.setProperty('min-height', '40px', 'important');
        
        // Get skill abbreviation for display
        const skillAbbr = getSkillAbbreviation(task.skillName);
        
        row.innerHTML = `
            <td style="text-align: left; background-color: #ffffff !important; padding: 12px !important; height: auto !important; min-height: 40px !important;"><strong>${task.id}</strong></td>
            <td style="text-align: left; background-color: #ffffff !important; padding: 12px !important; height: auto !important; min-height: 40px !important;">${task.title}</td>
            <td style="text-align: left; background-color: #ffffff !important; padding: 12px !important; height: auto !important; min-height: 40px !important;">${task.description}</td>
            <td style="text-align: left; background-color: #ffffff !important; padding: 12px !important; height: auto !important; min-height: 40px !important;" title="${task.skillName}">${skillAbbr}</td>
            <td style="text-align: center; background-color: #ffffff !important; padding: 12px !important; height: auto !important; min-height: 40px !important;"><strong>${task.hours.toFixed(1)}</strong></td>
            <td style="text-align: center;">
                <span class="action-icon" data-action="edit" data-task-ids="${task.allIds.join(',')}" title="Editar">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 16px; height: 16px;">
                        <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                    </svg>
                </span>
                <span class="action-icon" data-action="delete" data-task-ids="${task.allIds.join(',')}" title="Eliminar">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 16px; height: 16px;">
                        <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                </span>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // Add event listeners to action icons
    document.querySelectorAll('.action-icon').forEach(icon => {
        icon.addEventListener('click', function() {
            const action = this.getAttribute('data-action');
            // Keep IDs as strings (UUIDs), don't convert to integers
            const taskIds = this.getAttribute('data-task-ids').split(',');
            
            if (action === 'edit') {
                editTask(taskIds);
            } else if (action === 'delete') {
                deleteTaskFromTable(taskIds);
            }
        });
    });
}

/**
 * OLD Handsontable function - kept for reference but not used
 */
function initializeUnifiedTable_OLD(assignments) {
    const container = document.getElementById('tasks-table-container');
    
    if (assignments.length === 0) {
        container.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #718096; font-style: italic;">No hay tareas en este proyecto</div>';
        return;
    }
    
    // Month names for display
    const monthNames = {
        1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
        5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
        9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre'
    };
    
    // Group assignments by task-resource pair and sum hours
    const groupedMap = new Map();
    
    assignments.forEach(assignment => {
        // Create a unique key for grouping: title + resourceId (or 'pending' if no resource)
        const key = `${assignment.title}|${assignment.resourceId || 'pending'}`;
        
        if (!groupedMap.has(key)) {
            // First time seeing this task-resource pair
            groupedMap.set(key, {
                id: assignment.id, // Keep first assignment ID
                allIds: [], // Track ALL assignment IDs in this group
                title: assignment.title || '',
                description: assignment.description || '',
                month: monthNames[assignment.month] || assignment.month, // Display name
                monthNumber: assignment.month, // Store original number for updates
                year: assignment.year,
                hours: 0, // Will accumulate
                skillName: assignment.skillName || '',
                resourceId: assignment.resourceId || null,
                resourceName: assignment.resourceId ? getResourceName(assignment.resourceId) : '',
                isPending: !assignment.resourceId,
                isGrouped: false // Will be set to true if more than one assignment
            });
        }
        
        // Add this assignment ID to the group
        const group = groupedMap.get(key);
        group.allIds.push(assignment.id);
        
        // Accumulate hours for this group
        group.hours += parseFloat(assignment.hours) || 0;
        
        // Mark as grouped if we have more than one assignment
        if (group.allIds.length > 1) {
            group.isGrouped = true;
        }
    });
    
    // Convert map to array for Handsontable and initialize checkbox field
    const data = Array.from(groupedMap.values()).map(item => ({
        ...item,
        selected: false  // Initialize checkbox field
    }));
    
    // Prepare resource options for dropdown (only names for cleaner display)
    const resourceOptions = resourcesList.length > 0 
        ? resourcesList.map(r => r.name)
        : [];
    
    // Determine resource column type (read-only)
    const resourceColumnConfig = {
        data: 'resourceName',
        type: 'text',
        readOnly: true,
        width: 280
    };
    
    hotInstance = new Handsontable(container, {
        data: data,
        colHeaders: [
            '☑', 'Título', 'Descripción', 'Mes', 'Año', 'Horas', 
            'Recurso Asignado'
        ],
        columns: [
            {
                data: 'selected',
                type: 'checkbox',
                width: 50,
                className: 'htCenter'
            },
            {
                data: 'title',
                type: 'text',
                readOnly: true,
                width: 220
            },
            {
                data: 'description',
                type: 'text',
                readOnly: true,
                width: 280
            },
            {
                data: 'month',
                type: 'text',
                readOnly: true,
                width: 100,
                className: 'htCenter'
            },
            {
                data: 'year',
                type: 'numeric',
                readOnly: true,
                width: 80,
                className: 'htCenter'
            },
            {
                data: 'hours',
                type: 'numeric',
                readOnly: true,
                numericFormat: {
                    pattern: '0.00'
                },
                width: 80,
                className: 'htRight'
            },
            resourceColumnConfig  // Resource column is editable
        ],
        rowHeaders: true,
        width: '100%',
        height: 550,
        licenseKey: 'non-commercial-and-evaluation',
        stretchH: 'all',
        autoWrapRow: true,
        autoWrapCol: true,
        manualRowResize: true,
        manualColumnResize: true,
        contextMenu: true,
        filters: true,
        dropdownMenu: true,
        // Highlight pending tasks with yellow background
        cells: function(row, col) {
            const cellProperties = {};
            const rowData = this.instance.getSourceDataAtRow(row);
            
            if (rowData && rowData.isPending) {
                cellProperties.className = 'htCenter pending-task';
                cellProperties.renderer = function(instance, td, row, col, prop, value, cellProperties) {
                    Handsontable.renderers.TextRenderer.apply(this, arguments);
                    td.style.backgroundColor = '#fff3cd';
                    td.style.fontWeight = '500';
                };
            }
            
            return cellProperties;
        },
        afterChange: function(changes, source) {
            if (source === 'edit' || source === 'CopyPaste.paste' || source === 'Autofill.fill') {
                saveChangesToDatabase(changes, hotInstance);
            }
        }
    });
}

/**
 * Get resource name by ID (returns only the name)
 */
function getResourceName(resourceId) {
    const resource = resourcesList.find(r => r.id === resourceId);
    return resource ? resource.name : 'Unknown';
}

/**
 * Extract resource ID from resource name
 */
function extractResourceId(resourceName) {
    if (!resourceName) return null;
    // Find resource by name
    const resource = resourcesList.find(r => r.name === resourceName);
    return resource ? resource.id : null;
}

/**
 * Save changes from Handsontable to database
 */
async function saveChangesToDatabase(changes, tableInstance) {
    if (!changes) return;
    
    try {
        const awsAccessKey = sessionStorage.getItem('aws_access_key');
        const userTeam = sessionStorage.getItem('user_team');
        
        if (!awsAccessKey || !userTeam) {
            showNotification('No se encontraron credenciales de autenticación', 'error');
            return;
        }
        
        // Process each change
        for (const change of changes) {
            const [row, prop, oldValue, newValue] = change;
            
            if (oldValue === newValue) continue;
            
            // Get the full row data including allIds
            const sourceData = tableInstance.getSourceDataAtRow(row);
            const allIds = sourceData.allIds || [sourceData.id];
            
            // Prepare update payload based on changed field
            let updatePayload = {};
            
            switch (prop) {
                case 'title':
                    updatePayload.title = newValue;
                    break;
                case 'description':
                    updatePayload.description = newValue;
                    break;
                case 'hours':
                    // Note: hours are aggregated, so we can't update individual records
                    showNotification('Las horas son un total agregado. Usa el modal de Gestión de Tareas para editar horas individuales.', 'warning');
                    return;
                case 'skillName':
                    updatePayload.skillName = newValue;
                    break;
                case 'resourceName':
                    const resourceId = extractResourceId(newValue);
                    updatePayload.resourceId = resourceId;
                    
                    // CRITICAL: Preserve month and year from source data
                    // When updating only resourceId, we must keep month/year intact
                    if (sourceData.monthNumber) {
                        updatePayload.month = sourceData.monthNumber;  // Use numeric value
                    }
                    if (sourceData.year) {
                        updatePayload.year = sourceData.year;
                    }
                    
                    // Update the resourceId column (hidden data)
                    tableInstance.setDataAtRowProp(row, 'resourceId', resourceId);
                    // Update isPending flag
                    tableInstance.setDataAtRowProp(row, 'isPending', !resourceId);
                    break;
            }
            
            // Send update to ALL assignments in this group
            if (Object.keys(updatePayload).length > 0) {
                let successCount = 0;
                let errorCount = 0;
                
                for (const assignmentId of allIds) {
                    try {
                        const response = await fetch(`${API_CONFIG.BASE_URL}/assignments/${assignmentId}`, {
                            method: 'PUT',
                            headers: {
                                'Authorization': awsAccessKey,
                                'x-user-team': userTeam,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(updatePayload)
                        });
                        
                        if (!response.ok) {
                            errorCount++;
                            console.error(`Error updating assignment ${assignmentId}`);
                        } else {
                            successCount++;
                        }
                    } catch (err) {
                        errorCount++;
                        console.error(`Error updating assignment ${assignmentId}:`, err);
                    }
                }
                
                console.log(`Updated ${successCount} assignments (${errorCount} errors)`);
                
                if (errorCount > 0) {
                    showNotification(`Actualizado parcialmente: ${successCount} OK, ${errorCount} con error`, 'warning');
                }
            }
        }
        
        // Refresh the table to update display and styling
        tableInstance.render();
        
        showNotification('Cambios guardados correctamente', 'success');
        
    } catch (error) {
        console.error('Error saving changes:', error);
        showNotification('Error al guardar los cambios', 'error');
    }
}

/**
 * Edit a task - Opens the create task modal in edit mode
 */
function editTask(taskIds) {
    console.log('Edit task:', taskIds);
    
    // Initialize create task modal if not already done
    if (!createTaskModalInstance) {
        createTaskModalInstance = new CreateTaskModal();
        createTaskModalInstance.init();
        
        // Set callback to refresh view when task is updated
        createTaskModalInstance.setOnTaskCreatedCallback(async () => {
            console.log('Task updated, refreshing assignment view...');
            // Save current project info
            const projectId = currentProjectId;
            const projectCode = currentProjectCode;
            // Refresh the assignment view WITHOUT closing it
            await refreshAssignmentView(projectId, projectCode);
        });
    }
    
    // Find ALL assignments that match the taskIds
    const taskAssignments = allAssignments.filter(a => taskIds.includes(a.id));
    
    if (taskAssignments.length === 0) {
        showNotification('No se encontró la tarea para editar', 'error');
        return;
    }
    
    // Use the first assignment as base, but calculate total hours from all assignments
    const firstAssignment = taskAssignments[0];
    const totalHours = taskAssignments.reduce((sum, a) => sum + (parseFloat(a.hours) || 0), 0);
    
    // Create aggregated task data
    const taskData = {
        ...firstAssignment,
        hours: totalHours  // Use the sum of all hours
    };
    
    console.log('Editing task with aggregated data:', taskData);
    console.log('Total hours from', taskAssignments.length, 'assignments:', totalHours);
    
    // Open create task modal in edit mode with aggregated task data
    createTaskModalInstance.openForEdit(currentProjectId, currentProjectCode, taskData, taskIds);
}

/**
 * Delete a task from table (called by action icon)
 */
async function deleteTaskFromTable(taskIds) {
    await deleteTask(taskIds, null);
}

/**
 * Delete a task (all concept tasks in the group)
 */
async function deleteTask(taskIds, tableInstance) {
    // Confirm deletion
    const confirmed = confirm(
        `¿Estás seguro de que deseas eliminar esta tarea?\n\n` +
        `Se eliminarán ${taskIds.length} tarea(s).\n` +
        `Esta acción no se puede deshacer.`
    );
    
    if (!confirmed) return;
    
    try {
        const awsAccessKey = sessionStorage.getItem('aws_access_key');
        const userTeam = sessionStorage.getItem('user_team');
        
        if (!awsAccessKey || !userTeam) {
            showNotification('No se encontraron credenciales de autenticación', 'error');
            return;
        }
        
        let successCount = 0;
        let errorCount = 0;
        
        // Delete all concept tasks in this group
        for (const taskId of taskIds) {
            try {
                const response = await fetch(`${API_CONFIG.BASE_URL}/concept-tasks/${taskId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': awsAccessKey,
                        'x-user-team': userTeam
                    }
                });
                
                if (!response.ok) {
                    errorCount++;
                    console.error(`Error deleting concept task ${taskId}`);
                } else {
                    successCount++;
                }
            } catch (err) {
                errorCount++;
                console.error(`Error deleting concept task ${taskId}:`, err);
            }
        }
        
        console.log(`Deleted ${successCount} concept tasks (${errorCount} errors)`);
        
        if (successCount > 0) {
            showNotification('Tarea eliminada correctamente', 'success');
            // Refresh the assignment view WITHOUT closing it
            const projectId = currentProjectId;
            const projectCode = currentProjectCode;
            await refreshAssignmentView(projectId, projectCode);
        } else {
            showNotification('No se pudo eliminar la tarea', 'error');
        }
        
    } catch (error) {
        console.error('Error deleting task:', error);
        showNotification('Error al eliminar la tarea', 'error');
    }
}

/**
 * Refresh assignment view - reload data without closing the modal
 */
async function refreshAssignmentView(projectId, projectCode) {
    try {
        const awsAccessKey = sessionStorage.getItem('aws_access_key');
        const userTeam = sessionStorage.getItem('user_team');
        
        if (!awsAccessKey || !userTeam) {
            showNotification('No se encontraron credenciales de autenticación', 'error');
            return;
        }
        
        // Reload tasks/assignments for this project
        allAssignments = await loadProjectTasks(projectId, awsAccessKey, userTeam);
        
        // Repopulate the tasks table with updated data
        populateTasksTable(allAssignments);
        
        // Update statistics
        const totalHours = allAssignments.reduce((sum, a) => sum + (parseFloat(a.hours) || 0), 0);
        const totalTasks = allAssignments.length;
        
        // Update statistics in the modal
        const statsContainer = document.querySelector('#assignmentModal .modal-body > div:first-child');
        if (statsContainer) {
            statsContainer.innerHTML = `
                <div style="flex: 1; text-align: center;">
                    <div style="font-size: 2rem; font-weight: bold; color: #2c3e50;">${totalTasks}</div>
                    <div style="font-size: 0.875rem; color: #718096;">Total Tareas</div>
                </div>
                <div style="flex: 1; text-align: center;">
                    <div style="font-size: 2rem; font-weight: bold; color: #3498db;">${totalHours.toFixed(1)}</div>
                    <div style="font-size: 0.875rem; color: #718096;">Horas Totales</div>
                </div>
            `;
        }
        
        console.log('Assignment view refreshed successfully');
        
    } catch (error) {
        console.error('Error refreshing assignment view:', error);
        showNotification('Error al actualizar la vista', 'error');
    }
}

/**
 * Close assignment view
 */
export function closeAssignmentView() {
    const modal = document.getElementById('assignmentModal');
    if (modal) {
        // Destroy Handsontable instance
        if (hotInstance) {
            hotInstance.destroy();
            hotInstance = null;
        }
        
        modal.remove();
    }
    
    // Restore body scroll
    document.body.style.overflow = '';
    
    currentProjectCode = null;
    currentProjectId = null;
    allAssignments = [];
    resourcesList = [];
    domainsList = [];
    
    // Reload projects without full page reload
    if (window.loadProjectsFromAPI) {
        window.loadProjectsFromAPI();
    }
}

// Make functions globally available
window.openAssignmentView = openAssignmentView;
window.closeAssignmentView = closeAssignmentView;
