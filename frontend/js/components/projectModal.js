/**
 * Project Modal Component
 * Handles CRUD operations for projects with team-based access control
 */

import { API_CONFIG } from '../config/data.js';
import { initializeDropdowns, populateDomainDropdown, populateStatusDropdown } from '../utils/dropdownLoader.js';

// Modal state
let currentProjectId = null;
let isEditMode = false;
let isSaving = false; // Flag to prevent double submission
let isDeleting = false; // Flag to prevent double deletion

/**
 * Initialize modal event listeners
 */
export function initProjectModal() {
    console.log('Initializing project modal...');
    
    // Modal close handlers
    const projectModal = document.getElementById('projectModal');
    const deleteModal = document.getElementById('deleteModal');
    
    console.log('Project modal element:', projectModal);
    console.log('Delete modal element:', deleteModal);
    
    // Close on overlay click
    projectModal?.addEventListener('click', (e) => {
        if (e.target === projectModal) {
            closeProjectModal();
        }
    });
    
    deleteModal?.addEventListener('click', (e) => {
        if (e.target === deleteModal) {
            closeDeleteModal();
        }
    });
    
    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (projectModal?.classList.contains('active')) {
                closeProjectModal();
            }
            if (deleteModal?.classList.contains('active')) {
                closeDeleteModal();
            }
        }
    });
    
    // Form validation on input
    const form = document.getElementById('projectForm');
    if (form) {
        form.querySelectorAll('input, select, textarea').forEach(field => {
            field.addEventListener('blur', () => validateField(field));
            field.addEventListener('input', () => {
                if (field.classList.contains('error')) {
                    validateField(field);
                }
            });
        });
    }
}

/**
 * Open modal for creating a new project
 */
export function openCreateProjectModal() {
    console.log('openCreateProjectModal called!');
    
    isEditMode = false;
    currentProjectId = null;
    
    const modal = document.getElementById('projectModal');
    const form = document.getElementById('projectForm');
    const title = document.getElementById('modalTitle');
    
    console.log('Modal element:', modal);
    console.log('Form element:', form);
    console.log('Title element:', title);
    
    // Reset form
    form.reset();
    clearFormErrors();
    
    // Update title with icon
    title.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 24px; height: 24px; display: inline-block; margin-right: 8px; vertical-align: middle;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        Añadir Proyecto
    `;
    
    // Load dropdowns (synchronous now)
    initializeDropdowns();
    
    // Show modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

/**
 * Open modal for editing an existing project
 * @param {Object} project - Project data
 * @param {string} source - Source of the call ('projects' or 'tasks')
 */
export function openEditProjectModal(project, source = 'projects') {
    isEditMode = true;
    currentProjectId = project.id;
    
    const modal = document.getElementById('projectModal');
    const form = document.getElementById('projectForm');
    const title = document.getElementById('modalTitle');
    
    // Clear errors
    clearFormErrors();
    
    // Load dropdowns with selected values (synchronous now)
    populateDomainDropdown('projectDomain', project.domain);
    populateStatusDropdown('projectStatus', project.status);
    
    // Populate form with project data
    document.getElementById('projectId').value = project.id;
    document.getElementById('projectCode').value = project.code;
    document.getElementById('projectType').value = project.type || '';
    document.getElementById('projectTitle').value = project.title;
    document.getElementById('projectDescription').value = project.description;
    document.getElementById('projectDomain').value = project.domain;
    
    // Map priority from backend format to frontend format
    // Backend: 'muy-alta', 'alta', 'media', 'baja', 'muy-baja'
    // Frontend: 'Muy Alta', 'Alta', 'Media', 'Baja', 'Muy Baja'
    const priorityMap = {
        'muy-alta': 'Muy Alta',
        'alta': 'Alta',
        'media': 'Media',
        'baja': 'Baja',
        'muy-baja': 'Muy Baja'
    };
    const mappedPriority = priorityMap[project.priority] || project.priority;
    document.getElementById('projectPriority').value = mappedPriority;
    
    // Format dates for input[type="date"] (YYYY-MM-DD)
    // API returns start_date and end_date (snake_case)
    const startDateValue = project.startDate || project.start_date;
    if (startDateValue) {
        const startDate = new Date(startDateValue);
        document.getElementById('projectStartDate').value = startDate.toISOString().split('T')[0];
    } else {
        document.getElementById('projectStartDate').value = '';
    }
    
    const endDateValue = project.endDate || project.end_date;
    if (endDateValue) {
        const endDate = new Date(endDateValue);
        document.getElementById('projectEndDate').value = endDate.toISOString().split('T')[0];
    } else {
        document.getElementById('projectEndDate').value = '';
    }
    
    document.getElementById('projectStatus').value = project.status;
    
    // Set delivery hours if available (only for projects, not tasks)
    const deliveryHoursGroup = document.getElementById('projectDeliveryHours')?.closest('.form-group');
    if (source === 'tasks') {
        // Hide delivery hours field for tasks
        if (deliveryHoursGroup) {
            deliveryHoursGroup.style.display = 'none';
        }
    } else {
        // Show and populate delivery hours for projects
        if (deliveryHoursGroup) {
            deliveryHoursGroup.style.display = 'block';
        }
        const deliveryHours = project.deliveryHours || project.delivery_hours;
        document.getElementById('projectDeliveryHours').value = deliveryHours || '';
    }
    
    // Update title based on source
    const titleText = source === 'tasks' ? 'Editar Trabajo' : 'Editar Solicitud';
    title.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 24px; height: 24px; display: inline-block; margin-right: 8px; vertical-align: middle;">
            <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
        </svg>
        ${titleText} - ${project.code} - ${project.title}
    `;
    
    // Show modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

/**
 * Close project modal
 */
export function closeProjectModal() {
    const modal = document.getElementById('projectModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
    
    // Reset after animation
    setTimeout(() => {
        document.getElementById('projectForm').reset();
        clearFormErrors();
        currentProjectId = null;
        isEditMode = false;
    }, 300);
}

/**
 * Validate a single form field
 * @param {HTMLElement} field - Form field to validate
 * @returns {boolean} - True if valid
 */
function validateField(field) {
    const fieldId = field.id;
    const value = field.value.trim();
    const errorElement = document.getElementById(`${fieldId}Error`);
    
    let isValid = true;
    let errorMessage = '';
    
    switch (fieldId) {
        case 'projectCode':
            if (!value) {
                isValid = false;
                errorMessage = 'El código es obligatorio';
            } else if (value.length > 50) {
                isValid = false;
                errorMessage = 'El código debe tener máximo 50 caracteres';
            }
            break;
            
        case 'projectTitle':
            if (!value) {
                isValid = false;
                errorMessage = 'El título es obligatorio';
            } else if (value.length < 5) {
                isValid = false;
                errorMessage = 'El título debe tener al menos 5 caracteres';
            }
            break;
            
        case 'projectDescription':
            if (!value) {
                isValid = false;
                errorMessage = 'La descripción es obligatoria';
            } else if (value.length < 10) {
                isValid = false;
                errorMessage = 'La descripción debe tener al menos 10 caracteres';
            }
            break;
            
        case 'projectDomain':
            if (!value) {
                isValid = false;
                errorMessage = 'El dominio es obligatorio';
            }
            break;
            
        case 'projectPriority':
            if (!value) {
                isValid = false;
                errorMessage = 'La prioridad es obligatoria';
            }
            break;
            
        case 'projectStartDate':
            // OPCIONAL - Solo validar formato si se proporciona
            if (value) {
                const date = new Date(value);
                if (isNaN(date.getTime())) {
                    isValid = false;
                    errorMessage = 'Formato de fecha inválido';
                }
            }
            break;
            
        case 'projectEndDate':
            // OPCIONAL - Solo validar si se proporciona
            if (value) {
                const endDate = new Date(value);
                if (isNaN(endDate.getTime())) {
                    isValid = false;
                    errorMessage = 'Formato de fecha inválido';
                } else {
                    const startDate = document.getElementById('projectStartDate').value;
                    if (startDate && endDate < new Date(startDate)) {
                        isValid = false;
                        errorMessage = 'La fecha de fin debe ser posterior a la fecha de inicio';
                    }
                }
            }
            break;
            
        case 'projectStatus':
            if (!value) {
                isValid = false;
                errorMessage = 'El estado es obligatorio';
            }
            break;
    }
    
    // Update UI
    if (isValid) {
        field.classList.remove('error');
        if (errorElement) {
            errorElement.classList.remove('active');
            errorElement.textContent = '';
        }
    } else {
        field.classList.add('error');
        if (errorElement) {
            errorElement.classList.add('active');
            errorElement.textContent = errorMessage;
        }
    }
    
    return isValid;
}

/**
 * Validate entire form
 * @returns {boolean} - True if all fields are valid
 */
function validateForm() {
    const form = document.getElementById('projectForm');
    const fields = form.querySelectorAll('input[required], select[required], textarea[required]');
    
    let isValid = true;
    fields.forEach(field => {
        if (!validateField(field)) {
            isValid = false;
        }
    });
    
    return isValid;
}

/**
 * Clear all form errors
 */
function clearFormErrors() {
    const form = document.getElementById('projectForm');
    form.querySelectorAll('.error').forEach(field => {
        field.classList.remove('error');
    });
    form.querySelectorAll('.form-error').forEach(error => {
        error.classList.remove('active');
        error.textContent = '';
    });
}

/**
 * Save project (create or update)
 */
export async function saveProject() {
    // Prevent double submission
    if (isSaving) {
        console.log('Save already in progress, ignoring duplicate request');
        return;
    }
    
    // Validate form
    if (!validateForm()) {
        return;
    }
    
    // Set saving flag
    isSaving = true;
    
    // Disable save button
    const saveButton = document.querySelector('#projectModal .btn-success');
    if (saveButton) {
        saveButton.disabled = true;
        saveButton.style.opacity = '0.6';
        saveButton.style.cursor = 'not-allowed';
    }
    
    // Get form data
    const typeValue = document.getElementById('projectType').value.trim();
    const startDateValue = document.getElementById('projectStartDate').value.trim();
    const endDateValue = document.getElementById('projectEndDate').value.trim();
    
    // Get authentication tokens and user team from sessionStorage
    const awsAccessKey = sessionStorage.getItem('aws_access_key');
    const userTeam = sessionStorage.getItem('user_team');
    
    if (!awsAccessKey || !userTeam) {
        showNotification('No se encontró información de autenticación', 'error');
        return;
    }
    
    // Get delivery hours value
    const deliveryHoursValue = document.getElementById('projectDeliveryHours').value.trim();
    console.log('🔍 DEBUG - deliveryHoursValue RAW:', deliveryHoursValue);
    console.log('🔍 DEBUG - deliveryHoursValue isEmpty:', deliveryHoursValue === '');
    console.log('🔍 DEBUG - deliveryHoursValue parsed:', deliveryHoursValue === '' ? null : parseFloat(deliveryHoursValue));
    
    const formData = {
        code: document.getElementById('projectCode').value.trim(),
        type: typeValue === '' ? null : typeValue, // Explicitly set to null if empty
        title: document.getElementById('projectTitle').value.trim(),
        description: document.getElementById('projectDescription').value.trim(),
        domain: parseInt(document.getElementById('projectDomain').value, 10),  // Numeric ID
        priority: document.getElementById('projectPriority').value, // String value
        startDate: startDateValue === '' ? null : startDateValue,
        endDate: endDateValue === '' ? null : endDateValue,
        status: parseInt(document.getElementById('projectStatus').value, 10),   // Numeric ID
        team: userTeam,  // Add team from sessionStorage
        deliveryHours: deliveryHoursValue === '' ? null : parseFloat(deliveryHoursValue)
    };

    console.log('📤 Form data to be sent:', formData);
    console.log('📤 deliveryHours in formData:', formData.deliveryHours);
    console.log('📤 JSON.stringify:', JSON.stringify(formData));
    
    try {
        // Prepare request
        const url = isEditMode 
            ? `${API_CONFIG.BASE_URL}/projects/${currentProjectId}`
            : `${API_CONFIG.BASE_URL}/projects`;
        
        const method = isEditMode ? 'PUT' : 'POST';
        
        // Make API request
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': awsAccessKey,
                'x-user-team': userTeam
            },
            body: JSON.stringify(formData)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            // Extract specific error message from API response structure
            const errorMessage = errorData.error?.message || errorData.message || 'Error al guardar el proyecto';
            throw new Error(errorMessage);
        }
        
        const result = await response.json();
        
        // Close modal
        closeProjectModal();
        
        // Refresh projects table
        await refreshProjectsTable();
        
        // Show success message
        showNotification(
            isEditMode ? 'Proyecto actualizado correctamente' : 'Proyecto creado correctamente',
            'success'
        );
        
    } catch (error) {
        console.error('Error saving project:', error);
        showNotification(error.message || 'Error al guardar el proyecto', 'error');
    } finally {
        // Reset saving flag and re-enable button
        isSaving = false;
        const saveButton = document.querySelector('#projectModal .btn-success');
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.style.opacity = '1';
            saveButton.style.cursor = 'pointer';
        }
    }
}

/**
 * Open delete confirmation modal
 * @param {Object} project - Project to delete
 */
export function openDeleteModal(project) {
    currentProjectId = project.id;
    
    const modal = document.getElementById('deleteModal');
    const projectName = document.getElementById('deleteProjectName');
    
    // Show ID and title in format: [ID] - [Title]
    projectName.textContent = `${project.code} - ${project.title}`;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

/**
 * Close delete confirmation modal
 */
export function closeDeleteModal() {
    const modal = document.getElementById('deleteModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
    
    setTimeout(() => {
        currentProjectId = null;
    }, 300);
}

/**
 * Confirm and execute project deletion
 */
export async function confirmDelete() {
    if (!currentProjectId) {
        return;
    }
    
    // Prevent double deletion
    if (isDeleting) {
        console.log('Delete already in progress, ignoring duplicate request');
        return;
    }
    
    // Set deleting flag
    isDeleting = true;
    
    // Disable delete button
    const deleteButton = document.querySelector('#deleteModal .btn-danger');
    if (deleteButton) {
        deleteButton.disabled = true;
        deleteButton.style.opacity = '0.6';
        deleteButton.style.cursor = 'not-allowed';
    }
    
    try {
        // Get authentication tokens
        const awsAccessKey = sessionStorage.getItem('aws_access_key');
        const userTeam = sessionStorage.getItem('user_team');
        
        if (!awsAccessKey || !userTeam) {
            throw new Error('No se encontró información de autenticación');
        }
        
        // Step 1: Delete all assignments associated with this project
        console.log(`Deleting assignments for project ${currentProjectId}...`);
        const assignmentsResponse = await fetch(`${API_CONFIG.BASE_URL}/assignments?projectId=${currentProjectId}`, {
            headers: {
                'Authorization': awsAccessKey,
                'x-user-team': userTeam
            }
        });
        
        if (assignmentsResponse.ok) {
            const assignmentsData = await assignmentsResponse.json();
            const assignments = assignmentsData.data?.assignments || assignmentsData.assignments || [];
            
            // Delete each assignment
            for (const assignment of assignments) {
                await fetch(`${API_CONFIG.BASE_URL}/assignments/${assignment.id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': awsAccessKey,
                        'x-user-team': userTeam
                    }
                });
            }
            console.log(`Deleted ${assignments.length} assignments`);
        }
        
        // Step 2: Delete tasks from localStorage (conceptualization tasks)
        // Find project code from window.allProjects
        const project = window.allProjects?.find(p => p.id === currentProjectId);
        if (project && project.code) {
            const storageKey = `project_tasks_${project.code}`;
            localStorage.removeItem(storageKey);
            console.log(`Deleted localStorage tasks for project ${project.code}`);
        }
        
        // Step 3: Delete the project
        console.log(`Deleting project ${currentProjectId}...`);
        const response = await fetch(`${API_CONFIG.BASE_URL}/projects/${currentProjectId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': awsAccessKey,
                'x-user-team': userTeam
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Error al eliminar el proyecto');
        }
        
        // Close modal
        closeDeleteModal();
        
        // Refresh projects table
        await refreshProjectsTable();
        
        // Show success message
        showNotification('Proyecto y datos asociados eliminados correctamente', 'success');
        
    } catch (error) {
        console.error('Error deleting project:', error);
        showNotification(error.message || 'Error al eliminar el proyecto', 'error');
    } finally {
        // Reset deleting flag and re-enable button
        isDeleting = false;
        const deleteButton = document.querySelector('#deleteModal .btn-danger');
        if (deleteButton) {
            deleteButton.disabled = false;
            deleteButton.style.opacity = '1';
            deleteButton.style.cursor = 'pointer';
        }
    }
}

/**
 * Refresh projects table after CRUD operations
 */
async function refreshProjectsTable() {
    try {
        // Get authentication tokens
        const awsAccessKey = sessionStorage.getItem('aws_access_key');
        const userTeam = sessionStorage.getItem('user_team');
        
        if (!awsAccessKey || !userTeam) {
            throw new Error('No se encontró información de autenticación');
        }
        
        // Fetch projects
        const response = await fetch(`${API_CONFIG.BASE_URL}/projects`, {
            headers: {
                'Authorization': awsAccessKey,
                'x-user-team': userTeam
            }
        });
        
        if (!response.ok) {
            throw new Error('Error al cargar proyectos');
        }
        
        const data = await response.json();
        console.log('Projects data received after CRUD operation:', data);
        
        // Extract projects array from response
        // The API returns: {success: true, data: {projects: [...], count: N}}
        const projects = data.data?.projects || data.projects || [];
        console.log(`Refreshed ${projects.length} projects after CRUD operation`);
        
        // Update table (this function should be imported from the main module)
        if (window.updateProjectsTable) {
            window.updateProjectsTable(projects);
        }
        
        // Update KPIs and charts
        if (window.updateDashboard) {
            window.updateDashboard();
        }
        
    } catch (error) {
        console.error('Error refreshing projects:', error);
    }
}

/**
 * Show notification message
 * @param {string} message - Message to display
 * @param {string} type - Notification type (success, error, warning)
 */
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: #E5EDED;
        color: #1f2937;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 3000;
        animation: slideIn 0.3s ease-out;
        font-weight: 500;
    `;
    
    // Add to DOM
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// Make functions globally available for HTML onclick handlers
window.closeProjectModal = closeProjectModal;
window.saveProject = saveProject;
window.closeDeleteModal = closeDeleteModal;
window.confirmDelete = confirmDelete;
window.openCreateProjectModal = openCreateProjectModal;
window.openEditProjectModal = openEditProjectModal;
window.openDeleteModal = openDeleteModal;
