// Effort Tracking Component - Esfuerzo Incurrido vs. Planificado

import { API_CONFIG } from '../config/data.js';
import { formatNumber, getDomainText } from '../utils/helpers.js';

// Pagination state
let currentPage = 1;
let itemsPerPage = 10;
let allProjectMetrics = [];
let filteredProjectMetrics = [];

/**
 * Load and populate the Effort Tracking table
 */
export async function initializeEffortTrackingTable() {
    const tbody = document.getElementById('effort-tracking-table-body');
    if (!tbody) return;
    
    try {
        // Load data from API
        const { projects, assignments, conceptHoursMap } = await loadEffortData();
        
        // Get today's date
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Filter out ABSENCES projects
        const filteredProjects = projects.filter(p => !p.code.startsWith('ABSENCES'));
        
        // Calculate metrics for each project
        const projectMetrics = filteredProjects.map(project => {
            // Get all assignments for this project
            const projectAssignments = assignments.filter(a => {
                const assignmentProjectId = a.projectId || a.project_id;
                return assignmentProjectId === project.id;
            });
            
            console.log(`Project ${project.code} (ID: ${project.id}):`, {
                assignmentsFound: projectAssignments.length,
                sampleAssignment: projectAssignments[0]
            });
            
            // Calculate ITD (Inception To Date) - hours from start until today
            const itd = projectAssignments
                .filter(a => {
                    const assignmentDate = new Date(a.year, a.month - 1, 1);
                    const assignmentEndOfMonth = new Date(a.year, a.month, 0); // Last day of the month
                    
                    // If assignment month is before current month, count all hours
                    if (assignmentDate < new Date(today.getFullYear(), today.getMonth(), 1)) {
                        return true;
                    }
                    
                    // If assignment month is current month, only count if we're past the first day
                    if (assignmentDate.getFullYear() === today.getFullYear() && 
                        assignmentDate.getMonth() === today.getMonth()) {
                        // We're in the current month, so this is ITD (days already passed)
                        return true;
                    }
                    
                    // Future months are not ITD
                    return false;
                })
                .reduce((sum, a) => {
                    const assignmentDate = new Date(a.year, a.month - 1, 1);
                    const hours = parseFloat(a.hours) || 0;
                    
                    // If it's the current month, prorate based on days passed
                    if (assignmentDate.getFullYear() === today.getFullYear() && 
                        assignmentDate.getMonth() === today.getMonth()) {
                        const daysInMonth = new Date(a.year, a.month, 0).getDate();
                        const daysPassed = today.getDate();
                        const proratedHours = Math.round((hours / daysInMonth) * daysPassed);
                        return sum + proratedHours;
                    }
                    
                    // For past months, count all hours
                    return sum + hours;
                }, 0);
            
            // Calculate ETC (Estimate To Complete) - hours from tomorrow onwards
            const etc = projectAssignments
                .filter(a => {
                    const assignmentDate = new Date(a.year, a.month - 1, 1);
                    
                    // If assignment month is after current month, count all hours
                    if (assignmentDate > new Date(today.getFullYear(), today.getMonth(), 1)) {
                        return true;
                    }
                    
                    // If assignment month is current month, count remaining days
                    if (assignmentDate.getFullYear() === today.getFullYear() && 
                        assignmentDate.getMonth() === today.getMonth()) {
                        return true;
                    }
                    
                    // Past months are not ETC
                    return false;
                })
                .reduce((sum, a) => {
                    const assignmentDate = new Date(a.year, a.month - 1, 1);
                    const hours = parseFloat(a.hours) || 0;
                    
                    // If it's the current month, prorate based on days remaining
                    if (assignmentDate.getFullYear() === today.getFullYear() && 
                        assignmentDate.getMonth() === today.getMonth()) {
                        const daysInMonth = new Date(a.year, a.month, 0).getDate();
                        const daysPassed = today.getDate();
                        const daysRemaining = daysInMonth - daysPassed;
                        const proratedHours = Math.round((hours / daysInMonth) * daysRemaining);
                        return sum + proratedHours;
                    }
                    
                    // For future months, count all hours
                    return sum + hours;
                }, 0);
            
            // Calculate EAC (Estimate At Completion) - ITD + ETC
            const eac = itd + etc;
            
            // Get initial estimate from concept_tasks (estimación inicial del proyecto)
            const initialEstimate = conceptHoursMap.get(project.id) || 0;
            
            // Calculate deviation
            const deviationHours = initialEstimate - eac;
            const deviationPercent = initialEstimate > 0 
                ? ((deviationHours / initialEstimate) * 100).toFixed(1)
                : 0;
            
            return {
                project,
                initialEstimate,
                itd,
                etc,
                eac,
                deviationHours,
                deviationPercent
            };
        });
        
        // Sort by project code numeric ID in descending order (e.g., NC-767 -> 767)
        projectMetrics.sort((a, b) => {
            // Extract numeric part from project code (e.g., "NC-767" -> 767)
            const getNumericId = (code) => {
                const match = code.match(/(\d+)$/);
                return match ? parseInt(match[1], 10) : 0;
            };
            
            const numA = getNumericId(a.project.code);
            const numB = getNumericId(b.project.code);
            
            // Sort in descending order (higher numbers first)
            return numB - numA;
        });
        
        // Store all metrics for pagination
        allProjectMetrics = projectMetrics;
        filteredProjectMetrics = projectMetrics;
        
        // Initialize search functionality
        initializeSearch();
        
        // Reset to first page and render
        currentPage = 1;
        renderPage(1);
        
        console.log('Effort Tracking table populated with', projectMetrics.length, 'projects');
        
    } catch (error) {
        console.error('Error initializing Effort Tracking table:', error);
        const tbody = document.getElementById('effort-tracking-table-body');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 2rem; color: #718096;">
                        Error al cargar los datos de seguimiento de esfuerzo
                    </td>
                </tr>
            `;
        }
    }
}

/**
 * Render a specific page of the effort tracking table
 */
function renderPage(page) {
    const tbody = document.getElementById('effort-tracking-table-body');
    if (!tbody) return;
    
    const totalItems = filteredProjectMetrics.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
    // Validate page number
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    
    currentPage = page;
    
    // Calculate start and end indices
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
    
    // Get items for current page
    const pageItems = filteredProjectMetrics.slice(startIndex, endIndex);
    
    // Render table rows
    tbody.innerHTML = pageItems.map(metric => {
        const { project, initialEstimate, itd, etc, eac, deviationHours, deviationPercent } = metric;
        
        // Determine deviation color
        let deviationClass = '';
        if (deviationPercent < -10) {
            deviationClass = 'style="color: #dc2626; font-weight: 600;"'; // Red for over budget
        } else if (deviationPercent > 10) {
            deviationClass = 'style="color: #16a34a; font-weight: 600;"'; // Green for under budget
        }
        
        // Truncate title if too long
        const displayTitle = project.title.length > 40 
            ? project.title.substring(0, 37) + '...' 
            : project.title;
        
        return `
            <tr>
                <td style="text-align: left;">
                    <strong>${project.code}</strong> - ${displayTitle}
                </td>
                <td style="text-align: center;">
                    ${project.type || 'Proyecto'}
                </td>
                <td style="text-align: left;">${getDomainText(project.domain)}</td>
                <td style="text-align: center;">${formatNumber(initialEstimate)}</td>
                <td style="text-align: center;">${formatNumber(itd)}</td>
                <td style="text-align: center;">${formatNumber(etc)}</td>
                <td style="text-align: center; font-weight: 600;">${formatNumber(eac)}</td>
                <td style="text-align: center;" ${deviationClass}>${formatNumber(deviationHours)}</td>
                <td style="text-align: center;" ${deviationClass}>${deviationPercent}%</td>
            </tr>
        `;
    }).join('');
    
    // Update pagination controls
    updatePaginationControls(totalItems, totalPages);
}

/**
 * Update pagination controls
 */
function updatePaginationControls(totalItems, totalPages) {
    const startIndex = (currentPage - 1) * itemsPerPage + 1;
    const endIndex = Math.min(currentPage * itemsPerPage, totalItems);
    
    // Update info text
    const infoElement = document.getElementById('effort-info-text');
    if (infoElement) {
        infoElement.textContent = `Showing ${startIndex}-${endIndex} of ${totalItems} projects`;
    }
    
    // Update page info
    const pageInfoElement = document.getElementById('effort-current-page');
    if (pageInfoElement) {
        pageInfoElement.textContent = `Page ${currentPage} of ${totalPages}`;
    }
    
    // Update button states
    const prevButton = document.getElementById('effort-prev-btn');
    const nextButton = document.getElementById('effort-next-btn');
    
    if (prevButton) {
        prevButton.disabled = currentPage === 1;
    }
    
    if (nextButton) {
        nextButton.disabled = currentPage === totalPages || totalPages === 0;
    }
}

/**
 * Navigate to previous page
 */
export function loadPreviousEffortPage() {
    if (currentPage > 1) {
        renderPage(currentPage - 1);
    }
}

/**
 * Navigate to next page
 */
export function loadNextEffortPage() {
    const totalPages = Math.ceil(filteredProjectMetrics.length / itemsPerPage);
    if (currentPage < totalPages) {
        renderPage(currentPage + 1);
    }
}

/**
 * Initialize search functionality
 */
function initializeSearch() {
    const searchInput = document.getElementById('effort-search-input');
    if (!searchInput) return;
    
    searchInput.addEventListener('input', function(e) {
        const searchTerm = e.target.value.toLowerCase().trim();
        
        if (!searchTerm) {
            // No search term, show all projects
            filteredProjectMetrics = allProjectMetrics;
        } else {
            // Filter projects by code, title, or domain
            filteredProjectMetrics = allProjectMetrics.filter(metric => {
                const project = metric.project;
                const code = project.code.toLowerCase();
                const title = project.title.toLowerCase();
                const domain = getDomainText(project.domain).toLowerCase();
                
                return code.includes(searchTerm) || 
                       title.includes(searchTerm) || 
                       domain.includes(searchTerm);
            });
        }
        
        // Reset to first page and render
        currentPage = 1;
        renderPage(1);
    });
}

/**
 * Load effort data from API
 */
async function loadEffortData() {
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
        console.warn('No authentication for effort tracking');
        return { projects: [], assignments: [], conceptHoursMap: new Map() };
    }
    
    try {
        const authHeader = authType === 'cognito' ? `Bearer ${awsAccessKey}` : awsAccessKey;
        
        const [projectsRes, assignmentsRes, conceptTasksRes] = await Promise.all([
            fetch(`${API_CONFIG.BASE_URL}/projects`, {
                headers: {
                    'Authorization': authHeader,
                    'x-user-team': userTeam
                }
            }),
            fetch(`${API_CONFIG.BASE_URL}/assignments`, {
                headers: {
                    'Authorization': authHeader,
                    'x-user-team': userTeam
                }
            }),
            fetch(`${API_CONFIG.BASE_URL}/concept-tasks`, {
                headers: {
                    'Authorization': authHeader,
                    'x-user-team': userTeam
                }
            })
        ]);
        
        if (!projectsRes.ok || !assignmentsRes.ok || !conceptTasksRes.ok) {
            throw new Error('Error loading effort data');
        }
        
        const projectsData = await projectsRes.json();
        const assignmentsData = await assignmentsRes.json();
        const conceptTasksData = await conceptTasksRes.json();
        
        const projects = projectsData.data?.projects || projectsData.projects || [];
        const allAssignments = assignmentsData.data?.assignments || assignmentsData.assignments || [];
        const conceptTasks = conceptTasksData.data?.tasks || conceptTasksData.tasks || [];
        
        console.log('Raw data loaded:', {
            totalProjects: projects.length,
            totalAssignments: allAssignments.length,
            totalConceptTasks: conceptTasks.length,
            userTeam
        });
        
        // Filter projects by team
        const teamProjects = projects.filter(p => p.team === userTeam);
        
        // Filter assignments by team projects
        const projectIds = new Set(teamProjects.map(p => p.id));
        const assignments = allAssignments.filter(a => {
            const projectId = a.projectId || a.project_id;
            return projectIds.has(projectId);
        });
        
        console.log('After filtering:', {
            teamProjects: teamProjects.length,
            projectIds: projectIds.size,
            filteredAssignments: assignments.length
        });
        
        // Calculate concept hours map (sum of hours from concept tasks per project)
        const conceptHoursMap = new Map();
        
        console.log('Building conceptHoursMap from concept tasks:', {
            totalConceptTasks: conceptTasks.length,
            sampleTask: conceptTasks[0]
        });
        
        conceptTasks.forEach(task => {
            const projectId = task.projectId || task.project_id;
            
            console.log('Processing concept task:', {
                taskId: task.id,
                projectId: projectId,
                hours: task.hours,
                isInProjectIds: projectIds.has(projectId)
            });
            
            if (!projectId || !projectIds.has(projectId)) return;
            
            const hours = parseFloat(task.hours) || 0;
            
            if (!conceptHoursMap.has(projectId)) {
                conceptHoursMap.set(projectId, 0);
            }
            
            conceptHoursMap.set(projectId, conceptHoursMap.get(projectId) + hours);
        });
        
        console.log('Concept hours map built:', {
            mapSize: conceptHoursMap.size,
            entries: Array.from(conceptHoursMap.entries())
        });
        
        console.log(`Effort Tracking: Loaded ${teamProjects.length} projects, ${assignments.length} assignments, and ${conceptTasks.length} concept tasks for team "${userTeam}"`);
        
        return { projects: teamProjects, assignments, conceptHoursMap };
        
    } catch (error) {
        console.error('Error loading effort data:', error);
        return { projects: [], assignments: [], conceptHoursMap: new Map() };
    }
}
