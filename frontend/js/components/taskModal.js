/**
 * Task Modal Component with AG Grid
 * Provides Excel-like interface for managing project tasks
 */

import { API_CONFIG } from '../config/data.js';
import { showCapacityErrorModal } from './capacityErrorModal.js';

export class TaskModal {
    constructor() {
        this.gridApi = null;
        this.projectId = null;
        this.projectName = null;
        this.modalElement = null;
        this.isInitialized = false;
        this.resourcesList = [];
        this.tasksList = [];
        this.modulesList = [];
    }

    /**
     * Initialize the modal
     */
    init() {
        if (this.isInitialized) return;
        
        this.createModalHTML();
        this.attachEventListeners();
        this.isInitialized = true;
    }


    /**
     * Create modal HTML structure
     */
    createModalHTML() {
        const modalHTML = `
            <div id="task-modal" class="modal-overlay">
                <div class="modal-container">
                    <div class="modal-header">
                        <h2>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 24px; height: 24px; display: inline-block; margin-right: 8px; vertical-align: middle;">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                            </svg>
                            <span id="modal-project-title">Tareas de Alto Nivel</span>
                        </h2>
                        <button class="modal-close" id="close-task-modal" title="Cerrar">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div id="task-grid" class="ag-grid-container ag-theme-alpine"></div>
                    </div>
                    <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; border-top: 1px solid #e2e8f0;">
                        <div style="display: flex; gap: 0.75rem;">
                            <button type="button" id="cancel-task-modal" class="btn btn-secondary">Cerrar</button>
                        </div>
                        <div style="display: flex; gap: 0.75rem;">
                            <button type="button" id="add-task-row" class="btn btn-success" style="display: flex; align-items: center; gap: 0.5rem; background: #2d7a6e; border-color: #2d7a6e; color: white;">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="white" style="width: 18px; height: 18px;">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                                Añadir Fila
                            </button>
                            <button type="button" id="delete-task-row" class="btn btn-danger" style="display: flex; align-items: center; gap: 0.5rem; background: #dc2626; border-color: #dc2626; color: white;">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="white" style="width: 18px; height: 18px;">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                </svg>
                                Eliminar Seleccionadas
                            </button>
                            <button type="button" id="save-task-modal" class="btn btn-success" style="display: flex; align-items: center; gap: 0.5rem; background: #2d7a6e; border-color: #2d7a6e; color: white;">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="white" style="width: 18px; height: 18px;">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modalElement = document.getElementById('task-modal');
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Close modal
        document.getElementById('close-task-modal').addEventListener('click', () => this.close());
        document.getElementById('cancel-task-modal').addEventListener('click', () => this.close());
        
        // Close on overlay click
        this.modalElement.addEventListener('click', (e) => {
            if (e.target === this.modalElement) {
                this.close();
            }
        });

        // Add row
        document.getElementById('add-task-row').addEventListener('click', () => this.addRow());

        // Delete selected rows
        document.getElementById('delete-task-row').addEventListener('click', () => this.deleteSelectedRows());

        // Save changes
        document.getElementById('save-task-modal').addEventListener('click', () => this.save());

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modalElement.classList.contains('active')) {
                this.close();
            }
        });
    }

    /**
     * Get authentication headers - supports both Cognito and IAM
     */
    getAuthHeaders() {
        const authType = sessionStorage.getItem('auth_type');
        let awsAccessKey;
        
        if (authType === 'cognito') {
            awsAccessKey = sessionStorage.getItem('cognito_access_token');
        } else {
            awsAccessKey = sessionStorage.getItem('aws_access_key');
        }
        
        const userTeam = sessionStorage.getItem('user_team');
        
        if (!awsAccessKey || !userTeam) {
            return null;
        }
        
        const authHeader = authType === 'cognito' ? `Bearer ${awsAccessKey}` : awsAccessKey;
        
        return {
            'Authorization': authHeader,
            'x-user-team': userTeam
        };
    }

    /**
     * Load existing assignments for this project and transform to grid format
     */
    async loadProjectAssignments() {
        try {
            const headers = this.getAuthHeaders();
            
            if (!headers) {
                console.warn('No authentication tokens found');
                return [];
            }
            
            // Use jiraTaskId parameter for jira_tasks, projectId for legacy projects
            const response = await fetch(`${API_CONFIG.BASE_URL}/assignments?jiraTaskId=${this.projectId}`, {
                headers
            });
            
            if (!response.ok) {
                throw new Error('Error loading assignments');
            }
            
            const data = await response.json();
            const assignments = data.data?.assignments || data.assignments || [];
            
            console.log('Raw assignments loaded:', assignments.length);
            
            // Transform assignments to grid row format
            // Group by resource + task + team + module
            const rowsMap = new Map();
            
            assignments.forEach(assignment => {
                // Get resource name - API returns resource object directly
                // Also check resource_id (snake_case) and resourceId (camelCase)
                const resourceId = assignment.resourceId || assignment.resource_id;
                let resourceName = assignment.resource?.name; // API includes resource object
                
                // If not in assignment.resource, search in resourcesList
                if (!resourceName) {
                    const resource = this.resourcesList.find(r => r.id === resourceId);
                    resourceName = resource?.name || `Unknown (${resourceId})`;
                }
                
                // Create unique key for grouping - include module
                const key = `${resourceName}|${assignment.title}|${assignment.team || ''}|${assignment.module || ''}`;
                
                if (!rowsMap.has(key)) {
                    rowsMap.set(key, {
                        recurso: resourceName,
                        tarea: assignment.title,
                        detalleTarea: assignment.description || '',
                        equipo: assignment.team || '',
                        modulo: assignment.module || ''
                    });
                }
                
                const row = rowsMap.get(key);
                
                // Add hours to the appropriate date
                if (assignment.date) {
                    // Daily assignment - extract date directly from ISO string to avoid timezone issues
                    const dateStr = assignment.date.toString().split('T')[0]; // Get YYYY-MM-DD part
                    row[dateStr] = (row[dateStr] || 0) + parseFloat(assignment.hours || 0);
                } else if (assignment.month && assignment.year) {
                    // Legacy monthly assignment - put on first day of month
                    const date = new Date(assignment.year, assignment.month - 1, 1);
                    const dateStr = date.toISOString().split('T')[0];
                    row[dateStr] = (row[dateStr] || 0) + parseFloat(assignment.hours || 0);
                }
            });
            
            const rows = Array.from(rowsMap.values());
            console.log('Transformed to grid rows:', rows.length);
            
            return rows;
            
        } catch (error) {
            console.error('Error loading project assignments:', error);
            return [];
        }
    }

    /**
     * Load tasks from API for this project (from concept_tasks table)
     */
    async loadTasks() {
        try {
            const headers = this.getAuthHeaders();
            
            if (!headers) {
                console.warn('No authentication tokens found');
                return [];
            }
            
            // Load from concept_tasks table instead of assignments
            const response = await fetch(`${API_CONFIG.BASE_URL}/concept-tasks?projectId=${this.projectId}`, {
                headers
            });
            
            if (!response.ok) {
                throw new Error('Error loading tasks from concept_tasks');
            }
            
            const data = await response.json();
            console.log('API Response for concept tasks:', data);
            const tasks = data.data?.tasks || data.tasks || [];
            console.log('Raw concept tasks:', tasks);
            console.log('Project ID used:', this.projectId);
            
            // Extract unique task titles from concept_tasks
            const taskTitles = tasks.map(t => t.title);
            console.log('Concept task titles:', taskTitles);
            const uniqueTasks = [...new Set(taskTitles.filter(t => t && t.trim() !== ''))];
            
            console.log('Concept tasks loaded for project:', uniqueTasks.length);
            console.log('Unique concept tasks:', uniqueTasks);
            return uniqueTasks;
            
        } catch (error) {
            console.error('Error loading concept tasks:', error);
            return [];
        }
    }

    /**
     * Load resources from API
     */
    async loadResources() {
        try {
            const headers = this.getAuthHeaders();
            
            if (!headers) {
                console.warn('No authentication tokens found');
                return [];
            }
            
            const userTeam = sessionStorage.getItem('user_team');
            
            const response = await fetch(`${API_CONFIG.BASE_URL}/resources`, {
                headers
            });
            
            if (!response.ok) {
                throw new Error('Error loading resources');
            }
            
            const data = await response.json();
            let resources = data.data?.resources || data.resources || [];
            
            // Filter resources by user's team
            resources = resources.filter(r => {
                // Normalize team values for comparison
                const resourceTeam = (r.team || '').toLowerCase().trim();
                const normalizedUserTeam = userTeam.toLowerCase().trim();
                
                return resourceTeam === normalizedUserTeam;
            });
            
            console.log('Resources loaded:', resources.length, `(filtered by team: ${userTeam})`);
            return resources;
            
        } catch (error) {
            console.error('Error loading resources:', error);
            return [];
        }
    }

    /**
     * Load modules from app_config based on user team
     */
    async loadModules() {
        try {
            const headers = this.getAuthHeaders();
            
            if (!headers) {
                console.warn('No authentication tokens found');
                return [];
            }

            const userTeam = sessionStorage.getItem('user_team');
            console.log(`📦 Loading modules for team: ${userTeam}`);

            const response = await fetch(`${API_CONFIG.BASE_URL}/config?key=modules&team=${encodeURIComponent(userTeam)}`, {
                headers
            });

            if (response.ok) {
                const data = await response.json();
                console.log('📦 Config response:', data);
                
                const configValue = data.data?.value || data.value;
                
                if (configValue && Array.isArray(configValue)) {
                    console.log(`✅ Loaded ${configValue.length} modules for team ${userTeam}`);
                    return configValue;
                } else {
                    console.log(`⚠️ No modules configured for team ${userTeam}`);
                    return [];
                }
            } else if (response.status === 404) {
                console.log(`ℹ️ No module configuration found for team ${userTeam}`);
                return [];
            } else {
                console.error('Error loading config:', response.status);
                return [];
            }
        } catch (error) {
            console.error('Error loading modules:', error);
            return [];
        }
    }

    /**
     * Open modal for a specific project
     */
    async open(projectCode, projectName, existingTasks = [], startDate = null, endDate = null) {
        // Find the numeric project ID from the project code
        const project = window.allProjects?.find(p => p.code === projectCode);
        
        this.projectId = project?.id || projectCode; // Use numeric ID if available, fallback to code
        this.projectCode = projectCode;
        this.projectName = projectName;
        this.startDate = startDate;
        this.endDate = endDate;

        console.log('Opening modal for project:', { code: projectCode, id: this.projectId, name: projectName });

        // Update modal title with project code
        const dateRange = startDate && endDate ? ` (${startDate} - ${endDate})` : '';
        document.getElementById('modal-project-title').textContent = 
            `Asignación de Recursos - ${projectCode} - ${projectName}${dateRange}`;

        // Load resources, tasks, and modules before initializing grid
        this.resourcesList = await this.loadResources();
        this.tasksList = await this.loadTasks();
        this.modulesList = await this.loadModules();

        // Load existing assignments for this project
        const loadedAssignments = await this.loadProjectAssignments();
        console.log('Loaded assignments for project:', loadedAssignments.length);

        // Initialize AG Grid with loaded data
        this.initializeGrid(loadedAssignments, startDate, endDate);

        // Show modal
        this.modalElement.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    /**
     * Open modal for a specific jira_task (from Gestión de Trabajo tab)
     * @param {string} jiraTaskId - UUID of the jira_task
     * @param {string} taskCode - Code of the task (e.g., "DAR-5507")
     * @param {string} taskName - Name/title of the task
     * @param {Array} existingTasks - Existing tasks from storage
     * @param {string} startDate - Start date
     * @param {string} endDate - End date
     */
    async openForJiraTask(jiraTaskId, taskCode, taskName, existingTasks = [], startDate = null, endDate = null) {
        // For jira_tasks, use the UUID directly
        this.projectId = jiraTaskId; // This is the UUID from jira_tasks table
        this.projectCode = taskCode;
        this.projectName = taskName;
        this.startDate = startDate;
        this.endDate = endDate;

        console.log('Opening modal for jira_task:', { id: jiraTaskId, code: taskCode, name: taskName });

        // Update modal title with task code
        const dateRange = startDate && endDate ? ` (${startDate} - ${endDate})` : '';
        document.getElementById('modal-project-title').textContent = 
            `Asignación de Recursos - ${taskCode} - ${taskName}${dateRange}`;

        // Load resources, tasks, and modules before initializing grid
        this.resourcesList = await this.loadResources();
        this.tasksList = await this.loadTasks();
        this.modulesList = await this.loadModules();

        // Load existing assignments for this jira_task
        const loadedAssignments = await this.loadProjectAssignments();
        console.log('Loaded assignments for jira_task:', loadedAssignments.length);

        // Initialize AG Grid with loaded data
        this.initializeGrid(loadedAssignments, startDate, endDate);

        // Show modal
        this.modalElement.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    /**
     * Close modal
     */
    close() {
        this.modalElement.classList.remove('active');
        document.body.style.overflow = '';
        
        // Destroy grid
        if (this.gridApi) {
            this.gridApi.destroy();
            this.gridApi = null;
        }
        
        // Reload projects without full page reload
        if (window.loadProjectsFromAPI) {
            window.loadProjectsFromAPI();
        }
    }

    /**
     * Generate date columns: -30 days to +120 days from today
     */
    generateDateColumns() {
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
        console.log('First 5 columns:', dateColumns.slice(0, 5).map(c => c.headerName));
        console.log('Last 5 columns:', dateColumns.slice(-5).map(c => c.headerName));
        
        return dateColumns;
    }

    /**
     * Initialize AG Grid
     */
    async initializeGrid(tasks, startDate = null, endDate = null) {
        const gridDiv = document.getElementById('task-grid');

        // Destroy existing grid if any (prevent duplicates on double-click)
        if (this.gridApi) {
            console.log('Destroying existing grid before creating new one');
            this.gridApi.destroy();
            this.gridApi = null;
        }

        // Clear the grid container
        gridDiv.innerHTML = '';

        // Load AG Grid if not already loaded
        if (typeof agGrid === 'undefined') {
            console.log('AG Grid not loaded, loading now...');
            await window.loadAGGrid();
        }

        console.log('Initializing grid with resources:', this.resourcesList.length);
        console.log('Resources:', this.resourcesList);
        console.log('Tasks:', this.tasksList.length);

        // Prepare resource names for dropdown
        const resourceNames = this.resourcesList.length > 0 
            ? this.resourcesList.map(r => r.name)
            : []; // No fallback - if no resources, dropdown will be empty
        
        // Prepare task names for dropdown - always include "Proyecto" as first option
        const taskNames = ['Proyecto', ...this.tasksList];
        
        console.log('Resource names for dropdown:', resourceNames);
        console.log('Task names for dropdown:', taskNames);

        // Base column definitions
        const columnDefs = [
            {
                headerName: '',
                checkboxSelection: true,
                headerCheckboxSelection: true,
                width: 50,
                pinned: 'left',
                lockPosition: true,
                suppressMenu: true
            },
            {
                headerName: 'Recurso',
                field: 'recurso',
                editable: true,
                width: 140,
                minWidth: 120,
                pinned: 'left',
                cellEditor: 'agSelectCellEditor',
                cellEditorParams: {
                    values: resourceNames
                },
                cellStyle: { 
                    fontWeight: '600',
                    background: 'rgba(49, 151, 149, 0.05)'
                }
            },
            {
                headerName: 'Tarea',
                field: 'tarea',
                editable: true,
                width: 150,
                minWidth: 120,
                pinned: 'left',
                cellEditor: 'agSelectCellEditor',
                cellEditorParams: {
                    values: taskNames
                }
            },
            {
                headerName: 'Comentarios',
                field: 'detalleTarea',
                editable: true,
                width: 200,
                minWidth: 150,
                pinned: 'left',
                cellEditor: 'agLargeTextCellEditor',
                cellEditorPopup: true,
                cellEditorParams: {
                    maxLength: 500,
                    rows: 5,
                    cols: 50
                },
                wrapText: true,
                autoHeight: true
            },
            {
                headerName: 'Actividad',
                field: 'equipo',
                editable: true,
                width: 140,
                minWidth: 120,
                pinned: 'left',
                cellEditor: 'agSelectCellEditor',
                cellEditorParams: {
                    values: ['Project Management', 'Conceptualización', 'Análisis', 'Diseño', 'Construcción', 'QA', 'Despliegue', 'General']
                },
                cellStyle: params => {
                    const colors = {
                        'Project Management': { background: 'rgba(99, 102, 241, 0.1)', color: '#4338ca' },
                        'Conceptualización': { background: 'rgba(129, 199, 132, 0.1)', color: '#2e7d32' },
                        'Análisis': { background: 'rgba(66, 153, 225, 0.1)', color: '#3182ce' },
                        'Diseño': { background: 'rgba(236, 64, 122, 0.1)', color: '#d53f8c' },
                        'Construcción': { background: 'rgba(255, 183, 77, 0.1)', color: '#e65100' },
                        'QA': { background: 'rgba(186, 104, 200, 0.1)', color: '#6a1b9a' },
                        'Despliegue': { background: 'rgba(77, 182, 172, 0.1)', color: '#00695c' },
                        'General': { background: 'rgba(156, 163, 175, 0.1)', color: '#4b5563' }
                    };
                    return colors[params.value] || {};
                }
            },
            // Add Módulo column after Actividad
            {
                headerName: 'Módulo',
                field: 'modulo',
                editable: true,
                width: 140,
                minWidth: 120,
                pinned: 'left',
                cellEditor: 'agSelectCellEditor',
                cellEditorParams: {
                    values: this.modulesList.length > 0 ? this.modulesList : []
                },
                cellStyle: {
                    background: 'rgba(139, 92, 246, 0.05)',
                    color: '#6d28d9'
                }
            },
            // Add Total column after Módulo (before date columns)
            {
                headerName: 'Total',
                field: 'total',
                width: 120,
                minWidth: 70,
                pinned: 'left',
                editable: false,
                filter: false,
                sortable: false,
                suppressMenu: true,
                resizable: true,
                cellStyle: {
                    backgroundColor: '#e5e7eb', 
                    fontWeight: 'bold',
                    textAlign: 'center',
                    borderLeft: '2px solid #6b7280',
                    fontSize: '0.9em'
                },
                valueGetter: (params) => {
                    // Sum all day columns
                    let total = 0;
                    Object.keys(params.data).forEach(key => {
                        if (key.match(/^\d{4}-\d{2}-\d{2}$/) && params.data[key]) {
                            total += parseFloat(params.data[key]) || 0;
                        }
                    });
                    return total > 0 ? `${total.toFixed(1)}h` : '';
                }
            }
        ];

        // Always add date columns
        // If no dates provided, generate 120 days from today
        let dateStart = startDate;
        let dateEnd = endDate;
        
        if (!dateStart || !dateEnd) {
            const today = new Date();
            dateStart = today.toISOString().split('T')[0];
            const futureDate = new Date(today);
            futureDate.setDate(futureDate.getDate() + 120);
            dateEnd = futureDate.toISOString().split('T')[0];
        }
        
        const dateColumns = this.generateDateColumns();
        columnDefs.push(...dateColumns);

        // Grid options
        const gridOptions = {
            columnDefs: columnDefs,
            rowData: tasks.length > 0 ? tasks : this.getDefaultRows(),
            defaultColDef: {
                sortable: true,
                filter: true,
                resizable: true,
                suppressMenu: false
            },
            rowSelection: 'multiple',
            animateRows: true,
            enableCellTextSelection: true,
            ensureDomOrder: true,
            suppressRowClickSelection: true,
            stopEditingWhenCellsLoseFocus: true,
            singleClickEdit: false,
            enterNavigatesVertically: true,
            enterNavigatesVerticallyAfterEdit: true,
            undoRedoCellEditing: true,
            undoRedoCellEditingLimit: 20,
            enableRangeSelection: true,
            enableFillHandle: true,
            fillHandleDirection: 'y',
            onCellValueChanged: (event) => {
                console.log('Cell value changed:', event);
            },
            onGridReady: (params) => {
                this.gridApi = params.api;
                params.api.sizeColumnsToFit();
                
                // Scroll to today's column
                setTimeout(() => {
                    const todayDateStr = new Date().toISOString().split('T')[0];
                    params.api.ensureColumnVisible(todayDateStr);
                    console.log('Scrolled to today:', todayDateStr);
                }, 200);
            }
        };

        // Create grid
        this.gridApi = agGrid.createGrid(gridDiv, gridOptions);
    }

    /**
     * Get default empty rows
     */
    getDefaultRows() {
        const defaultRow = { recurso: '', tarea: '', detalleTarea: '', equipo: '' };
        
        // Always initialize date fields
        let dateStart = this.startDate;
        let dateEnd = this.endDate;
        
        if (!dateStart || !dateEnd) {
            const today = new Date();
            dateStart = today.toISOString().split('T')[0];
            const futureDate = new Date(today);
            futureDate.setDate(futureDate.getDate() + 120);
            dateEnd = futureDate.toISOString().split('T')[0];
        }
        
        const start = new Date(dateStart);
        const end = new Date(dateEnd);
        let currentDate = new Date(start);
        
        while (currentDate <= end) {
            const dateStr = currentDate.toISOString().split('T')[0];
            defaultRow[dateStr] = null;
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        return [
            { ...defaultRow },
            { ...defaultRow },
            { ...defaultRow }
        ];
    }

    /**
     * Add new row
     */
    addRow() {
        if (!this.gridApi) return;

        const newRow = { recurso: '', tarea: '', detalleTarea: '', equipo: '' };
        
        // Always initialize date fields
        let dateStart = this.startDate;
        let dateEnd = this.endDate;
        
        if (!dateStart || !dateEnd) {
            const today = new Date();
            dateStart = today.toISOString().split('T')[0];
            const futureDate = new Date(today);
            futureDate.setDate(futureDate.getDate() + 120);
            dateEnd = futureDate.toISOString().split('T')[0];
        }
        
        const start = new Date(dateStart);
        const end = new Date(dateEnd);
        let currentDate = new Date(start);
        
        while (currentDate <= end) {
            const dateStr = currentDate.toISOString().split('T')[0];
            newRow[dateStr] = null;
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        this.gridApi.applyTransaction({ add: [newRow] });

        // Focus on the new row
        const rowCount = this.gridApi.getDisplayedRowCount();
        this.gridApi.ensureIndexVisible(rowCount - 1);
    }

    /**
     * Delete selected rows
     */
    deleteSelectedRows() {
        if (!this.gridApi) return;

        const selectedRows = this.gridApi.getSelectedRows();
        
        if (selectedRows.length === 0) {
            alert('Por favor, selecciona las filas que deseas eliminar.');
            return;
        }

        if (confirm(`¿Estás seguro de eliminar ${selectedRows.length} fila(s)?`)) {
            this.gridApi.applyTransaction({ remove: selectedRows });
        }
    }

    /**
     * Save changes
     */
    async save() {
        if (!this.gridApi) return;

        const allRows = [];
        this.gridApi.forEachNode(node => allRows.push(node.data));

        // Filter out empty rows (rows with at least some data)
        const validRows = allRows.filter(row => {
            // Check if row has recurso, tarea, descripcion, or equipo
            if (row.recurso || row.tarea || row.detalleTarea || row.equipo) {
                return true;
            }
            // Or check if it has any date values
            return Object.keys(row).some(key => key.match(/^\d{4}-\d{2}-\d{2}$/) && row[key]);
        });

        // Validate data
        const errors = this.validateData(validRows);
        if (errors.length > 0) {
            alert('Errores de validación:\n\n' + errors.join('\n'));
            return;
        }

        // Calculate totals from date columns
        let totalHoras = 0;
        validRows.forEach(row => {
            Object.keys(row).forEach(key => {
                if (key.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    totalHoras += parseFloat(row[key]) || 0;
                }
            });
        });

        console.log('Saving tasks for project:', this.projectId);
        console.log('Tasks:', validRows);
        console.log('Total horas:', totalHoras.toFixed(1));

        // Validate capacity before sending to backend
        const capacityErrors = await this.validateCapacityBeforeSave(validRows);
        if (capacityErrors.length > 0) {
            // Show capacity error modal
            const results = {
                success: 0,
                failed: capacityErrors.length,
                errors: capacityErrors
            };
            
            showCapacityErrorModal(results);
            return; // Don't proceed with save
        }

        // Save to database
        try {
            const saveResult = await this.saveToDatabase(validRows);
            
            // Check if saveToDatabase returned early due to capacity errors
            if (!saveResult) {
                // Capacity errors were shown, don't proceed
                return;
            }
            
            // Also save to localStorage as backup
            this.saveToStorage(validRows);

            // Show success message
            alert(`✓ Guardado exitoso\n\nProyecto: ${this.projectName}\nTareas: ${validRows.length}\nTotal horas: ${totalHoras.toFixed(1)}h`);

            // Close modal and reload projects
            this.modalElement.classList.remove('active');
            document.body.style.overflow = '';
            
            // Destroy grid
            if (this.gridApi) {
                this.gridApi.destroy();
                this.gridApi = null;
            }
            
            // Reload projects without full page reload
            if (window.loadProjectsFromAPI) {
                window.loadProjectsFromAPI();
            }
        } catch (error) {
            console.error('Error saving to database:', error);
            const errorMessage = error.message || 'Error desconocido al guardar';
            alert(`❌ Error al guardar los cambios\n\n${errorMessage}\n\nPor favor, revisa los datos e intenta de nuevo.`);
        }
    }

    /**
     * Save to database with daily assignments
     * Strategy: Delete all existing assignments for this project, then create new ones
     */
    async saveToDatabase(rows) {
        const headers = this.getAuthHeaders();
        
        if (!headers) {
            throw new Error('No authentication tokens found');
        }

        // STEP 1: Delete all existing assignments for this project
        console.log('Step 1: Deleting existing assignments for project:', this.projectId);
        try {
            const deleteResponse = await fetch(`${API_CONFIG.BASE_URL}/assignments?projectId=${this.projectId}`, {
                method: 'DELETE',
                headers
            });
            
            if (deleteResponse.ok) {
                const deleteResult = await deleteResponse.json();
                console.log('Deleted assignments:', deleteResult);
            } else {
                console.warn('Could not delete existing assignments:', deleteResponse.status);
            }
        } catch (error) {
            console.warn('Error deleting existing assignments:', error);
            // Continue anyway - maybe there were no existing assignments
        }

        // STEP 2: Transform rows to daily assignments
        const assignments = [];
        
        rows.forEach(row => {
            // For each day with hours, create a daily assignment
            Object.keys(row).forEach(key => {
                if (key.match(/^\d{4}-\d{2}-\d{2}$/) && row[key] && parseFloat(row[key]) > 0) {
                    // Find resource ID from name
                    const resource = this.resourcesList.find(r => r.name === row.recurso);
                    
                    if (!resource) {
                        console.warn(`Resource not found for: ${row.recurso}`);
                        return;
                    }
                    
                    // Extract month and year from date string (YYYY-MM-DD) directly to avoid timezone issues
                    const [year, month] = key.split('-').map(Number); // Extract year and month from "YYYY-MM-DD"
                    
                    const dateToSend = key + 'T00:00:00.000Z';
                    console.log('Sending assignment with date:', key, '-> UTC:', dateToSend);
                    
                    assignments.push({
                        jiraTaskId: this.projectId, // Use jiraTaskId for jira_tasks table
                        resourceId: resource.id,
                        title: row.tarea || 'Sin título',
                        description: row.detalleTarea || '',
                        team: row.equipo || null,
                        module: row.modulo || null,
                        date: dateToSend, // Force UTC interpretation
                        month: month, // Add month for KPI filtering
                        year: year, // Add year for KPI filtering
                        hours: parseFloat(row[key])
                    });
                }
            });
        });

        console.log('Step 2: Creating new assignments:', assignments.length);
        console.log('Sample assignments:', assignments.slice(0, 3));

        // STEP 3: Save each assignment to the API
        const results = {
            success: 0,
            failed: 0,
            errors: []
        };

        for (const assignment of assignments) {
            try {
                const response = await fetch(`${API_CONFIG.BASE_URL}/assignments`, {
                    method: 'POST',
                    headers: {
                        ...headers,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(assignment)
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    console.log('Error response from API:', errorData);
                    
                    // Extract the actual error message from nested structure
                    let errorMessage = '';
                    if (errorData.error && typeof errorData.error === 'object') {
                        errorMessage = errorData.error.message || errorData.error.details || JSON.stringify(errorData.error);
                    } else if (typeof errorData.error === 'string') {
                        errorMessage = errorData.error;
                    } else {
                        errorMessage = errorData.message || JSON.stringify(errorData);
                    }
                    
                    console.log('Parsed error message:', errorMessage);
                    console.log('Contains capacity?', errorMessage.toLowerCase().includes('capacity'));
                    console.log('Contains exceed?', errorMessage.toLowerCase().includes('exceed'));
                    
                    // Check if it's a capacity exceeded error
                    const isCapacityError = errorMessage.toLowerCase().includes('capacity') || 
                                          errorMessage.toLowerCase().includes('exceed');
                    
                    console.log('Is capacity error?', isCapacityError);
                    
                    if (isCapacityError) {
                        results.errors.push({
                            assignment,
                            error: errorMessage,
                            type: 'CAPACITY_EXCEEDED'
                        });
                    } else {
                        results.errors.push({
                            assignment,
                            error: errorMessage
                        });
                    }
                    results.failed++;
                } else {
                    results.success++;
                }
            } catch (error) {
                console.error('Error saving assignment:', error);
                results.errors.push({
                    assignment,
                    error: error.message
                });
                results.failed++;
            }
        }

        console.log('Save results:', results);

        // If there were capacity errors, show detailed modal and return early
        if (results.errors.some(e => e.type === 'CAPACITY_EXCEEDED')) {
            console.log('Showing capacity error modal...');
            
            // Add resource names to assignments for better error display
            results.errors.forEach(error => {
                if (error.assignment) {
                    const resource = this.resourcesList.find(r => r.id === error.assignment.resourceId);
                    error.assignment.resourceName = resource?.name || 'Recurso desconocido';
                    console.log('Added resource name:', error.assignment.resourceName);
                }
            });
            
            console.log('Calling showCapacityErrorModal with:', results);
            showCapacityErrorModal(results);
            console.log('Modal should be visible now');
            return; // Return early, don't throw error
        }

        // If there were other errors, throw them
        if (results.failed > 0) {
            throw new Error(
                `Se guardaron ${results.success} asignaciones, pero ${results.failed} fallaron.\n\n` +
                `Errores: ${results.errors.map(e => e.error).join(', ')}`
            );
        }

        return results;
    }

    /**
     * Validate task data
     */
    validateData(rows) {
        const errors = [];

        rows.forEach((row, index) => {
            const rowNum = index + 1;

            // Check if row has at least one filled field
            const hasRecurso = row.recurso && row.recurso.trim() !== '';
            const hasTarea = row.tarea && row.tarea.trim() !== '';
            const hasEquipo = row.equipo && row.equipo.trim() !== '';
            
            // Check if row has at least some hours in date columns
            let hasHours = false;
            Object.keys(row).forEach(key => {
                if (key.match(/^\d{4}-\d{2}-\d{2}$/) && row[key] > 0) {
                    hasHours = true;
                }
            });

            // If row has any data, validate required fields
            if (hasRecurso || hasTarea || hasEquipo || hasHours) {
                if (!hasTarea) {
                    errors.push(`Fila ${rowNum}: El campo "Tarea" es obligatorio`);
                }
                if (!hasRecurso) {
                    errors.push(`Fila ${rowNum}: El campo "Recurso" es obligatorio`);
                }
            }
        });

        return errors;
    }

    /**
     * Validate capacity before saving to backend
     * Checks if the sum of hours per resource and date exceeds daily capacity
     */
    async validateCapacityBeforeSave(rows) {
        const headers = this.getAuthHeaders();
        
        if (!headers) {
            return []; // Can't validate without auth
        }

        // Step 1: Calculate hours per resource per date from the grid
        const hoursByResourceAndDate = new Map();
        
        rows.forEach(row => {
            const resource = this.resourcesList.find(r => r.name === row.recurso);
            if (!resource) return;
            
            Object.keys(row).forEach(key => {
                if (key.match(/^\d{4}-\d{2}-\d{2}$/) && row[key] && parseFloat(row[key]) > 0) {
                    const mapKey = `${resource.id}_${key}`;
                    const currentHours = hoursByResourceAndDate.get(mapKey) || 0;
                    hoursByResourceAndDate.set(mapKey, currentHours + parseFloat(row[key]));
                }
            });
        });

        console.log('[validateCapacity] Hours by resource and date:', hoursByResourceAndDate);

        // Step 2: For each resource+date, check capacity
        const errors = [];

        for (const [mapKey, requestedHours] of hoursByResourceAndDate.entries()) {
            const [resourceId, date] = mapKey.split('_');
            
            // Get resource's daily capacity (defaultCapacity / 20 working days)
            const resource = this.resourcesList.find(r => r.id === resourceId);
            if (!resource) continue;
            
            // Use default_capacity (snake_case) from API response
            const monthlyCapacity = resource.defaultCapacity || resource.default_capacity || 160;
            const dailyCapacity = Math.floor(monthlyCapacity / 20); // Monthly capacity / 20 working days
            console.log(`[validateCapacity] Resource ${resource.name}: Monthly=${monthlyCapacity}h, Daily=${dailyCapacity}h`);
            
            // Get existing assignments for this resource on this date (excluding current project)
            try {
                const response = await fetch(
                    `${API_CONFIG.BASE_URL}/assignments?resourceId=${resourceId}`,
                    {
                        headers
                    }
                );
                
                if (response.ok) {
                    const data = await response.json();
                    const assignments = data.data?.assignments || data.assignments || [];
                    
                    console.log(`[validateCapacity] Current jiraTaskId: ${this.projectId} (type: ${typeof this.projectId})`);
                    console.log(`[validateCapacity] Total assignments for resource ${resourceId}:`, assignments.length);
                    
                    // Filter assignments for this date, excluding current jira_task
                    const assignedHours = assignments
                        .filter(a => {
                            const assignmentDate = a.date ? a.date.toString().split('T')[0] : null;
                            const matchesDate = assignmentDate === date;
                            
                            // Get jira_task_id from assignment (handle both camelCase and snake_case)
                            const assignmentJiraTaskId = a.jiraTaskId || a.jira_task_id;
                            
                            // Compare as strings to handle both string and UUID formats
                            const isDifferentTask = String(assignmentJiraTaskId) !== String(this.projectId);
                            
                            if (matchesDate) {
                                console.log(`[validateCapacity] Assignment on ${date}: jiraTaskId=${assignmentJiraTaskId}, hours=${a.hours}, isDifferent=${isDifferentTask}`);
                            }
                            
                            return matchesDate && isDifferentTask;
                        })
                        .reduce((sum, a) => sum + parseFloat(a.hours || 0), 0);
                    
                    const availableHours = dailyCapacity - assignedHours;
                    
                    console.log(`[validateCapacity] ${resourceId} on ${date}: Available=${availableHours}h, Requested=${requestedHours}h, Assigned=${assignedHours}h`);
                    
                    if (requestedHours > availableHours) {
                        const resource = this.resourcesList.find(r => r.id === resourceId);
                        errors.push({
                            assignment: {
                                resourceId: resourceId,
                                resourceName: resource?.name || 'Recurso desconocido',
                                date: date,
                                title: 'Múltiples asignaciones',
                                hours: requestedHours
                            },
                            error: `Assignment would exceed daily resource capacity for ${date}. Available: ${availableHours} hours, Requested: ${requestedHours} hours, Assigned: ${assignedHours} hours`,
                            type: 'CAPACITY_EXCEEDED'
                        });
                    }
                }
            } catch (error) {
                console.error('[validateCapacity] Error checking capacity:', error);
                // Continue with other validations
            }
        }

        console.log('[validateCapacity] Validation errors:', errors.length);
        return errors;
    }

    /**
     * Save to localStorage
     */
    saveToStorage(tasks) {
        const storageKey = `project_tasks_${this.projectId}`;
        localStorage.setItem(storageKey, JSON.stringify({
            projectId: this.projectId,
            projectName: this.projectName,
            tasks: tasks,
            lastUpdated: new Date().toISOString()
        }));
    }

    /**
     * Load from localStorage
     */
    static loadFromStorage(projectId) {
        const storageKey = `project_tasks_${projectId}`;
        const data = localStorage.getItem(storageKey);
        return data ? JSON.parse(data).tasks : [];
    }
}
