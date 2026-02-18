// Helper Functions and Utilities

/**
 * Format number with thousands separator (using period)
 */
export function formatNumber(num) {
    return num.toLocaleString('de-DE'); // German locale uses period as thousand separator
}

/**
 * Calculate percentage
 */
export function calculatePercentage(value, total) {
    if (total === 0) return 0;
    return ((value / total) * 100).toFixed(1);
}

/**
 * Get month name from index
 */
export function getMonthName(index) {
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return months[index];
}

/**
 * Get short month name from index
 */
export function getShortMonthName(index) {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 
                    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return months[index];
}

/**
 * Convert hours to FTEs (1 FTE = 160 hours)
 */
export function hoursToFTEs(hours) {
    return (hours / 160).toFixed(2);
}

/**
 * Convert FTEs to hours
 */
export function ftesToHours(ftes) {
    return Math.round(ftes * 160);
}

/**
 * Get status text from status ID
 * @param {number} statusId - Status ID
 * @param {string} type - Type of status ('project' or 'task')
 * @returns {string} Status text
 */
export function getStatusText(statusId, type = 'project') {
    // Map status IDs to text for PROJECTS
    const projectStatusMap = {
        1: 'Conceptualización',
        2: 'Análisis',
        3: 'Diseño',
        4: 'Desarrollo',
        5: 'Validación',
        6: 'Producción',
        7: 'Cerrado'
    };
    
    // Map status IDs to text for TASKS
    const taskStatusMap = {
        1: 'TAREAS POR HACER',
        2: 'CONCEPTUALIZACIÓN',
        3: 'CIERRE REQUISITOS',
        4: 'EN VALORACIÓN',
        5: 'VALE PDTE. APROB',
        6: 'EN SD',
        7: 'SD PDTE APROB',
        8: 'EN DESARROLLO',
        9: 'EN VALIDACIÓN SSII',
        10: 'UAT',
        11: 'READY TO PROMOTE',
        12: 'FINALIZADO',
        13: 'CANCELADO',
        14: 'WAITING'
    };
    
    const statusMap = type === 'task' ? taskStatusMap : projectStatusMap;
    return statusMap[statusId] || 'Desconocido';
}

/**
 * Get priority class name
 */
export function getPriorityClass(priority) {
    const priorityMap = {
        'Muy Alta': 'muy-alta',
        'Alta': 'alta',
        'Media': 'media',
        'Baja': 'baja',
        'Muy Baja': 'muy-baja',
        // Legacy support
        'muy-alta': 'muy-alta',
        'alta': 'alta',
        'media': 'media',
        'baja': 'baja',
        'muy-baja': 'muy-baja'
    };
    return priorityMap[priority] || 'media';
}

/**
 * Get priority display text
 */
export function getPriorityText(priority) {
    // Handle null/undefined
    if (!priority) return 'Media';
    
    // Already in correct format from API
    if (priority === 'Muy Alta' || priority === 'Alta' || priority === 'Media' || 
        priority === 'Baja' || priority === 'Muy Baja') {
        return priority;
    }
    
    // Convert to lowercase for comparison
    const lowerPriority = priority.toLowerCase();
    
    // Legacy format conversion (with or without hyphens)
    const priorityMap = {
        'muy-alta': 'Muy Alta',
        'muy alta': 'Muy Alta',
        'alta': 'Alta',
        'media': 'Media',
        'baja': 'Baja',
        'muy-baja': 'Muy Baja',
        'muy baja': 'Muy Baja'
    };
    
    return priorityMap[lowerPriority] || 'Media';
}

/**
 * Get status class name
 * Accepts both numeric IDs and string keys
 */
export function getStatusClass(status) {
    // Numeric mapping (from database - matches jiraHandler.ts)
    const numericStatusMap = {
        1: 'idea',
        2: 'concepto',
        3: 'viabilidad',
        4: 'diseno-detallado',
        5: 'desarrollo',
        6: 'implantado',
        7: 'finalizado',
        8: 'on-hold',
        9: 'cancelado'
    };
    
    // String mapping (legacy)
    const stringStatusMap = {
        'idea': 'idea',
        'conceptualizacion': 'conceptualizacion',
        'concepto': 'concepto',
        'diseno-detallado': 'diseno-detallado',
        'viabilidad': 'viabilidad',
        'desarrollo': 'desarrollo',
        'implantado': 'implantado',
        'finalizado': 'finalizado',
        'on-hold': 'on-hold',
        'cancelado': 'cancelado'
    };
    
    // Try numeric first, then string
    if (typeof status === 'number') {
        return numericStatusMap[status] || 'desarrollo';
    }
    return stringStatusMap[status] || 'desarrollo';
}


/**
 * Get domain display text
 * Accepts both numeric IDs and string keys
 */
export function getDomainText(domain) {
    // Numeric mapping (from database - matches jiraHandler.ts)
    const numericDomainMap = {
        1: 'Ventas | Contratación y SW',
        2: 'Ciclo de Vida y Producto',
        3: 'Facturación y Cobro',
        4: 'Atención',
        5: 'Operación de Sistemas y Ciberseguridad',
        6: 'Datos',
        7: 'Portabilidad',
        8: 'Integración',
        0: 'Ninguno'
    };
    
    // String mapping (legacy)
    const stringDomainMap = {
        'atencion': 'Atención',
        'facturacion': 'Facturación y Cobros',
        'contratacion': 'Contratación',
        'tecnologia': 'Tecnología',
        'marketing': 'Marketing',
        'rrhh': 'Recursos Humanos',
        'finanzas': 'Finanzas',
        'operaciones': 'Operaciones'
    };
    
    // Try numeric first, then string, then return as-is
    if (typeof domain === 'number') {
        return numericDomainMap[domain] || 'Ninguno';
    }
    return stringDomainMap[domain] || domain;
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

/**
 * Debounce function
 */
export function debounce(func, wait) {
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
 * Show notification/alert
 */
export function showNotification(message, type = 'info') {
    alert(message); // Simple implementation, can be enhanced with custom notifications
}

/**
 * Validate email format
 */
export function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

/**
 * Generate unique ID
 */
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Deep clone object
 */
export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Sort array of objects by property
 */
export function sortByProperty(array, property, ascending = true) {
    return array.sort((a, b) => {
        const aVal = a[property];
        const bVal = b[property];
        
        if (aVal < bVal) return ascending ? -1 : 1;
        if (aVal > bVal) return ascending ? 1 : -1;
        return 0;
    });
}

/**
 * Get date range (month/year) based on period selector value
 * @param {string} period - 'current', 'next', 'next3', 'next6', 'next12'
 * @returns {Array} Array of {month, year} objects
 */
export function getPeriodDateRange(period) {
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentYear = now.getFullYear();
    const ranges = [];
    
    switch(period) {
        case 'current':
            // Mes en curso
            ranges.push({ month: currentMonth, year: currentYear });
            break;
            
        case 'next':
            // Mes próximo (empezar desde el mes siguiente al actual)
            const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
            const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
            ranges.push({ month: nextMonth, year: nextYear });
            break;
            
        case 'next3':
            // 3 meses (empezar desde mes actual)
            for (let i = 0; i < 3; i++) {
                let m = currentMonth + i;
                let y = currentYear;
                while (m > 12) {
                    m -= 12;
                    y += 1;
                }
                ranges.push({ month: m, year: y });
            }
            break;
            
        case 'next6':
            // 6 meses (empezar desde mes actual)
            for (let i = 0; i < 6; i++) {
                let m = currentMonth + i;
                let y = currentYear;
                while (m > 12) {
                    m -= 12;
                    y += 1;
                }
                ranges.push({ month: m, year: y });
            }
            break;
            
        case 'next12':
            // 12 meses (empezar desde mes actual)
            for (let i = 0; i < 12; i++) {
                let m = currentMonth + i;
                let y = currentYear;
                while (m > 12) {
                    m -= 12;
                    y += 1;
                }
                ranges.push({ month: m, year: y });
            }
            break;
            
        default:
            // Por defecto, mes en curso
            ranges.push({ month: currentMonth, year: currentYear });
    }
    
    return ranges;
}
