/**
 * Calendar View Component
 * Displays time entries in a calendar-like AG Grid format
 * Read-only view showing all user time entries by day
 */

import { API_CONFIG } from '../config/data.js';

// AG Grid instance
let calendarGridApi = null;

// All time entries data
let allTimeEntries = [];

// Filtered data
let filteredTimeEntries = [];

/**
 * Initialize calendar view
 */
export function initializeCalendarView() {
    console.log('Initializing calendar view...');
    
    // Add event listener for search input
    const searchInput = document.getElementById('calendar-search');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(applyCalendarFilters, 300));
    }
    
    // Make functions globally available
    window.refreshCalendarView = refreshCalendarView;
    
    console.log('Calendar view initialized');
}

/**
 * Debounce function to limit API calls
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Load calendar view data
 */
export async function loadCalendarView() {
    try {
        const awsAccessKey = sessionStorage.getItem('aws_access_key');
        const userTeam = sessionStorage.getItem('user_team');
        
        if (!awsAccessKey || !userTeam) {
            console.error('No authentication tokens found');
            return;
        }

        console.log('Loading time entries for calendar view...');

        const response = await fetch(`${API_CONFIG.BASE_URL}/time-entries`, {
            headers: {
                'Authorization': awsAccessKey,
                'x-user-team': userTeam
            }
        });

        if (response.ok) {
            const data = await response.json();
            allTimeEntries = data.data?.timeEntries || data.timeEntries || [];
            
            console.log(`✅ Loaded ${allTimeEntries.length} time entries for calendar`);
            
            // Apply initial filters
            applyCalendarFilters();
        } else {
            console.error('Error loading time entries:', response.status);
            allTimeEntries = [];
            filteredTimeEntries = [];
            renderCalendarGrid([]);
        }
    } catch (error) {
        console.error('Error loading time entries:', error);
        allTimeEntries = [];
        filteredTimeEntries = [];
        renderCalendarGrid([]);
    }
}

/**
 * Parse date from search text
 * Supports formats: DD/MM/YYYY, DD/MM/, DD/, YYYY-MM-DD, YYYY-MM-
 * Returns an object with day, month, year (any can be null for partial matches)
 */
function parseDateFromSearch(searchText) {
    const result = { day: null, month: null, year: null, isPartial: false };
    
    // Try DD/MM/YYYY format (complete)
    const ddmmyyyyRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const ddmmyyyyMatch = searchText.match(ddmmyyyyRegex);
    if (ddmmyyyyMatch) {
        result.day = parseInt(ddmmyyyyMatch[1]);
        result.month = parseInt(ddmmyyyyMatch[2]);
        result.year = parseInt(ddmmyyyyMatch[3]);
        return result;
    }
    
    // Try DD/MM/ format (day and month)
    const ddmmRegex = /^(\d{1,2})\/(\d{1,2})\/$/;
    const ddmmMatch = searchText.match(ddmmRegex);
    if (ddmmMatch) {
        result.day = parseInt(ddmmMatch[1]);
        result.month = parseInt(ddmmMatch[2]);
        result.isPartial = true;
        return result;
    }
    
    // Try DD/ format (only day)
    const ddRegex = /^(\d{1,2})\/$/;
    const ddMatch = searchText.match(ddRegex);
    if (ddMatch) {
        result.day = parseInt(ddMatch[1]);
        result.isPartial = true;
        return result;
    }
    
    // Try YYYY-MM-DD format (complete)
    const yyyymmddRegex = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
    const yyyymmddMatch = searchText.match(yyyymmddRegex);
    if (yyyymmddMatch) {
        result.year = parseInt(yyyymmddMatch[1]);
        result.month = parseInt(yyyymmddMatch[2]);
        result.day = parseInt(yyyymmddMatch[3]);
        return result;
    }
    
    // Try YYYY-MM- format (year and month)
    const yyyymmRegex = /^(\d{4})-(\d{1,2})-$/;
    const yyyymmMatch = searchText.match(yyyymmRegex);
    if (yyyymmMatch) {
        result.year = parseInt(yyyymmMatch[1]);
        result.month = parseInt(yyyymmMatch[2]);
        result.isPartial = true;
        return result;
    }
    
    return null;
}

/**
 * Check if an entry date matches the search date criteria
 */
function matchesDateCriteria(entryDate, searchDateObj) {
    if (!searchDateObj) return false;
    
    const entryDay = entryDate.getDate();
    const entryMonth = entryDate.getMonth() + 1; // Convert to 1-indexed
    const entryYear = entryDate.getFullYear();
    
    // Check day match (if specified)
    if (searchDateObj.day !== null && entryDay !== searchDateObj.day) {
        return false;
    }
    
    // Check month match (if specified)
    if (searchDateObj.month !== null && entryMonth !== searchDateObj.month) {
        return false;
    }
    
    // Check year match (if specified)
    if (searchDateObj.year !== null && entryYear !== searchDateObj.year) {
        return false;
    }
    
    return true;
}

/**
 * Apply filters to time entries
 */
function applyCalendarFilters() {
    const searchInput = document.getElementById('calendar-search');
    
    let filtered = [...allTimeEntries];
    let searchDateObj = null;
    
    // Filter by search text (project, resource, task, or date)
    if (searchInput && searchInput.value.trim()) {
        const searchText = searchInput.value.trim();
        const searchLower = searchText.toLowerCase();
        
        // Try to parse as date (complete or partial)
        searchDateObj = parseDateFromSearch(searchText);
        
        filtered = filtered.filter(entry => {
            // Check if search matches a date (complete or partial)
            if (searchDateObj) {
                const entryDate = new Date(entry.workDate);
                if (matchesDateCriteria(entryDate, searchDateObj)) {
                    return true;
                }
            }
            
            // Check text fields
            const projectCode = (entry.project?.code || entry.projectId || '').toLowerCase();
            const projectTitle = (entry.project?.title || '').toLowerCase();
            const resourceName = (entry.resource?.name || '').toLowerCase();
            const taskTitle = (entry.taskTitle || '').toLowerCase();
            
            return projectCode.includes(searchLower) || 
                   projectTitle.includes(searchLower) || 
                   resourceName.includes(searchLower) ||
                   taskTitle.includes(searchLower);
        });
    }
    
    console.log(`🔍 Filters applied: ${filtered.length} of ${allTimeEntries.length} entries`);
    
    filteredTimeEntries = filtered;
    
    // Group entries for grid display
    const groupedData = groupTimeEntriesForGrid(filtered);
    renderCalendarGrid(groupedData, searchDateObj);
    updateCalendarStats(filtered);
}

/**
 * Truncate text to maximum length
 */
function truncateText(text, maxLength = 100) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

/**
 * Group time entries by project + resource + task
 */
function groupTimeEntriesForGrid(entries) {
    const groupMap = new Map();
    
    entries.forEach(entry => {
        const projectId = entry.project?.code || entry.projectId || 'N/A';
        const projectTitle = entry.project?.title || 'Sin título';
        const resourceName = entry.resource?.name || 'Sin recurso';
        const taskTitle = entry.taskTitle || 'Sin título';
        const taskDescription = entry.taskDescription || '';
        
        // Create unique key for grouping
        const key = `${projectId}|${resourceName}|${taskTitle}`;
        
        if (!groupMap.has(key)) {
            groupMap.set(key, {
                projectId: truncateText(projectId, 100),
                projectTitle: truncateText(projectTitle, 100),
                resourceName: truncateText(resourceName, 100),
                taskTitle: truncateText(taskTitle, 100),
                taskDescription: truncateText(taskDescription, 100)
            });
        }
        
        const group = groupMap.get(key);
        
        // Add hours to the appropriate date
        if (entry.workDate) {
            const dateStr = entry.workDate.toString().split('T')[0]; // YYYY-MM-DD
            group[dateStr] = (group[dateStr] || 0) + parseFloat(entry.hours || 0);
        }
    });
    
    return Array.from(groupMap.values());
}

/**
 * Get target date to scroll to based on search criteria and filtered entries
 */
function getTargetDateFromSearch(searchDateObj, filteredEntries) {
    if (!searchDateObj) return null;
    
    // If we have a complete date, use it
    if (searchDateObj.year && searchDateObj.month && searchDateObj.day) {
        const year = searchDateObj.year;
        const month = String(searchDateObj.month).padStart(2, '0');
        const day = String(searchDateObj.day).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    // For partial dates, find the first actual date with data
    if (filteredEntries && filteredEntries.length > 0) {
        // Get all dates from filtered entries that match the search criteria
        const matchingDates = [];
        
        filteredEntries.forEach(entry => {
            const entryDate = new Date(entry.workDate);
            if (matchesDateCriteria(entryDate, searchDateObj)) {
                const year = entryDate.getFullYear();
                const month = String(entryDate.getMonth() + 1).padStart(2, '0');
                const day = String(entryDate.getDate()).padStart(2, '0');
                const dateStr = `${year}-${month}-${day}`;
                if (!matchingDates.includes(dateStr)) {
                    matchingDates.push(dateStr);
                }
            }
        });
        
        // Sort dates and return the first one (earliest)
        if (matchingDates.length > 0) {
            matchingDates.sort();
            return matchingDates[0];
        }
    }
    
    // Fallback: construct a date based on what we have
    // If we have day and month, use current year
    if (searchDateObj.day && searchDateObj.month) {
        const year = new Date().getFullYear();
        const month = String(searchDateObj.month).padStart(2, '0');
        const day = String(searchDateObj.day).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    // If we only have day, use current month and year
    if (searchDateObj.day) {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(searchDateObj.day).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    // If we have year and month, use first day of that month
    if (searchDateObj.year && searchDateObj.month) {
        const year = searchDateObj.year;
        const month = String(searchDateObj.month).padStart(2, '0');
        return `${year}-${month}-01`;
    }
    
    return null;
}

/**
 * Render calendar grid with AG Grid
 */
async function renderCalendarGrid(data, searchDateObj = null) {
    const gridDiv = document.getElementById('calendar-grid');
    
    if (!gridDiv) {
        console.error('Calendar grid container not found');
        return;
    }

    // Load AG Grid if not already loaded
    if (typeof agGrid === 'undefined') {
        console.log('Loading AG Grid...');
        await window.loadAGGrid();
    }

    // Destroy existing grid if any
    if (calendarGridApi) {
        calendarGridApi.destroy();
        calendarGridApi = null;
    }

    // Clear container
    gridDiv.innerHTML = '';

    // Get date range from filters
    const startDateInput = document.getElementById('calendar-start-date');
    const endDateInput = document.getElementById('calendar-end-date');
    
    const startDate = startDateInput && startDateInput.value 
        ? new Date(startDateInput.value) 
        : new Date(new Date().setDate(new Date().getDate() - 30));
    
    const endDate = endDateInput && endDateInput.value 
        ? new Date(endDateInput.value) 
        : new Date(new Date().setDate(new Date().getDate() + 30));

    // Base column definitions (fixed columns)
    const columnDefs = [
        {
            headerName: 'ID Proyecto',
            field: 'projectId',
            width: 110,
            minWidth: 110,
            pinned: 'left',
            suppressSizeToFit: true,
            wrapText: true,
            autoHeight: true,
            cellStyle: { 
                fontWeight: '600', 
                background: 'rgba(49, 151, 149, 0.05)',
                whiteSpace: 'normal',
                lineHeight: '1.4',
                wordBreak: 'normal',
                overflowWrap: 'break-word'
            }
        },
        {
            headerName: 'Título Proyecto',
            field: 'projectTitle',
            width: 270,
            minWidth: 270,
            pinned: 'left',
            suppressSizeToFit: true,
            wrapText: true,
            autoHeight: true,
            cellStyle: {
                whiteSpace: 'normal',
                lineHeight: '1.4',
                wordBreak: 'normal',
                overflowWrap: 'break-word'
            }
        },
        {
            headerName: 'Recurso',
            field: 'resourceName',
            width: 180,
            minWidth: 180,
            pinned: 'left',
            suppressSizeToFit: true,
            wrapText: true,
            autoHeight: true,
            cellStyle: { 
                fontWeight: '500',
                whiteSpace: 'normal',
                lineHeight: '1.4',
                wordBreak: 'normal',
                overflowWrap: 'break-word'
            }
        },
        {
            headerName: 'Título Tarea',
            field: 'taskTitle',
            width: 220,
            minWidth: 220,
            pinned: 'left',
            suppressSizeToFit: true,
            wrapText: true,
            autoHeight: true,
            cellStyle: {
                whiteSpace: 'normal',
                lineHeight: '1.4',
                wordBreak: 'normal',
                overflowWrap: 'break-word'
            }
        },
        {
            headerName: 'Subtarea',
            field: 'taskDescription',
            width: 250,
            minWidth: 250,
            pinned: 'left',
            suppressSizeToFit: true,
            wrapText: true,
            autoHeight: true,
            cellStyle: { 
                fontSize: '0.875rem', 
                color: '#718096',
                whiteSpace: 'normal',
                lineHeight: '1.4',
                wordBreak: 'normal',
                overflowWrap: 'break-word'
            }
        }
    ];

    // Generate date columns
    const dateColumns = generateDateColumns(startDate, endDate);
    columnDefs.push(...dateColumns);

    // Grid options
    const gridOptions = {
        columnDefs: columnDefs,
        rowData: data,
        defaultColDef: {
            sortable: true,
            filter: true,
            resizable: true
        },
        animateRows: true,
        enableCellTextSelection: true,
        suppressRowClickSelection: true,
        // Pagination settings
        pagination: true,
        paginationPageSize: 50,
        paginationPageSizeSelector: [25, 50, 100, 200],
        onGridReady: (params) => {
            calendarGridApi = params.api;
            params.api.sizeColumnsToFit();
            
            // Scroll to the appropriate column
            setTimeout(() => {
                let targetDateStr;
                
                // If there's a search date, scroll to it
                if (searchDateObj) {
                    targetDateStr = getTargetDateFromSearch(searchDateObj, filteredTimeEntries);
                    if (targetDateStr) {
                        console.log('Scrolling to searched date:', targetDateStr);
                    }
                }
                
                // Otherwise, scroll to today
                if (!targetDateStr) {
                    targetDateStr = new Date().toISOString().split('T')[0];
                    console.log('Scrolling to today:', targetDateStr);
                }
                
                params.api.ensureColumnVisible(targetDateStr);
            }, 200);
        }
    };

    // Create grid
    calendarGridApi = agGrid.createGrid(gridDiv, gridOptions);
    
    console.log(`Calendar grid rendered with ${data.length} rows`);
}

/**
 * Generate date columns for the grid
 */
function generateDateColumns(startDate, endDate) {
    const dateColumns = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        const dateHeader = `${currentDate.getDate()}/${currentDate.getMonth() + 1}`;
        
        const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
        const isToday = currentDate.toDateString() === today.toDateString();
        
        dateColumns.push({
            headerName: dateHeader,
            field: dateStr,
            editable: false, // Read-only
            width: 65,
            minWidth: 65,
            filter: false,
            sortable: false,
            suppressMenu: true,
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
        
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    console.log(`Generated ${dateColumns.length} date columns`);
    return dateColumns;
}

/**
 * Update calendar statistics
 */
function updateCalendarStats(entries) {
    const totalEntries = entries.length;
    const totalHours = entries.reduce((sum, entry) => sum + (parseFloat(entry.hours) || 0), 0);
    const uniqueResources = new Set(entries.map(entry => entry.resource?.name || entry.resourceName)).size;
    
    const totalEntriesEl = document.getElementById('calendar-total-entries');
    const totalHoursEl = document.getElementById('calendar-total-hours');
    const uniqueResourcesEl = document.getElementById('calendar-unique-resources');
    
    if (totalEntriesEl) totalEntriesEl.textContent = totalEntries;
    if (totalHoursEl) totalHoursEl.textContent = `${totalHours.toFixed(1)}h`;
    if (uniqueResourcesEl) uniqueResourcesEl.textContent = uniqueResources;
}

/**
 * Refresh calendar view
 */
async function refreshCalendarView() {
    console.log('Refreshing calendar view...');
    await loadCalendarView();
}