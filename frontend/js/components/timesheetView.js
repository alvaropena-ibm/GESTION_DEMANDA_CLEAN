/**
 * Timesheet View Component
 * Vista de imputación de horas en formato grid/calendario usando AG Grid
 */

import { API_CONFIG } from '../config/data.js';
import { showNotification } from '../utils/helpers.js';

// AG Grid instance
let gridApi = null;
let gridColumnApi = null;

// Save state
let isSaving = false;

// Current data
let currentWeekStart = null;
let currentResourceId = null;
let allProjects = [];
let allResources = [];
let timeEntries = [];
let tasksCache = {}; // Cache for tasks by project

// Módulos disponibles por equipo
const MODULES_BY_TEAM = {
    'TEAM_DIGITAL': ['Frontend', 'Backend', 'Integraciones', 'Base de Datos', 'DevOps', 'Testing', 'Documentación'],
    'TEAM_ANALYTICS': ['ETL', 'Reporting', 'Data Modeling', 'BI', 'Data Quality', 'Documentación'],
    'TEAM_INFRA': ['Infraestructura', 'Redes', 'Seguridad', 'Monitorización', 'Backup', 'Documentación']
};

/**
 * Initialize timesheet view
 */
export async function initTimesheetView() {
    console.log('Initializing timesheet view with AG Grid...');
    
    // Set current week to this week
    currentWeekStart = getMonday(new Date());
    
    // Get current user's resource ID
    const userEmail = sessionStorage.getItem('user_email');
    currentResourceId = await getResourceIdByEmail(userEmail);
    
    // Load initial data
    await loadProjects();
    await loadResources();
    
    // Populate week selector
    populateWeekSelector();
    
    // Populate resource selector (if user has permissions)
    populateResourceSelector();
    
    // Load time entries for current week
    await loadTimeEntries();
    
    // Initialize AG Grid
    await initializeAGGrid();
    
    // Attach event listeners
    attachEventListeners();
    
    console.log('Timesheet view initialized with AG Grid');
}

/**
 * Get Monday of a given date
 */
function getMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

/**
 * Get resource ID by email
 */
async function getResourceIdByEmail(email) {
    try {
        const authType = sessionStorage.getItem('auth_type');
        let awsAccessKey;
        
        if (authType === 'cognito') {
            awsAccessKey = sessionStorage.getItem('cognito_access_token');
        } else {
            awsAccessKey = sessionStorage.getItem('aws_access_key');
        }
        
        const userTeam = sessionStorage.getItem('user_team');
        const authHeader = authType === 'cognito' ? `Bearer ${awsAccessKey}` : awsAccessKey;
        
        const response = await fetch(`${API_CONFIG.BASE_URL}/resources`, {
            headers: {
                'Authorization': authHeader,
                'x-user-team': userTeam
            }
        });
        
        if (!response.ok) return null;
        
        const data = await response.json();
        const resources = data.data?.resources || data.resources || [];
        const resource = resources.find(r => r.email === email);
        
        return resource ? resource.id : null;
    } catch (error) {
        console.error('Error getting resource ID:', error);
        return null;
    }
}

/**
 * Load projects from API
 */
async function loadProjects() {
    try {
        const authType = sessionStorage.getItem('auth_type');
        let awsAccessKey;
        
        if (authType === 'cognito') {
            awsAccessKey = sessionStorage.getItem('cognito_access_token');
        } else {
            awsAccessKey = sessionStorage.getItem('aws_access_key');
        }
        
        const userTeam = sessionStorage.getItem('user_team');
        const authHeader = authType === 'cognito' ? `Bearer ${awsAccessKey}` : awsAccessKey;
        
        const response = await fetch(`${API_CONFIG.BASE_URL}/jira-tasks`, {
            headers: {
                'Authorization': authHeader,
                'x-user-team': userTeam
            }
        });
        
        if (!response.ok) throw new Error('Error loading projects');
        
        const data = await response.json();
        allProjects = data.data?.tasks || data.tasks || [];
        
        console.log(`Loaded ${allProjects.length} projects`);
    } catch (error) {
        console.error('Error loading projects:', error);
        allProjects = [];
    }
}

/**
 * Load resources from API
 */
async function loadResources() {
    try {
        const authType = sessionStorage.getItem('auth_type');
        let awsAccessKey;
        
        if (authType === 'cognito') {
            awsAccessKey = sessionStorage.getItem('cognito_access_token');
        } else {
            awsAccessKey = sessionStorage.getItem('aws_access_key');
        }
        
        const userTeam = sessionStorage.getItem('user_team');
        const authHeader = authType === 'cognito' ? `Bearer ${awsAccessKey}` : awsAccessKey;
        
        const response = await fetch(`${API_CONFIG.BASE_URL}/resources`, {
            headers: {
                'Authorization': authHeader,
                'x-user-team': userTeam
            }
        });
        
        if (!response.ok) throw new Error('Error loading resources');
        
        const data = await response.json();
        allResources = data.data?.resources || data.resources || [];
        
        console.log(`Loaded ${allResources.length} resources`);
    } catch (error) {
        console.error('Error loading resources:', error);
        allResources = [];
    }
}

/**
 * Load time entries for current week and resource
 */
async function loadTimeEntries() {
    try {
        const authType = sessionStorage.getItem('auth_type');
        let awsAccessKey;
        
        if (authType === 'cognito') {
            awsAccessKey = sessionStorage.getItem('cognito_access_token');
        } else {
            awsAccessKey = sessionStorage.getItem('aws_access_key');
        }
        
        const userTeam = sessionStorage.getItem('user_team');
        const authHeader = authType === 'cognito' ? `Bearer ${awsAccessKey}` : awsAccessKey;
        
        // Calculate week end date
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        // Format dates as YYYY-MM-DD
        const startDate = currentWeekStart.toISOString().split('T')[0];
        const endDate = weekEnd.toISOString().split('T')[0];
        
        // Don't filter by resourceId - show all entries for the team
        const url = `${API_CONFIG.BASE_URL}/time-entries?startDate=${startDate}&endDate=${endDate}`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': authHeader,
                'x-user-team': userTeam
            }
        });
        
        if (!response.ok) throw new Error('Error loading time entries');
        
        const data = await response.json();
        timeEntries = data.data?.timeEntries || data.timeEntries || [];
        
        console.log(`Loaded ${timeEntries.length} time entries`);
    } catch (error) {
        console.error('Error loading time entries:', error);
        timeEntries = [];
    }
}

/**
 * Populate week selector with last 4 weeks and next 4 weeks
 */
function populateWeekSelector() {
    const selector = document.getElementById('timesheet-week-selector');
    if (!selector) return;
    
    selector.innerHTML = '';
    
    const today = new Date();
    const currentMonday = getMonday(today);
    
    // Generate 4 weeks before and 4 weeks after
    for (let i = -4; i <= 4; i++) {
        const weekStart = new Date(currentMonday);
        weekStart.setDate(weekStart.getDate() + (i * 7));
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        const option = document.createElement('option');
        option.value = weekStart.toISOString().split('T')[0];
        option.textContent = `${formatDate(weekStart)} - ${formatDate(weekEnd)}`;
        
        if (i === 0) {
            option.selected = true;
        }
        
        selector.appendChild(option);
    }
}

/**
 * Populate resource selector
 */
function populateResourceSelector() {
    const selector = document.getElementById('timesheet-resource-selector');
    if (!selector) return;
    
    // Only populate if user has admin permissions
    // For now, just show current user
    selector.innerHTML = '<option value="">Mi usuario</option>';
}

/**
 * Format date as DD/MM/YYYY
 */
function formatDate(date) {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

/**
 * Get day name
 */
function getDayName(index) {
    const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    return days[index];
}

/**
 * Get modules for current team
 */
function getModulesForTeam() {
    const userTeam = sessionStorage.getItem('user_team');
    return MODULES_BY_TEAM[userTeam] || ['Frontend', 'Backend', 'Integraciones', 'Testing', 'Documentación'];
}

/**
 * Load tasks for a specific project from concept_tasks
 */
async function loadTasksForProject(projectCode) {
    try {
        const authType = sessionStorage.getItem('auth_type');
        let awsAccessKey;
        
        if (authType === 'cognito') {
            awsAccessKey = sessionStorage.getItem('cognito_access_token');
        } else {
            awsAccessKey = sessionStorage.getItem('aws_access_key');
        }
        
        const userTeam = sessionStorage.getItem('user_team');
        const authHeader = authType === 'cognito' ? `Bearer ${awsAccessKey}` : awsAccessKey;
        
        // Find the project by code to get its jira_task_id (UUID)
        const project = allProjects.find(p => p.code === projectCode);
        if (!project) {
            console.warn(`Project not found: ${projectCode}`);
            return ['Proyecto']; // Default task
        }
        
        console.log(`Found project:`, project);
        console.log(`Using jiraTaskId: ${project.id}`);
        
        // Load tasks from concept_tasks table using jiraTaskId
        const response = await fetch(`${API_CONFIG.BASE_URL}/concept-tasks?jiraTaskId=${project.id}`, {
            headers: {
                'Authorization': authHeader,
                'x-user-team': userTeam
            }
        });
        
        if (!response.ok) {
            console.warn('Error loading tasks for project:', projectCode, response.status);
            return ['Proyecto']; // Default task
        }
        
        const data = await response.json();
        console.log('API Response for concept-tasks:', data);
        
        const tasks = data.data?.tasks || data.tasks || [];
        console.log(`Found ${tasks.length} tasks for ${projectCode}:`, tasks);
        
        // Extract unique task titles
        const taskTitles = tasks.map(t => t.title).filter(t => t && t.trim() !== '');
        const uniqueTasks = [...new Set(taskTitles)];
        
        console.log(`Unique task titles:`, uniqueTasks);
        
        // Always include "Proyecto" as first option
        const result = ['Proyecto', ...uniqueTasks];
        console.log(`Returning tasks:`, result);
        
        return result;
        
    } catch (error) {
        console.error('Error loading tasks for project:', error);
        return ['Proyecto']; // Default task
    }
}

/**
 * Generate date columns: -30 days to +120 days from today
 */
function generateDateColumns() {
    const dateColumns = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Start 30 days before today
    const start = new Date(today);
    start.setDate(start.getDate() - 30);
    
    // End 120 days after today
    const end = new Date(today);
    end.setDate(end.getDate() + 120);
    
    let currentDate = new Date(start);
    
    while (currentDate <= end) {
        // Use local date string to avoid timezone conversion issues
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`; // YYYY-MM-DD in local timezone
        const dateHeader = `${currentDate.getDate()}/${currentDate.getMonth() + 1}`;
        
        // Determine if it's weekend or today
        const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
        const isToday = currentDate.toDateString() === today.toDateString();
        
        dateColumns.push({
            headerName: dateHeader,
            field: dateStr,
            editable: true,
            width: 70,
            minWidth: 70,
            filter: false,
            sortable: false,
            suppressMenu: true,
            cellEditor: 'agNumberCellEditor',
            cellEditorParams: {
                min: 0,
                max: 24,
                precision: 1
            },
            valueFormatter: params => params.value ? `${params.value}h` : '',
            cellStyle: params => {
                const style = { 
                    textAlign: 'center',
                    fontWeight: params.value ? '600' : 'normal',
                    fontSize: '0.85em'
                };
                
                // Highlight today's column
                if (isToday) {
                    style.backgroundColor = '#fef3c7';
                    style.borderLeft = '2px solid #f59e0b';
                    style.borderRight = '2px solid #f59e0b';
                }
                // Highlight weekends
                else if (isWeekend) {
                    style.background = 'rgba(200, 200, 200, 0.1)';
                }
                // Highlight cells with values
                else if (params.value) {
                    style.background = 'rgba(49, 151, 149, 0.1)';
                    style.color = '#00695c';
                }
                
                return style;
            },
            headerClass: isToday ? 'today-header' : (isWeekend ? 'weekend-header' : '')
        });
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    console.log('Generated date columns:', dateColumns.length);
    return dateColumns;
}

/**
 * Initialize AG Grid
 */
async function initializeAGGrid() {
    // Destroy existing grid instance if it exists
    if (gridApi) {
        console.log('Destroying existing grid instance...');
        gridApi.destroy();
        gridApi = null;
        gridColumnApi = null;
    }
    
    // Load AG Grid library if not loaded
    if (!window.agGrid) {
        await window.loadAGGrid();
    }
    
    const container = document.getElementById('timesheet-grid-container');
    if (!container) return;
    
    // Clear container to ensure clean slate
    container.innerHTML = '';
    
    // Prepare data structure
    const rowData = prepareGridData();
    
    // Generate date columns (-30 to +120 days)
    const dateColumns = generateDateColumns();
    
    // Define columns
    const columnDefs = [
        {
            headerName: 'ID Trabajo',
            field: 'projectId',
            width: 150,
            editable: true,
            cellEditor: 'agSelectCellEditor',
            cellEditorParams: {
                values: allProjects.map(p => p.code)
            },
            pinned: 'left'
        },
        {
            headerName: 'Tarea',
            field: 'taskTitle',
            width: 200,
            editable: true,
            pinned: 'left',
            cellEditorSelector: params => {
                // If projectId is set and we have tasks cached, use select editor
                const projectId = params.data.projectId;
                if (projectId && projectId.trim() !== '' && tasksCache[projectId]) {
                    return {
                        component: 'agSelectCellEditor',
                        params: {
                            values: tasksCache[projectId]
                        }
                    };
                }
                // Otherwise, use text editor
                return {
                    component: 'agTextCellEditor'
                };
            }
        },
        {
            headerName: 'Descripción',
            field: 'taskDescription',
            width: 250,
            editable: true,
            pinned: 'left'
        },
        {
            headerName: 'Actividad',
            field: 'activity',
            width: 150,
            editable: true,
            cellEditor: 'agSelectCellEditor',
            cellEditorParams: {
                values: ['Análisis', 'Diseño', 'Desarrollo', 'Testing', 'Documentación', 'Reuniones', 'Code Review', 'Despliegue', 'Soporte', 'Formación', 'Otros']
            },
            pinned: 'left'
        },
        {
            headerName: 'Módulo',
            field: 'module',
            width: 150,
            editable: true,
            cellEditor: 'agSelectCellEditor',
            cellEditorParams: {
                values: getModulesForTeam()
            },
            pinned: 'left'
        },
        // Add Total column
        {
            headerName: 'Total',
            field: 'total',
            width: 100,
            minWidth: 70,
            pinned: 'left',
            editable: false,
            filter: false,
            sortable: false,
            suppressMenu: true,
            cellStyle: {
                backgroundColor: '#e5e7eb', 
                fontWeight: 'bold',
                textAlign: 'center',
                borderLeft: '2px solid #6b7280',
                fontSize: '0.9em'
            },
            valueGetter: (params) => {
                // Sum all date columns
                let total = 0;
                Object.keys(params.data).forEach(key => {
                    if (key.match(/^\d{4}-\d{2}-\d{2}$/) && params.data[key]) {
                        total += parseFloat(params.data[key]) || 0;
                    }
                });
                return total > 0 ? `${total.toFixed(1)}h` : '';
            }
        },
        // Add all date columns
        ...dateColumns
    ];
    
    // Grid options
    const gridOptions = {
        columnDefs: columnDefs,
        rowData: rowData,
        defaultColDef: {
            sortable: true,
            filter: true,
            resizable: true
        },
        singleClickEdit: false,
        stopEditingWhenCellsLoseFocus: true,
        enableRangeSelection: true,
        enableFillHandle: true,
        fillHandleDirection: 'y',
        onCellValueChanged: async (event) => {
            console.log('Cell value changed:', event);
            
            // If projectId changed, load tasks for that project
            if (event.colDef.field === 'projectId' && event.newValue && event.newValue.trim() !== '') {
                const projectCode = event.newValue;
                console.log(`Loading tasks for project: ${projectCode}`);
                
                // Load tasks and cache them
                const tasks = await loadTasksForProject(projectCode);
                tasksCache[projectCode] = tasks;
                
                console.log(`Cached ${tasks.length} tasks for ${projectCode}:`, tasks);
            }
            
            updateTotals();
        },
        onGridReady: (params) => {
            gridApi = params.api;
            gridColumnApi = params.columnApi;
            
            // Scroll to today's column
            setTimeout(() => {
                const todayDateStr = new Date().toISOString().split('T')[0];
                params.api.ensureColumnVisible(todayDateStr);
                console.log('Scrolled to today:', todayDateStr);
            }, 200);
            
            // Update totals initially
            updateTotals();
        }
    };
    
    // Create the grid
    new agGrid.Grid(container, gridOptions);
}

/**
 * Prepare grid data from time entries
 */
function prepareGridData() {
    // Group time entries by project + task + activity + module
    const grouped = {};
    
    timeEntries.forEach(entry => {
        const key = `${entry.projectId}_${entry.taskTitle}_${entry.activity}_${entry.module || 'none'}`;
        
        if (!grouped[key]) {
            grouped[key] = {
                projectId: entry.projectCode || entry.projectId,
                taskTitle: entry.taskTitle,
                taskDescription: entry.taskDescription || '',
                activity: entry.activity,
                module: entry.module || ''
            };
        }
        
        // Add hours to corresponding date (YYYY-MM-DD format)
        if (entry.date) {
            const dateStr = entry.date.toString().split('T')[0]; // Get YYYY-MM-DD part
            grouped[key][dateStr] = (grouped[key][dateStr] || 0) + parseFloat(entry.hours || 0);
        }
    });
    
    // Convert to array
    const data = Object.values(grouped);
    
    // Add empty rows if no data
    if (data.length === 0) {
        data.push({
            projectId: '',
            taskTitle: '',
            taskDescription: '',
            activity: '',
            module: ''
        });
    }
    
    return data;
}

/**
 * Update totals for each day and week
 */
function updateTotals() {
    if (!gridApi) return;
    
    // Calculate totals for the current week (7 days from currentWeekStart)
    const weekTotals = [0, 0, 0, 0, 0, 0, 0];
    
    gridApi.forEachNode(node => {
        for (let i = 0; i < 7; i++) {
            const date = new Date(currentWeekStart);
            date.setDate(date.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];
            weekTotals[i] += parseFloat(node.data[dateStr]) || 0;
        }
    });
    
    // Update UI for each day of the week
    const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    days.forEach((day, index) => {
        const element = document.getElementById(`timesheet-total-${day}`);
        if (element) {
            element.textContent = `${weekTotals[index].toFixed(1)}h`;
        }
    });
    
    // Update week total
    const weekTotal = weekTotals.reduce((sum, val) => sum + val, 0);
    const weekElement = document.getElementById('timesheet-total-week');
    if (weekElement) {
        weekElement.textContent = `${weekTotal.toFixed(1)}h`;
    }
}

/**
 * Add a new empty row to the grid
 */
function addTimesheetRow() {
    if (!gridApi) return;
    
    const newRow = {
        projectId: '',
        taskTitle: '',
        taskDescription: '',
        activity: '',
        module: ''
    };
    
    gridApi.applyTransaction({ add: [newRow] });
}

/**
 * Attach event listeners
 */
function attachEventListeners() {
    // Week selector change
    const weekSelector = document.getElementById('timesheet-week-selector');
    if (weekSelector) {
        weekSelector.addEventListener('change', async (e) => {
            currentWeekStart = new Date(e.target.value);
            await loadTimeEntries();
            await initializeAGGrid();
        });
    }
    
    // Resource selector change
    const resourceSelector = document.getElementById('timesheet-resource-selector');
    if (resourceSelector) {
        resourceSelector.addEventListener('change', async (e) => {
            currentResourceId = e.target.value || null;
            await loadTimeEntries();
            await initializeAGGrid();
        });
    }
    
    // Project search
    const projectSearch = document.getElementById('timesheet-project-search');
    if (projectSearch) {
        projectSearch.addEventListener('input', (e) => {
            filterGrid(e.target.value);
        });
    }
    
    // Add row button
    const addRowBtn = document.getElementById('timesheet-add-row-btn');
    if (addRowBtn) {
        addRowBtn.addEventListener('click', () => {
            addTimesheetRow();
        });
    }
    
    // Save button
    const saveBtn = document.getElementById('timesheet-save-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            await saveTimesheet();
        });
    }
}

/**
 * Filter grid by project search
 */
function filterGrid(searchText) {
    if (!gridApi) return;
    
    gridApi.setQuickFilter(searchText);
}

/**
 * Save timesheet data
 */
async function saveTimesheet() {
    if (!gridApi) return;
    
    // Prevent multiple simultaneous saves
    if (isSaving) {
        console.log('Save already in progress, ignoring request');
        showNotification('Ya hay un guardado en progreso...', 'info');
        return;
    }
    
    isSaving = true;
    
    try {
        const authType = sessionStorage.getItem('auth_type');
        let awsAccessKey;
        
        if (authType === 'cognito') {
            awsAccessKey = sessionStorage.getItem('cognito_access_token');
        } else {
            awsAccessKey = sessionStorage.getItem('aws_access_key');
        }
        
        const userTeam = sessionStorage.getItem('user_team');
        const authHeader = authType === 'cognito' ? `Bearer ${awsAccessKey}` : awsAccessKey;
        
        // Prepare time entries to save
        const entriesToSave = [];
        
        console.log('Starting to prepare entries for saving...');
        
        gridApi.forEachNode(node => {
            const row = node.data;
            const projectCode = row.projectId;
            const taskTitle = row.taskTitle;
            const taskDescription = row.taskDescription || '';
            const activity = row.activity;
            const module = row.module || '';
            
            console.log('Processing row:', { projectCode, taskTitle, activity });
            
            // Skip empty rows - require at least projectId, taskTitle, and activity
            if (!projectCode || !projectCode.trim() || !taskTitle || !taskTitle.trim() || !activity || !activity.trim()) {
                console.log('Skipping row - missing required fields');
                return;
            }
            
            // Find the project to get its UUID
            const project = allProjects.find(p => p.code === projectCode);
            if (!project) {
                console.warn(`Project not found for code: ${projectCode}`);
                return;
            }
            
            const jiraTaskId = project.id; // Get UUID from jira_tasks
            console.log(`Found project: ${projectCode} with jiraTaskId: ${jiraTaskId}`);
            
            // Get resource name
            const resource = allResources.find(r => r.id === currentResourceId);
            const resourceName = resource?.name || 'Unknown';
            
            console.log(`Resource name: ${resourceName}`);
            
            // Iterate over all date columns (YYYY-MM-DD format)
            Object.keys(row).forEach(key => {
                // Check if key is a date field (YYYY-MM-DD format)
                if (key.match(/^\d{4}-\d{2}-\d{2}$/) && row[key] && parseFloat(row[key]) > 0) {
                    const hours = parseFloat(row[key]);
                    
                    const entry = {
                        jiraTaskId: jiraTaskId, // Use jira_task UUID
                        resourceName: resourceName,
                        workDate: key, // YYYY-MM-DD format
                        taskTitle: taskTitle,
                        taskDescription: taskDescription,
                        activity: activity,
                        module: module,
                        hours: hours
                    };
                    
                    console.log('Adding entry:', entry);
                    entriesToSave.push(entry);
                }
            });
        });
        
        if (entriesToSave.length === 0) {
            showNotification('No hay datos para guardar. Asegúrate de completar ID Trabajo, Tarea, Actividad y al menos un día con horas.', 'warning');
            return;
        }
        
        console.log(`Prepared ${entriesToSave.length} time entries to save`);
        console.log('Sample entry:', entriesToSave[0]);
        
        // Check for entries exceeding 8 hours per day
        const dailyTotals = {};
        entriesToSave.forEach(entry => {
            const date = entry.workDate;
            if (!dailyTotals[date]) {
                dailyTotals[date] = 0;
            }
            dailyTotals[date] += entry.hours;
        });
        
        // Find dates with more than 8 hours
        const datesExceeding8Hours = Object.entries(dailyTotals)
            .filter(([date, hours]) => hours > 8)
            .map(([date, hours]) => ({ date, hours }));
        
        // If there are dates exceeding 8 hours, show warning
        if (datesExceeding8Hours.length > 0) {
            const datesList = datesExceeding8Hours
                .map(({ date, hours }) => {
                    const [year, month, day] = date.split('-');
                    return `  • ${day}/${month}/${year}: ${hours.toFixed(1)} horas`;
                })
                .join('\n');
            
            const message = `⚠️ ADVERTENCIA: Se han detectado imputaciones que superan las 8 horas diarias:\n\n${datesList}\n\n¿Está seguro de que desea guardar estas imputaciones?`;
            
            const confirmed = confirm(message);
            
            if (!confirmed) {
                console.log('User cancelled save due to hours exceeding 8 per day');
                showNotification('Guardado cancelado. Revise las horas imputadas.', 'info');
                return;
            }
            
            console.log('User confirmed save despite hours exceeding 8 per day');
        }
        
        // Save each entry
        let successCount = 0;
        let errorCount = 0;
        const errors = [];
        
        for (const entry of entriesToSave) {
            try {
                console.log('Saving entry:', entry);
                
                const response = await fetch(`${API_CONFIG.BASE_URL}/time-entries`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': authHeader,
                        'x-user-team': userTeam
                    },
                    body: JSON.stringify(entry)
                });
                
                if (response.ok) {
                    successCount++;
                    console.log('Entry saved successfully');
                } else {
                    const errorData = await response.json();
                    console.error('Error saving entry:', errorData);
                    console.error('Full error details:', JSON.stringify(errorData, null, 2));
                    console.error('Entry that failed:', JSON.stringify(entry, null, 2));
                    errors.push({ entry, error: errorData });
                    errorCount++;
                }
            } catch (error) {
                console.error('Exception saving entry:', error);
                errors.push({ entry, error: error.message });
                errorCount++;
            }
        }
        
        console.log(`Save complete: ${successCount} success, ${errorCount} errors`);
        
        if (successCount > 0) {
            showNotification(`✓ ${successCount} imputaciones guardadas correctamente`, 'success');
            // Reload data
            await loadTimeEntries();
            await initializeAGGrid();
        }
        
        if (errorCount > 0) {
            console.error('Errors during save:', errors);
            showNotification(`✗ ${errorCount} imputaciones con error. Revisa la consola para más detalles.`, 'error');
        }
        
    } catch (error) {
        console.error('Error saving timesheet:', error);
        showNotification('Error al guardar las imputaciones: ' + error.message, 'error');
    } finally {
        // Reset saving flag
        isSaving = false;
    }
}

// Export functions
export { saveTimesheet, updateTotals };