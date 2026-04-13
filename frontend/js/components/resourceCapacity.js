/**
 * Resource Capacity Management Module
 * Handles loading and displaying resource capacity data dynamically from API
 */

import { API_CONFIG } from '../config/data.js';

// Global state
let capacityData = null;
let currentYear = new Date().getFullYear();
let allResources = [];
let filteredResources = [];
let currentCapacityPage = 1;
const capacityEntriesPerPage = 10;

/**
 * Initialize resource capacity management
 */
export function initializeResourceCapacity() {
    console.log('Initializing Resource Capacity Management...');
    
    // Load capacity data when the capacity tab is opened
    document.addEventListener('click', function(e) {
        const tabButton = e.target.closest('.tab-button');
        if (tabButton && tabButton.getAttribute('data-tab') === 'resources-tab') {
            console.log('Capacity tab opened, loading capacity data...');
            loadCapacityData();
        }
    });
    
    console.log('Resource Capacity Management initialized');
}

/**
 * Load capacity overview data from API
 */
async function loadCapacityData() {
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
            console.warn('No authentication tokens found');
            console.warn('Auth type:', authType, 'Token:', !!awsAccessKey, 'Team:', userTeam);
            showErrorMessage('No se encontraron credenciales de autenticación');
            return;
        }
        
        console.log('Loading capacity data from API...');
        console.log('User team:', userTeam);
        console.log('Year:', currentYear);
        
        // Fetch resources
        const resourcesResponse = await fetch(
            `${API_CONFIG.BASE_URL}/resources`, 
            {
                headers: {
                    'Authorization': authType === 'cognito' ? `Bearer ${awsAccessKey}` : awsAccessKey,
                    'x-user-team': userTeam
                }
            }
        );
        
        if (!resourcesResponse.ok) {
            console.error('Resources response not OK:', resourcesResponse.status, resourcesResponse.statusText);
            throw new Error('Error al cargar recursos');
        }
        
        const resourcesData = await resourcesResponse.json();
        const resources = resourcesData.data?.resources || resourcesData.resources || [];
        console.log('Resources loaded:', resources.length);
        
        // Fetch assignments
        const assignmentsResponse = await fetch(
            `${API_CONFIG.BASE_URL}/assignments`, 
            {
                headers: {
                    'Authorization': authType === 'cognito' ? `Bearer ${awsAccessKey}` : awsAccessKey,
                    'x-user-team': userTeam
                }
            }
        );
        
        if (!assignmentsResponse.ok) {
            console.error('Assignments response not OK:', assignmentsResponse.status, assignmentsResponse.statusText);
            throw new Error('Error al cargar asignaciones');
        }
        
        const assignmentsData = await assignmentsResponse.json();
        const assignments = assignmentsData.data?.assignments || assignmentsData.assignments || [];
        console.log('Assignments loaded:', assignments.length);
        
        // Build capacity data structure
        capacityData = buildCapacityData(resources, assignments);
        
        // Calculate potential available hours (base hours - absences) and committed hours (excluding absences)
        const { potentialAvailableHours, committedHours } = await calculateCapacityHours(awsAccessKey, userTeam);
        
        // Update all UI components
        updateKPIs(capacityData.kpis);
        updateCharts(capacityData.charts, potentialAvailableHours, committedHours);
        updateCapacityMatrix(capacityData.resources, capacityData.currentMonth);
        
        console.log('Capacity view updated successfully');
        
    } catch (error) {
        console.error('Error loading capacity data:', error);
        showErrorMessage('Error al cargar datos de capacidad. Por favor, intenta de nuevo.');
    }
}

/**
 * Build capacity data structure from resources and assignments
 */
function buildCapacityData(resources, assignments) {
    const currentMonth = new Date().getMonth() + 1; // 1-12
    
    // Build resources with monthly data
    const resourcesWithMonthlyData = resources.map(resource => {
        const monthlyData = [];
        
        // Get assignments for this resource (support both snake_case and camelCase)
        const resourceAssignments = assignments.filter(a => {
            const assignmentResourceId = a.resource_id || a.resourceId;
            return assignmentResourceId === resource.id;
        });
        
        // Build monthly data for each month
        for (let month = 1; month <= 12; month++) {
            const monthAssignments = resourceAssignments.filter(a => {
                let assignmentMonth = a.month;
                let assignmentYear = a.year;
                
                // Extract from date if month/year not available
                if ((!assignmentMonth || !assignmentYear) && a.date) {
                    const dateObj = new Date(a.date);
                    assignmentMonth = dateObj.getMonth() + 1;
                    assignmentYear = dateObj.getFullYear();
                }
                
                return assignmentMonth === month && assignmentYear === currentYear;
            });
            
            // Calculate committed hours for this month
            const committedHours = monthAssignments.reduce((sum, a) => sum + (parseFloat(a.hours) || 0), 0);
            
            // Calculate available hours (default capacity - committed)
            const defaultCapacity = resource.defaultCapacity || resource.default_capacity || 160;
            const availableHours = Math.max(0, defaultCapacity - committedHours);
            
            // Calculate utilization rate
            const utilizationRate = defaultCapacity > 0 ? Math.round((committedHours / defaultCapacity) * 100) : 0;
            
            // Build assignments array for this month
            const monthAssignmentsData = monthAssignments.map(a => ({
                projectCode: a.project?.code || '',
                projectTitle: a.project?.title || '',
                projectType: a.project?.type || '',
                team: a.team || '',
                skillName: a.skillName || '',
                hours: parseFloat(a.hours) || 0
            }));
            
            monthlyData.push({
                month,
                committedHours: Math.round(committedHours),
                availableHours: Math.round(availableHours),
                utilizationRate,
                assignments: monthAssignmentsData
            });
        }
        
        // Calculate average utilization
        const avgUtilization = Math.round(
            monthlyData.reduce((sum, m) => sum + m.utilizationRate, 0) / 12
        );
        
        return {
            ...resource,
            monthlyData,
            avgUtilization
        };
    });
    
    // Calculate KPIs
    const totalResources = resources.length;
    const resourcesWithAssignment = resources.filter(r => {
        return assignments.some(a => a.resourceId === r.id);
    }).length;
    const resourcesWithoutAssignment = totalResources - resourcesWithAssignment;
    
    // Calculate average utilization for current and future months
    const currentMonthUtilization = resourcesWithMonthlyData.reduce((sum, r) => {
        const monthData = r.monthlyData.find(m => m.month === currentMonth);
        return sum + (monthData?.utilizationRate || 0);
    }, 0) / (totalResources || 1);
    
    const futureMonthsUtilization = resourcesWithMonthlyData.reduce((sum, r) => {
        const futureMonths = r.monthlyData.filter(m => m.month > currentMonth);
        const avgFuture = futureMonths.reduce((s, m) => s + m.utilizationRate, 0) / (futureMonths.length || 1);
        return sum + avgFuture;
    }, 0) / (totalResources || 1);
    
    const kpis = {
        totalResources,
        resourcesWithAssignment,
        resourcesWithoutAssignment,
        avgUtilization: {
            current: Math.round(currentMonthUtilization),
            future: Math.round(futureMonthsUtilization)
        }
    };
    
    // Build charts data
    const monthlyComparison = [];
    for (let month = 1; month <= 12; month++) {
        const monthData = resourcesWithMonthlyData.reduce((acc, r) => {
            const data = r.monthlyData.find(m => m.month === month);
            return {
                committedHours: acc.committedHours + (data?.committedHours || 0),
                availableHours: acc.availableHours + (data?.availableHours || 0)
            };
        }, { committedHours: 0, availableHours: 0 });
        
        monthlyComparison.push(monthData);
    }
    
    // Build skills availability (simplified - you can enhance this)
    const skillsAvailability = [
        { skill: 'Project Management', currentMonth: 0, futureMonths: 0 },
        { skill: 'Análisis', currentMonth: 0, futureMonths: 0 },
        { skill: 'Diseño', currentMonth: 0, futureMonths: 0 },
        { skill: 'Construcción', currentMonth: 0, futureMonths: 0 },
        { skill: 'QA', currentMonth: 0, futureMonths: 0 }
    ];
    
    const charts = {
        monthlyComparison,
        skillsAvailability
    };
    
    return {
        resources: resourcesWithMonthlyData,
        kpis,
        charts,
        currentMonth
    };
}

/**
 * Calculate capacity hours: potential available hours and committed hours (excluding absences)
 * EXPORTED for use in other modules (e.g., charts.js)
 */
export async function calculateCapacityHoursFromResourceCapacity(awsAccessKey, userTeam) {
    return await calculateCapacityHours(awsAccessKey, userTeam);
}

/**
 * Calculate capacity hours: potential available hours and committed hours (excluding absences)
 */
async function calculateCapacityHours(awsAccessKey, userTeam) {
    try {
        console.log('Calculating potential available hours...');
        
        // Check if there's a period filter active (including 'current')
        const hasPeriodFilter = window.currentPeriod && window.filteredAssignmentsByPeriod;
        let monthIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]; // All 12 months by default
        
        if (hasPeriodFilter && window.getPeriodDateRange) {
            const dateRange = window.getPeriodDateRange(window.currentPeriod);
            if (dateRange.length > 0) {
                monthIndices = dateRange.map(d => d.month - 1); // Convert to 0-based index
                console.log('Period filter active:', window.currentPeriod, 'Months:', monthIndices);
            }
        }
        
        // Load all resources
        const resourcesResponse = await fetch(`${API_CONFIG.BASE_URL}/resources`, {
            headers: {
                'Authorization': awsAccessKey,
                'x-user-team': userTeam
            }
        });
        
        if (!resourcesResponse.ok) {
            throw new Error('Error loading resources');
        }
        
        const resourcesData = await resourcesResponse.json();
        let resources = resourcesData.data?.resources || resourcesData.resources || [];
        
        // Filter by team
        resources = resources.filter(r => {
            const resourceTeam = (r.team || '').toLowerCase().trim();
            const normalizedUserTeam = userTeam.toLowerCase().trim();
            return resourceTeam === normalizedUserTeam;
        });
        
        console.log('Resources loaded for potential hours calculation:', resources.length);
        
        // Initialize monthly totals (12 months)
        const monthlyBaseHours = new Array(12).fill(0);
        const monthlyAbsences = new Array(12).fill(0);
        
        // Calculate base hours per month for all resources
        // Formula: (defaultCapacity / 20) * workingDaysInMonth
        resources.forEach(resource => {
            const defaultCapacity = resource.defaultCapacity || 160; // Monthly capacity
            const dailyBaseHours = defaultCapacity / 20; // e.g., 160 / 20 = 8h/day
            
            // Add base hours for each month based on working days
            for (let month = 0; month < 12; month++) {
                const workingDays = getWorkingDaysInMonth(currentYear, month + 1);
                monthlyBaseHours[month] += dailyBaseHours * workingDays;
            }
        });
        
        // ALWAYS load ALL assignments to calculate hours correctly
        // The period filter should only affect which months are DISPLAYED, not which data is used
        const assignmentsResponse = await fetch(`${API_CONFIG.BASE_URL}/assignments`, {
            headers: {
                'Authorization': awsAccessKey,
                'x-user-team': userTeam
            }
        });
        
        if (!assignmentsResponse.ok) {
            throw new Error('Error loading assignments');
        }
        
        const assignmentsData = await assignmentsResponse.json();
        const assignments = assignmentsData.data?.assignments || assignmentsData.assignments || [];
        
        console.log('Assignments loaded for absences calculation:', assignments.length);
        
        // Filter absences (from ABSENCES-{TEAM} projects) and sum by month
        let absencesCount = 0;
        const absencesProjectCode = `ABSENCES-${userTeam}`;
        
        console.log('Looking for absences project:', absencesProjectCode);
        
        assignments.forEach(assignment => {
            const projectCode = assignment.project?.code || '';
            
            // Check if this is an absence for this team
            if (projectCode === absencesProjectCode) {
                // Get month and year from assignment
                // If month/year are null, try to extract from date field
                let month = assignment.month;
                let year = assignment.year;
                
                // If month/year are null but date exists, extract from date
                if ((!month || !year) && assignment.date) {
                    const dateObj = new Date(assignment.date);
                    month = dateObj.getMonth() + 1; // getMonth() returns 0-11
                    year = dateObj.getFullYear();
                }
                
                const hours = parseFloat(assignment.hours) || 0;
                
                console.log('Found absence:', {
                    projectCode,
                    month,
                    year,
                    hours,
                    resourceId: assignment.resourceId,
                    date: assignment.date
                });
                
                // Only count absences for the current year
                if (year === currentYear && month >= 1 && month <= 12) {
                    monthlyAbsences[month - 1] += hours;
                    absencesCount++;
                    console.log(`Added ${hours}h to month ${month} (index ${month - 1})`);
                }
            }
        });
        
        console.log('Total absences found for current year:', absencesCount);
        
        // Calculate committed hours (excluding ABSENCES project) by month
        // Sum all hours from assignments grouped by month, excluding ABSENCES
        const monthlyCommittedHours = new Array(12).fill(0);
        let committedCount = 0;
        
        // Group assignments by project to show summary
        const projectSummary = {};
        
        assignments.forEach(assignment => {
            const projectCode = assignment.project?.code || '';
            const projectTitle = assignment.project?.title || 'Sin título';
            const resourceId = assignment.resourceId;
            
            // Get team from assignment.team field (skillName in lowercase)
            // assignment.team contains the skill name like "Project Management", "Construcción", etc.
            // We need to check if assignment exists for this user's team by checking if resourceId is assigned
            const normalizedUserTeam = userTeam.toLowerCase().trim();
            
            console.log('Processing assignment:', {
                projectCode,
                projectTitle,
                assignmentTeam: assignment.team,
                userTeam: normalizedUserTeam,
                month: assignment.month,
                year: assignment.year,
                hours: assignment.hours,
                resourceId: assignment.resourceId,
                hasResource: !!assignment.resourceId
            });
            
            // Exclude ABSENCES projects
            // For committed hours, we only count assignments that have a resourceId (assigned tasks)
            // The team filtering is already done by the backend via x-user-team header
            // Check both resourceId (camelCase) and resource_id (snake_case)
            const hasResource = assignment.resourceId || assignment.resource_id;
            if (!projectCode.startsWith('ABSENCES') && hasResource) {
                // Get month and year from assignment
                let month = assignment.month;
                let year = assignment.year;
                
                // If month/year are null but date exists, extract from date
                if ((!month || !year) && assignment.date) {
                    const dateObj = new Date(assignment.date);
                    month = dateObj.getMonth() + 1;
                    year = dateObj.getFullYear();
                }
                
                const hours = parseFloat(assignment.hours) || 0;
                
                // Only count for the current year
                if (year === currentYear && month >= 1 && month <= 12) {
                    monthlyCommittedHours[month - 1] += hours;
                    committedCount++;
                    
                    // Track by project for summary
                    if (!projectSummary[projectCode]) {
                        projectSummary[projectCode] = {
                            title: projectTitle,
                            totalHours: 0,
                            byMonth: {},
                            resourceTeams: new Set()
                        };
                    }
                    projectSummary[projectCode].totalHours += hours;
                    projectSummary[projectCode].byMonth[month] = (projectSummary[projectCode].byMonth[month] || 0) + hours;
                    projectSummary[projectCode].resourceTeams.add(assignment.team || 'N/A');
                    
                    console.log(`✓ Added ${hours}h from ${projectCode} (${projectTitle}) - Assignment team: ${assignment.team} - Month: ${month}`);
                }
            }
        });
        
        // Show summary by project
        console.log('\n========== COMMITTED HOURS SUMMARY BY PROJECT ==========');
        Object.keys(projectSummary).forEach(projectCode => {
            const project = projectSummary[projectCode];
            const teams = Array.from(project.resourceTeams).join(', ');
            console.log(`\n📊 ${projectCode} - ${project.title}`);
            console.log(`   Total hours: ${project.totalHours}h`);
            console.log(`   Resource teams: ${teams}`);
            console.log(`   By month:`, project.byMonth);
        });
        console.log('\n========================================================\n');
        
        console.log('Total committed assignments found (excluding absences):', committedCount);
        
        // Calculate potential available hours: base - absences (NOT subtracting committed)
        const potentialAvailableHours = monthlyBaseHours.map((baseHours, index) => {
            return Math.max(0, baseHours - monthlyAbsences[index]);
        });
        
        console.log('Monthly base hours:', monthlyBaseHours);
        console.log('Monthly absences:', monthlyAbsences);
        console.log('Monthly committed hours (excluding absences):', monthlyCommittedHours);
        console.log('Potential available hours (base - absences):', potentialAvailableHours);
        
        // If period filter is active, return only the filtered months
        if (hasPeriodFilter) {
            const filteredPotentialHours = monthIndices.map(i => potentialAvailableHours[i]);
            const filteredCommittedHours = monthIndices.map(i => monthlyCommittedHours[i]);
            
            console.log('Filtered to period months:', monthIndices);
            console.log('Filtered potential hours:', filteredPotentialHours);
            console.log('Filtered committed hours:', filteredCommittedHours);
            
            return {
                potentialAvailableHours: filteredPotentialHours,
                committedHours: filteredCommittedHours
            };
        }
        
        return {
            potentialAvailableHours,
            committedHours: monthlyCommittedHours
        };
        
    } catch (error) {
        console.error('Error calculating potential available hours:', error);
        // Return zeros if calculation fails
        return new Array(12).fill(0);
    }
}

/**
 * Update KPIs section
 */
function updateKPIs(kpis) {
    if (!kpis) return;
    
    // Total resources
    const totalResourcesEl = document.querySelector('[data-kpi="total-resources"]');
    if (totalResourcesEl) {
        totalResourcesEl.textContent = kpis.totalResources || 0;
    }
    
    // Resources with assignment
    const withAssignmentEl = document.querySelector('[data-kpi="with-assignment"]');
    if (withAssignmentEl) {
        withAssignmentEl.textContent = kpis.resourcesWithAssignment || 0;
    }
    
    // Resources without assignment
    const withoutAssignmentEl = document.querySelector('[data-kpi="without-assignment"]');
    if (withoutAssignmentEl) {
        withoutAssignmentEl.textContent = kpis.resourcesWithoutAssignment || 0;
    }
    
    // Average utilization - current month
    const currentUtilizationEl = document.querySelector('[data-kpi="current-utilization"]');
    if (currentUtilizationEl) {
        currentUtilizationEl.textContent = `${kpis.avgUtilization?.current || 0}%`;
    }
    
    // Average utilization - future
    const futureUtilizationEl = document.querySelector('[data-kpi="future-utilization"]');
    if (futureUtilizationEl) {
        futureUtilizationEl.textContent = `${kpis.avgUtilization?.future || 0}%`;
    }
    
    console.log('KPIs updated');
}

/**
 * Update charts section
 */
function updateCharts(charts, potentialAvailableHours, committedHours) {
    if (!charts) return;
    
    // Update monthly comparison chart (Horas Comprometidas vs Disponibles)
    updateMonthlyComparisonChart(charts.monthlyComparison, potentialAvailableHours, committedHours);
    
    // Update skills availability chart (Horas potenciales disponibles por perfil)
    updateSkillsAvailabilityChart(charts.skillsAvailability);
    
    console.log('Charts updated');
}

/**
 * Update monthly comparison chart
 */
function updateMonthlyComparisonChart(monthlyData, potentialAvailableHours, committedHours) {
    const chartCanvas = document.getElementById('monthly-comparison-chart');
    if (!chartCanvas || !monthlyData) return;
    
    const ctx = chartCanvas.getContext('2d');
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    
    // Destroy existing chart if it exists
    if (window.monthlyComparisonChart) {
        window.monthlyComparisonChart.destroy();
    }
    
    // Use calculated values if provided, otherwise fall back to backend data
    const availableHoursData = potentialAvailableHours && potentialAvailableHours.length === 12
        ? potentialAvailableHours
        : monthlyData.map(m => m.availableHours);
    
    const committedHoursData = committedHours && committedHours.length === 12
        ? committedHours
        : monthlyData.map(m => m.committedHours);
    
    console.log('Chart data - Committed hours (excluding absences):', committedHoursData);
    console.log('Chart data - Potential available hours:', availableHoursData);
    
    window.monthlyComparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: monthNames,
            datasets: [
                {
                    label: 'Horas Comprometidas',
                    data: committedHoursData,
                    backgroundColor: '#6b7280',
                    borderColor: '#4b5563',
                    borderWidth: 1
                },
                {
                    label: 'Horas potenciales disponibles (excl. ausencias)',
                    data: availableHoursData,
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
                    position: 'top',
                },
                title: {
                    display: true,
                    text: 'Horas Comprometidas vs. Disponibles',
                    font: {
                        size: 18,
                        weight: 'bold'
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Horas'
                    }
                }
            }
        }
    });
}

/**
 * Update skills availability chart
 */
function updateSkillsAvailabilityChart(skillsData) {
    const chartCanvas = document.getElementById('skills-availability-chart');
    if (!chartCanvas || !skillsData) return;
    
    const ctx = chartCanvas.getContext('2d');
    
    // Destroy existing chart if it exists
    if (window.skillsAvailabilityChart) {
        window.skillsAvailabilityChart.destroy();
    }
    
    window.skillsAvailabilityChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: skillsData.map(s => s.skill),
            datasets: [
                {
                    label: 'Mes Actual',
                    data: skillsData.map(s => s.currentMonth),
                    backgroundColor: '#059669',
                    borderColor: '#047857',
                    borderWidth: 1
                },
                {
                    label: 'Meses Futuros',
                    data: skillsData.map(s => s.futureMonths),
                    backgroundColor: '#86efac',
                    borderColor: '#4ade80',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: 'Horas potenciales disponibles por perfil',
                    font: {
                        size: 18,
                        weight: 'bold'
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Horas'
                    }
                }
            }
        }
    });
}

/**
 * Apply filters to resources
 */
function applyCapacityFilters() {
    const searchInput = document.getElementById('capacity-search');
    
    let resources = [...allResources];
    
    // Filter by search text (resource name or skills)
    if (searchInput && searchInput.value.trim()) {
        const searchText = searchInput.value.trim().toLowerCase();
        resources = resources.filter(resource => {
            const resourceName = (resource.name || '').toLowerCase();
            const skills = resource.resourceSkills || resource.skills || [];
            const skillNames = skills.map(s => (s.skillName || s.name || '').toLowerCase()).join(' ');
            
            return resourceName.includes(searchText) || skillNames.includes(searchText);
        });
    }
    
    console.log(`🔍 Capacity filters applied: ${resources.length} of ${allResources.length} resources`);
    
    filteredResources = resources;
    currentCapacityPage = 1; // Reset to first page when filters change
    renderCurrentCapacityPage();
}

/**
 * Render current page of resources
 */
function renderCurrentCapacityPage() {
    const startIndex = (currentCapacityPage - 1) * capacityEntriesPerPage;
    const endIndex = startIndex + capacityEntriesPerPage;
    const pageResources = filteredResources.slice(startIndex, endIndex);
    
    renderCapacityTable(pageResources, capacityData?.currentMonth || new Date().getMonth() + 1);
    updateCapacityPaginationInfo();
}

/**
 * Update pagination information and controls
 */
function updateCapacityPaginationInfo() {
    const totalResources = filteredResources.length;
    const totalPages = Math.ceil(totalResources / capacityEntriesPerPage);
    const startIndex = totalResources === 0 ? 0 : (currentCapacityPage - 1) * capacityEntriesPerPage + 1;
    const endIndex = Math.min(currentCapacityPage * capacityEntriesPerPage, totalResources);
    
    // Update info text
    const infoText = document.getElementById('capacity-info-text');
    if (infoText) {
        infoText.textContent = `Showing ${startIndex}-${endIndex} of ${totalResources} resources`;
    }
    
    // Update page number
    const currentPageSpan = document.getElementById('capacity-current-page');
    if (currentPageSpan) {
        currentPageSpan.textContent = `Page ${currentCapacityPage} of ${totalPages || 1}`;
    }
    
    // Update button states
    const prevBtn = document.getElementById('capacity-prev-btn');
    const nextBtn = document.getElementById('capacity-next-btn');
    
    if (prevBtn) {
        prevBtn.disabled = currentCapacityPage === 1;
    }
    
    if (nextBtn) {
        nextBtn.disabled = currentCapacityPage >= totalPages || totalPages === 0;
    }
}

/**
 * Load previous page
 */
function loadPreviousCapacityPage() {
    if (currentCapacityPage > 1) {
        currentCapacityPage--;
        renderCurrentCapacityPage();
    }
}

/**
 * Load next page
 */
function loadNextCapacityPage() {
    const totalPages = Math.ceil(filteredResources.length / capacityEntriesPerPage);
    if (currentCapacityPage < totalPages) {
        currentCapacityPage++;
        renderCurrentCapacityPage();
    }
}

/**
 * Update capacity matrix table
 */
function updateCapacityMatrix(resources, currentMonth) {
    // Store all resources globally
    allResources = resources || [];
    filteredResources = [...allResources];
    currentCapacityPage = 1;
    
    // Setup search listener
    const searchInput = document.getElementById('capacity-search');
    if (searchInput) {
        // Remove existing listener
        const newSearchInput = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearchInput, searchInput);
        
        // Add new listener
        newSearchInput.addEventListener('input', applyCapacityFilters);
    }
    
    // Expose functions globally
    window.loadPreviousCapacityPage = loadPreviousCapacityPage;
    window.loadNextCapacityPage = loadNextCapacityPage;
    window.applyCapacityFilters = applyCapacityFilters;
    
    // Render first page
    renderCurrentCapacityPage();
}

/**
 * Render capacity table with given resources
 */
function renderCapacityTable(resources, currentMonth) {
    const tableBody = document.getElementById('capacity-table-body');
    if (!tableBody) {
        console.warn('Capacity table body not found');
        return;
    }
    
    // Clear existing rows
    tableBody.innerHTML = '';
    
    // Check if there are no resources
    if (!resources || resources.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="16" style="text-align: center; padding: 2rem; color: #6b7280;">
                No hay recursos disponibles para tu equipo.
            </td>
        `;
        tableBody.appendChild(row);
        console.log('No resources to display');
        return;
    }
    
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    
    // Populate table with resources
    resources.forEach(resource => {
        // Create main resource row
        const row = document.createElement('tr');
        row.className = 'resource-row';
        row.setAttribute('data-resource-id', resource.id);
        
        // Create expand icon cell
        const expandTd = document.createElement('td');
        expandTd.style.textAlign = 'center';
        const expandIcon = document.createElement('span');
        expandIcon.className = 'expand-icon';
        expandIcon.setAttribute('data-resource', resource.id);
        expandIcon.style.cursor = 'pointer';
        expandIcon.style.fontWeight = 'bold';
        expandIcon.style.fontSize = '1.2em';
        expandIcon.textContent = '+';
        expandTd.appendChild(expandIcon);
        row.appendChild(expandTd);
        
        // Create resource name cell
        const nameTd = document.createElement('td');
        nameTd.style.textAlign = 'left';
        const nameStrong = document.createElement('strong');
        nameStrong.textContent = resource.name;
        nameTd.appendChild(nameStrong);
        row.appendChild(nameTd);
        
        // Create utilization cell
        const utilizationTd = document.createElement('td');
        utilizationTd.style.textAlign = 'center';
        utilizationTd.textContent = `${resource.avgUtilization}%`;
        row.appendChild(utilizationTd);
        
        // Create skills cell
        const skillsTd = document.createElement('td');
        skillsTd.style.cssText = 'text-align: center !important;';
        // Backend returns resourceSkills, not skills
        const skills = resource.resourceSkills || resource.skills || [];
        if (skills.length > 0) {
            // Define skill order
            const skillOrder = [
                'Project Management',
                'Conceptualización',
                'Análisis',
                'Diseño',
                'Construcción',
                'QA',
                'Despliegue',
                'General'
            ];
            
            // Sort skills according to defined order
            const sortedSkills = skills.slice().sort((a, b) => {
                const nameA = a.skillName || a.name;
                const nameB = b.skillName || b.name;
                const indexA = skillOrder.indexOf(nameA);
                const indexB = skillOrder.indexOf(nameB);
                
                // If skill not in order list, put it at the end
                const orderA = indexA === -1 ? 999 : indexA;
                const orderB = indexB === -1 ? 999 : indexB;
                
                return orderA - orderB;
            });
            
            sortedSkills.forEach(skill => {
                // skill.skillName is the field name in resourceSkills, skill.name for legacy
                const skillName = skill.skillName || skill.name;
                const abbr = getSkillAbbreviation(skillName);
                const badge = document.createElement('span');
                badge.className = 'skill-badge';
                badge.title = skillName;
                badge.textContent = abbr;
                skillsTd.appendChild(badge);
                skillsTd.appendChild(document.createTextNode(' '));
            });
        } else {
            skillsTd.textContent = '-';
        }
        row.appendChild(skillsTd);
        
        // Create capacity cells for each month
        resource.monthlyData.forEach((monthData, index) => {
            const month = index + 1;
            const isCurrentMonth = month === currentMonth;
            let bgColor = getUtilizationColor(monthData.utilizationRate);
            
            // Darken background for current month
            if (isCurrentMonth) {
                bgColor = darkenColor(bgColor);
            }
            
            const capacityTd = document.createElement('td');
            capacityTd.className = 'capacity-cell';
            capacityTd.setAttribute('data-resource', resource.id);
            capacityTd.setAttribute('data-month', month);
            capacityTd.style.textAlign = 'center';
            capacityTd.style.backgroundColor = bgColor;
            
            const committedDiv = document.createElement('div');
            committedDiv.style.fontSize = '0.9em';
            committedDiv.style.fontWeight = 'bold';
            committedDiv.textContent = monthData.committedHours;
            
            const availableDiv = document.createElement('div');
            availableDiv.style.fontSize = '0.75em';
            availableDiv.style.color = '#059669';
            availableDiv.textContent = `(${monthData.availableHours})`;
            
            capacityTd.appendChild(committedDiv);
            capacityTd.appendChild(availableDiv);
            row.appendChild(capacityTd);
        });
        
        tableBody.appendChild(row);
        
        // Create project assignment rows (initially hidden)
        // Group by project + skill (team field) to show separate rows for each skill
        const projectsMap = new Map();
        resource.monthlyData.forEach(monthData => {
            monthData.assignments.forEach(assignment => {
                // Create unique key combining project code and skill/team
                const skill = assignment.team || assignment.skillName || '-';
                const key = `${assignment.projectCode}|${skill}`;
                
                if (!projectsMap.has(key)) {
                    projectsMap.set(key, {
                        code: assignment.projectCode,
                        title: assignment.projectTitle,
                        type: assignment.projectType,
                        skill: skill,
                        monthlyHours: new Array(12).fill(0)
                    });
                }
                projectsMap.get(key).monthlyHours[monthData.month - 1] += assignment.hours;
            });
        });
        
        // Convert Map to Array and sort by project code (numeric part, descending)
        const sortedProjects = Array.from(projectsMap.values()).sort((a, b) => {
            // Extract numeric part from project codes (e.g., "NC-779" -> 779)
            const numA = parseInt(a.code.split('-').pop()) || 0;
            const numB = parseInt(b.code.split('-').pop()) || 0;
            return numB - numA; // Descending order
        });
        
        // Add project rows
        sortedProjects.forEach(project => {
            const projectRow = document.createElement('tr');
            projectRow.className = 'project-row';
            projectRow.setAttribute('data-resource', resource.id);
            projectRow.style.display = 'none';
            projectRow.style.backgroundColor = '#f9fafb';
            
            // Get skill abbreviation for this project assignment
            const skillAbbr = project.skill ? getSkillAbbreviation(project.skill) : '-';
            
            let projectCells = `
                <td style="text-align: center;"></td>
                <td colspan="2" style="text-align: left; padding-left: 2rem; font-style: italic;">
                    ${project.code} - ${project.title}
                </td>
                <td style="text-align: center; font-size: 0.8em;" title="${project.skill || ''}">${skillAbbr}</td>
            `;
            
            // Add monthly hours for this project
            project.monthlyHours.forEach((hours, index) => {
                const month = index + 1;
                const isCurrentMonth = month === currentMonth;
                const bgStyle = isCurrentMonth ? 'background-color: #d1d5db; ' : '';
                projectCells += `
                    <td style="${bgStyle}text-align: center !important; font-size: 0.85em;">
                        ${hours > 0 ? hours : '-'}
                    </td>
                `;
            });
            
            projectRow.innerHTML = projectCells;
            tableBody.appendChild(projectRow);
        });
    });
    
    // Add event listeners for expand icons
    addExpandIconListeners();
    
    // Add event listeners for resource rows
    addResourceRowListeners();
    
    console.log(`Capacity matrix updated with ${resources.length} resources`);
}

/**
 * Add event listeners for resource rows to open capacity modal
 */
function addResourceRowListeners() {
    const resourceRows = document.querySelectorAll('.resource-row[data-resource-id]');
    
    resourceRows.forEach(row => {
        row.style.cursor = 'pointer';
        
        // Add single click listener - use once:true to prevent duplicates
        row.addEventListener('click', function(e) {
            // Don't trigger if clicking on expand icon
            if (e.target.closest('.expand-icon')) {
                return;
            }
            
            const resourceId = this.getAttribute('data-resource-id');
            const resourceName = this.querySelector('strong').textContent;
            
            console.log('Resource row clicked:', resourceId, resourceName);
            
            // Open capacity modal if available
            if (window.capacityModal) {
                window.capacityModal.open(resourceId, resourceName);
            } else {
                console.error('Capacity modal not available');
            }
        });
    });
    
    console.log('Resource row listeners added to', resourceRows.length, 'rows');
}

/**
 * Get skill abbreviation
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
    return abbreviations[skillName] || skillName.substring(0, 3);
}

/**
 * Get background color based on utilization rate
 */
function getUtilizationColor(utilizationRate) {
    if (utilizationRate === 0) return '#ffffff';
    if (utilizationRate < 50) return '#d1fae5'; // Light green
    if (utilizationRate < 75) return '#fef3c7'; // Light yellow
    if (utilizationRate < 100) return '#fed7aa'; // Light orange
    return '#fecaca'; // Light red
}

/**
 * Darken a hex color by a percentage
 */
function darkenColor(hex) {
    // Convert hex to RGB
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    
    // Darken by 20%
    const factor = 0.8;
    const newR = Math.round(r * factor);
    const newG = Math.round(g * factor);
    const newB = Math.round(b * factor);
    
    // Convert back to hex
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

/**
 * Add event listeners for expand/collapse icons
 */
function addExpandIconListeners() {
    const expandIcons = document.querySelectorAll('.expand-icon[data-resource]');
    
    expandIcons.forEach(icon => {
        // Remove any existing listeners by cloning
        const newIcon = icon.cloneNode(true);
        icon.parentNode.replaceChild(newIcon, icon);
        
        // Add click listener to the new icon
        newIcon.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent triggering row click
            const resourceId = this.getAttribute('data-resource');
            toggleResourceProjects(resourceId, this);
        });
    });
}

/**
 * Toggle visibility of project rows for a resource
 */
function toggleResourceProjects(resourceId, expandIcon) {
    // Find all project rows for this resource
    const projectRows = document.querySelectorAll(`.project-row[data-resource="${resourceId}"]`);
    
    if (projectRows.length === 0) {
        console.log(`No project rows found for resource ${resourceId}`);
        // No alert - just log to console
        return;
    }
    
    // Check current state (if first row is hidden, we want to show all)
    const isHidden = projectRows[0].style.display === 'none';
    
    // Toggle visibility
    projectRows.forEach(row => {
        row.style.display = isHidden ? 'table-row' : 'none';
    });
    
    // Toggle icon
    expandIcon.textContent = isHidden ? '−' : '+';
    
    console.log(`Toggled projects for resource ${resourceId}: ${isHidden ? 'expanded' : 'collapsed'}`);
}

/**
 * Calculate working days (Monday-Friday) in a given month
 * @param {number} year - The year
 * @param {number} month - The month (1-12)
 * @returns {number} Number of working days
 */
function getWorkingDaysInMonth(year, month) {
    let workingDays = 0;
    const date = new Date(year, month - 1, 1); // month is 1-indexed
    
    // Loop through all days in the month
    while (date.getMonth() === month - 1) {
        const dayOfWeek = date.getDay();
        // 0 = Sunday, 6 = Saturday
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            workingDays++;
        }
        date.setDate(date.getDate() + 1);
    }
    
    return workingDays;
}

/**
 * Show error message to user
 */
function showErrorMessage(message) {
    console.error(message);
    alert(message);
}

/**
 * Export function to reload capacity data (can be called from other modules)
 */
export function reloadCapacityData() {
    loadCapacityData();
}
