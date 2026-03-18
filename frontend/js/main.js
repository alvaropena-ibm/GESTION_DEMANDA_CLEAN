 // Main Application Entry Point

import appState from './state/AppState.js';
import apiService from './services/api.js';
import projectsManager from './managers/ProjectsManager.js';
import tasksManager from './managers/TasksManager.js';
import resourcesManager from './managers/ResourcesManager.js';
import assignmentsManager from './managers/AssignmentsManager.js';
import { initializeTabs } from './components/tabs.js';
import { initializeAllCharts } from './components/charts.js';
import { initializeKPIs } from './components/kpi.js';
import { initializeEffortTrackingTable, loadPreviousEffortPage, loadNextEffortPage } from './components/effortTracking.js';
import { 
    initProjectModal, 
    openCreateProjectModal, 
    openEditProjectModal, 
    openDeleteModal 
} from './components/projectModal.js';
import { 
    initResourceModal,
    openCreateResourceModal,
    openEditResourceModal,
    openDeleteResourceModal
} from './components/resourceModal.js';
import { TaskModal } from './components/taskModal.js';
import { ConceptTasksModal } from './components/conceptTasksModal.js';
import { CreateTaskModal } from './components/createTaskModal.js';
import { ResourceCapacityModal } from './components/resourceCapacityModal.js';
import { JiraModal } from './components/jiraModal.js';
import jiraTasksModal from './components/jiraTasksModal.js';
import { initializeClaimModal } from './components/claimModal.js';
import { openAssignmentView } from './components/assignmentView.js';
import { initializeResourceCapacity } from './components/resourceCapacity.js';
import { initializeCalendarView, loadCalendarView } from './components/calendarView.js';
import { projectMetadata, projectSkillBreakdown, monthKeys, API_CONFIG } from './config/data.js';
import { 
    getPriorityText, 
    getPriorityClass, 
    getStatusText, 
    getStatusClass,
    getDomainText,
    truncateText,
    formatNumber,
    getPeriodDateRange
} from './utils/helpers.js';

// Make getPeriodDateRange globally available for charts
window.getPeriodDateRange = getPeriodDateRange;

// Global modal instances
let taskModal = null;
let conceptTasksModal = null;
let createTaskModal = null;
let capacityModal = null;
let jiraModal = null;

/**
 * Initialize the application
 */
async function initializeApp() {
    console.log('🚀🚀🚀 INIT APP START - VERSION 2.0 🚀🚀🚀');
    console.log('Initializing Capacity Planning Application...');
    
    // Check if we need to restore a specific tab
    const activeTab = sessionStorage.getItem('activeTab');
    if (activeTab) {
        console.log('Restoring active tab:', activeTab);
        sessionStorage.removeItem('activeTab'); // Clear the flag
        
        // Wait a bit for DOM to be ready
        setTimeout(() => {
            const tabButton = document.querySelector(`[data-tab="${activeTab}"]`);
            if (tabButton) {
                tabButton.click();
                console.log('Tab restored:', activeTab);
            }
        }, 100);
    }
    
    // Initialize components
    initializeTabs();
    
    // Set initial period from selector BEFORE initializing charts
    const periodSelector = document.getElementById('period-selector');
    if (periodSelector) {
        window.currentPeriod = periodSelector.value || 'next12';
        console.log('Initial period set to:', window.currentPeriod);
    }
    
    initProjectModal();
    initResourceModal();
    initializeResourceCapacity();
    initializeClaimModal();
    initializeCalendarView();
    
    // Initialize modals
    taskModal = new TaskModal();
    taskModal.init();
    
    conceptTasksModal = new ConceptTasksModal();
    conceptTasksModal.init();
    
    createTaskModal = new CreateTaskModal();
    createTaskModal.init();
    
    capacityModal = new ResourceCapacityModal();
    capacityModal.init();
    
    jiraModal = new JiraModal();
    jiraModal.init();
    
    // Initialize jiraTasksModal
    jiraTasksModal.init();
    
    // Make modals globally available
    window.conceptTasksModal = conceptTasksModal;
    window.createTaskModal = createTaskModal;
    window.capacityModal = capacityModal;
    window.jiraModal = jiraModal;
    window.jiraTasksModal = jiraTasksModal;
    console.log('Modals initialized:', { conceptTasksModal: !!window.conceptTasksModal, createTaskModal: !!window.createTaskModal, capacityModal: !!window.capacityModal, jiraModal: !!window.jiraModal, jiraTasksModal: !!window.jiraTasksModal });
    
    // Load all data once at startup
    await loadInitialData();
    
    // Update UI with loaded data
    console.log('🔵 About to call updateMatrixKPIs...');
    updateMatrixKPIs();
    console.log('✅ updateMatrixKPIs completed');
    
    console.log('🔵 About to call populateMatrixTable...');
    await populateMatrixTable();
    console.log('✅ populateMatrixTable completed');
    
    console.log('🔵 About to call initializeEffortTrackingTable...');
    await initializeEffortTrackingTable();
    console.log('✅ initializeEffortTrackingTable completed');
    
    // Initialize event listeners
    initializeEventListeners();
    
    // Apply initial period filter to KPIs
    const initialPeriod = window.currentPeriod || 'next12';
    console.log('🎯 About to call updateDashboardByPeriod with period:', initialPeriod);
    await updateDashboardByPeriod(initialPeriod);
    console.log('✅ updateDashboardByPeriod completed');
    
    // Check if we need to activate the projects tab after Jira import
    const activateProjectsTab = sessionStorage.getItem('activate_projects_tab');
    if (activateProjectsTab === 'true') {
        // Remove the flag
        sessionStorage.removeItem('activate_projects_tab');
        
        // Activate the projects tab
        console.log('Activating projects tab after Jira import...');
        
        // Deactivate all tabs
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        // Activate projects tab
        const projectsTabButton = document.querySelector('.tab-button[data-tab="projects-tab"]');
        const projectsTabContent = document.getElementById('projects-tab');
        
        if (projectsTabButton && projectsTabContent) {
            projectsTabButton.classList.add('active');
            projectsTabContent.classList.add('active');
            console.log('Projects tab activated successfully');
        }
    }
    
    console.log('Application initialized successfully!');
}

/**
 * Load all initial data once (optimized to avoid redundant API calls)
 */
async function loadInitialData() {
    console.log('Loading initial data...');
    const startTime = performance.now();
    
    try {
        // Load all data in parallel for better performance
        const [projects, resources, assignments] = await Promise.all([
            projectsManager.loadProjects(),
            resourcesManager.loadResources(),
            assignmentsManager.loadAssignments()
        ]);
        
        // CRITICAL: Assign to window.allProjects FIRST (needed by charts)
        window.allProjects = projects.filter(p => !p.code.startsWith('ABSENCES'));
        window.allProjectsWithAbsences = projects;
        console.log('✅ window.allProjects assigned:', window.allProjects.length, 'projects');
        
        // Store in AppState for caching
        appState.setProjects(window.allProjects);
        appState.setProjectsWithAbsences(projects);
        appState.setResources(resources);
        appState.setAssignments(assignments);
        
        // Update projects table
        updateProjectsTable(projects);
        
        const endTime = performance.now();
        console.log(`Initial data loaded in ${Math.round(endTime - startTime)}ms:`, {
            projects: projects.length,
            resources: resources.length,
            assignments: assignments.length
        });
        
    } catch (error) {
        console.error('Error loading initial data:', error);
    }
}

/**
 * Load projects from API and populate the table
 */
async function loadProjectsFromAPI() {
    try {
        console.log('Loading projects from API...');
        
        // Use projectsManager to load projects
        const projects = await projectsManager.loadProjects();
        
        // Update table
        updateProjectsTable(projects);
        
        console.log(`Loaded ${projects.length} projects from API`);
        
    } catch (error) {
        console.error('Error loading projects from API:', error);
        // Don't show error notification on page load, just log it
    }
}

/**
 * Initialize event listeners
 */
function initializeEventListeners() {
    // Period selector
    const periodSelector = document.getElementById('period-selector');
    if (periodSelector) {
        periodSelector.addEventListener('change', async function() {
            console.log(`Período seleccionado: ${this.value}`);
            await updateDashboardByPeriod(this.value);
        });
    }
    
    // Project search
    const projectSearch = document.getElementById('project-search');
    if (projectSearch) {
        projectSearch.addEventListener('keyup', function() {
            filterProjects(this.value);
        });
    }
    
    // Add resource button
    const addResourceBtn = document.getElementById('add-resource-btn');
    if (addResourceBtn) {
        addResourceBtn.addEventListener('click', function() {
            console.log('Add resource button clicked!');
            openCreateResourceModal();
        });
    }
    
    // Add project button
    const addProjectBtn = document.getElementById('add-project-btn');
    console.log('Add project button found:', addProjectBtn);
    if (addProjectBtn) {
        addProjectBtn.addEventListener('click', function() {
            console.log('Add project button clicked!');
            console.log('openCreateProjectModal function:', typeof openCreateProjectModal);
            openCreateProjectModal();
        });
        console.log('Event listener attached to add-project-btn');
    } else {
        console.error('Add project button NOT found!');
    }
    
    // Import Jira button
    const importJiraBtn = document.getElementById('import-jira-btn');
    if (importJiraBtn) {
        importJiraBtn.addEventListener('click', function() {
            importFromJira();
        });
    }
    
    // ==================== GESTIÓN DE TAREAS BUTTONS ====================
    
    // Add task project button
    const addTaskProjectBtn = document.getElementById('add-task-project-btn');
    if (addTaskProjectBtn) {
        addTaskProjectBtn.addEventListener('click', function() {
            console.log('Add task project button clicked!');
            openCreateProjectModal(); // Opens the project modal (same as projects tab)
        });
    }
    
    // Import task from Jira button (SCOM source)
    const importTaskJiraBtn = document.getElementById('import-task-jira-btn');
    if (importTaskJiraBtn) {
        importTaskJiraBtn.addEventListener('click', function() {
            console.log('Import task from Jira button clicked!');
            importFromJiraForTasks();
        });
    }
    
    // Task project search
    const taskProjectSearch = document.getElementById('task-project-search');
    if (taskProjectSearch) {
        taskProjectSearch.addEventListener('keyup', function() {
            filterTasks(this.value);
        });
    }
    
    // Tab change listener - reload data when tabs are opened
    document.addEventListener('click', function(e) {
        const tabButton = e.target.closest('.tab-button');
        if (tabButton) {
            const tabName = tabButton.getAttribute('data-tab');
            
            if (tabName === 'projects-tab') {
                console.log('Projects tab opened, reloading projects...');
                loadProjectsFromAPI();
            } else if (tabName === 'tasks-tab') {
                console.log('Tasks tab opened, reloading tasks...');
                loadTasksFromAPI();
            } else if (tabName === 'calendar-tab') {
                console.log('Calendar tab opened, loading calendar view...');
                loadCalendarView();
            }
        }
    });
    
    // Expand icons for project skills and resource projects
    document.addEventListener('click', function(e) {
        const expandIcon = e.target.closest('.expand-icon');
        if (expandIcon) {
            const projectCode = expandIcon.getAttribute('data-project');
            const resourceId = expandIcon.getAttribute('data-resource');
            
            if (projectCode) {
                toggleProjectSkills(projectCode);
            } else if (resourceId) {
                toggleResourceProjects(resourceId, expandIcon);
            }
        }
    });
    
    // Action icons
    document.addEventListener('click', function(e) {
        const actionIcon = e.target.closest('.action-icon');
        if (actionIcon) {
            const action = actionIcon.getAttribute('data-action');
            const projectId = actionIcon.getAttribute('data-project');
            const taskId = actionIcon.getAttribute('data-task');
            
            // Handle project actions
            if (action && projectId) {
                if (action === 'edit') {
                    editProject(projectId);
                } else if (action === 'tasks') {
                    openTasksModal(projectId);
                } else if (action === 'resources') {
                    openConceptTasksModal(projectId);
                } else if (action === 'delete') {
                    deleteProject(projectId);
                } else if (action === 'sync') {
                    syncWithJira(projectId);
                }
            }
            
            // Handle task actions (from Gestión de Trabajo tab)
            if (action) {
                if (action === 'edit' && taskId) {
                    editTask(taskId);
                } else if (action === 'delete' && taskId) {
                    deleteTask(taskId);
                } else if (action === 'assign-resources') {
                    // Get task ID from data attribute
                    const jiraTaskId = actionIcon.getAttribute('data-task-id');
                    const taskCode = actionIcon.getAttribute('data-task');
                    assignResourcesToTask(jiraTaskId, taskCode);
                } else if (action === 'concept-tasks') {
                    // Get task ID and code from data attributes
                    const jiraTaskId = actionIcon.getAttribute('data-task-id');
                    const taskCode = actionIcon.getAttribute('data-task-code');
                    console.log('Concept tasks icon clicked:', { jiraTaskId, taskCode });
                    openConceptTasksForJiraTask(jiraTaskId, taskCode);
                }
            }
        }
    });
}

/**
 * Open tasks modal for a project (Resource Assignment with AG Grid)
 */
function openTasksModal(projectCode) {
    console.log('Opening resource assignment modal for project:', projectCode);
    
    if (!taskModal) {
        console.error('Task modal not initialized');
        return;
    }
    
    // Find project in allProjects array
    const project = allProjects.find(p => p.code === projectCode);
    
    if (!project) {
        console.error(`Project ${projectCode} not found`);
        return;
    }
    
    // Load existing tasks from storage
    const existingTasks = TaskModal.loadFromStorage(project.code);
    
    // Open modal with project data and dates
    taskModal.open(project.code, project.title, existingTasks, project.startDate, project.endDate);
}

/**
 * Open concept tasks modal for a project (Conceptualization Tasks)
 */
function openConceptTasksModal(projectCode) {
    console.log('Opening concept tasks list for project:', projectCode);
    
    // Find project in allProjects array
    const project = allProjects.find(p => p.code === projectCode);
    
    if (!project) {
        console.error(`Project ${projectCode} not found`);
        return;
    }
    
    // Open assignment view which shows the list of concept tasks
    openAssignmentView(project.id, project.code, project.title);
}

/**
 * Assign resources to a project
 */
function assignResources(projectCode) {
    console.log('Opening assignment view for project:', projectCode);
    
    // Find project in allProjects array
    const project = allProjects.find(p => p.code === projectCode);
    
    if (!project) {
        console.error(`Project ${projectCode} not found`);
        return;
    }
    
    // Open assignment view with project ID, code, and title
    openAssignmentView(project.id, project.code, project.title);
}

/**
 * Assign resources to a task (jira_task) - Opens AG Grid modal
 */
function assignResourcesToTask(jiraTaskId, taskCode) {
    console.log('Opening AG Grid resource assignment modal for task:', jiraTaskId, taskCode);
    
    if (!taskModal) {
        console.error('Task modal not initialized');
        return;
    }
    
    // Find task in allTasks array
    const task = allTasks.find(t => t.id === jiraTaskId);
    
    if (!task) {
        console.error(`Task ${taskCode} not found in allTasks`);
        return;
    }
    
    // Load existing tasks from storage (if any)
    const existingTasks = TaskModal.loadFromStorage(task.code);
    
    // Open AG Grid modal with task ID (UUID), code, title, and dates
    // Pass jiraTaskId as the ID parameter so API calls use the correct UUID
    taskModal.openForJiraTask(jiraTaskId, task.code, task.title, existingTasks, task.startDate, task.endDate);
}

/**
 * Open concept tasks modal for a jira_task (from Gestión de Trabajo tab)
 * Shows the list of concept tasks associated with this jira_task
 */
function openConceptTasksForJiraTask(jiraTaskId, taskCode) {
    console.log('Opening concept tasks list for jira_task:', jiraTaskId, taskCode);
    
    // Find task in allTasks array
    const task = allTasks.find(t => t.id === jiraTaskId);
    
    if (!task) {
        console.error(`Task ${taskCode} not found in allTasks`);
        return;
    }
    
    // Open assignment view which shows the list of concept tasks
    // Pass jiraTaskId (UUID) as the ID, taskCode, and task title
    openAssignmentView(jiraTaskId, task.code, task.title);
}

/**
 * Filter projects in table
 */
function filterProjects(searchTerm) {
    const tableBody = document.getElementById('projects-table-body');
    if (!tableBody) return;
    
    const rows = tableBody.getElementsByTagName('tr');
    const term = searchTerm.toLowerCase();
    
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const cells = row.getElementsByTagName('td');
        let found = false;
        
        if (cells.length > 0) {
            const id = cells[0].textContent.toLowerCase();
            const title = cells[1].textContent.toLowerCase();
            const description = cells[2].textContent.toLowerCase();
            
            if (id.includes(term) || title.includes(term) || description.includes(term)) {
                found = true;
            }
        }
        
        row.style.display = found ? '' : 'none';
    }
}

/**
 * Toggle project resources breakdown - show resources assigned to project
 */
async function toggleProjectSkills(projectCode) {
    console.log('Toggling resources for project:', projectCode);
    
    // Find all resource rows for this project
    const resourceRows = document.querySelectorAll(`.resource-row[data-project="${projectCode}"]`);
    
    // Find the expand icon
    const expandIcon = document.querySelector(`.expand-icon[data-project="${projectCode}"]`);
    
    if (resourceRows.length === 0) {
        // No rows exist yet, need to create them
        await loadProjectResources(projectCode, expandIcon);
    } else {
        // Rows exist, toggle visibility
        const isHidden = resourceRows[0].style.display === 'none';
        
        resourceRows.forEach(row => {
            row.style.display = isHidden ? 'table-row' : 'none';
        });
        
        // Toggle icon
        if (expandIcon) {
            expandIcon.textContent = isHidden ? '−' : '+';
        }
    }
}

/**
 * Load and display resources assigned to a project
 */
async function loadProjectResources(projectCode, expandIcon) {
    try {
        // Find the project
        const project = window.allProjects?.find(p => p.code === projectCode);
        if (!project) {
            console.error('Project not found:', projectCode);
            return;
        }
        
        // Use projectsManager to load project resources
        const resourceSkillHoursMap = await projectsManager.loadProjectResources(project.id);
        
        // Find the project row in the table
        const projectRow = document.querySelector(`.project-row[data-project="${projectCode}"]`);
        if (!projectRow) {
            console.error('Project row not found in table');
            return;
        }
        
        // Create resource rows
        const tableBody = projectRow.parentElement;
        const projectRowIndex = Array.from(tableBody.children).indexOf(projectRow);
        
        // Insert resource rows after project row
        let insertIndex = projectRowIndex + 1;
        
        resourceSkillHoursMap.forEach((data, key) => {
            const resourceRow = document.createElement('tr');
            resourceRow.className = 'resource-row';
            resourceRow.setAttribute('data-project', projectCode);
            resourceRow.style.backgroundColor = '#f9fafb';
            resourceRow.style.fontStyle = 'italic';
            
            // Build monthly cells with hours
            const monthlyCells = data.monthlyHours.map((hours, index) => {
                const display = hours > 0 ? Math.round(hours) : '-';
                return `<td style="text-align: center; font-size: 0.85em;">${display}</td>`;
            }).join('');
            
            // Create cells: empty first cell, resource name + skill, total hours in separate column, then 12 monthly cells
            resourceRow.innerHTML = `
                <td style="text-align: center;"></td>
                <td colspan="2" style="text-align: left; padding-left: 2rem;">
                    ${data.name} - ${data.skill}
                </td>
                <td style="text-align: center; font-weight: bold;">${formatNumber(Math.round(data.totalHours))}</td>
                ${monthlyCells}
            `;
            
            // Insert at the correct position
            if (insertIndex < tableBody.children.length) {
                tableBody.insertBefore(resourceRow, tableBody.children[insertIndex]);
            } else {
                tableBody.appendChild(resourceRow);
            }
            
            insertIndex++;
        });
        
        // Change icon to minus
        if (expandIcon) {
            expandIcon.textContent = '−';
        }
        
        console.log(`Loaded ${resourceSkillHoursMap.size} resource-skill combinations for project ${projectCode}`);
        
    } catch (error) {
        console.error('Error loading project resources:', error);
        alert('Error al cargar recursos del proyecto');
    }
}

/**
 * Toggle resource projects visibility
 */
function toggleResourceProjects(resourceId, expandIcon) {
    // Find all skill rows for this resource
    const skillRows = document.querySelectorAll(`.skill-row[data-resource="${resourceId}"]`);
    
    if (skillRows.length === 0) return;
    
    // Check current state
    const isExpanded = skillRows[0].style.display !== 'none';
    
    // Toggle visibility
    skillRows.forEach(row => {
        row.style.display = isExpanded ? 'none' : 'table-row';
    });
    
    // Toggle icon
    expandIcon.textContent = isExpanded ? '+' : '−';
}

/**
 * Edit project
 */
function editProject(projectCode) {
    console.log('Edit project called for code:', projectCode);
    
    // Find project in allProjects array (loaded from API)
    const project = allProjects.find(p => p.code === projectCode);
    
    if (!project) {
        console.error(`Project ${projectCode} not found in allProjects`);
        return;
    }
    
    console.log('Project found for editing:', project);
    
    // The project object from API already has the correct structure
    // that openEditProjectModal expects: {id, code, type, title, description, domain, priority, startDate, endDate, status}
    openEditProjectModal(project);
}

/**
 * Delete project
 */
function deleteProject(projectCode) {
    console.log('Delete project called for code:', projectCode);
    
    // Find project in allProjects array (loaded from API)
    const project = allProjects.find(p => p.code === projectCode);
    
    if (!project) {
        console.error(`Project ${projectCode} not found in allProjects`);
        // Fallback: try to find in projectMetadata (for backward compatibility)
        const metadata = projectMetadata[projectCode];
        if (metadata) {
            const fallbackProject = {
                id: metadata.id || projectCode,
                code: projectCode,
                title: metadata.title
            };
            openDeleteModal(fallbackProject);
            return;
        }
        console.error(`Project ${projectCode} not found anywhere`);
        return;
    }
    
    console.log('Project found:', project);
    
    // Create project object for modal with the correct structure
    const projectForModal = {
        id: project.id,
        code: project.code,
        title: project.title
    };
    
    openDeleteModal(projectForModal);
}

/**
 * Sync with Jira
 */
function syncWithJira(projectId) {
    alert(`Sincronizando proyecto ${projectId} con Jira...`);
    setTimeout(() => {
        alert('Sincronización completada (simulación)');
    }, 1000);
}

/**
 * Import from Jira
 */
function importFromJira() {
    console.log('=== importFromJira function called ===');
    console.log('window.jiraModal:', window.jiraModal);
    
    if (window.jiraModal) {
        console.log('Opening jiraModal...');
        window.jiraModal.open();
    } else {
        console.error('Jira modal not initialized');
        console.error('Available window properties:', Object.keys(window).filter(k => k.includes('jira') || k.includes('Modal')));
        alert('Error: Modal de Jira no está inicializado. Revisa la consola para más detalles.');
    }
}

/**
 * Update Matrix KPIs with real data
 */
async function updateMatrixKPIs() {
    // Count projects by type from real data (excluding ABSENCES)
    let totalProjects = 0;
    let evolutivosCount = 0;
    let proyectosCount = 0;
    
    // Use window.allProjects array (loaded from API, already filtered without ABSENCES)
    if (window.allProjects && Array.isArray(window.allProjects)) {
        // Filter out ABSENCES projects from KPI calculation
        const projectsForKPI = window.allProjects.filter(p => !p.code.startsWith('ABSENCES'));
        
        totalProjects = projectsForKPI.length;
        
        projectsForKPI.forEach(project => {
            if (project.type === 'Evolutivo') {
                evolutivosCount++;
            } else if (project.type === 'Proyecto') {
                proyectosCount++;
            }
        });
    }
    
    // Update Matrix tab elements
    const matrixTotalElement = document.getElementById('matrix-total-projects');
    const matrixEvolutivosElement = document.getElementById('matrix-evolutivos-count');
    const matrixProyectosElement = document.getElementById('matrix-proyectos-count');
    
    if (matrixTotalElement) matrixTotalElement.textContent = totalProjects;
    if (matrixEvolutivosElement) matrixEvolutivosElement.textContent = evolutivosCount;
    if (matrixProyectosElement) matrixProyectosElement.textContent = proyectosCount;
    
    // Update Projects tab elements
    const projectsTotalElement = document.getElementById('projects-total-count');
    const projectsEvolutivosElement = document.getElementById('projects-evolutivos-count');
    const projectsProyectosElement = document.getElementById('projects-proyectos-count');
    
    if (projectsTotalElement) projectsTotalElement.textContent = totalProjects;
    if (projectsEvolutivosElement) projectsEvolutivosElement.textContent = evolutivosCount;
    if (projectsProyectosElement) projectsProyectosElement.textContent = proyectosCount;
    
    // Calculate average hours per project from real assignments
    await updateAverageHoursKPI();
    
    console.log('Matrix and Projects KPIs updated:', { totalProjects, evolutivosCount, proyectosCount });
}

/**
 * Update Average Hours per Project KPI with real data from assignments
 */
async function updateAverageHoursKPI() {
    try {
        // Use projectsManager to calculate average hours
        const avgHours = await projectsManager.calculateAverageHours();
        
        // Update UI elements
        const avgTotalElement = document.getElementById('matrix-avg-hours-project');
        const avgEvolutivosElement = document.getElementById('matrix-avg-evolutivos');
        const avgProyectosElement = document.getElementById('matrix-avg-proyectos');
        
        if (avgTotalElement) avgTotalElement.textContent = formatNumber(avgHours.avgTotal);
        if (avgEvolutivosElement) avgEvolutivosElement.textContent = formatNumber(avgHours.avgEvolutivos);
        if (avgProyectosElement) avgProyectosElement.textContent = formatNumber(avgHours.avgProyectos);
        
        console.log('Average hours KPI updated:', avgHours);
        
    } catch (error) {
        console.error('Error updating average hours KPI:', error);
    }
}

// Pagination state - now managed by AppState
// Access via: appState.getCurrentPage(), appState.get('projects.perPage'), appState.getProjects()
let currentPage = 1;
const projectsPerPage = 10;
let allProjects = []; // Keep for backward compatibility, but use appState as source of truth

// Tasks pagination state
let currentTasksPage = 1;
const tasksPerPage = 10;
let allTasks = [];

/**
 * Update projects table with new data from API
 * Called after CRUD operations to refresh the table
 * @param {Array} projects - Array of project objects from API
 */
async function updateProjectsTable(projects) {
    const tableBody = document.getElementById('projects-table-body');
    if (!tableBody) {
        console.warn('Projects table body not found');
        return;
    }
    
    // Store all projects (including ABSENCES)
    const allProjectsRaw = projects || [];
    
    // INCLUDE ABSENCES projects in the main table
    allProjects = [...allProjectsRaw];
    
    console.log('All projects loaded (including ABSENCES):', allProjects.length);
    
    // Sort projects by numeric ID (descending)
    // Extract numeric part from code (e.g., "NC-734" -> 734)
    allProjects.sort((a, b) => {
        const getNumericId = (code) => {
            const match = code.match(/\d+/);
            return match ? parseInt(match[0], 10) : 0;
        };
        return getNumericId(b.code) - getNumericId(a.code); // Descending order
    });
    
    // Make allProjects globally available (without ABSENCES)
    window.allProjects = allProjects;
    
    // Create separate array WITH ABSENCES for Matrix table (Desglose de Proyectos por Recurso)
    const allProjectsWithAbsences = [...allProjectsRaw];
    allProjectsWithAbsences.sort((a, b) => {
        const getNumericId = (code) => {
            const match = code.match(/\d+/);
            return match ? parseInt(match[0], 10) : 0;
        };
        return getNumericId(b.code) - getNumericId(a.code);
    });
    window.allProjectsWithAbsences = allProjectsWithAbsences;
    
    // Update KPIs immediately after loading projects (without ABSENCES)
    updateMatrixKPIs();
    
    // Calculate both committed and estimated hours for each project
    const { committedHoursMap, estimatedHoursMap } = await calculateProjectHours(allProjects);
    
    // Clear existing rows
    tableBody.innerHTML = '';
    
    // Check if there are no projects (excluding ABSENCES)
    if (!allProjects || allProjects.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="10" style="text-align: center; padding: 2rem; color: #6b7280;">
                No hay proyectos disponibles. Haz clic en "Añadir Proyecto" para crear uno.
            </td>
        `;
        tableBody.appendChild(row);
        console.log('No projects to display');
        
        // Hide pagination if no projects
        const paginationContainer = document.getElementById('pagination-container');
        if (paginationContainer) {
            paginationContainer.style.display = 'none';
        }
        return;
    }
    
    // Calculate pagination
    const totalPages = Math.ceil(allProjects.length / projectsPerPage);
    const startIndex = (currentPage - 1) * projectsPerPage;
    const endIndex = startIndex + projectsPerPage;
    const projectsToDisplay = allProjects.slice(startIndex, endIndex);
    
    // Populate with paginated data
    projectsToDisplay.forEach(project => {
        const row = document.createElement('tr');
        
        // Debug logging
        console.log('Project data:', {
            code: project.code,
            domain: project.domain,
            domainType: typeof project.domain,
            status: project.status,
            statusType: typeof project.status,
            type: project.type
        });
        
        const priorityClass = getPriorityClass(project.priority);
        const priorityText = getPriorityText(project.priority);
        const statusClass = getStatusClass(project.status);
        const statusText = getStatusText(project.status);
        const domainText = getDomainText(project.domain);
        
        console.log('Converted values:', {
            code: project.code,
            domainText: domainText,
            statusText: statusText
        });
        
        // Format dates if they exist
        // API returns start_date and end_date (snake_case)
        const startDate = (project.startDate || project.start_date) ? new Date(project.startDate || project.start_date).toLocaleDateString('es-ES') : '-';
        const endDate = (project.endDate || project.end_date) ? new Date(project.endDate || project.end_date).toLocaleDateString('es-ES') : '-';
        
        // Get committed hours (from assignments) and estimated hours (from concept_tasks)
        const committedHours = committedHoursMap.get(project.id) || 0;
        const committedHoursDisplay = committedHours > 0 ? formatNumber(Math.round(committedHours)) : '-';
        
        const estimatedHours = estimatedHoursMap.get(project.id) || 0;
        const estimatedHoursDisplay = estimatedHours > 0 ? formatNumber(Math.round(estimatedHours)) : '-';
        
        // Get delivery hours
        const deliveryHours = project.deliveryHours || project.delivery_hours || 0;
        const deliveryHoursDisplay = deliveryHours > 0 ? formatNumber(Math.round(deliveryHours)) : '-';
        
        // Check if this is an ABSENCES project
        const isAbsencesProject = project.code.startsWith('ABSENCES-');
        
        // Create Jira link for project code (only if not ABSENCES)
        const jiraBaseUrl = 'https://naturgy-adn.atlassian.net/browse/';
        const projectCodeDisplay = isAbsencesProject 
            ? `<strong>${project.code}</strong>`
            : `<a href="${jiraBaseUrl}${project.code}" target="_blank" rel="noopener noreferrer" style="color: #0052CC; text-decoration: none; font-weight: bold;">${project.code}</a>`;
        
        row.innerHTML = `
            <td style="text-align: left;">${projectCodeDisplay}</td>
            <td style="text-align: left;">${project.title}</td>
            <td style="text-align: left;">${truncateText(project.description || '', 50)}</td>
            <td style="text-align: left;">${isAbsencesProject ? '-' : domainText}</td>
            <td style="text-align: center;"><strong>${estimatedHoursDisplay}</strong></td>
            <td style="text-align: center;"><strong>${deliveryHoursDisplay}</strong></td>
            <td style="text-align: center;"><strong>${committedHoursDisplay}</strong></td>
            <td style="text-align: center;">${isAbsencesProject ? '-' : startDate}</td>
            <td style="text-align: center;">${isAbsencesProject ? '-' : endDate}</td>
            <td style="text-align: center;">
                ${isAbsencesProject ? '-' : `<span class="status-badge ${statusClass}">${statusText}</span>`}
            </td>
            <td style="text-align: center;">${isAbsencesProject ? '-' : (project.type || '-')}</td>
            <td>
                ${!isAbsencesProject ? `
                <span class="action-icon" data-action="edit" data-project="${project.code}" title="Editar">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 16px; height: 16px;">
                        <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                    </svg>
                </span>
                ` : ''}
                <span class="action-icon" data-action="tasks" data-project="${project.code}" title="Asignación de Recursos">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 16px; height: 16px;">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                    </svg>
                </span>
                ${!isAbsencesProject ? `
                <span class="action-icon" data-action="resources" data-project="${project.code}" title="Tareas Conceptualización">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 16px; height: 16px;">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                    </svg>
                </span>
                <span class="action-icon" data-action="delete" data-project="${project.code}" title="Eliminar">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 16px; height: 16px;">
                        <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                </span>
                ` : ''}
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // Render pagination controls
    renderPagination(totalPages);
    
    console.log(`Projects table updated with ${allProjects.length} projects (showing page ${currentPage} of ${totalPages})`);
}

/**
 * Render pagination controls
 * @param {number} totalPages - Total number of pages
 */
function renderPagination(totalPages) {
    const paginationContainer = document.getElementById('pagination-container');
    
    if (!paginationContainer) {
        console.warn('Pagination container not found');
        return;
    }
    
    // Hide pagination if only one page or no projects
    if (totalPages <= 1) {
        paginationContainer.style.display = 'none';
        return;
    }
    
    // Calculate display info
    const startIndex = (currentPage - 1) * projectsPerPage + 1;
    const endIndex = Math.min(currentPage * projectsPerPage, allProjects.length);
    
    // Update centered info text
    const infoText = document.getElementById('projects-info-text');
    if (infoText) {
        infoText.textContent = `Showing ${startIndex}-${endIndex} of ${allProjects.length} projects`;
    }
    
    // Render pagination buttons in the container
    paginationContainer.innerHTML = `
        <button id="prev-projects-btn" class="btn" style="margin-right: 5px;" ${currentPage === 1 ? 'disabled' : ''}>
            ←
        </button>
        <span id="projects-page-info">Page ${currentPage} of ${totalPages}</span>
        <button id="next-projects-btn" class="btn" style="margin-left: 5px;" ${currentPage === totalPages ? 'disabled' : ''}>
            →
        </button>
    `;
    
    // Add event listeners
    const prevButton = document.getElementById('prev-projects-btn');
    const nextButton = document.getElementById('next-projects-btn');
    
    if (prevButton) {
        prevButton.onclick = () => {
            if (currentPage > 1) {
                currentPage--;
                updateProjectsTable(allProjects);
            }
        };
    }
    
    if (nextButton) {
        nextButton.onclick = () => {
            if (currentPage < totalPages) {
                currentPage++;
                updateProjectsTable(allProjects);
            }
        };
    }
}

// Debounce timer for dashboard updates
let dashboardUpdateTimer = null;

/**
 * Update dashboard (KPIs and charts) after CRUD operations
 * Optimized to update only what changed and with debouncing
 * @param {Object} options - Update options
 * @param {boolean} options.projects - Update projects-related data
 * @param {boolean} options.resources - Update resources-related data
 * @param {boolean} options.assignments - Update assignments-related data
 * @param {boolean} options.immediate - Skip debouncing
 */
function updateDashboard(options = {}) {
    const {
        projects = true,
        resources = false,
        assignments = false,
        immediate = false
    } = options;
    
    // Clear existing timer
    if (dashboardUpdateTimer) {
        clearTimeout(dashboardUpdateTimer);
    }
    
    const performUpdate = async () => {
        console.log('Updating dashboard...', { projects, resources, assignments });
        const startTime = performance.now();
        
        try {
            // Only update what changed
            if (projects) {
                // Reload projects data
                const updatedProjects = await projectsManager.loadProjects();
                appState.setProjects(updatedProjects.filter(p => !p.code.startsWith('ABSENCES')));
                appState.setProjectsWithAbsences(updatedProjects);
                
                // Update projects table
                await updateProjectsTable(updatedProjects);
                
                // Update Matrix KPIs (depends on projects)
                updateMatrixKPIs();
                
                // Update charts (depends on projects)
                initializeAllCharts();
            }
            
            if (resources) {
                // Reload resources data
                const updatedResources = await resourcesManager.loadResources();
                appState.setResources(updatedResources);
                
                // Update resource-related KPIs
                await initializeKPIs();
            }
            
            if (assignments) {
                // Reload assignments data
                const updatedAssignments = await assignmentsManager.loadAssignments();
                appState.setAssignments(updatedAssignments);
                
                // Update assignment-related components
                await populateMatrixTable();
                await initializeEffortTrackingTable();
                
                // Update KPIs that depend on assignments
                await updateAverageHoursKPI();
            }
            
            const endTime = performance.now();
            console.log(`Dashboard updated in ${Math.round(endTime - startTime)}ms`);
            
        } catch (error) {
            console.error('Error updating dashboard:', error);
        }
    };
    
    // Debounce updates unless immediate
    if (immediate) {
        performUpdate();
    } else {
        dashboardUpdateTimer = setTimeout(performUpdate, 300); // 300ms debounce
    }
}

// Make functions and modals globally available
window.updateProjectsTable = updateProjectsTable;
window.updateDashboard = updateDashboard;
window.loadProjectsFromAPI = loadProjectsFromAPI;
window.capacityModal = null;

// Function to set capacity modal reference
export function setCapacityModal(modal) {
    window.capacityModal = modal;
}

// Set capacity modal after initialization
setTimeout(() => {
    if (capacityModal) {
        window.capacityModal = capacityModal;
    }
}, 100);

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

/**
 * Populate Matrix table with real data from API
 */
async function populateMatrixTable() {
    console.log('🔍 populateMatrixTable START');
    
    const tableBody = document.getElementById('planning-table-body');
    const tableHeader = document.getElementById('planning-table-header');
    
    if (!tableBody || !tableHeader) {
        console.warn('Matrix table body or header not found');
        return;
    }
    
    console.log('✅ Table body and header found');
    
    try {
        console.log('📥 Loading assignments...');
        await assignmentsManager.loadAssignments();
        console.log('✅ Assignments loaded');
        
        const projectMonthHours = assignmentsManager.calculateMonthlyHoursByProject(2026);
        
        // Determine which months to show based on period filter
        const monthLabels = ['Ene 2026', 'Feb 2026', 'Mar 2026', 'Abr 2026', 'May 2026', 'Jun 2026', 
                            'Jul 2026', 'Ago 2026', 'Sep 2026', 'Oct 2026', 'Nov 2026', 'Dic 2026'];
        let monthIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]; // All 12 months by default
        let visibleMonthLabels = monthLabels;
        
        if (window.currentPeriod && window.getPeriodDateRange) {
            const dateRange = window.getPeriodDateRange(window.currentPeriod);
            if (dateRange.length > 0) {
                monthIndices = dateRange.map(d => d.month - 1); // Convert to 0-based index
                visibleMonthLabels = monthIndices.map(i => monthLabels[i]);
                console.log('Filtering table columns for period:', window.currentPeriod, 'Months:', visibleMonthLabels);
            }
        }
        
        // Update table header with filtered months
        const headerRow = tableHeader.querySelector('tr');
        if (headerRow) {
            const monthHeaders = visibleMonthLabels.map(label => `<th>${label}</th>`).join('');
            headerRow.innerHTML = `
                <th class="project-name">Proyecto</th>
                <th>Tipo</th>
                <th>Dominio principal</th>
                <th>Total Horas</th>
                ${monthHeaders}
            `;
        }
        
        // Convert Map to object for easier iteration
        const projectMonthHoursObj = {};
        projectMonthHours.forEach((hours, projectId) => {
            projectMonthHoursObj[projectId] = hours;
        });
        
        // Clear existing rows
        tableBody.innerHTML = '';
        
        // Calculate monthly totals (only for visible months)
        const monthlyTotals = new Array(monthIndices.length).fill(0);
        
        // Generate rows for each project with hours
        // Use allProjectsWithAbsences to include ABSENCES projects
        if (window.allProjectsWithAbsences && Array.isArray(window.allProjectsWithAbsences)) {
            window.allProjectsWithAbsences.forEach(project => {
                const hours = projectMonthHoursObj[project.id];
                if (!hours) return; // Skip projects with no hours
                
                const row = document.createElement('tr');
                row.className = 'project-row';
                row.setAttribute('data-project', project.code);
                
                // Get class for capacity cells
                const getCapacityClass = (hours) => {
                    if (hours === 0) return 'empty';
                    if (hours < 200) return 'low';
                    if (hours < 400) return 'medium';
                    return 'high';
                };
                
                // Calculate total hours for this project (only visible months)
                const projectTotal = monthIndices.reduce((sum, idx) => sum + hours[idx], 0);
                
                // Build month cells (only for visible months)
                const monthCells = monthIndices.map((monthIdx, visibleIdx) => {
                    const h = hours[monthIdx];
                    monthlyTotals[visibleIdx] += h;
                    const className = getCapacityClass(h);
                    const display = h > 0 ? Math.round(h) : '-';
                    const title = h > 0 ? `${Math.round(h)} horas` : '0 horas';
                    return `<td><span class="capacity-cell ${className}" data-project="${project.code}" data-month="${monthIdx + 1}" title="${title}">${display}</span></td>`;
                }).join('');
                
                // Check if this is an ABSENCES project
                const isAbsencesProject = project.code.startsWith('ABSENCES');
                
                row.innerHTML = `
                    <td class="project-name">
                        <span class="expand-icon" data-project="${project.code}">+</span>
                        <strong>${project.code}</strong> - ${truncateText(project.title, 30)}
                    </td>
                    <td>${isAbsencesProject ? '-' : (project.type || '-')}</td>
                    <td>${isAbsencesProject ? '-' : getDomainText(project.domain)}</td>
                    <td style="text-align: center; font-weight: bold;">${formatNumber(Math.round(projectTotal))}</td>
                    ${monthCells}
                `;
                
                tableBody.appendChild(row);
            });
        }
        
        // Add summary row with totals
        const summaryRow = document.createElement('tr');
        summaryRow.className = 'summary-row';
        summaryRow.style.fontWeight = 'bold';
        summaryRow.style.backgroundColor = '#f3f4f6';
        
        const summaryMonthCells = monthlyTotals.map(total => 
            `<td style="text-align: center;"><strong>${formatNumber(Math.round(total))}</strong></td>`
        ).join('');
        
        const grandTotal = monthlyTotals.reduce((sum, t) => sum + t, 0);
        
        summaryRow.innerHTML = `
            <td class="project-name"><strong>TOTAL HORAS</strong></td>
            <td colspan="2"></td>
            <td style="text-align: center;"><strong>${formatNumber(Math.round(grandTotal))}</strong></td>
            ${summaryMonthCells}
        `;
        
        tableBody.appendChild(summaryRow);
        
        console.log('Matrix table populated with real data:', {
            projects: projectMonthHours.size,
            visibleMonths: visibleMonthLabels.length,
            monthlyTotals
        });
        
    } catch (error) {
        console.error('Error populating Matrix table:', error);
    }
}

/**
 * Calculate project hours (both committed and estimated)
 * @param {Array} projects - Array of project objects
 * @returns {Object} Object with committedHoursMap and estimatedHoursMap
 */
async function calculateProjectHours(projects) {
    try {
        // Use projectsManager to calculate both committed and estimated hours
        return await projectsManager.calculateProjectHours();
    } catch (error) {
        console.error('Error calculating project hours:', error);
        return { 
            committedHoursMap: new Map(), 
            estimatedHoursMap: new Map() 
        };
    }
}

/**
 * Update dashboard (KPIs and charts) filtered by selected period
 * @param {string} period - Selected period value ('current', 'next', 'next3', 'next6', 'next12')
 */
async function updateDashboardByPeriod(period) {
    
    try {
        // Get authentication tokens - support both Cognito and IAM
        const authType = sessionStorage.getItem('auth_type');
        let awsAccessKey;
        
        if (authType === 'cognito') {
            awsAccessKey = sessionStorage.getItem('cognito_access_token');
        } else {
            awsAccessKey = sessionStorage.getItem('aws_access_key');
        }
        
        const userTeam = sessionStorage.getItem('user_team');
        
        if (!awsAccessKey || !userTeam) {
            console.warn('No authentication for period filtering');
            return;
        }
        
        const authHeader = authType === 'cognito' ? `Bearer ${awsAccessKey}` : awsAccessKey;
        
        // Get date range for the selected period (including 'current' which returns 1 month)
        const dateRange = getPeriodDateRange(period);
        
        // Fetch all assignments
        const response = await fetch(`${API_CONFIG.BASE_URL}/assignments`, {
            headers: {
                'Authorization': authHeader,
                'x-user-team': userTeam
            }
        });
        
        if (!response.ok) {
            throw new Error('Error loading assignments');
        }
        
        const data = await response.json();
        const allAssignments = data.data?.assignments || data.assignments || [];
        
        
        // Filter assignments by date range
        const filteredAssignments = allAssignments.filter(assignment => {
            return dateRange.some(range => 
                assignment.month === range.month && assignment.year === range.year
            );
        });
        
        // Store filtered assignments globally for charts
        window.filteredAssignmentsByPeriod = filteredAssignments;
        window.currentPeriod = period;
        
        // Update KPIs with filtered data
        await updateKPIsWithFilteredData(filteredAssignments);
        
        // Update the planning table with filtered data
        await populateMatrixTable();
        
        // Update charts with filtered data
        await updateChartsWithFilteredData(filteredAssignments, period);
        
    } catch (error) {
        console.error('Error updating dashboard by period:', error);
    }
}

/**
 * Update KPIs with filtered assignment data
 */
async function updateKPIsWithFilteredData(assignments) {
    // Calculate metrics from filtered assignments
    const uniqueProjects = new Set();
    const uniqueResources = new Set();
    let totalHours = 0;
    let assignedHours = 0;
    let hoursEvolutivos = 0;
    let horasProyectos = 0;
    
    // IMPORTANT: Only count projects that have committed hours in the selected period
    // and are not ABSENCES projects
    
    assignments.forEach(assignment => {
        const hours = parseFloat(assignment.hours) || 0;
        
        // Map snake_case to camelCase
        const projectId = assignment.project_id || assignment.projectId;
        const resourceId = assignment.resource_id || assignment.resourceId;
        
        
        // Only process assignments with hours > 0
        if (hours > 0 && projectId && window.allProjects) {
            const project = window.allProjects.find(p => p.id === projectId);
            
            
            // EXCLUDE ABSENCES projects from KPIs
            if (project && !project.code.startsWith('ABSENCES')) {
                // Add to unique projects (only if has hours in this period)
                uniqueProjects.add(projectId);
                
                // Sum total hours
                totalHours += hours;
                
                if (resourceId) {
                    assignedHours += hours;
                }
                
                // Calculate hours by project type
                if (project.type === 'Evolutivo') {
                    hoursEvolutivos += hours;
                } else if (project.type === 'Proyecto') {
                    horasProyectos += hours;
                }
            }
        }
        
        // Count unique resources (regardless of project type)
        if (resourceId) {
            uniqueResources.add(resourceId);
        }
    });
    
    // Count projects by type from unique project IDs (excluding ABSENCES)
    // These are ACTIVE projects = projects with committed hours in the selected period
    let evolutivosCount = 0;
    let proyectosCount = 0;
    let totalProjectsWithoutAbsences = 0;
    
    uniqueProjects.forEach(projectId => {
        if (window.allProjects) {
            const project = window.allProjects.find(p => p.id === projectId);
            if (project && !project.code.startsWith('ABSENCES')) {
                totalProjectsWithoutAbsences++;
                if (project.type === 'Evolutivo') {
                    evolutivosCount++;
                } else if (project.type === 'Proyecto') {
                    proyectosCount++;
                }
            }
        }
    });
    
    // Calculate resource utilization (resources assigned >50% and >80%)
    const resourceUtilization = new Map(); // resourceId -> total hours assigned
    
    assignments.forEach(assignment => {
        const resourceId = assignment.resource_id || assignment.resourceId;
        if (resourceId) {
            const current = resourceUtilization.get(resourceId) || 0;
            resourceUtilization.set(resourceId, current + (parseFloat(assignment.hours) || 0));
        }
    });
    
    // Get date range to calculate capacity per resource
    const dateRange = getPeriodDateRange(window.currentPeriod || 'current');
    const numberOfMonths = dateRange.length;
    const capacityPerResource = 160 * numberOfMonths; // 160h/month × number of months
    
    let resourcesOver50 = 0;
    let resourcesOver80 = 0;
    
    resourceUtilization.forEach((hours, resourceId) => {
        const utilizationPercent = (hours / capacityPerResource) * 100;
        if (utilizationPercent > 50) resourcesOver50++;
        if (utilizationPercent > 80) resourcesOver80++;
    });
    
    // Get REAL capacity from resourceCapacity.js (same logic as the chart)
    const awsAccessKey = sessionStorage.getItem('aws_access_key');
    const userTeam = sessionStorage.getItem('user_team');
    
    let totalCapacity = 0;
    if (awsAccessKey && userTeam) {
        try {
            // Import the same function used by the chart
            const { calculateCapacityHoursFromResourceCapacity } = await import('./components/resourceCapacity.js');
            
            // Get capacity data (base hours - absences)
            const { potentialAvailableHours } = await calculateCapacityHoursFromResourceCapacity(awsAccessKey, userTeam);
            
            // Sum only the months in the selected period
            const dateRange = getPeriodDateRange(window.currentPeriod || 'next12');
            const monthIndices = dateRange.map(d => d.month - 1); // Convert to 0-based
            
            totalCapacity = monthIndices.reduce((sum, idx) => sum + (potentialAvailableHours[idx] || 0), 0);
            
            console.log('Capacity calculation (from resourceCapacity.js):', {
                period: window.currentPeriod,
                monthIndices,
                potentialAvailableHours,
                totalCapacity,
                formula: 'Sum of green bars from chart'
            });
        } catch (error) {
            console.error('Error calculating capacity from resourceCapacity.js:', error);
            // Fallback to simple calculation
            const resourcesResponse = await fetch(`${API_CONFIG.BASE_URL}/resources`, {
                headers: {
                    'Authorization': awsAccessKey,
                    'x-user-team': userTeam
                }
            });
            
            if (resourcesResponse.ok) {
                const resourcesData = await resourcesResponse.json();
                const allResources = resourcesData.data?.resources || resourcesData.resources || [];
                const teamResources = allResources.filter(r => r.team === userTeam && r.active);
                const dateRange = getPeriodDateRange(window.currentPeriod || 'next12');
                const numberOfMonths = dateRange.length;
                totalCapacity = teamResources.length * 160 * numberOfMonths;
            }
        }
    }
    
    // Update KPI elements (only if they exist)
    const proyectosActivosEl = document.getElementById('proyectos-activos');
    const recursosActivosEl = document.getElementById('recursos-activos');
    const capacidadTotalEl = document.getElementById('capacidad-total');
    const horasComprometidasEl = document.getElementById('kpi-horas-comprometidas');
    const eficienciaEl = document.getElementById('eficiencia');
    
    // Calculate total committed hours as sum of Evolutivos + Proyectos (excluding ABSENCES)
    const totalCommittedHours = hoursEvolutivos + horasProyectos;
    
    // Main KPI values (excluding ABSENCES projects)
    if (proyectosActivosEl) proyectosActivosEl.textContent = totalProjectsWithoutAbsences;
    if (recursosActivosEl) recursosActivosEl.textContent = uniqueResources.size;
    if (capacidadTotalEl) capacidadTotalEl.textContent = formatNumber(totalCapacity);
    if (horasComprometidasEl) horasComprometidasEl.textContent = formatNumber(Math.round(totalCommittedHours));
    
    // Sub-KPIs for PROYECTOS ACTIVOS
    const kpiNumEvolutivosEl = document.getElementById('kpi-num-evolutivos');
    const kpiNumProyectosEl = document.getElementById('kpi-num-proyectos');
    if (kpiNumEvolutivosEl) kpiNumEvolutivosEl.textContent = evolutivosCount;
    if (kpiNumProyectosEl) kpiNumProyectosEl.textContent = proyectosCount;
    
    // Sub-KPIs for RECURSOS ACTIVOS
    const kpiAsignados50El = document.getElementById('kpi-asignados-50');
    const kpiAsignados80El = document.getElementById('kpi-asignados-80');
    if (kpiAsignados50El) kpiAsignados50El.textContent = resourcesOver50;
    if (kpiAsignados80El) kpiAsignados80El.textContent = resourcesOver80;
    
    // Sub-KPIs for HORAS COMPROMETIDAS
    const kpiHorasEvolutivosEl = document.getElementById('kpi-horas-evolutivos');
    const kpiHorasProyectosEl = document.getElementById('kpi-horas-proyectos');
    if (kpiHorasEvolutivosEl) kpiHorasEvolutivosEl.textContent = formatNumber(Math.round(hoursEvolutivos));
    if (kpiHorasProyectosEl) kpiHorasProyectosEl.textContent = formatNumber(Math.round(horasProyectos));
    
    // Sub-KPIs for CAPACIDAD DISPONIBLE
    const kpiFtesCapacidadEl = document.getElementById('kpi-ftes-capacidad');
    if (kpiFtesCapacidadEl) {
        const dateRange = getPeriodDateRange(window.currentPeriod || 'current');
        const numberOfMonths = dateRange.length;
        const ftesCapacidad = (totalCapacity / 160 / numberOfMonths).toFixed(1);
        kpiFtesCapacidadEl.textContent = `${ftesCapacidad} FTEs`;
    }
    
    // Calculate efficiency (utilization percentage) = HORAS COMPROMETIDAS / CAPACIDAD DISPONIBLE
    const efficiency = totalCapacity > 0 ? ((totalCommittedHours / totalCapacity) * 100).toFixed(1) : '0.0';
    if (eficienciaEl) eficienciaEl.textContent = `${efficiency}%`;
    
    // Sub-KPIs for EFICIENCIA
    const kpiFtesEficienciaEl = document.getElementById('kpi-ftes-eficiencia');
    if (kpiFtesEficienciaEl) {
        const dateRange = getPeriodDateRange(window.currentPeriod || 'current');
        const numberOfMonths = dateRange.length;
        const ftesEficiencia = (assignedHours / 160 / numberOfMonths).toFixed(1);
        kpiFtesEficienciaEl.textContent = `${ftesEficiencia} FTEs`;
    }
    
    console.log('KPIs updated with filtered data:', {
        projects: totalProjectsWithoutAbsences,
        totalProjectsIncludingAbsences: uniqueProjects.size,
        evolutivosCount,
        proyectosCount,
        resources: uniqueResources.size,
        resourcesOver50,
        resourcesOver80,
        totalCapacity,
        totalCommittedHours: totalCommittedHours,
        hoursEvolutivos,
        horasProyectos,
        efficiency
    });
}

/**
 * Update charts with filtered assignment data
 */
async function updateChartsWithFilteredData(assignments, period) {
    // The charts are managed by charts.js
    // We'll trigger a re-initialization with filtered data
    window.filteredAssignmentsByPeriod = assignments;
    window.currentPeriod = period;
    
    // Re-initialize charts with filtered data
    await initializeAllCharts();
}

/**
 * Filter tasks in Gestión de Tareas table
 */
function filterTasks(searchTerm) {
    const tableBody = document.getElementById('tasks-table-body');
    if (!tableBody) return;
    
    const rows = tableBody.getElementsByTagName('tr');
    const term = searchTerm.toLowerCase();
    
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const cells = row.getElementsByTagName('td');
        let found = false;
        
        if (cells.length > 0) {
            const id = cells[0].textContent.toLowerCase();
            const title = cells[1].textContent.toLowerCase();
            const description = cells[2] ? cells[2].textContent.toLowerCase() : '';
            
            if (id.includes(term) || title.includes(term) || description.includes(term)) {
                found = true;
            }
        }
        
        row.style.display = found ? '' : 'none';
    }
}

/**
 * Import from Jira for Tasks (SCOM source)
 * Uses jiraModal in 'tasks' mode which saves to jira_tasks table
 */
function importFromJiraForTasks() {
    console.log('=== importFromJiraForTasks function called ===');
    console.log('window.jiraModal:', window.jiraModal);
    
    if (window.jiraModal) {
        console.log('Opening jiraModal in tasks mode (SCOM)...');
        window.jiraModal.open('tasks'); // Pasar 'tasks' como modo
    } else {
        console.error('Jira modal not initialized');
        alert('Error: Modal de Jira no está inicializado. Revisa la consola para más detalles.');
    }
}

/**
 * Load tasks from API and update tasks table
 */
async function loadTasksFromAPI() {
    try {
        console.log('Loading tasks from jira_tasks table...');
        
        // Get authentication tokens - support both Cognito and IAM
        const authType = sessionStorage.getItem('auth_type');
        let awsAccessKey;
        
        if (authType === 'cognito') {
            awsAccessKey = sessionStorage.getItem('cognito_access_token');
        } else {
            awsAccessKey = sessionStorage.getItem('aws_access_key');
        }
        
        const userTeam = sessionStorage.getItem('user_team');
        
        if (!awsAccessKey || !userTeam) {
            console.warn('No credentials for loading tasks');
            return;
        }
        
        const response = await fetch(`${API_CONFIG.BASE_URL}/jira-tasks`, {
            headers: {
                'Authorization': authType === 'cognito' ? `Bearer ${awsAccessKey}` : awsAccessKey,
                'x-user-team': userTeam
            }
        });
        
        if (!response.ok) {
            throw new Error('Error loading tasks');
        }
        
        const result = await response.json();
        const tasks = result.data?.tasks || result.tasks || [];
        
        console.log(`Loaded ${tasks.length} tasks from jira_tasks table`);
        
        // Update tasks table
        updateTasksTable(tasks);
        
        // Update tasks KPIs and charts
        updateTasksKPIsAndCharts(tasks);
        
    } catch (error) {
        console.error('Error loading tasks:', error);
    }
}

/**
 * Update Tasks KPIs and Charts with data from jira_tasks
 */
function updateTasksKPIsAndCharts(tasks) {
    if (!tasks || tasks.length === 0) {
        // Set all to 0 or '-'
        const totalCountEl = document.getElementById('tasks-total-count');
        const evolutivosCountEl = document.getElementById('tasks-evolutivos-count');
        const proyectosCountEl = document.getElementById('tasks-proyectos-count');
        
        if (totalCountEl) totalCountEl.textContent = '0';
        if (evolutivosCountEl) evolutivosCountEl.textContent = '0';
        if (proyectosCountEl) proyectosCountEl.textContent = '0';
        
        return;
    }
    
    // Calculate totals
    let totalCount = tasks.length;
    let evolutivosCount = 0;
    let proyectosCount = 0;
    
    // Count by status
    const statusCounts = {};
    // Count by domain
    const domainCounts = {};
    // Count by priority
    const priorityCounts = {};
    
    tasks.forEach(task => {
        // Count by type
        if (task.type === 'Evolutivo') {
            evolutivosCount++;
        } else if (task.type === 'Proyecto') {
            proyectosCount++;
        }
        
        // Count by status - usar 'task' para estados de tareas
        const statusText = getStatusText(task.status, 'task');
        statusCounts[statusText] = (statusCounts[statusText] || 0) + 1;
        
        // Count by domain
        const domainText = getDomainText(task.domain);
        domainCounts[domainText] = (domainCounts[domainText] || 0) + 1;
        
        // Count by priority
        const priorityText = task.priority || 'Sin prioridad';
        priorityCounts[priorityText] = (priorityCounts[priorityText] || 0) + 1;
    });
    
    // Update KPI card
    const totalCountEl = document.getElementById('tasks-total-count');
    const evolutivosCountEl = document.getElementById('tasks-evolutivos-count');
    const proyectosCountEl = document.getElementById('tasks-proyectos-count');
    
    if (totalCountEl) totalCountEl.textContent = totalCount;
    if (evolutivosCountEl) evolutivosCountEl.textContent = evolutivosCount;
    if (proyectosCountEl) proyectosCountEl.textContent = proyectosCount;
    
    // Update charts
    updateTasksCharts(statusCounts, domainCounts, priorityCounts);
    
    console.log('Tasks KPIs and charts updated:', {
        total: totalCount,
        evolutivos: evolutivosCount,
        proyectos: proyectosCount,
        statusCounts,
        domainCounts,
        priorityCounts
    });
}

/**
 * Update Tasks Charts (Status, Domain, Priority)
 */
function updateTasksCharts(statusCounts, domainCounts, priorityCounts) {
    // Destroy existing charts if they exist
    if (window.tasksStatusChart) {
        window.tasksStatusChart.destroy();
    }
    if (window.tasksDomainChart) {
        window.tasksDomainChart.destroy();
    }
    if (window.tasksPriorityChart) {
        window.tasksPriorityChart.destroy();
    }
    
    // Chart 1: By Status
    const statusCanvas = document.getElementById('tasks-by-status-chart');
    if (statusCanvas) {
        const statusLabels = Object.keys(statusCounts);
        const statusData = Object.values(statusCounts);
        
        window.tasksStatusChart = new Chart(statusCanvas, {
            type: 'doughnut',
            data: {
                labels: statusLabels,
                datasets: [{
                    data: statusData,
                    backgroundColor: [
                        '#3b82f6', '#10b981', '#f59e0b', '#ef4444', 
                        '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { font: { size: 10 } }
                    }
                }
            }
        });
    }
    
    // Chart 2: By Domain
    const domainCanvas = document.getElementById('tasks-by-domain-chart');
    if (domainCanvas) {
        const domainLabels = Object.keys(domainCounts);
        const domainData = Object.values(domainCounts);
        
        window.tasksDomainChart = new Chart(domainCanvas, {
            type: 'doughnut',
            data: {
                labels: domainLabels,
                datasets: [{
                    data: domainData,
                    backgroundColor: [
                        '#3b82f6', '#10b981', '#f59e0b', '#ef4444', 
                        '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { font: { size: 10 } }
                    }
                }
            }
        });
    }
    
    // Chart 3: By Priority
    const priorityCanvas = document.getElementById('tasks-by-priority-chart');
    if (priorityCanvas) {
        const priorityLabels = Object.keys(priorityCounts);
        const priorityData = Object.values(priorityCounts);
        
        window.tasksPriorityChart = new Chart(priorityCanvas, {
            type: 'doughnut',
            data: {
                labels: priorityLabels,
                datasets: [{
                    data: priorityData,
                    backgroundColor: [
                        '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { font: { size: 10 } }
                    }
                }
            }
        });
    }
}

/**
 * Update tasks table with data from jira_tasks
 */
function updateTasksTable(tasks) {
    const tableBody = document.getElementById('tasks-table-body');
    if (!tableBody) {
        console.warn('Tasks table body not found');
        return;
    }
    
    // Store all tasks
    allTasks = tasks || [];
    
    // Sort tasks by code (descending)
    allTasks.sort((a, b) => {
        const getNumericId = (code) => {
            const match = code.match(/\d+/);
            return match ? parseInt(match[0], 10) : 0;
        };
        return getNumericId(b.code) - getNumericId(a.code);
    });
    
    // Clear existing rows
    tableBody.innerHTML = '';
    
    if (!allTasks || allTasks.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="11" style="text-align: center; padding: 2rem; color: #6b7280;">
                No hay tareas disponibles. Haz clic en "Importar desde Jira" para importar tareas de SCOM.
            </td>
        `;
        tableBody.appendChild(row);
        
        // Hide pagination if no tasks
        const paginationContainer = document.getElementById('tasks-pagination-container');
        if (paginationContainer) {
            paginationContainer.style.display = 'none';
        }
        
        // Update info text
        const infoText = document.getElementById('tasks-info-text');
        if (infoText) {
            infoText.textContent = 'Showing 0-0 of 0 tasks';
        }
        
        return;
    }
    
    // Calculate pagination
    const totalPages = Math.ceil(allTasks.length / tasksPerPage);
    const startIndex = (currentTasksPage - 1) * tasksPerPage;
    const endIndex = startIndex + tasksPerPage;
    const tasksToDisplay = allTasks.slice(startIndex, endIndex);
    
    // Populate table with paginated tasks
    tasksToDisplay.forEach(task => {
        const row = document.createElement('tr');
        
        const statusText = getStatusText(task.status, 'task'); // Usar 'task' para estados de tareas
        const statusClass = getStatusClass(task.status);
        const domainText = getDomainText(task.domain);
        
        // Format dates if they exist
        const startDate = task.startDate ? new Date(task.startDate).toLocaleDateString('es-ES') : '-';
        const endDate = task.endDate ? new Date(task.endDate).toLocaleDateString('es-ES') : '-';
        
        // Create Jira link
        const jiraLink = task.jiraUrl || `https://naturgy-adn.atlassian.net/browse/${task.code}`;
        const codeDisplay = `<a href="${jiraLink}" target="_blank" rel="noopener noreferrer" style="color: #0052CC; text-decoration: none; font-weight: bold;">${task.code}</a>`;
        
        // Format fixVersions for display
        let fixVersionsDisplay = '-';
        if (task.fixVersions && task.fixVersions.length > 0) {
            // Parse if it's a string
            const versions = typeof task.fixVersions === 'string' 
                ? JSON.parse(task.fixVersions) 
                : task.fixVersions;
            
            if (Array.isArray(versions) && versions.length > 0) {
                // Show version names, comma-separated
                fixVersionsDisplay = versions.map(v => v.name).join(', ');
            }
        } else if (task.fix_versions && task.fix_versions.length > 0) {
            // Handle snake_case variant
            const versions = typeof task.fix_versions === 'string' 
                ? JSON.parse(task.fix_versions) 
                : task.fix_versions;
            
            if (Array.isArray(versions) && versions.length > 0) {
                fixVersionsDisplay = versions.map(v => v.name).join(', ');
            }
        }
        
        row.innerHTML = `
            <td style="text-align: left;">${codeDisplay}</td>
            <td style="text-align: left;">${task.title}</td>
            <td style="text-align: left;">${truncateText(task.description || '', 50)}</td>
            <td style="text-align: left;">${domainText}</td>
            <td style="text-align: center;">-</td>
            <td style="text-align: center;">-</td>
            <td style="text-align: center;">${startDate}</td>
            <td style="text-align: center;">${endDate}</td>
            <td style="text-align: left;">${truncateText(fixVersionsDisplay, 30)}</td>
            <td style="text-align: center;">
                <span class="status-badge ${statusClass}">${statusText}</span>
            </td>
            <td style="text-align: center;">${task.type || '-'}</td>
            <td style="text-align: center;">
                <span class="action-icon" data-action="edit" data-task="${task.code}" title="Editar">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 16px; height: 16px;">
                        <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                    </svg>
                </span>
                <span class="action-icon" data-action="assign-resources" data-task="${task.code}" data-task-id="${task.id}" title="Asignación de Recursos">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 16px; height: 16px;">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                    </svg>
                </span>
                <span class="action-icon" data-action="concept-tasks" data-task-id="${task.id}" data-task-code="${task.code}" title="Tareas de Conceptualización">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 16px; height: 16px;">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                    </svg>
                </span>
                <span class="action-icon" data-action="delete" data-task="${task.code}" title="Eliminar">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 16px; height: 16px;">
                        <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                </span>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // Render pagination controls for tasks
    renderTasksPagination(totalPages);
    
    console.log(`Tasks table updated with ${allTasks.length} tasks (showing page ${currentTasksPage} of ${totalPages})`);
    console.log('renderTasksPagination called with totalPages:', totalPages);
}

/**
 * Render tasks pagination controls
 * @param {number} totalPages - Total number of pages
 */
function renderTasksPagination(totalPages) {
    console.log('renderTasksPagination called:', { totalPages, allTasks: allTasks.length, currentTasksPage });
    
    const paginationContainer = document.getElementById('tasks-pagination-container');
    const infoText = document.getElementById('tasks-info-text');
    
    console.log('Elements found:', { 
        paginationContainer: !!paginationContainer, 
        infoText: !!infoText 
    });
    
    // Calculate display info FIRST (before any returns)
    const startIndex = (currentTasksPage - 1) * tasksPerPage + 1;
    const endIndex = Math.min(currentTasksPage * tasksPerPage, allTasks.length);
    
    // ALWAYS update info text, even if pagination is hidden
    if (infoText) {
        infoText.textContent = `Showing ${startIndex}-${endIndex} of ${allTasks.length} tasks`;
        console.log('Info text updated to:', infoText.textContent);
    } else {
        console.error('tasks-info-text element NOT FOUND');
    }
    
    if (!paginationContainer) {
        console.warn('Tasks pagination container not found');
        return;
    }
    
    // Show pagination container
    paginationContainer.style.display = 'flex';
    
    // Hide pagination if only one page or no tasks
    if (totalPages <= 1) {
        paginationContainer.style.display = 'none';
        console.log('Pagination hidden (only 1 page)');
        return;
    }
    
    // Render pagination buttons in the container
    paginationContainer.innerHTML = `
        <button id="prev-tasks-btn" class="btn" style="margin-right: 5px;" ${currentTasksPage === 1 ? 'disabled' : ''}>
            ←
        </button>
        <span id="tasks-page-info">Page ${currentTasksPage} of ${totalPages}</span>
        <button id="next-tasks-btn" class="btn" style="margin-left: 5px;" ${currentTasksPage === totalPages ? 'disabled' : ''}>
            →
        </button>
    `;
    
    // Add event listeners
    const prevButton = document.getElementById('prev-tasks-btn');
    const nextButton = document.getElementById('next-tasks-btn');
    
    if (prevButton) {
        prevButton.onclick = () => {
            if (currentTasksPage > 1) {
                currentTasksPage--;
                updateTasksTable(allTasks);
            }
        };
    }
    
    if (nextButton) {
        nextButton.onclick = () => {
            if (currentTasksPage < totalPages) {
                currentTasksPage++;
                updateTasksTable(allTasks);
            }
        };
    }
}

/**
 * Edit task from Gestión de Trabajo tab
 */
function editTask(taskCode) {
    console.log('Edit task called for code:', taskCode);
    
    // Find task in allTasks array
    const task = allTasks.find(t => t.code === taskCode);
    
    if (!task) {
        console.error(`Task ${taskCode} not found in allTasks`);
        return;
    }
    
    console.log('Task found for editing:', task);
    
    // Open the project modal in edit mode with source='tasks'
    // This will show "Editar Trabajo" and hide delivery hours field
    openEditProjectModal(task, 'tasks');
}

/**
 * Delete task from Gestión de Trabajo tab
 */
async function deleteTask(taskCode) {
    console.log('Delete task called for code:', taskCode);
    
    // Find task in allTasks array
    const task = allTasks.find(t => t.code === taskCode);
    
    if (!task) {
        console.error(`Task ${taskCode} not found in allTasks`);
        return;
    }
    
    // Confirm deletion
    if (!confirm(`¿Estás seguro de que quieres eliminar el trabajo "${task.code} - ${task.title}"?`)) {
        return;
    }
    
    try {
        const awsAccessKey = sessionStorage.getItem('aws_access_key');
        const userTeam = sessionStorage.getItem('user_team');
        
        if (!awsAccessKey || !userTeam) {
            throw new Error('No se encontró información de autenticación');
        }
        
        // Delete from jira_tasks table
        const response = await fetch(`${API_CONFIG.BASE_URL}/jira-tasks/${task.id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': awsAccessKey,
                'x-user-team': userTeam
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Error al eliminar el trabajo');
        }
        
        // Reload tasks table
        await loadTasksFromAPI();
        
        // Show success message
        alert('Trabajo eliminado correctamente');
        
    } catch (error) {
        console.error('Error deleting task:', error);
        alert(`Error al eliminar el trabajo: ${error.message}`);
    }
}

// Make functions globally available
window.loadTasksFromAPI = loadTasksFromAPI;
window.updateTasksTable = updateTasksTable;
window.editTask = editTask;
window.deleteTask = deleteTask;

// Make pagination functions globally available for onclick handlers
window.loadPreviousEffortPage = loadPreviousEffortPage;
window.loadNextEffortPage = loadNextEffortPage;

// Export for external use if needed
export { initializeApp, updateProjectsTable, updateDashboard, loadProjectsFromAPI };
