// Charts Initialization Component

import { projectSkillBreakdown, monthKeys, monthLabels, API_CONFIG } from '../config/data.js';
import { formatNumber, getStatusText, getDomainText, getPriorityText } from '../utils/helpers.js';

// Store chart instances to destroy them before recreating
const chartInstances = {};

// Flag to prevent multiple simultaneous chart initializations
let isInitializing = false;

// Cache for API data
let assignmentsCache = null;
let resourcesCache = null;

/**
 * Load assignments and resources from API
 */
async function loadAPIData() {
    const awsAccessKey = sessionStorage.getItem('aws_access_key');
    const userTeam = sessionStorage.getItem('user_team');
    
    if (!awsAccessKey || !userTeam) {
        console.warn('No authentication for charts');
        return { assignments: [], resources: [] };
    }
    
    try {
        const [assignmentsRes, resourcesRes] = await Promise.all([
            fetch(`${API_CONFIG.BASE_URL}/assignments`, {
                headers: {
                    'Authorization': awsAccessKey,
                    'x-user-team': userTeam
                }
            }),
            fetch(`${API_CONFIG.BASE_URL}/resources`, {
                headers: {
                    'Authorization': awsAccessKey,
                    'x-user-team': userTeam
                }
            })
        ]);
        
        if (!assignmentsRes.ok || !resourcesRes.ok) {
            throw new Error('Error loading data for charts');
        }
        
        const assignmentsData = await assignmentsRes.json();
        const resourcesData = await resourcesRes.json();
        
        const allAssignments = assignmentsData.data?.assignments || assignmentsData.assignments || [];
        const allResources = resourcesData.data?.resources || resourcesData.resources || [];
        
        // FILTRAR recursos por equipo
        const resources = allResources.filter(r => r.team === userTeam);
        
        // Crear Set de IDs de recursos del equipo
        const teamResourceIds = new Set(resources.map(r => r.id));
        
        // NO FILTRAR assignments por resourceId para la gráfica de Vista General
        // Necesitamos TODOS los assignments del equipo, incluyendo los no asignados
        const assignments = allAssignments;
        
        // Cache the data
        assignmentsCache = assignments;
        resourcesCache = resources;
        
        console.log(`Charts: Filtered by team "${userTeam}" - Resources: ${resources.length}, Assignments: ${assignments.length} (of ${allAssignments.length} total)`);
        
        return { assignments, resources };
    } catch (error) {
        console.error('Error loading API data for charts:', error);
        return { assignments: [], resources: [] };
    }
}

/**
 * Calculate hours by month from real assignments (for year 2026)
 */
function calculateRealHoursByMonth(assignments) {
    const currentYear = 2026;
    const hoursByMonth = new Array(12).fill(0);
    const hoursByMonthProyecto = new Array(12).fill(0);
    const hoursByMonthEvolutivo = new Array(12).fill(0);
    
    assignments.forEach(assignment => {
        if (assignment.year === currentYear && assignment.month >= 1 && assignment.month <= 12) {
            const monthIndex = assignment.month - 1; // Convert 1-12 to 0-11
            const hours = parseFloat(assignment.hours) || 0;
            
            hoursByMonth[monthIndex] += hours;
            
            // Get project type from window.allProjects
            if (window.allProjects && assignment.projectId) {
                const project = window.allProjects.find(p => p.id === assignment.projectId);
                if (project) {
                    if (project.type === 'Proyecto') {
                        hoursByMonthProyecto[monthIndex] += hours;
                    } else if (project.type === 'Evolutivo') {
                        hoursByMonthEvolutivo[monthIndex] += hours;
                    }
                }
            }
        }
    });
    
    return { hoursByMonth, hoursByMonthProyecto, hoursByMonthEvolutivo };
}

/**
 * Calculate capacity by month based on real resources
 */
function calculateRealCapacity(resources) {
    const capacityByMonth = new Array(12).fill(0);
    const capacityPerMonth = resources.length * 160; // Each resource = 160h/month
    
    for (let i = 0; i < 12; i++) {
        capacityByMonth[i] = capacityPerMonth;
    }
    
    return capacityByMonth;
}

/**
 * Calculate hours by skill/profile from real assignments
 */
function calculateRealHoursBySkill(assignments) {
    const currentYear = 2026;
    const skills = ['Project Management', 'Análisis', 'Diseño', 'Construcción', 'QA', 'General'];
    const hoursBySkill = {};
    
    skills.forEach(skill => {
        hoursBySkill[skill] = new Array(12).fill(0);
    });
    
    assignments.forEach(assignment => {
        if (assignment.year === currentYear && assignment.month >= 1 && assignment.month <= 12) {
            const monthIndex = assignment.month - 1;
            const hours = parseFloat(assignment.hours) || 0;
            const skillName = assignment.skillName || 'General';
            
            if (hoursBySkill[skillName]) {
                hoursBySkill[skillName][monthIndex] += hours;
            } else {
                // If skill doesn't match, add to General
                hoursBySkill['General'][monthIndex] += hours;
            }
        }
    });
    
    return hoursBySkill;
}

/**
 * Destroy a chart instance if it exists
 * @param {string} chartId - The ID of the chart canvas element
 */
function destroyChart(chartId) {
    if (chartInstances[chartId]) {
        chartInstances[chartId].destroy();
        delete chartInstances[chartId];
    }
}

/**
 * Initialize all charts in the application
 */
export async function initializeAllCharts() {
    // Prevent multiple simultaneous initializations
    if (isInitializing) {
        console.log('Chart initialization already in progress, skipping...');
        return;
    }
    
    isInitializing = true;
    
    try {
        // Overview tab charts - now async with real data
        console.log('📊 Initializing overview committed hours chart...');
        await initializeOverviewCommittedHoursChart();
        console.log('✅ Overview committed hours chart done');
        
        // Import and initialize new overview charts
        console.log('📊 Importing overviewCharts.js...');
        const { initializeOverviewCharts } = await import('./overviewCharts.js');
        console.log('✅ overviewCharts.js imported, calling initializeOverviewCharts...');
        await initializeOverviewCharts();
        console.log('✅ initializeOverviewCharts completed');
        
        // Projects tab charts
        initializeProjectsByStatusChart();
        initializeProjectsByDomainChart();
        initializeProjectsByPriorityChart();
        
        // Matrix tab charts
        initializeMatrixCommittedHoursChart();
        initializeCommittedHoursChart();
        initializeSkillDistributionChart();
        
        // Matrix charts with async imports - await them to prevent race conditions
        await initializeMatrixHoursByTypeChart();
        await initializeMatrixHoursByDomainChart();
        
        // Resources tab charts
        await initializeResourcesCommittedHoursChart();
        initializeResourcesHoursBySkillChart();
        
        console.log('All charts initialized with real data');
    } finally {
        isInitializing = false;
    }
}

/**
 * Initialize Overview Committed Hours Chart
 * IMPORTA Y USA directamente la función de resourceCapacity.js
 */
async function initializeOverviewCommittedHoursChart() {
    const chartId = 'overview-committed-hours-chart';
    const ctx = document.getElementById(chartId);
    if (!ctx) return;
    
    // Destroy existing chart if it exists
    destroyChart(chartId);
    
    try {
        // Importar la función de cálculo desde resourceCapacity.js
        const { calculateCapacityHoursFromResourceCapacity } = await import('./resourceCapacity.js');
        
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
            console.warn('No authentication for overview chart');
            console.warn('Auth type:', authType, 'Token:', !!awsAccessKey, 'Team:', userTeam);
            return;
        }
        
        // Usar la MISMA función que usa Gestión de Capacidad
        const { potentialAvailableHours, committedHours } = await calculateCapacityHoursFromResourceCapacity(awsAccessKey, userTeam);
        
        // Determine which months to show based on period filter
        let monthsToShow = monthLabels;
        let filteredPotentialHours = potentialAvailableHours;
        let filteredCommittedHours = committedHours;
        
        if (window.currentPeriod && window.getPeriodDateRange) {
            const dateRange = window.getPeriodDateRange(window.currentPeriod);
            if (dateRange.length > 0) {
                const monthIndices = dateRange.map(d => d.month - 1);
                monthsToShow = monthIndices.map(i => monthLabels[i]);
                filteredPotentialHours = monthIndices.map(i => potentialAvailableHours[i]);
                filteredCommittedHours = monthIndices.map(i => committedHours[i]);
                console.log('Filtering months for period:', window.currentPeriod, 'Indices:', monthIndices, 'Labels:', monthsToShow);
            }
        }
        
        console.log('Overview Committed Hours Chart - Using resourceCapacity.js logic:', {
            period: window.currentPeriod || 'all',
            monthsToShow,
            committedHours: filteredCommittedHours,
            potentialAvailableHours: filteredPotentialHours
        });

        chartInstances[chartId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: monthsToShow,
                datasets: [
                    {
                        label: 'Horas Comprometidas',
                        data: filteredCommittedHours,
                        backgroundColor: '#6b7280',
                        borderColor: '#4b5563',
                        borderWidth: 1
                    },
                    {
                        label: 'Horas potenciales disponibles (excl. ausencias)',
                        data: filteredPotentialHours,
                        backgroundColor: '#10b981',
                        borderColor: '#059669',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom'
                    },
                    title: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += formatNumber(context.parsed.y);
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Horas' },
                        ticks: {
                            callback: function(value) {
                                return formatNumber(value);
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error initializing Overview Committed Hours Chart:', error);
    }
}

/**
 * Initialize Overview Skill Distribution Chart with REAL DATA
 */
async function initializeOverviewSkillDistributionChart() {
    const chartId = 'overview-skill-distribution-chart';
    const ctx = document.getElementById(chartId);
    if (!ctx) return;
    
    // Destroy existing chart if it exists
    destroyChart(chartId);
    
    // Load real data from API
    const { assignments, resources } = await loadAPIData();
    
    // Calculate real hours by skill
    const skillTotals = calculateRealHoursBySkill(assignments);
    const realCapacity = calculateRealCapacity(resources);
    
    console.log('Skill Distribution Chart - Real Data:', {
        assignments: assignments.length,
        resources: resources.length,
        skillTotals,
        capacity: realCapacity
    });
    
    const skillColors = {
        'Construcción': '#4db6ac',
        'Análisis': '#64b5f6',
        'Diseño': '#ffb74d',
        'QA': '#81c784',
        'Project Management': '#ba68c8',
        'General': '#90a4ae'
    };
    
    const datasets = Object.keys(skillTotals).map(skill => ({
        label: skill,
        data: skillTotals[skill],
        backgroundColor: skillColors[skill],
        borderColor: skillColors[skill],
        borderWidth: 1,
        stack: 'skills',
        order: 2
    }));
    
    // Add the red capacity line with real data
    datasets.push({
        label: 'Capacidad Real Disponible',
        data: realCapacity,
        type: 'line',
        borderColor: '#dc2626',
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 4,
        order: 1
    });
    
    chartInstances[chartId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: monthLabels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: { boxWidth: 12, padding: 8, font: { size: 10 } }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += formatNumber(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: { stacked: true },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    title: { display: true, text: 'Horas' },
                    ticks: {
                        callback: function(value) {
                            return formatNumber(value);
                        }
                    }
                }
            }
        }
    });
}

/**
 * Initialize Overview Capacity by Profile Chart with REAL DATA
 * Uses the "team" column from assignments table
 */
async function initializeOverviewCapacityByProfileChart() {
    const chartId = 'overview-capacity-by-profile-chart';
    const ctx = document.getElementById(chartId);
    if (!ctx) return;
    
    // Destroy existing chart if it exists
    destroyChart(chartId);
    
    // Load real data from API
    const { assignments, resources } = await loadAPIData();
    
    // Get current month
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentYear = 2026;
    
    // Filter assignments for current month
    const currentMonthAssignments = assignments.filter(a => 
        a.month === currentMonth && a.year === currentYear
    );
    
    // Calculate hours by team (from assignments.team column) and project type
    const teams = ['Conceptualización', 'Análisis', 'Diseño', 'Construcción', 'QA', 'Despliegue'];
    const hoursProyecto = {};
    const hoursEvolutivo = {};
    
    teams.forEach(team => {
        hoursProyecto[team] = 0;
        hoursEvolutivo[team] = 0;
    });
    
    currentMonthAssignments.forEach(assignment => {
        const hours = parseFloat(assignment.hours) || 0;
        const teamName = assignment.team || 'Conceptualización'; // Default to Conceptualización if not set
        
        // Get project type
        let projectType = 'Proyecto';
        if (window.allProjects && assignment.projectId) {
            const project = window.allProjects.find(p => p.id === assignment.projectId);
            if (project && project.type) {
                projectType = project.type;
            }
        }
        
        // Add hours to corresponding team and type
        if (projectType === 'Proyecto') {
            if (hoursProyecto[teamName] !== undefined) {
                hoursProyecto[teamName] += hours;
            } else {
                // If team not in list, add to Conceptualización
                hoursProyecto['Conceptualización'] += hours;
            }
        } else if (projectType === 'Evolutivo') {
            if (hoursEvolutivo[teamName] !== undefined) {
                hoursEvolutivo[teamName] += hours;
            } else {
                // If team not in list, add to Conceptualización
                hoursEvolutivo['Conceptualización'] += hours;
            }
        }
    });
    
    const horasProyectos = teams.map(team => hoursProyecto[team]);
    const horasEvolutivos = teams.map(team => hoursEvolutivo[team]);
    
    console.log('Capacity by Profile Chart - Real Data (using team column):', {
        currentMonth,
        assignments: currentMonthAssignments.length,
        hoursProyecto,
        hoursEvolutivo
    });

    chartInstances[chartId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: teams,
            datasets: [
                {
                    label: 'Horas Comprometidas Proyectos',
                    data: horasProyectos,
                    backgroundColor: 'rgba(49, 151, 149, 0.8)',
                    borderColor: '#319795',
                    borderWidth: 1,
                    stack: 'comprometidas'
                },
                {
                    label: 'Horas Comprometidas Evolutivos',
                    data: horasEvolutivos,
                    backgroundColor: 'rgba(49, 151, 149, 0.4)',
                    borderColor: '#4db8b5',
                    borderWidth: 1,
                    stack: 'comprometidas'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: { boxWidth: 12, padding: 8, font: { size: 10 } }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += formatNumber(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: { stacked: true },
                y: {
                    beginAtZero: true,
                    stacked: true,
                    title: { display: true, text: 'Horas' },
                    ticks: {
                        callback: function(value) {
                            return formatNumber(value);
                        }
                    }
                }
            }
        }
    });
}

/**
 * Initialize Projects by Status Chart
 */
function initializeProjectsByStatusChart() {
    const chartId = 'projects-by-status-chart';
    const ctx = document.getElementById(chartId);
    if (!ctx) return;
    
    // Destroy existing chart if it exists
    destroyChart(chartId);
    
    // Get real projects from global allProjects array (excluding ABSENCES)
    const allProjectsRaw = window.allProjects || [];
    const allProjects = allProjectsRaw.filter(p => !p.code.startsWith('ABSENCES'));
    
    // Count projects by status
    const statusCounts = {};
    allProjects.forEach(project => {
        const statusText = getStatusText(project.status);
        statusCounts[statusText] = (statusCounts[statusText] || 0) + 1;
    });
    
    // Define status order for funnel (from early to late stages)
    const statusOrder = [
        'Idea',
        'Concepto',
        'Viabilidad (TEC-ECO)',
        'Diseño Detallado',
        'Desarrollo',
        'Implantado',
        'Finalizado',
        'On Hold',
        'Cancelado'
    ];
    
    // Filter to only include statuses that exist in the data
    const labels = statusOrder.filter(status => statusCounts[status] > 0);
    const values = labels.map(status => statusCounts[status] || 0);
    const total = values.reduce((a, b) => a + b, 0);
    
    // Handle case when no projects
    if (total === 0) {
        chartInstances[chartId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Sin datos'],
                datasets: [{
                    label: 'Proyectos por Estado',
                    data: [0],
                    backgroundColor: ['#e0f2f1'],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: {
                        beginAtZero: true,
                        max: 1,
                        title: { display: true, text: 'Número de Proyectos' }
                    }
                }
            }
        });
        return;
    }
    
    // Use actual counts (not cumulative) for horizontal bar chart
    const colors = ['#e0f2f1', '#b2dfdb', '#80cbc4', '#4db6ac', '#26a69a', '#009688', '#00796b', '#ef5350', '#f44336'];
    
    chartInstances[chartId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Proyectos por Estado',
                data: values,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return 'Proyectos: ' + context.parsed.x;
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    title: { display: true, text: 'Número de Proyectos' },
                    ticks: {
                        stepSize: 1,
                        callback: function(value) {
                            if (Number.isInteger(value)) {
                                return value;
                            }
                        }
                    }
                }
            }
        }
    });
}

/**
 * Initialize Projects by Domain Chart
 */
function initializeProjectsByDomainChart() {
    const chartId = 'projects-by-domain-chart';
    const ctx = document.getElementById(chartId);
    if (!ctx) return;
    
    // Destroy existing chart if it exists
    destroyChart(chartId);
    
    // Get real projects from global allProjects array (excluding ABSENCES)
    const allProjectsRaw = window.allProjects || [];
    const allProjects = allProjectsRaw.filter(p => !p.code.startsWith('ABSENCES'));
    
    // Count projects by domain
    const domainCounts = {};
    allProjects.forEach(project => {
        const domainText = getDomainText(project.domain);
        domainCounts[domainText] = (domainCounts[domainText] || 0) + 1;
    });
    
    const labels = Object.keys(domainCounts);
    const values = Object.values(domainCounts);
    
    // Handle case when no projects
    if (labels.length === 0) {
        chartInstances[chartId] = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Sin datos'],
                datasets: [{
                    data: [1],
                    backgroundColor: ['#e0e0e0'],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: { boxWidth: 12, padding: 8, font: { size: 10 } }
                    }
                }
            }
        });
        return;
    }
    
    // Generate colors for each domain
    const colors = ['#4db6ac', '#64b5f6', '#ffb74d', '#81c784', '#ba68c8', '#ef5350', '#ab47bc', '#26a69a', '#42a5f5', '#ffa726', '#66bb6a', '#ec407a'];
    
    chartInstances[chartId] = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: { boxWidth: 12, padding: 8, font: { size: 10 } }
                }
            }
        }
    });
}

/**
 * Initialize Projects by Priority Chart
 */
function initializeProjectsByPriorityChart() {
    const chartId = 'projects-by-priority-chart';
    const ctx = document.getElementById(chartId);
    if (!ctx) return;
    
    // Destroy existing chart if it exists
    destroyChart(chartId);
    
    // Get real projects from global allProjects array (excluding ABSENCES)
    const allProjectsRaw = window.allProjects || [];
    const allProjects = allProjectsRaw.filter(p => !p.code.startsWith('ABSENCES'));
    
    // Debug: Log priority values from projects
    console.log('Priority Chart Debug - Total projects:', allProjects.length);
    const rawPriorities = allProjects.map(p => p.priority);
    console.log('Raw priority values:', rawPriorities);
    
    // Count projects by priority
    const priorityCounts = {};
    allProjects.forEach(project => {
        const priorityText = getPriorityText(project.priority);
        priorityCounts[priorityText] = (priorityCounts[priorityText] || 0) + 1;
    });
    
    console.log('Priority counts:', priorityCounts);
    
    // Define priority order (from highest to lowest)
    const priorityOrder = ['Muy Alta', 'Alta', 'Media', 'Baja', 'Muy Baja'];
    
    // Show only priorities that exist in the data (count > 0)
    const labels = priorityOrder.filter(priority => priorityCounts[priority] > 0);
    const values = labels.map(priority => priorityCounts[priority] || 0);
    
    // Handle case when no projects
    if (labels.length === 0) {
        chartInstances[chartId] = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Sin datos'],
                datasets: [{
                    data: [1],
                    backgroundColor: ['#e0e0e0'],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: { boxWidth: 12, padding: 8, font: { size: 10 } }
                    }
                }
            }
        });
        return;
    }
    
    // Colors for priorities (red to green)
    const priorityColors = {
        'Muy Alta': '#ef5350',
        'Alta': '#ff9800',
        'Media': '#ffca28',
        'Baja': '#66bb6a',
        'Muy Baja': '#81c784'
    };
    
    const colors = labels.map(label => priorityColors[label] || '#90a4ae');
    
    chartInstances[chartId] = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: { boxWidth: 12, padding: 8, font: { size: 10 } }
                }
            }
        }
    });
}

/**
 * Initialize Matrix Committed Hours Chart (new chart in Matrix tab)
 */
function initializeMatrixCommittedHoursChart() {
    const chartId = 'matrix-committed-hours-chart';
    const ctx = document.getElementById(chartId);
    if (!ctx) return;
    
    // Destroy existing chart if it exists
    destroyChart(chartId);
    
    const committedHours = calculateCommittedHoursByMonth();
    const horasProyectos = committedHours.map(hours => Math.round(hours * 0.8));
    const horasEvolutivos = committedHours.map(hours => Math.round(hours * 0.2));
    const availableHours = [1750, 1720, 1760, 1740, 1700, 1780, 1750, 1730, 1760, 1770, 1750, 1740];

    chartInstances[chartId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: monthLabels,
            datasets: [
                {
                    label: 'Horas Comprometidas Proyectos',
                    data: horasProyectos,
                    backgroundColor: 'rgba(49, 151, 149, 0.8)',
                    borderColor: '#319795',
                    borderWidth: 1,
                    stack: 'comprometidas',
                    order: 2
                },
                {
                    label: 'Horas Comprometidas Evolutivos',
                    data: horasEvolutivos,
                    backgroundColor: 'rgba(49, 151, 149, 0.4)',
                    borderColor: '#4db8b5',
                    borderWidth: 1,
                    stack: 'comprometidas',
                    order: 2
                },
                {
                    label: 'Capacidad Real Disponible',
                    data: availableHours,
                    type: 'line',
                    borderColor: '#dc2626',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    pointRadius: 4,
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: { boxWidth: 12, padding: 8, font: { size: 10 } }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += formatNumber(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: { stacked: true },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    beginAtZero: true,
                    stacked: true,
                    title: { display: true, text: 'Horas' },
                    ticks: {
                        callback: function(value) {
                            return formatNumber(value);
                        }
                    }
                }
            }
        }
    });
}

/**
 * Initialize Committed Hours Chart (Matrix tab)
 */
function initializeCommittedHoursChart() {
    const ctx = document.getElementById('committed-hours-chart');
    if (!ctx) return;
    
    // Similar implementation to overview chart
    initializeOverviewCommittedHoursChart();
}

/**
 * Initialize Skill Distribution Chart (Matrix tab)
 */
function initializeSkillDistributionChart() {
    const ctx = document.getElementById('skill-distribution-chart');
    if (!ctx) return;
    
    // Similar implementation to overview chart
    initializeOverviewSkillDistributionChart();
}

/**
 * Helper: Calculate committed hours by month
 */
function calculateCommittedHoursByMonth() {
    const committedHours = new Array(12).fill(0);
    
    Object.keys(projectSkillBreakdown).forEach(projectId => {
        const project = projectSkillBreakdown[projectId];
        monthKeys.forEach((monthKey, index) => {
            let monthTotal = 0;
            Object.keys(project.skills).forEach(skillName => {
                monthTotal += project.skills[skillName][monthKey] || 0;
            });
            committedHours[index] += monthTotal;
        });
    });
    
    return committedHours;
}

/**
 * Helper: Calculate skill totals by month
 */
function calculateSkillTotalsByMonth() {
    const skillTotals = {
        'Construcción': new Array(12).fill(0),
        'Análisis': new Array(12).fill(0),
        'Diseño': new Array(12).fill(0),
        'QA': new Array(12).fill(0),
        'Project Management': new Array(12).fill(0),
        'General': new Array(12).fill(0)
    };
    
    Object.keys(projectSkillBreakdown).forEach(projectId => {
        const project = projectSkillBreakdown[projectId];
        Object.keys(project.skills).forEach(skillName => {
            monthKeys.forEach((monthKey, index) => {
                const hours = project.skills[skillName][monthKey] || 0;
                if (skillTotals[skillName]) {
                    skillTotals[skillName][index] += hours;
                }
            });
        });
    });
    
    return skillTotals;
}

/**
 * Helper: Calculate committed hours by profile for a specific month
 */
function calculateCommittedHoursByProfile(month) {
    const committedHours = {
        'Construcción': 0,
        'Diseño': 0,
        'Project Management': 0,
        'QA': 0,
        'Análisis': 0,
        'General': 0
    };
    
    Object.keys(projectSkillBreakdown).forEach(projectId => {
        const project = projectSkillBreakdown[projectId];
        Object.keys(project.skills).forEach(skillName => {
            const hours = project.skills[skillName][month] || 0;
            if (committedHours[skillName] !== undefined) {
                committedHours[skillName] += hours;
            }
        });
    });
    
    return committedHours;
}

/**
 * Initialize Matrix Hours by Type Chart (Vertical Bar Chart) with REAL DATA
 */
async function initializeMatrixHoursByTypeChart() {
    const chartId = 'matrix-hours-by-type-chart';
    const ctx = document.getElementById(chartId);
    if (!ctx) return;
    
    // Destroy existing chart if it exists
    destroyChart(chartId);
    
    try {
        // Load real data from API
        const { assignments } = await loadAPIData();
        
        // Calculate total hours by project type
        let hoursProyectos = 0;
        let hoursEvolutivos = 0;
        
        // Group hours by project type
        const projectHours = {};
        
        assignments.forEach(assignment => {
            const projectId = assignment.projectId;
            if (!projectId) return;
            
            const hours = parseFloat(assignment.hours) || 0;
            
            if (!projectHours[projectId]) {
                projectHours[projectId] = 0;
            }
            projectHours[projectId] += hours;
        });
        
        // Sum by project type
        Object.keys(projectHours).forEach(projectId => {
            const project = window.allProjects?.find(p => p.id === projectId);
            if (!project) return;
            
            const hours = projectHours[projectId];
            
            if (project.type === 'Proyecto') {
                hoursProyectos += hours;
            } else if (project.type === 'Evolutivo') {
                hoursEvolutivos += hours;
            }
        });
        
        console.log('Matrix Hours by Type Chart - Real Data:', {
            assignments: assignments.length,
            hoursProyectos,
            hoursEvolutivos
        });
        
        chartInstances[chartId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Proyecto', 'Evolutivo'],
                datasets: [{
                    label: 'Horas Totales',
                    data: [hoursProyectos, hoursEvolutivos],
                    backgroundColor: ['#4db6ac', '#64b5f6'],
                    borderColor: ['#26a69a', '#42a5f5'],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return 'Horas: ' + formatNumber(context.parsed.y);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Horas' },
                        ticks: {
                            callback: function(value) {
                                return formatNumber(value);
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error initializing Matrix Hours by Type Chart:', error);
    }
}

/**
 * Initialize Matrix Hours by Domain Chart (Horizontal Bar Chart)
 */
async function initializeMatrixHoursByDomainChart() {
    const chartId = 'matrix-hours-by-domain-chart';
    const ctx = document.getElementById(chartId);
    if (!ctx) return;
    
    // Destroy existing chart if it exists
    destroyChart(chartId);
    
    // Import projectMetadata to get dominiosPrincipales information
    const module = await import('../config/data.js');
    const { projectMetadata } = module;
    
    const hoursByDomain = calculateHoursByDomain(projectMetadata);
    const domains = Object.keys(hoursByDomain).sort((a, b) => hoursByDomain[b] - hoursByDomain[a]);
    const hours = domains.map(domain => hoursByDomain[domain]);
    
    const colors = ['#4db6ac', '#64b5f6', '#ffb74d', '#81c784', '#ba68c8', '#90a4ae', '#ef5350'];
    
    chartInstances[chartId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: domains,
            datasets: [{
                label: 'Horas Totales',
                data: hours,
                backgroundColor: colors.slice(0, domains.length),
                borderColor: colors.slice(0, domains.length).map(c => c),
                borderWidth: 2
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return 'Horas: ' + formatNumber(context.parsed.x);
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    title: { display: true, text: 'Horas' },
                    ticks: {
                        callback: function(value) {
                            return formatNumber(value);
                        }
                    }
                }
            }
        }
    });
}

/**
 * Helper: Calculate total hours by project type
 */
function calculateHoursByType(projectMetadata) {
    const hoursByType = {
        'Proyecto': 0,
        'Evolutivo': 0
    };
    
    Object.keys(projectSkillBreakdown).forEach(projectId => {
        const project = projectSkillBreakdown[projectId];
        const metadata = projectMetadata[projectId];
        
        if (!metadata) return;
        
        let totalHours = 0;
        Object.keys(project.skills).forEach(skillName => {
            monthKeys.forEach(month => {
                totalHours += project.skills[skillName][month] || 0;
            });
        });
        
        const tipo = metadata.tipo || 'Proyecto';
        hoursByType[tipo] += totalHours;
    });
    
    return hoursByType;
}

/**
 * Helper: Calculate total hours by domain
 */
function calculateHoursByDomain(projectMetadata) {
    const hoursByDomain = {};
    
    Object.keys(projectSkillBreakdown).forEach(projectId => {
        const project = projectSkillBreakdown[projectId];
        const metadata = projectMetadata[projectId];
        
        if (!metadata) return;
        
        let totalHours = 0;
        Object.keys(project.skills).forEach(skillName => {
            monthKeys.forEach(month => {
                totalHours += project.skills[skillName][month] || 0;
            });
        });
        
        const domain = metadata.dominiosPrincipales || metadata.domain || 'Sin Dominio';
        if (!hoursByDomain[domain]) {
            hoursByDomain[domain] = 0;
        }
        hoursByDomain[domain] += totalHours;
    });
    
    return hoursByDomain;
}

/**
 * Initialize Resources Committed Hours Chart (Vertical Bar Chart) with REAL DATA
 */
async function initializeResourcesCommittedHoursChart() {
    const chartId = 'resources-committed-hours-chart';
    const ctx = document.getElementById(chartId);
    if (!ctx) return;
    
    // Destroy existing chart if it exists
    destroyChart(chartId);
    
    try {
        // Load real data from API
        const { assignments, resources } = await loadAPIData();
        
        // Calculate real committed hours by month
        const { hoursByMonth } = calculateRealHoursByMonth(assignments);
        const realCapacity = calculateRealCapacity(resources);
        
        // Calculate available hours = capacity - committed
        const availableHours = realCapacity.map((capacity, index) => {
            const available = capacity - hoursByMonth[index];
            return available > 0 ? available : 0;
        });
        
        console.log('Resources Committed Hours Chart - Real Data:', {
            assignments: assignments.length,
            resources: resources.length,
            committedHours: hoursByMonth,
            capacity: realCapacity,
            available: availableHours
        });

        chartInstances[chartId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: monthLabels,
                datasets: [
                    {
                        label: 'Horas Comprometidas',
                        data: hoursByMonth,
                        backgroundColor: '#9ca3af',
                        borderColor: '#6b7280',
                        borderWidth: 1
                    },
                    {
                        label: 'Horas Disponibles',
                        data: availableHours,
                        backgroundColor: '#10b981',
                        borderColor: '#059669',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: { boxWidth: 12, padding: 8, font: { size: 10 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += formatNumber(context.parsed.y);
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: { stacked: false },
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Horas' },
                        ticks: {
                            callback: function(value) {
                                return formatNumber(value);
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error initializing Resources Committed Hours Chart:', error);
    }
}

/**
 * Initialize Resources Hours by Skill Chart (Stacked Vertical Bar Chart - Potential Available Hours by Profile)
 */
function initializeResourcesHoursBySkillChart() {
    const chartId = 'resources-hours-by-skill-chart';
    const ctx = document.getElementById(chartId);
    if (!ctx) return;
    
    // Destroy existing chart if it exists
    destroyChart(chartId);
    
    const tableData = extractResourceTableData();
    const availableBySkill = tableData.availableBySkill;
    const availableBySkillByMonth = tableData.availableBySkillByMonth;
    
    // Order skills in the specified order
    const skillOrder = ['Project Management', 'Análisis', 'Diseño', 'Construcción', 'QA', 'General'];
    const sortedSkills = skillOrder.filter(skill => availableBySkill[skill] !== undefined);
    
    // Current month index (July = 6)
    const currentMonthIdx = 6;
    
    // Calculate available hours for current month and future months for each skill
    const currentMonthHours = sortedSkills.map(skill => {
        return availableBySkillByMonth[skill] ? availableBySkillByMonth[skill][currentMonthIdx] : 0;
    });
    
    const futureMonthsHours = sortedSkills.map(skill => {
        if (!availableBySkillByMonth[skill]) return 0;
        let total = 0;
        for (let i = currentMonthIdx + 1; i < 12; i++) {
            total += availableBySkillByMonth[skill][i] || 0;
        }
        return total;
    });
    
    chartInstances[chartId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedSkills,
            datasets: [
                {
                    label: 'Mes Actual',
                    data: currentMonthHours,
                    backgroundColor: '#4db6ac',
                    borderColor: '#26a69a',
                    borderWidth: 1,
                    stack: 'availability'
                },
                {
                    label: 'Meses Futuros',
                    data: futureMonthsHours,
                    backgroundColor: '#80cbc4',
                    borderColor: '#4db6ac',
                    borderWidth: 1,
                    stack: 'availability'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: { boxWidth: 12, padding: 8, font: { size: 10 } }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += formatNumber(context.parsed.y) + ' horas';
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: { stacked: true },
                y: {
                    beginAtZero: true,
                    stacked: true,
                    title: { display: true, text: 'Horas Disponibles' },
                    ticks: {
                        callback: function(value) {
                            return formatNumber(value);
                        }
                    }
                }
            }
        }
    });
}

/**
 * Helper: Extract data from the Resources table in the DOM
 * Reads the black numbers (committed hours) and green numbers in parentheses (available hours)
 */
function extractResourceTableData() {
    const result = {
        committedByMonth: new Array(12).fill(0),
        availableByMonth: new Array(12).fill(0),
        committedBySkill: {},
        availableBySkill: {},
        availableBySkillByMonth: {}
    };
    
    // Find the resources table in the Resources tab
    const resourcesTab = document.getElementById('resources-tab');
    if (!resourcesTab) return result;
    
    const table = resourcesTab.querySelector('.capacity-matrix table');
    if (!table) return result;
    
    const rows = table.querySelectorAll('tbody tr');
    
    rows.forEach(row => {
        // Get all skill badges for this resource (can have multiple)
        const skillBadges = row.querySelectorAll('.skill-badge');
        if (skillBadges.length === 0) return;
        
        // Map abbreviated names to full skill names
        const skillMap = {
            'PM': 'Project Management',
            'Ana': 'Análisis',
            'Dis': 'Diseño',
            'Cons': 'Construcción',
            'QA': 'QA',
            'Gen': 'General'
        };
        
        // Process each skill badge for this resource
        skillBadges.forEach(skillBadge => {
            const abbreviatedName = skillBadge.textContent.trim();
            const skillName = skillMap[abbreviatedName] || abbreviatedName;
            
            // Initialize skill totals if not exists
            if (!result.committedBySkill[skillName]) {
                result.committedBySkill[skillName] = 0;
                result.availableBySkill[skillName] = 0;
                result.availableBySkillByMonth[skillName] = new Array(12).fill(0);
            }
        });
        
        // Get all capacity cells (skip first three columns: name, ratio, and skills)
        const cells = row.querySelectorAll('td');
        
        // Start from index 3 (first three are name, ratio, and skills columns)
        for (let i = 3; i < cells.length && i < 15; i++) {
            const cell = cells[i];
            const capacityCell = cell.querySelector('.capacity-cell');
            
            if (capacityCell) {
                // Extract the main number (committed hours) - the text before the span
                const fullText = capacityCell.childNodes[0]?.textContent?.trim() || '0';
                const committedHours = parseInt(fullText) || 0;
                
                // Extract the available hours from the green span
                const availableSpan = capacityCell.querySelector('.available-hours');
                let availableHours = 0;
                if (availableSpan) {
                    const availableText = availableSpan.textContent.trim();
                    // Remove parentheses and parse
                    availableHours = parseInt(availableText.replace(/[()]/g, '')) || 0;
                }
                
                // Add to month totals (i-3 because we skip first three columns)
                const monthIndex = i - 3;
                result.committedByMonth[monthIndex] += committedHours;
                result.availableByMonth[monthIndex] += availableHours;
                
                // Add to skill totals for each skill this resource has
                skillBadges.forEach(skillBadge => {
                    const abbreviatedName = skillBadge.textContent.trim();
                    const skillName = skillMap[abbreviatedName] || abbreviatedName;
                    
                    // Divide hours equally among all skills for this resource
                    const hoursPerSkill = availableHours / skillBadges.length;
                    result.committedBySkill[skillName] += committedHours / skillBadges.length;
                    result.availableBySkill[skillName] += hoursPerSkill;
                    result.availableBySkillByMonth[skillName][monthIndex] += hoursPerSkill;
                });
            }
        }
    });
    
    return result;
}
