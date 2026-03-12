/**
 * Resource Modal Component
 * Handles CRUD operations for resources with team-based access control
 */

import { API_CONFIG } from '../config/data.js';
import { reloadCapacityData } from './resourceCapacity.js';

// Modal state
let currentResourceId = null;
let isEditMode = false;
let isSaving = false; // Flag to prevent double submission
let isDeleting = false; // Flag to prevent double deletion
let maxResourceHours = 180; // Default value, will be loaded from config

// Available skills list
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

/**
 * Load max resource hours configuration from API
 */
async function loadMaxResourceHoursConfig() {
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
            console.warn('No credentials found, using default max resource hours');
            return;
        }
        
        const authHeader = authType === 'cognito' ? `Bearer ${awsAccessKey}` : awsAccessKey;
        
        // Request global config (team = null)
        const response = await fetch(`${API_CONFIG.BASE_URL}/config?key=max_resource_hours`, {
            headers: {
                'Authorization': authHeader,
                'x-user-team': userTeam
            }
        });
        
        if (!response.ok) {
            console.warn('Could not load max_resource_hours config, using default');
            return;
        }
        
        const result = await response.json();
        
        if (result.success && result.data && result.data.value) {
            const configValue = parseInt(result.data.value, 10);
            if (!isNaN(configValue) && configValue > 0) {
                maxResourceHours = configValue;
                console.log(`✅ Loaded max resource hours from config: ${maxResourceHours}`);
            }
        }
    } catch (error) {
        console.error('Error loading max resource hours config:', error);
        // Keep default value
    }
}

/**
 * Initialize modal event listeners
 */
export function initResourceModal() {
    console.log('Initializing resource modal...');
    
    // Load configuration
    loadMaxResourceHoursConfig();
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initResourceModalElements);
    } else {
        initResourceModalElements();
    }
}

/**
 * Initialize modal elements after DOM is ready
 */
function initResourceModalElements() {
    console.log('Initializing resource modal elements...');
    
    // Modal close handlers
    const resourceModal = document.getElementById('resourceModal');
    const deleteResourceModal = document.getElementById('deleteResourceModal');
    
    // Close on overlay click
    resourceModal?.addEventListener('click', (e) => {
        if (e.target === resourceModal) {
            closeResourceModal();
        }
    });
    
    deleteResourceModal?.addEventListener('click', (e) => {
        if (e.target === deleteResourceModal) {
            closeDeleteResourceModal();
        }
    });
    
    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (resourceModal?.classList.contains('active')) {
                closeResourceModal();
            }
            if (deleteResourceModal?.classList.contains('active')) {
                closeDeleteResourceModal();
            }
        }
    });
    
    // Form validation on input
    const form = document.getElementById('resourceForm');
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
    
    // Add event listener for "Añadir Recurso" button
    const addResourceBtn = document.getElementById('add-resource-btn');
    if (addResourceBtn) {
        addResourceBtn.addEventListener('click', openCreateResourceModal);
        console.log('Add resource button listener attached');
    } else {
        console.error('Add resource button not found in DOM!');
    }
}

/**
 * Update max hours UI elements
 */
function updateMaxHoursUI() {
    // Update input max attribute
    const capacityInput = document.getElementById('resourceDefaultCapacity');
    if (capacityInput) {
        capacityInput.setAttribute('max', maxResourceHours);
    }
    
    // Update label
    const capacityLabel = document.querySelector('label[for="resourceDefaultCapacity"]');
    if (capacityLabel) {
        capacityLabel.innerHTML = `Capacidad por Defecto (horas/mes) (máx.${maxResourceHours}) <span class="required">*</span>`;
    }
    
    // Update help text
    const helpText = capacityInput?.nextElementSibling;
    if (helpText && helpText.classList.contains('form-help')) {
        helpText.textContent = `Horas disponibles por mes (máximo: ${maxResourceHours} horas)`;
    }
}

/**
 * Open modal for creating a new resource
 */
export function openCreateResourceModal() {
    console.log('openCreateResourceModal called!');
    
    isEditMode = false;
    currentResourceId = null;
    
    const modal = document.getElementById('resourceModal');
    const form = document.getElementById('resourceForm');
    const title = document.getElementById('resourceModalTitle');
    
    console.log('Modal element:', modal);
    console.log('Form element:', form);
    console.log('Title element:', title);
    
    // Reset form
    form.reset();
    clearFormErrors();
    
    // Set default capacity
    document.getElementById('resourceDefaultCapacity').value = '160';
    
    // Update max hours UI elements
    updateMaxHoursUI();
    
    // Set user's team as default (hidden field)
    const userTeam = sessionStorage.getItem('user_team');
    if (userTeam) {
        document.getElementById('resourceTeam').value = userTeam;
    } else {
        console.error('No user team found in sessionStorage!');
    }
    
    // Update title with icon
    title.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" style="width: 24px; height: 24px; display: inline-block; margin-right: 8px; vertical-align: middle;">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
        </svg>
        Añadir Nuevo Recurso
    `;
    
    // Populate skills checkboxes
    populateSkillsCheckboxes([]);
    
    // Show modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

/**
 * Open modal for editing an existing resource
 * @param {Object} resource - Resource data
 */
export function openEditResourceModal(resource) {
    isEditMode = true;
    currentResourceId = resource.id;
    
    const modal = document.getElementById('resourceModal');
    const form = document.getElementById('resourceForm');
    const title = document.getElementById('resourceModalTitle');
    
    // Clear errors
    clearFormErrors();
    
    // Populate form with resource data
    document.getElementById('resourceName').value = resource.name;
    document.getElementById('resourceEmail').value = resource.email || '';
    document.getElementById('resourceTeam').value = resource.team;
    document.getElementById('resourceDefaultCapacity').value = resource.defaultCapacity || 160;
    
    // Update max hours UI elements
    updateMaxHoursUI();
    
    // Populate skills checkboxes with resource's skills
    const resourceSkills = resource.resourceSkills?.map(rs => rs.skillName) || [];
    populateSkillsCheckboxes(resourceSkills);
    
    // Update title with icon
    title.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" style="width: 24px; height: 24px; display: inline-block; margin-right: 8px; vertical-align: middle;">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
        </svg>
        Editar Recurso
    `;
    
    // Show modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

/**
 * Populate skills checkboxes
 * @param {Array} selectedSkills - Array of selected skill names
 */
function populateSkillsCheckboxes(selectedSkills) {
    const container = document.getElementById('resourceSkillsContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    AVAILABLE_SKILLS.forEach(skill => {
        const isChecked = selectedSkills.includes(skill);
        
        const checkboxDiv = document.createElement('div');
        checkboxDiv.className = 'skill-checkbox-item';
        checkboxDiv.innerHTML = `
            <label class="skill-checkbox-label">
                <input type="checkbox" name="skills" value="${skill}" ${isChecked ? 'checked' : ''}>
                <span>${skill}</span>
            </label>
        `;
        
        container.appendChild(checkboxDiv);
    });
}

/**
 * Close resource modal
 */
export function closeResourceModal() {
    const modal = document.getElementById('resourceModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
    
    // Reset after animation
    setTimeout(() => {
        document.getElementById('resourceForm').reset();
        clearFormErrors();
        currentResourceId = null;
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
        case 'resourceName':
            if (!value) {
                isValid = false;
                errorMessage = 'El nombre es obligatorio';
            } else if (value.length < 3) {
                isValid = false;
                errorMessage = 'El nombre debe tener al menos 3 caracteres';
            }
            break;
            
        case 'resourceEmail':
            if (value && !isValidEmail(value)) {
                isValid = false;
                errorMessage = 'El email no es válido';
            }
            break;
            
            
        case 'resourceDefaultCapacity':
            if (!value) {
                isValid = false;
                errorMessage = 'La capacidad por defecto es obligatoria';
            } else if (isNaN(value) || parseInt(value) <= 0) {
                isValid = false;
                errorMessage = 'La capacidad debe ser un número positivo';
            } else if (parseInt(value) > maxResourceHours) {
                isValid = false;
                errorMessage = `La capacidad no puede superar las ${maxResourceHours} horas`;
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
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} - True if valid
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate entire form
 * @returns {boolean} - True if all fields are valid
 */
function validateForm() {
    const form = document.getElementById('resourceForm');
    const fields = form.querySelectorAll('input[required], select[required]');
    
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
    const form = document.getElementById('resourceForm');
    form.querySelectorAll('.error').forEach(field => {
        field.classList.remove('error');
    });
    form.querySelectorAll('.form-error').forEach(error => {
        error.classList.remove('active');
        error.textContent = '';
    });
}

/**
 * Save resource (create or update)
 */
export async function saveResource() {
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
    const saveButton = document.querySelector('#resourceModal .btn-primary');
    if (saveButton) {
        saveButton.disabled = true;
        saveButton.style.opacity = '0.6';
        saveButton.style.cursor = 'not-allowed';
    }
    
    // Get form data
    const emailValue = document.getElementById('resourceEmail').value.trim();
    
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
        showNotification('No se encontró información de autenticación', 'error');
        return;
    }
    
    const authHeader = authType === 'cognito' ? `Bearer ${awsAccessKey}` : awsAccessKey;
    
    // Get selected skills
    const selectedSkills = Array.from(
        document.querySelectorAll('input[name="skills"]:checked')
    ).map(checkbox => ({
        name: checkbox.value,
        proficiency: null  // Could be enhanced to allow proficiency selection
    }));
    
    // Generate resource code from name (initials + timestamp)
    const resourceName = document.getElementById('resourceName').value.trim();
    const nameParts = resourceName.split(' ');
    const initials = nameParts.map(part => part.charAt(0).toUpperCase()).join('');
    const timestamp = Date.now().toString().slice(-4);
    const resourceCode = `${initials}${timestamp}`;
    
    const formData = {
        code: resourceCode,  // Add auto-generated code
        name: resourceName,
        email: emailValue === '' ? null : emailValue,
        team: document.getElementById('resourceTeam').value,
        defaultCapacity: parseInt(document.getElementById('resourceDefaultCapacity').value, 10),
        active: true
        // Note: skills are NOT included in the main resource creation/update
        // They will be sent separately after resource is created/updated
    };

    console.log('Form data to be sent:', formData);
    console.log('Selected skills to be saved:', selectedSkills);
    
    try {
        // Prepare request
        const url = isEditMode 
            ? `${API_CONFIG.BASE_URL}/resources/${currentResourceId}`
            : `${API_CONFIG.BASE_URL}/resources`;
        
        const method = isEditMode ? 'PUT' : 'POST';
        
        // Make API request
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader,
                'x-user-team': userTeam
            },
            body: JSON.stringify(formData)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            const errorMessage = errorData.error?.message || errorData.message || 'Error al guardar el recurso';
            throw new Error(errorMessage);
        }
        
        const result = await response.json();
        console.log('Resource save result:', result);
        
        // Get resource ID from response
        const resourceId = isEditMode ? currentResourceId : (result.data?.resource?.id || result.data?.id || result.id);
        console.log('Resource ID for skills update:', resourceId);
        
        // Update skills (both for create and edit)
        if (resourceId) {
            await updateResourceSkills(resourceId, selectedSkills, awsAccessKey, userTeam);
        } else {
            console.error('No resource ID found in response, cannot update skills');
        }
        
        // Close modal
        closeResourceModal();
        
        // Refresh capacity data
        reloadCapacityData();
        
        // Show success message
        showNotification(
            isEditMode ? 'Recurso actualizado correctamente' : 'Recurso creado correctamente',
            'success'
        );
        
    } catch (error) {
        console.error('Error saving resource:', error);
        showNotification(error.message || 'Error al guardar el recurso', 'error');
    } finally {
        // Reset saving flag and re-enable button
        isSaving = false;
        const saveButton = document.querySelector('#resourceModal .btn-primary');
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.style.opacity = '1';
            saveButton.style.cursor = 'pointer';
        }
    }
}

/**
 * Update resource skills
 * @param {string} resourceId - Resource ID
 * @param {Array} skills - Array of skill objects with {name, proficiency}
 * @param {string} awsAccessKey - AWS access key
 * @param {string} userTeam - User team
 */
async function updateResourceSkills(resourceId, skills, awsAccessKey, userTeam) {
    console.log('Updating resource skills:', { resourceId, skills });
    
    // Get auth type for proper header formatting
    const authType = sessionStorage.getItem('auth_type');
    const authHeader = authType === 'cognito' ? `Bearer ${awsAccessKey}` : awsAccessKey;
    
    try {
        // First, delete all existing skills for this resource
        const deleteResponse = await fetch(`${API_CONFIG.BASE_URL}/resources/${resourceId}/skills`, {
            method: 'DELETE',
            headers: {
                'Authorization': authHeader,
                'x-user-team': userTeam
            }
        });
        
        if (!deleteResponse.ok) {
            console.warn('Could not delete existing skills (may not exist)');
        }
        
        // Then, create new skills
        if (skills.length > 0) {
            const createPromises = skills.map(skill => 
                fetch(`${API_CONFIG.BASE_URL}/resources/${resourceId}/skills`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': authHeader,
                        'x-user-team': userTeam
                    },
                    body: JSON.stringify({
                        skillName: skill.name,
                        proficiency: skill.proficiency
                    })
                })
            );
            
            const results = await Promise.all(createPromises);
            
            // Check if all requests were successful
            const allSuccessful = results.every(r => r.ok);
            
            if (allSuccessful) {
                console.log('All skills updated successfully');
            } else {
                console.warn('Some skills failed to update');
            }
        } else {
            console.log('No skills to add (all skills removed)');
        }
        
    } catch (error) {
        console.error('Error updating resource skills:', error);
        // Don't throw error - skills update is not critical
        // The resource was already saved successfully
    }
}

/**
 * Open delete confirmation modal
 * @param {Object} resource - Resource to delete
 */
export function openDeleteResourceModal(resource) {
    currentResourceId = resource.id;
    
    const modal = document.getElementById('deleteResourceModal');
    const resourceName = document.getElementById('deleteResourceName');
    
    resourceName.textContent = resource.name;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

/**
 * Close delete confirmation modal
 */
export function closeDeleteResourceModal() {
    const modal = document.getElementById('deleteResourceModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
    
    setTimeout(() => {
        currentResourceId = null;
    }, 300);
}

/**
 * Confirm and execute resource deletion (mark as inactive)
 */
export async function confirmDeleteResource() {
    if (!currentResourceId) {
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
    const deleteButton = document.querySelector('#deleteResourceModal .btn-danger');
    if (deleteButton) {
        deleteButton.disabled = true;
        deleteButton.style.opacity = '0.6';
        deleteButton.style.cursor = 'not-allowed';
    }
    
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
            throw new Error('No se encontró información de autenticación');
        }
        
        const authHeader = authType === 'cognito' ? `Bearer ${awsAccessKey}` : awsAccessKey;
        
        // Mark resource as inactive (soft delete)
        const response = await fetch(`${API_CONFIG.BASE_URL}/resources/${currentResourceId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader,
                'x-user-team': userTeam
            },
            body: JSON.stringify({ active: false })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Error al eliminar el recurso');
        }
        
        // Close modal
        closeDeleteResourceModal();
        
        // Refresh capacity data
        reloadCapacityData();
        
        // Show success message
        showNotification('Recurso marcado como inactivo correctamente', 'success');
        
    } catch (error) {
        console.error('Error deleting resource:', error);
        showNotification(error.message || 'Error al eliminar el recurso', 'error');
    } finally {
        // Reset deleting flag and re-enable button
        isDeleting = false;
        const deleteButton = document.querySelector('#deleteResourceModal .btn-danger');
        if (deleteButton) {
            deleteButton.disabled = false;
            deleteButton.style.opacity = '1';
            deleteButton.style.cursor = 'pointer';
        }
    }
}

/**
 * Show notification message
 * @param {string} message - Message to display
 * @param {string} type - Notification type (success, error, warning)
 */
function showNotification(message, type = 'info') {
    // Use alert box for all notifications
    alert(message);
}

// Make functions globally available for HTML onclick handlers
window.closeResourceModal = closeResourceModal;
window.saveResource = saveResource;
window.closeDeleteResourceModal = closeDeleteResourceModal;
window.confirmDeleteResource = confirmDeleteResource;
window.openCreateResourceModal = openCreateResourceModal;
window.openEditResourceModal = openEditResourceModal;
window.openDeleteResourceModal = openDeleteResourceModal;
