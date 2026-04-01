// Overview Charts Component - New charts for Vista General

import { monthLabels, API_CONFIG } from '../config/data.js';
import { formatNumber } from '../utils/helpers.js';

// Store chart instances
const overviewChartInstances = {};

/**
 * Destroy a chart instance if it exists
 */
function destroyChart(chartId) {
    if (overviewChartInstances[chartId]) {
        overviewChartInstances[chartId].destroy();
        delete overviewChartInstances[chartId];
    }
}

/**
 * Load assignments - use already filtered data from window if available
 */
async function loadAPIData() {
    // Use the already filtered assignments from window if available
    if (window.filteredAssignmentsByPeriod && window.filteredAssignmentsByPeriod.length > 0) {
        return { 
            assignments: window.filteredAssignmentsByPeriod,
            resources: [] // Not needed for these charts
        };
    }
    
    // Fallback: load from API if not available
    const awsAccessKey = sessionStorage.getItem('aws_access_key');
    const userTeam = sessionStorage.getItem('user_team');
    
    if (!awsAccessKey || !userTeam) {
        console.warn('No authentication for overview charts');
        return { assignments: [], resources: [] };
    }
    
    try {
        const assignmentsRes = await fetch(`${API_CONFIG.BASE_URL}/assignments`, {
            headers: {
                'Authorization': awsAccessKey,
                'x-user-team': userTeam
            }
        });
        
        if (!assignmentsRes.ok) {
            throw new Error('Error loading data for overview charts');
        }
        
        const assignmentsData = await assignmentsRes.json();
        const allAssignments = assignmentsData.data?.assignments || assignmentsData.assignments || [];
        
        return { assignments: allAssignments, resources: [] };
    } catch (error) {
        console.error('Error loading API data for overview charts:', error);
        return { assignments: [], resources: [] };
    }
}

/**
 * Initialize "Horas Comprometidas por Tipo de Proyecto" chart
 * Gráfico de barras por mes mostrando Evolutivos y Proyectos
 */
export async function initializeOverviewHoursByTypeChart() {
    const chartId = 'overview-hours-by-type-chart';
    const ctx = document.getElementById(chartId);
    if (!ctx) {
        console.error('Canvas element NOT found:', chartId);
        return;
    }
    
    destroyChart(chartId);
    
    try {
        const { assignments, resources } = await loadAPIData();
        
        // Determine which months to show based on period filter
        let monthsToShow = monthLabels;
        let monthIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]; // All 12 months
        
        if (window.currentPeriod && window.getPeriodDateRange) {
            // Get the date range for the selected period (including 'current')
            const dateRange = window.getPeriodDateRange(window.currentPeriod);
            if (dateRange.length > 0) {
                monthIndices = dateRange.map(d => d.month - 1); // Convert to 0-based index
                monthsToShow = monthIndices.map(i => monthLabels[i]);
            }
        }
        
        // Calculate hours by month and category
        const currentYear = 2026;
        const hoursByMonthEvolutivo = new Array(12).fill(0);
        const hoursByMonthConceptualizacion = new Array(12).fill(0);
        const hoursByMonthResto = new Array(12).fill(0);
        
        assignments.forEach(assignment => {
            if (assignment.year === currentYear && assignment.month >= 1 && assignment.month <= 12) {
                const monthIndex = assignment.month - 1;
                const hours = parseFloat(assignment.hours) || 0;
                
                // Map snake_case to camelCase
                const projectId = assignment.project_id || assignment.projectId;
                
                // Get project type (exclude ABSENCES projects)
                if (window.allProjects && projectId) {
                    const project = window.allProjects.find(p => p.id === projectId);
                    if (project && !project.code.startsWith('ABSENCES')) {
                        if (project.type === 'Evolutivo') {
                            hoursByMonthEvolutivo[monthIndex] += hours;
                        } else if (project.type === 'Proyecto') {
                            // Check if activity is "Conceptualización"
                            const team = assignment.team || '';
                            if (team === 'Conceptualización') {
                                hoursByMonthConceptualizacion[monthIndex] += hours;
                            } else {
                                hoursByMonthResto[monthIndex] += hours;
                            }
                        }
                    }
                }
            }
        });
        
        // Filter data to show only selected months
        const filteredEvolutivo = monthIndices.map(i => hoursByMonthEvolutivo[i]);
        const filteredConceptualizacion = monthIndices.map(i => hoursByMonthConceptualizacion[i]);
        const filteredResto = monthIndices.map(i => hoursByMonthResto[i]);
        
        
        overviewChartInstances[chartId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: monthsToShow,
                datasets: [
                    {
                        label: 'Evolutivos',
                        data: filteredEvolutivo,
                        backgroundColor: 'rgba(100, 181, 246, 0.8)', // Blue - same as pie chart
                        borderColor: '#64b5f6',
                        borderWidth: 1
                    },
                    {
                        label: 'Proyectos - Conceptualización',
                        data: filteredConceptualizacion,
                        backgroundColor: 'rgba(255, 183, 77, 0.8)', // Orange - same as pie chart
                        borderColor: '#ffb74d',
                        borderWidth: 1
                    },
                    {
                        label: 'Proyectos - Resto',
                        data: filteredResto,
                        backgroundColor: 'rgba(77, 182, 172, 0.8)', // Teal - same as pie chart
                        borderColor: '#4db6ac',
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
    } catch (error) {
        console.error('Error initializing Overview Hours by Type Chart:', error);
    }
}

/**
 * Initialize "Split Horas Comprometidas" chart
 * Gráfico de tarta con 3 áreas: Evolutivos / Proyectos_conceptualización / Proyectos_resto
 */
export async function initializeOverviewSplitHoursChart() {
    const chartId = 'overview-split-hours-chart';
    const ctx = document.getElementById(chartId);
    if (!ctx) {
        console.error('Canvas element NOT found:', chartId);
        return;
    }
    
    destroyChart(chartId);
    
    try {
        const { assignments } = await loadAPIData();
        
        // Determine which months to filter based on period
        let monthIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]; // All 12 months by default
        
        if (window.currentPeriod && window.getPeriodDateRange) {
            const dateRange = window.getPeriodDateRange(window.currentPeriod);
            if (dateRange.length > 0) {
                monthIndices = dateRange.map(d => d.month - 1); // Convert to 0-based index
            }
        }
        
        // Calculate hours by category (only for selected months)
        const currentYear = 2026;
        let hoursEvolutivos = 0;
        let horasProyectosConceptualizacion = 0;
        let horasProyectosResto = 0;
        
        assignments.forEach(assignment => {
            // Filter by year and selected months
            if (assignment.year !== currentYear || assignment.month < 1 || assignment.month > 12) return;
            
            const monthIndex = assignment.month - 1;
            if (!monthIndices.includes(monthIndex)) return; // Skip if not in selected period
            
            const hours = parseFloat(assignment.hours) || 0;
            
            // Map snake_case to camelCase
            const projectId = assignment.project_id || assignment.projectId;
            
            // Get project type (exclude ABSENCES projects)
            if (window.allProjects && projectId) {
                const project = window.allProjects.find(p => p.id === projectId);
                if (!project || project.code.startsWith('ABSENCES')) return;
                
                if (project.type === 'Evolutivo') {
                    hoursEvolutivos += hours;
                } else if (project.type === 'Proyecto') {
                    // Check if activity is "Conceptualización"
                    const team = assignment.team || '';
                    if (team === 'Conceptualización') {
                        horasProyectosConceptualizacion += hours;
                    } else {
                        horasProyectosResto += hours;
                    }
                }
            }
        });
        
        const total = hoursEvolutivos + horasProyectosConceptualizacion + horasProyectosResto;
        const percentEvolutivos = total > 0 ? ((hoursEvolutivos / total) * 100).toFixed(1) : 0;
        const percentConceptualizacion = total > 0 ? ((horasProyectosConceptualizacion / total) * 100).toFixed(1) : 0;
        const percentResto = total > 0 ? ((horasProyectosResto / total) * 100).toFixed(1) : 0;
        
        // If no data, show a placeholder chart
        const hasData = total > 0;
        const chartData = hasData 
            ? [hoursEvolutivos, horasProyectosConceptualizacion, horasProyectosResto]
            : [1]; // Show a single gray segment when no data
        
        const chartLabels = hasData
            ? ['Evolutivos', 'Proyectos - Conceptualización', 'Proyectos - Resto']
            : ['Sin datos'];
        
        const chartColors = hasData
            ? ['#64b5f6', '#ffb74d', '#4db6ac']
            : ['#e0e0e0'];
        
        overviewChartInstances[chartId] = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: chartLabels,
                datasets: [{
                    data: chartData,
                    backgroundColor: chartColors,
                    borderColor: '#ffffff',
                    borderWidth: 2
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
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                if (label === 'Sin datos') {
                                    return 'No hay datos para el período seleccionado';
                                }
                                const value = context.parsed || 0;
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                return `${label}: ${formatNumber(value)} horas (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error initializing Overview Split Hours Chart:', error);
    }
}

/**
 * Initialize all overview charts
 */
export async function initializeOverviewCharts() {
    await initializeOverviewHoursByTypeChart();
    await initializeOverviewSplitHoursChart();
}
