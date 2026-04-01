const { ValidationError } = require('./errors');

const VALID_ACTIVITIES = [
    'Análisis', 'Diseño', 'Desarrollo', 'Testing', 'Documentación',
    'Reuniones', 'Code Review', 'Despliegue', 'Soporte', 'Formación', 'Otros'
];

function validateTimeEntry(data, isUpdate = false) {
    const errors = [];

    // Required fields for creation
    if (!isUpdate) {
        // Either projectId or jiraTaskId must be provided
        if (!data.projectId && !data.jiraTaskId) {
            errors.push('Either projectId or jiraTaskId is required');
        }
        if (!data.resourceName) errors.push('resourceName is required');
        if (!data.workDate) errors.push('workDate is required');
        if (!data.taskTitle) errors.push('taskTitle is required');
        if (!data.activity) errors.push('activity is required');
        if (data.hours === undefined || data.hours === null) errors.push('hours is required');
    }

    // Validate fields if present
    if (data.taskTitle && data.taskTitle.length > 255) {
        errors.push('taskTitle must be 255 characters or less');
    }

    if (data.taskDescription && data.taskDescription.length > 5000) {
        errors.push('taskDescription must be 5000 characters or less');
    }

    if (data.activity && !VALID_ACTIVITIES.includes(data.activity)) {
        errors.push(`activity must be one of: ${VALID_ACTIVITIES.join(', ')}`);
    }

    if (data.hours !== undefined) {
        const hours = parseFloat(data.hours);
        if (isNaN(hours) || hours <= 0 || hours > 24) {
            errors.push('hours must be a positive number between 0.5 and 24');
        }
    }

    if (data.workDate) {
        const date = new Date(data.workDate);
        if (isNaN(date.getTime())) {
            errors.push('workDate must be a valid date');
        }
    }

    if (errors.length > 0) {
        throw new ValidationError(errors.join(', '));
    }

    return true;
}

module.exports = {
    validateTimeEntry,
    VALID_ACTIVITIES
};