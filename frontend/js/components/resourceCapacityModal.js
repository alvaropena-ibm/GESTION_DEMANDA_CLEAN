/**
 * Resource Capacity Modal Component with AG Grid
 * Manages resource availability, absences and committed hours
 */

import { API_CONFIG } from '../config/data.js';
import { reloadCapacityData } from './resourceCapacity.js';

export class ResourceCapacityModal {
    constructor() {
        this.gridApi = null;
        this.resourceId = null;
        this.resourceData = null;
        this.modalElement = null;
        this.isInitialized = false;
        this.isSaving = false; // Flag to prevent double submission
        this.isDeleting = false; // Flag to prevent double deletion
    }

    /**
     * Get authentication credentials (supports both Cognito and IAM)
     * @returns {Object} Object with awsAccessKey, userTeam, and authHeader
     */
    getAuthCredentials() {
        const authType = sessionStorage.getItem('auth_type');
        let awsAccessKey;
        
        if (authType === 'cognito') {
            awsAccessKey = sessionStorage.getItem('cognito_access_token');
        } else {
            awsAccessKey = sessionStorage.getItem('aws_access_key');
        }
        
        const userTeam = sessionStorage.getItem('user_team');
        const authHeader = authType === 'cognito' ? `Bearer ${awsAccessKey}` : awsAccessKey;
        
        return { awsAccessKey, userTeam, authHeader, authType };
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
            <div id="capacity-modal" class="modal-overlay">
                <div class="modal-container" style="max-width: 95vw;">
                    <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center;">
                        <h2>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 24px; height: 24px; display: inline-block; margin-right: 8px; vertical-align: middle;">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                            </svg>
                            <span id="capacity-modal-title">Gestión de Capacidad</span>
                        </h2>
                        <button class="modal-close" id="close-capacity-modal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <!-- Resource Information Section -->
                        <div id="resource-info-section" class="resource-info-card">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                                <h3 style="margin: 0;">Información del Recurso</h3>
                                <button type="button" id="delete-resource-btn" class="btn btn-danger" style="display: flex; align-items: center; gap: 0.5rem; background: #dc2626; border-color: #dc2626; color: white; font-size: 1rem;">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="white" style="width: 18px; height: 18px;">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                    </svg>
                                    Eliminar Recurso
                                </button>
                            </div>
                            <div class="resource-info-grid">
                                <div class="form-group">
                                    <label>Nombre Completo: <span style="color: #dc2626;">*</span></label>
                                    <input type="text" id="resource-name" class="form-input" />
                                </div>
                                <div class="form-group">
                                    <label>Email:</label>
                                    <input type="email" id="resource-email" class="form-input" />
                                </div>
                                <div class="form-group">
                                    <label>Equipo: <span style="color: #dc2626;">*</span></label>
                                    <input type="text" id="resource-team" class="form-input" readonly style="background-color: #f3f4f6; cursor: not-allowed;" />
                                </div>
                                <div class="form-group" style="grid-column: 1 / -1;">
                                    <label>Skills:</label>
                                    <div id="resource-skills-container" style="display: flex; flex-wrap: wrap; gap: 12px; margin-top: 8px;">
                                        <!-- Skills checkboxes will be populated here -->
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Capacity Calendar Section -->
                        <div style="margin-top: 24px;">
                            <h3 style="margin-bottom: 12px; color: #000000;">
                                Calendario de Capacidad 
                                <span style="font-size: 0.75em; font-weight: normal;">(permite solo edición de ausencias/vacaciones)</span>
                            </h3>
                            <div id="capacity-grid" class="ag-grid-container ag-theme-alpine" style="height: 300px;"></div>
                        </div>
                    </div>
                    <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; border-top: 1px solid #e2e8f0;">
                        <div style="display: flex; gap: 0.75rem;">
                            <button type="button" class="btn btn-secondary" id="cancel-capacity-modal">Cerrar</button>
                        </div>
                        <div style="display: flex; gap: 0.75rem;">
                            <button type="button" class="btn btn-success" id="save-capacity-modal" style="display: flex; align-items: center; gap: 0.5rem; background: #2d7a6e; border-color: #2d7a6e; color: white;">
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
        this.modalElement = document.getElementById('capacity-modal');
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Close modal
        document.getElementById('close-capacity-modal').addEventListener('click', () => this.close());
        document.getElementById('cancel-capacity-modal').addEventListener('click', () => this.close());
        
        // Close on overlay click
        this.modalElement.addEventListener('click', (e) => {
            if (e.target === this.modalElement) {
                this.close();
            }
        });

        // Save everything (resource info + capacity)
        document.getElementById('save-capacity-modal').addEventListener('click', () => this.saveAll());

        // Delete resource - use event delegation on modal body
        this.modalElement.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('#delete-resource-btn');
            if (deleteBtn) {
                console.log('Delete button clicked via delegation');
                this.showDeleteConfirmation();
            }
        });

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modalElement.classList.contains('active')) {
                this.close();
            }
        });
    }

    /**
     * Load resource data from API
     */
    async loadResourceData(resourceId) {
        try {
            console.log('Loading resource data for ID:', resourceId);
            
            const { awsAccessKey, userTeam, authHeader } = this.getAuthCredentials();
            
            if (!awsAccessKey || !userTeam) {
                console.error('No authentication tokens found');
                throw new Error('No authentication tokens found');
            }
            
            console.log('Fetching resource from:', `${API_CONFIG.BASE_URL}/resources/${resourceId}`);
            
            const response = await fetch(`${API_CONFIG.BASE_URL}/resources/${resourceId}`, {
                headers: {
                    'Authorization': authHeader,
                    'x-user-team': userTeam
                }
            });
            
            console.log('Response status:', response.status);
            
            if (!response.ok) {
                console.error('Response not OK:', response.status, response.statusText);
                throw new Error('Error loading resource data');
            }
            
            const data = await response.json();
            console.log('Raw API response:', data);
            
            const resource = data.data || data;
            console.log('Extracted resource:', resource);
            
            return resource;
            
        } catch (error) {
            console.error('Error loading resource data:', error);
            return null;
        }
    }

    /**
     * Load committed hours and absences from assignments (daily assignments)
     * Separates absences (from ABSENCES project) from regular committed hours
     */
    async loadCommittedHoursAndAbsences(resourceId) {
        try {
            const { awsAccessKey, userTeam, authHeader } = this.getAuthCredentials();
            
            if (!awsAccessKey || !userTeam) {
                throw new Error('No authentication tokens found');
            }
            
            const response = await fetch(`${API_CONFIG.BASE_URL}/assignments?resourceId=${resourceId}`, {
                headers: {
                    'Authorization': authHeader,
                    'x-user-team': userTeam
                }
            });
            
            if (!response.ok) {
                throw new Error('Error loading committed hours');
            }
            
            const data = await response.json();
            const assignments = data.data?.assignments || data.assignments || [];
            
            console.log('Assignments loaded for resource:', resourceId, 'Count:', assignments.length);
            
            // Group hours by date - separate absences from regular committed hours
            const committedHours = {};
            const absenceHours = {};
            
            assignments.forEach(assignment => {
                let dateStr;
                
                // Check if assignment has date field (new daily system)
                if (assignment.date) {
                    // Always extract date directly from ISO string to avoid timezone issues
                    dateStr = assignment.date.toString().split('T')[0]; // Get YYYY-MM-DD part
                } 
                // Legacy: month/year system - distribute to first day of month
                else if (assignment.month && assignment.year) {
                    const month = String(assignment.month).padStart(2, '0');
                    dateStr = `${assignment.year}-${month}-01`;
                }
                
                if (dateStr) {
                    const hours = parseFloat(assignment.hours) || 0;
                    
                    // Check if this is an absence (from ABSENCES-{TEAM} project)
                    const projectCode = assignment.project?.code || '';
                    if (projectCode.startsWith('ABSENCES')) {
                        if (!absenceHours[dateStr]) {
                            absenceHours[dateStr] = 0;
                        }
                        absenceHours[dateStr] += hours;
                    } else {
                        // Regular committed hours
                        if (!committedHours[dateStr]) {
                            committedHours[dateStr] = 0;
                        }
                        committedHours[dateStr] += hours;
                    }
                }
            });
            
            console.log('Committed hours by date:', Object.keys(committedHours).length, 'days');
            console.log('Absence hours by date:', Object.keys(absenceHours).length, 'days');
            
            return { committedHours, absenceHours };
            
        } catch (error) {
            console.error('Error loading committed hours:', error);
            return { committedHours: {}, absenceHours: {} };
        }
    }

    /**
     * Open modal for a specific resource
     */
    async open(resourceId, resourceName) {
        // Prevent opening if already open
        if (this.modalElement.classList.contains('active')) {
            console.log('Modal already open, ignoring duplicate open request');
            return;
        }
        
        this.resourceId = resourceId;
        
        console.log('Opening capacity modal for resource:', resourceId, resourceName);

        // Update modal title
        document.getElementById('capacity-modal-title').textContent = 
            `Gestión de Capacidad - ${resourceName}`;

        // Load resource data
        this.resourceData = await this.loadResourceData(resourceId);
        
        if (this.resourceData) {
            this.populateResourceInfo();
        }

        // Load committed hours and absences
        const { committedHours, absenceHours } = await this.loadCommittedHoursAndAbsences(resourceId);

        // Destroy any existing grid before creating a new one
        if (this.gridApi) {
            console.log('Destroying existing grid before creating new one');
            this.gridApi.destroy();
            this.gridApi = null;
        }

        // Show modal first
        this.modalElement.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Initialize AG Grid (async - will load library if needed)
        await this.initializeGrid(committedHours, absenceHours);
    }

    /**
     * Populate resource information fields
     */
    populateResourceInfo() {
        if (!this.resourceData) {
            console.warn('No resource data available to populate');
            return;
        }

        console.log('Populating resource info with data:', this.resourceData);

        // Populate basic fields
        const nameField = document.getElementById('resource-name');
        const emailField = document.getElementById('resource-email');
        const teamField = document.getElementById('resource-team');
        
        if (nameField) nameField.value = this.resourceData.name || '';
        if (emailField) emailField.value = this.resourceData.email || '';
        if (teamField) teamField.value = this.resourceData.team || '';
        
        // Populate skills checkboxes
        const resourceSkills = this.resourceData.resourceSkills || [];
        const resourceSkillNames = resourceSkills.map(s => s.skillName);
        this.populateSkillsCheckboxes(resourceSkillNames);
        
        console.log('Resource info populated:', {
            name: nameField?.value,
            email: emailField?.value,
            team: teamField?.value,
            skills: resourceSkillNames
        });
    }

    /**
     * Populate skills checkboxes
     */
    populateSkillsCheckboxes(selectedSkills = []) {
        const AVAILABLE_SKILLS = [
            'Project Management',
            'Conceptualización',
            'Análisis',
            'Diseño',
            'Construcción',
            'QA',
            'Despliegue',
            'General'
        ];

        const container = document.getElementById('resource-skills-container');
        if (!container) return;
        
        container.innerHTML = '';
        
        AVAILABLE_SKILLS.forEach(skill => {
            const isChecked = selectedSkills.includes(skill);
            
            const checkboxDiv = document.createElement('div');
            checkboxDiv.className = 'skill-checkbox-item';
            checkboxDiv.innerHTML = `
                <label class="skill-checkbox-label" style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                    <input type="checkbox" name="resource-skills" value="${skill}" ${isChecked ? 'checked' : ''}>
                    <span>${skill}</span>
                </label>
            `;
            
            container.appendChild(checkboxDiv);
        });
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

        // Reload capacity data without full page reload
        reloadCapacityData();
    }

    /**
     * Generate date columns: from day 1 of current month to day 31 of month +12
     */
    generateDateColumns() {
        const dateColumns = [];
        
        // Start from day 1 of current month
        const startDate = new Date();
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        
        // End at day 31 of month +12
        const endDate = new Date(startDate);
        endDate.setMonth(startDate.getMonth() + 12);
        endDate.setDate(31);
        endDate.setHours(23, 59, 59, 999);
        
        // Calculate total days
        const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
        
        // Generate columns for each day
        for (let i = 0; i < totalDays; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + i);
            
            // Generate date string in local timezone to avoid UTC conversion issues
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            const day = currentDate.getDate();
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dateHeader = `${day}/${month}`;
            
            // Determine if it's weekend or today
            const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
            const isToday = i === 0;
            
            dateColumns.push({
                headerName: dateHeader,
                field: dateStr,
                editable: params => {
                    // Only 'Ausencias/Vacaciones' is editable
                    return params.data.rowType === 'ausencias';
                },
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
                valueFormatter: params => params.value ? `${params.value}h` : '0h',
                cellStyle: params => {
                    const style = { 
                        textAlign: 'center',
                        fontWeight: params.value ? '600' : 'normal',
                        fontSize: '0.85em'
                    };
                    
                    // Different colors for each row type
                    if (params.data.rowType === 'base') {
                        style.backgroundColor = 'rgba(156, 163, 175, 0.1)';
                        style.color = '#374151';
                    } else if (params.data.rowType === 'ausencias') {
                        style.backgroundColor = '#F7E6E5';
                        style.color = '#000000';
                    } else if (params.data.rowType === 'comprometidas') {
                        style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                        style.color = '#1e40af';
                    } else if (params.data.rowType === 'disponibles') {
                        style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
                        style.color = '#065f46';
                    }
                    
                    // Highlight today
                    if (isToday) {
                        style.borderLeft = '2px solid #f59e0b';
                        style.borderRight = '2px solid #f59e0b';
                    }
                    // Highlight weekends
                    else if (isWeekend) {
                        style.opacity = '0.6';
                    }
                    
                    return style;
                },
                headerClass: isToday ? 'today-header' : (isWeekend ? 'weekend-header' : '')
            });
        }
        
        return dateColumns;
    }

    /**
     * Initialize AG Grid
     */
    async initializeGrid(committedHours = {}, absenceHours = {}) {
        // Load AG Grid if not already loaded
        if (typeof agGrid === 'undefined') {
            console.log('AG Grid not loaded, loading now...');
            await window.loadAGGrid();
        }
        
        const gridDiv = document.getElementById('capacity-grid');

        // Base column definition
        const columnDefs = [
            {
                headerName: 'Tipo',
                field: 'tipo',
                editable: false,
                width: 250,
                minWidth: 200,
                pinned: 'left',
                cellStyle: params => {
                    const style = { fontWeight: '600' };
                    if (params.data.rowType === 'base') {
                        style.backgroundColor = 'rgba(156, 163, 175, 0.2)';
                        style.color = '#374151';
                    } else if (params.data.rowType === 'ausencias') {
                        style.backgroundColor = '#F7E6E5';
                        style.color = '#000000';
                    } else if (params.data.rowType === 'comprometidas') {
                        style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
                        style.color = '#1e40af';
                    } else if (params.data.rowType === 'disponibles') {
                        style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
                        style.color = '#065f46';
                    }
                    return style;
                }
            }
        ];

        // Add date columns
        const dateColumns = this.generateDateColumns();
        columnDefs.push(...dateColumns);

        // Prepare row data - from day 1 of current month to day 31 of month +12
        const startDate = new Date();
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        
        const endDate = new Date(startDate);
        endDate.setMonth(startDate.getMonth() + 12);
        endDate.setDate(31);
        endDate.setHours(23, 59, 59, 999);
        
        const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

        const baseRow = { tipo: 'Horas base', rowType: 'base' };
        const ausenciasRow = { tipo: 'Ausencias/Vacaciones', rowType: 'ausencias' };
        const comprometidasRow = { tipo: 'Horas comprometidas', rowType: 'comprometidas' };
        const disponiblesRow = { tipo: 'Horas disponibles', rowType: 'disponibles' };

        // Calculate daily hours based on defaultCapacity
        // defaultCapacity is monthly hours, divide by 20 to get daily hours for weekdays
        // API returns default_capacity (snake_case), so check both
        const defaultCapacity = this.resourceData?.defaultCapacity || this.resourceData?.default_capacity || 160;
        const dailyHours = defaultCapacity / 20;
        
        console.log(`Calculating daily hours: ${defaultCapacity} monthly hours / 20 = ${dailyHours} hours per weekday`);

        // Initialize all dates
        for (let i = 0; i < totalDays; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + i);
            // Generate date string in local timezone to match column field names
            const year = currentDate.getFullYear();
            const month = String(currentDate.getMonth() + 1).padStart(2, '0');
            const day = String(currentDate.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            
            // Get day of week (0 = Sunday, 6 = Saturday)
            const dayOfWeek = currentDate.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            
            // Set base hours: dailyHours for weekdays, 0 for weekends
            const base = isWeekend ? 0 : dailyHours;
            baseRow[dateStr] = base;
            
            // Absences from database
            const ausencias = absenceHours[dateStr] || 0;
            ausenciasRow[dateStr] = ausencias;
            
            // Committed hours from database
            const comprometidas = committedHours[dateStr] || 0;
            comprometidasRow[dateStr] = comprometidas;
            
            // Calculate available hours: base - ausencias - comprometidas
            const disponibles = Math.max(0, base - ausencias - comprometidas);
            disponiblesRow[dateStr] = disponibles;
        }

        const rowData = [baseRow, ausenciasRow, comprometidasRow, disponiblesRow];

        // Grid options
        const gridOptions = {
            columnDefs: columnDefs,
            rowData: rowData,
            defaultColDef: {
                sortable: false,
                filter: false,
                resizable: true,
                suppressMenu: true
            },
            animateRows: false,
            enableCellTextSelection: true,
            suppressRowClickSelection: true,
            stopEditingWhenCellsLoseFocus: true,
            singleClickEdit: false,
            onCellValueChanged: (event) => {
                this.validateCapacity(event);
            },
            onGridReady: (params) => {
                this.gridApi = params.api;
                params.api.sizeColumnsToFit();
                
                // Scroll to today's column
                setTimeout(() => {
                    const todayDateStr = new Date().toISOString().split('T')[0];
                    params.api.ensureColumnVisible(todayDateStr);
                }, 200);
            }
        };

        // Create grid
        this.gridApi = agGrid.createGrid(gridDiv, gridOptions);
    }

    /**
     * Validate capacity constraints
     */
    validateCapacity(event) {
        // Get current value
        const field = event.colDef.field;
        const rowType = event.data.rowType;
        
        // Ensure value is >= 0
        if (event.newValue < 0) {
            event.node.setDataValue(field, 0);
            alert('Las horas no pueden ser negativas');
            return;
        }

        // Get all rows
        let base = 0;
        let ausencias = 0;
        let comprometidas = 0;

        this.gridApi.forEachNode(node => {
            const value = parseFloat(node.data[field]) || 0;
            if (node.data.rowType === 'base') {
                base = value;
            } else if (node.data.rowType === 'ausencias') {
                ausencias = value;
            } else if (node.data.rowType === 'comprometidas') {
                comprometidas = value;
            }
        });

        // Validate: Ausencias + Comprometidas <= Base
        if (ausencias + comprometidas > base) {
            alert(`Validación fallida en ${field}:\nAusencias (${ausencias}h) + Comprometidas (${comprometidas}h) no puede superar Horas Base (${base}h)`);
            
            // Revert to previous value
            if (rowType === 'ausencias') {
                event.node.setDataValue(field, base - comprometidas);
            }
        } else {
            // Recalculate disponibles row
            const disponibles = Math.max(0, base - ausencias - comprometidas);
            this.gridApi.forEachNode(node => {
                if (node.data.rowType === 'disponibles') {
                    node.setDataValue(field, disponibles);
                }
            });
        }
    }

    /**
     * Save all data (resource info + capacity)
     */
    async saveAll() {
        // Prevent double submission
        if (this.isSaving) {
            console.log('Save already in progress, ignoring duplicate request');
            return;
        }
        
        // Set saving flag
        this.isSaving = true;
        
        // Disable save button
        const saveButton = document.getElementById('save-capacity-modal');
        if (saveButton) {
            saveButton.disabled = true;
            saveButton.style.opacity = '0.6';
            saveButton.style.cursor = 'not-allowed';
        }
        
        try {
            // First save resource info
            const resourceSaved = await this.saveResourceInfo();
            
            if (!resourceSaved) {
                return; // Stop if resource info failed to save
            }
            
            // Then save capacity
            await this.saveCapacity();
        } finally {
            // Reset saving flag and re-enable button
            this.isSaving = false;
            if (saveButton) {
                saveButton.disabled = false;
                saveButton.style.opacity = '1';
                saveButton.style.cursor = 'pointer';
            }
        }
    }

    /**
     * Save resource information
     * Returns true if successful, false otherwise
     */
    async saveResourceInfo() {
        const name = document.getElementById('resource-name').value.trim();
        const email = document.getElementById('resource-email').value.trim();
        
        // Validate required fields
        if (!name) {
            alert('El nombre es requerido');
            return false;
        }
        
        // Validate email format only if provided
        if (email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                alert('Por favor ingresa un email válido');
                return false;
            }
        }
        
        // Get selected skills from checkboxes
        const selectedSkills = Array.from(
            document.querySelectorAll('input[name="resource-skills"]:checked')
        ).map(checkbox => checkbox.value);

        console.log('Saving resource info:', { name, email, skills: selectedSkills });

        try {
            const { awsAccessKey, userTeam, authHeader } = this.getAuthCredentials();
            
            if (!awsAccessKey || !userTeam) {
                throw new Error('No authentication tokens found');
            }

            // Update resource basic info including skills
            // Use default_capacity (snake_case) from API response
            const currentDefaultCapacity = this.resourceData.defaultCapacity || this.resourceData.default_capacity || 160;
            
            const response = await fetch(`${API_CONFIG.BASE_URL}/resources/${this.resourceId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': authHeader,
                    'x-user-team': userTeam
                },
                body: JSON.stringify({
                    code: this.resourceData.code,  // Requerido por backend
                    name: name,
                    email: email,
                    team: this.resourceData.team,  // Requerido por backend
                    defaultCapacity: currentDefaultCapacity,  // Preserve original value
                    skills: selectedSkills  // Include skills in the main PUT request
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('API Error:', errorData);
                console.error('Full error object:', JSON.stringify(errorData, null, 2));
                
                // Extract detailed error message
                let errorMessage = 'Error al guardar';
                
                // Check for errors array in different possible locations
                let errorsArray = null;
                if (errorData.error?.details?.errors) {
                    errorsArray = errorData.error.details.errors;
                } else if (errorData.error?.errors) {
                    errorsArray = errorData.error.errors;
                } else if (errorData.details?.errors) {
                    errorsArray = errorData.details.errors;
                }
                
                if (errorsArray && Array.isArray(errorsArray)) {
                    console.error('Validation errors:', errorsArray);
                    errorMessage = errorsArray.map(e => `• ${e.field}: ${e.message}`).join('\n');
                } else if (errorData.error?.message) {
                    errorMessage = errorData.error.message;
                } else if (errorData.message) {
                    errorMessage = errorData.message;
                } else if (typeof errorData.error === 'string') {
                    errorMessage = errorData.error;
                }
                
                throw new Error(errorMessage);
            }

            const result = await response.json();
            console.log('Resource updated successfully:', result);

            // Update local data
            this.resourceData = result.data || result;

            console.log('✓ Resource info and skills saved successfully');
            return true;

        } catch (error) {
            console.error('Error saving resource info:', error);
            alert(`❌ Error al guardar información del recurso\n\n${error.message}`);
            return false;
        }
    }

    /**
     * Save capacity data
     * Saves absences as special assignments
     */
    async saveCapacity() {
        if (!this.gridApi) return;

        try {
            const { awsAccessKey, userTeam, authHeader } = this.getAuthCredentials();
            
            if (!awsAccessKey || !userTeam) {
                throw new Error('No authentication tokens found');
            }

            const capacityData = {};
            
            this.gridApi.forEachNode(node => {
                const rowType = node.data.rowType;
                capacityData[rowType] = {};
                
                Object.keys(node.data).forEach(key => {
                    if (key.match(/^\d{4}-\d{2}-\d{2}$/)) {
                        capacityData[rowType][key] = parseFloat(node.data[key]) || 0;
                    }
                });
            });

            console.log('Saving capacity data:', capacityData);

            // Get or create special "ABSENCES" project
            const absencesProject = await this.getOrCreateAbsencesProject(authHeader, userTeam);
            
            if (!absencesProject) {
                throw new Error('Could not create absences project');
            }

            // Delete existing absences for this resource
            await this.deleteExistingAbsences(this.resourceId, absencesProject.id, authHeader, userTeam);

            // Save new absences as assignments
            const absencesData = capacityData.ausencias || {};
            const savedCount = await this.saveAbsencesAsAssignments(
                this.resourceId, 
                absencesProject.id, 
                absencesData,
                authHeader,
                userTeam
            );

            alert(`✓ Datos guardados correctamente\n\n• Información del recurso actualizada\n• ${savedCount} días con ausencias/vacaciones guardados`);
            
            this.close();
            
        } catch (error) {
            console.error('Error saving capacity:', error);
            alert(`❌ Error al guardar capacidad\n\n${error.message}`);
        }
    }

    /**
     * Get or create the special ABSENCES project for this team
     */
    async getOrCreateAbsencesProject(authHeader, userTeam) {
        try {
            // Use team-specific code: ABSENCES-{TEAM}
            const projectCode = `ABSENCES-${userTeam}`;
            
            // Try to get existing ABSENCES project for this team
            const getResponse = await fetch(`${API_CONFIG.BASE_URL}/projects`, {
                headers: {
                    'Authorization': authHeader,
                    'x-user-team': userTeam
                }
            });
            
            if (getResponse.ok) {
                const data = await getResponse.json();
                const projects = data.data?.projects || data.projects || [];
                const absencesProject = projects.find(p => p.code === projectCode);
                
                if (absencesProject) {
                    console.log(`Found existing ${projectCode} project:`, absencesProject);
                    return absencesProject;
                }
            }
            
            // Create team-specific ABSENCES project if it doesn't exist
            console.log(`Creating ${projectCode} project for team ${userTeam}...`);
            const createResponse = await fetch(`${API_CONFIG.BASE_URL}/projects`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': authHeader,
                    'x-user-team': userTeam
                },
                body: JSON.stringify({
                    code: projectCode,
                    title: `Ausencias y Vacaciones - ${userTeam}`,
                    description: `Proyecto especial para tracking de ausencias y vacaciones del equipo ${userTeam}`,
                    type: 'Proyecto',
                    priority: 'Baja',
                    status: 1,
                    domain: 1,
                    team: userTeam,
                    startDate: new Date().toISOString().split('T')[0],
                    endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 10)).toISOString().split('T')[0]
                })
            });
            
            if (!createResponse.ok) {
                const errorData = await createResponse.json();
                
                // If project already exists (409), try to find it again
                if (createResponse.status === 409) {
                    console.log(`${projectCode} project already exists (409), searching again...`);
                    
                    const retryResponse = await fetch(`${API_CONFIG.BASE_URL}/projects`, {
                        headers: {
                            'Authorization': authHeader,
                            'x-user-team': userTeam
                        }
                    });
                    
                    if (retryResponse.ok) {
                        const retryData = await retryResponse.json();
                        const projects = retryData.data?.projects || retryData.projects || [];
                        const absencesProject = projects.find(p => p.code === projectCode);
                        
                        if (absencesProject) {
                            console.log(`✓ Found existing ${projectCode} project:`, absencesProject);
                            return absencesProject;
                        }
                    }
                    
                    console.error(`Could not find ${projectCode} project after 409 conflict`);
                    return null;
                }
                
                console.error(`Error creating ${projectCode} project:`, errorData);
                console.error('Full error details:', JSON.stringify(errorData, null, 2));
                
                let errorMessage = 'Unknown error';
                if (errorData.error?.details?.errors) {
                    errorMessage = errorData.error.details.errors.map(e => `${e.field}: ${e.message}`).join(', ');
                } else if (errorData.error?.message) {
                    errorMessage = errorData.error.message;
                } else if (errorData.message) {
                    errorMessage = errorData.message;
                }
                
                throw new Error(`Could not create absences project: ${errorMessage}`);
            }
            
            const result = await createResponse.json();
            console.log(`✓ Created ${projectCode} project successfully`);
            return result.data || result;
            
        } catch (error) {
            console.error('Error getting/creating absences project:', error);
            return null;
        }
    }

    /**
     * Delete existing absences for this resource
     */
    async deleteExistingAbsences(resourceId, projectId, authHeader, userTeam) {
        try {
            const response = await fetch(
                `${API_CONFIG.BASE_URL}/assignments?projectId=${projectId}&resourceId=${resourceId}`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': authHeader,
                        'x-user-team': userTeam
                    }
                }
            );
            
            if (!response.ok) return;
            
            const data = await response.json();
            const assignments = data.data?.assignments || data.assignments || [];
            
            // Delete each existing absence assignment
            for (const assignment of assignments) {
                await fetch(`${API_CONFIG.BASE_URL}/assignments/${assignment.id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': authHeader,
                        'x-user-team': userTeam
                    }
                });
            }
            
            console.log(`Deleted ${assignments.length} existing absences`);
            
        } catch (error) {
            console.error('Error deleting existing absences:', error);
        }
    }

    /**
     * Save absences as assignments
     */
    async saveAbsencesAsAssignments(resourceId, projectId, absencesData, authHeader, userTeam) {
        let savedCount = 0;
        
        for (const [date, hours] of Object.entries(absencesData)) {
            // Only save days with hours > 0
            if (hours <= 0) continue;
            
            try {
                const response = await fetch(`${API_CONFIG.BASE_URL}/assignments`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': authHeader,
                        'x-user-team': userTeam
                    },
                    body: JSON.stringify({
                        projectId: projectId,
                        resourceId: resourceId,
                        title: 'Ausencia/Vacación',
                        description: 'Registro de ausencia o vacación',
                        date: date,
                        hours: hours,
                        year: parseInt(date.split('-')[0]),
                        month: parseInt(date.split('-')[1])
                    })
                });
                
                if (response.ok) {
                    savedCount++;
                } else {
                    console.error(`Failed to save absence for ${date}`);
                }
                
            } catch (error) {
                console.error(`Error saving absence for ${date}:`, error);
            }
        }
        
        return savedCount;
    }

    /**
     * Update resource skills
     * Skills are updated via PUT /resources/{id} with skills array in body
     * This method is kept for compatibility but does nothing since skills
     * are already updated in saveResourceInfo()
     */
    async updateResourceSkills(resourceId, skills, authHeader, userTeam) {
        console.log('Skills already updated via PUT /resources/{id}');
        // Skills are updated in the main PUT request, no separate call needed
        return Promise.resolve();
    }

    /**
     * Show delete confirmation modal
     */
    showDeleteConfirmation() {
        console.log('showDeleteConfirmation called');
        console.log('Resource data:', this.resourceData);
        
        // Create confirmation modal HTML - same style as project deletion modal
        const confirmModalHTML = `
            <div id="delete-resource-confirmation-modal" class="modal-overlay active" style="z-index: 10000;">
                <div class="modal-container modal-small">
                    <div class="modal-header">
                        <h2 style="display: flex; align-items: center; gap: 0.5rem;">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 24px; height: 24px;">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                            </svg>
                            Confirmar Eliminación
                        </h2>
                        <button class="modal-close" id="close-delete-confirmation">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p style="margin: 0 0 1rem 0; font-size: 1rem; color: var(--text-primary);">
                            Se va a eliminar el recurso <strong>${this.resourceData?.name || 'este recurso'}</strong>
                        </p>
                        <div style="display: flex; align-items: flex-start; gap: 0.75rem; padding: 1rem; background: #FAE5E4; border-left: 4px solid #f59e0b; border-radius: var(--radius-md);">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 20px; height: 20px; flex-shrink: 0; color: #f59e0b; margin-top: 0.1rem;">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                            </svg>
                            <div style="font-size: 0.9rem; color: #92400e; line-height: 1.5;">
                                <strong>Advertencia:</strong> Esta acción desencadena la eliminación de todos los datos asociados al recurso, incluyendo todas sus asignaciones a proyectos.
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" id="cancel-delete-resource">Cancelar</button>
                        <button type="button" class="btn btn-danger" id="confirm-delete-resource">Eliminar Recurso</button>
                    </div>
                </div>
            </div>
        `;

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', confirmModalHTML);

        // Get modal element
        const confirmModal = document.getElementById('delete-resource-confirmation-modal');

        // Attach event listeners
        document.getElementById('close-delete-confirmation').addEventListener('click', () => {
            confirmModal.remove();
        });

        document.getElementById('cancel-delete-resource').addEventListener('click', () => {
            confirmModal.remove();
        });

        document.getElementById('confirm-delete-resource').addEventListener('click', async () => {
            confirmModal.remove();
            await this.deleteResource();
        });

        // Close on overlay click
        confirmModal.addEventListener('click', (e) => {
            if (e.target === confirmModal) {
                confirmModal.remove();
            }
        });
    }

    /**
     * Delete resource and all its assignments
     */
    async deleteResource() {
        // Prevent double deletion
        if (this.isDeleting) {
            console.log('Delete already in progress, ignoring duplicate request');
            return;
        }
        
        // Set deleting flag
        this.isDeleting = true;
        
        try {
            const { awsAccessKey, userTeam, authHeader } = this.getAuthCredentials();
            
            if (!awsAccessKey || !userTeam) {
                throw new Error('No authentication tokens found');
            }

            console.log('Deleting resource:', this.resourceId);

            // Delete resource (backend should cascade delete assignments)
            const response = await fetch(`${API_CONFIG.BASE_URL}/resources/${this.resourceId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': authHeader,
                    'x-user-team': userTeam
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Error deleting resource:', errorData);
                throw new Error(errorData.message || 'Error al eliminar el recurso');
            }

            console.log('Resource deleted successfully');

            // Show success message
            alert(`✓ Recurso eliminado correctamente\n\nEl recurso "${this.resourceData?.name}" y todas sus asignaciones han sido eliminados.`);

            // Close modal and reload capacity data
            this.close();

        } catch (error) {
            console.error('Error deleting resource:', error);
            alert(`❌ Error al eliminar el recurso\n\n${error.message}`);
        } finally {
            // Reset deleting flag
            this.isDeleting = false;
        }
    }
}
