/**
 * Create Task Modal Component
 * Simple form to create a new task/assignment for a project
 */

import { API_CONFIG } from '../config/data.js';
import { showNotification } from '../utils/helpers.js';

export class CreateTaskModal {
    constructor() {
        this.modalElement = null;
        this.projectId = null;
        this.projectCode = null;
        this.isInitialized = false;
    }

    /**
     * Initialize the modal
     */
    init() {
        if (this.isInitialized) return;
        
        this.createModalHTML();
        this.attachEventListeners();
        this.isInitialized = true;
    }

    /**
     * Create modal HTML structure
     */
    createModalHTML() {
        const modalHTML = `
            <div id="create-task-modal" class="modal-overlay">
                <div class="modal-container" style="max-width: 600px;">
                    <div class="modal-header">
                        <h2>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 24px; height: 24px; display: inline-block; margin-right: 8px; vertical-align: middle;">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                            </svg>
                            <span>Crear Nueva Tarea</span>
                        </h2>
                        <button class="modal-close" id="close-create-task-modal" title="Cerrar">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <div class="modal-body">
                        <form id="create-task-form">
                            <div class="form-group">
                                <label for="task-title">Título de la Tarea *</label>
                                <input type="text" id="task-title" name="title" class="form-control" required placeholder="Ej: Desarrollo de módulo de reportes">
                            </div>
                            
                            <div class="form-group">
                                <label for="task-description">Descripción</label>
                                <textarea id="task-description" name="description" class="form-control" rows="3" placeholder="Descripción detallada de la tarea..."></textarea>
                            </div>
                            
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="task-hours">Horas Estimadas *</label>
                                    <input type="number" id="task-hours" name="hours" class="form-control" required min="0" step="0.5" placeholder="Ej: 40">
                                </div>
                                
                                <div class="form-group">
                                    <label for="task-skill">Actividad</label>
                                    <select id="task-skill" name="skillName" class="form-control">
                                        <option value="">Seleccionar actividad...</option>
                                        <option value="Project Management">Project Management</option>
                                        <option value="Conceptualización">Conceptualización</option>
                                        <option value="Análisis">Análisis</option>
                                        <option value="Diseño">Diseño</option>
                                        <option value="Construcción">Construcción</option>
                                        <option value="QA">QA</option>
                                        <option value="Despliegue">Despliegue</option>
                                        <option value="General">General</option>
                                    </select>
                                </div>
                            </div>
                            
                        </form>
                    </div>
                    <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; border-top: 1px solid #e2e8f0;">
                        <div style="display: flex; gap: 0.75rem;">
                            <button type="button" class="btn btn-secondary" id="cancel-create-task">Cancelar</button>
                        </div>
                        <div style="display: flex; gap: 0.75rem;">
                            <button type="button" class="btn btn-success" id="save-create-task" style="display: flex; align-items: center; gap: 0.5rem; background: #2d7a6e; border-color: #2d7a6e; color: white;">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="white" style="width: 18px; height: 18px;">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                                Crear Tarea
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modalElement = document.getElementById('create-task-modal');
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Close modal
        const closeBtn = document.getElementById('close-create-task-modal');
        const cancelBtn = document.getElementById('cancel-create-task');
        const saveBtn = document.getElementById('save-create-task');
        
        // Remove any existing listeners by cloning and replacing
        const newCloseBtn = closeBtn.cloneNode(true);
        const newCancelBtn = cancelBtn.cloneNode(true);
        const newSaveBtn = saveBtn.cloneNode(true);
        
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
        
        // Attach fresh listeners
        newCloseBtn.addEventListener('click', () => this.close());
        newCancelBtn.addEventListener('click', () => this.close());
        newSaveBtn.addEventListener('click', () => {
            console.log('[TRACE 0] Save button clicked');
            this.save();
        }, { once: false }); // Allow multiple clicks but prevent double-firing
        
        // Close on overlay click
        this.modalElement.addEventListener('click', (e) => {
            if (e.target === this.modalElement) {
                this.close();
            }
        });

        // ESC key to close - store reference to remove later
        this.escapeHandler = (e) => {
            if (e.key === 'Escape' && this.modalElement.classList.contains('active')) {
                e.stopPropagation(); // Prevent other modals from closing
                this.close();
            }
        };
        document.addEventListener('keydown', this.escapeHandler);
    }

    /**
     * Open modal for a specific project
     */
    open(projectId, projectCode) {
        this.projectId = projectId;
        this.projectCode = projectCode;
        this.editMode = false;
        this.editTaskIds = null;

        // Reset form
        document.getElementById('create-task-form').reset();
        
        // Update modal title and icon
        const modalTitle = this.modalElement.querySelector('.modal-header h2 span');
        if (modalTitle) {
            modalTitle.textContent = 'Crear Nueva Tarea';
        }
        
        // Update icon to "add" icon for create mode
        const modalIcon = this.modalElement.querySelector('.modal-header h2 svg');
        if (modalIcon) {
            modalIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />';
        }
        
        // Update button text
        const saveButton = document.getElementById('save-create-task');
        if (saveButton) {
            saveButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="white" style="width: 18px; height: 18px;">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Crear Tarea
            `;
        }

        // Show modal
        this.modalElement.classList.add('active');
    }

    /**
     * Open modal in edit mode for an existing task
     */
    openForEdit(projectId, projectCode, taskData, taskIds) {
        this.projectId = projectId;
        this.projectCode = projectCode;
        this.editMode = true;
        this.editTaskIds = taskIds;

        // Populate form with existing data
        document.getElementById('task-title').value = taskData.title || '';
        document.getElementById('task-description').value = taskData.description || '';
        document.getElementById('task-hours').value = taskData.hours || '';
        document.getElementById('task-skill').value = taskData.skillName || '';
        
        // Update modal title and icon
        const modalTitle = this.modalElement.querySelector('.modal-header h2 span');
        if (modalTitle) {
            modalTitle.textContent = 'Editar Trabajo';
        }
        
        // Update icon to "edit" icon for edit mode
        const modalIcon = this.modalElement.querySelector('.modal-header h2 svg');
        if (modalIcon) {
            modalIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />';
        }
        
        // Update button text
        const saveButton = document.getElementById('save-create-task');
        if (saveButton) {
            saveButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="white" style="width: 18px; height: 18px;">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Guardar
            `;
        }

        // Show modal
        this.modalElement.classList.add('active');
    }

    /**
     * Close modal
     */
    close() {
        this.modalElement.classList.remove('active');
        // Don't trigger any callbacks when closing without saving
    }

    /**
     * Save task to database (create or update)
     */
    async save() {
        // Prevent double-submission
        if (this.isSaving) {
            console.log('[TRACE] Already saving, ignoring duplicate call');
            return;
        }
        this.isSaving = true;
        
        const form = document.getElementById('create-task-form');
        
        // Validate form
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        // Get form data
        const formData = new FormData(form);
        const hours = parseFloat(formData.get('hours'));
        
        // Validation for hours
        if (!hours || isNaN(hours) || hours <= 0) {
            showNotification('Las horas deben ser un número mayor que 0', 'error');
            return;
        }
        
        // Use current month and year
        const now = new Date();
        const month = now.getMonth() + 1; // JavaScript months are 0-indexed
        const year = now.getFullYear();
        
        const taskData = {
            title: formData.get('title'),
            description: formData.get('description') || '',
            hours: hours,
            skillName: formData.get('skillName') || null
        };

        try {
            // Get authentication tokens
            const awsAccessKey = sessionStorage.getItem('aws_access_key');
            const userTeam = sessionStorage.getItem('user_team');
            
            if (!awsAccessKey || !userTeam) {
                showNotification('No se encontraron credenciales de autenticación', 'error');
                return;
            }

            if (this.editMode && this.editTaskIds && this.editTaskIds.length > 0) {
                // EDIT MODE: Update concept task
                const taskId = this.editTaskIds[0];
                
                console.log('[TRACE PUT-1] Updating concept task:', taskId, taskData);
                console.log('[TRACE PUT-2] API URL:', `${API_CONFIG.BASE_URL}/concept-tasks/${taskId}`);
                console.log('[TRACE PUT-3] Headers:', { awsAccessKey: awsAccessKey ? 'present' : 'missing', userTeam });
                
                try {
                    console.log('[TRACE PUT-4] About to call fetch PUT...');
                    const response = await fetch(`${API_CONFIG.BASE_URL}/concept-tasks/${taskId}`, {
                        method: 'PUT',
                        headers: {
                            'Authorization': awsAccessKey,
                            'x-user-team': userTeam,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(taskData)
                    });
                    console.log('[TRACE PUT-5] Fetch completed, response status:', response.status);
                    console.log('[TRACE PUT-6] Response headers:', Object.fromEntries(response.headers.entries()));
                    
                    if (!response.ok) {
                        console.log('[TRACE PUT-7] Response not OK, reading error...');
                        const errorData = await response.json();
                        console.log('[TRACE PUT-8] Error data:', errorData);
                        throw new Error(errorData.message || 'Error al actualizar la tarea');
                    }
                    
                    console.log('[TRACE PUT-9] Response OK, parsing JSON...');
                    const result = await response.json();
                    console.log('[TRACE PUT-10] Concept task updated successfully:', result);
                    
                    // Close modal
                    console.log('[TRACE PUT-11] Closing modal...');
                    this.close();
                    console.log('[TRACE PUT-12] Modal closed');
                    
                    // Trigger callback if provided
                    console.log('[TRACE PUT-13] Triggering callback...');
                    if (this.onTaskCreated) {
                        this.onTaskCreated(result.task || result.data);
                    }
                    console.log('[TRACE PUT-14] Callback completed');
                } catch (err) {
                    console.error('[TRACE PUT-ERROR] Error updating concept task:', err);
                    console.error('[TRACE PUT-ERROR] Error name:', err.name);
                    console.error('[TRACE PUT-ERROR] Error message:', err.message);
                    console.error('[TRACE PUT-ERROR] Error stack:', err.stack);
                    showNotification(err.message || 'No se pudo actualizar la tarea', 'error');
                }
                
            } else {
                // CREATE MODE: Create new concept task
                const createData = {
                    ...taskData,
                    projectId: this.projectId
                };
                
                console.log('[TRACE 1] Creating concept task:', createData);
                console.log('[TRACE 2] API URL:', `${API_CONFIG.BASE_URL}/concept-tasks`);
                console.log('[TRACE 3] Headers:', { awsAccessKey: awsAccessKey ? 'present' : 'missing', userTeam });

                // Send POST request to concept-tasks API
                console.log('[TRACE 4] About to call fetch...');
                const response = await fetch(`${API_CONFIG.BASE_URL}/concept-tasks`, {
                    method: 'POST',
                    headers: {
                        'Authorization': awsAccessKey,
                        'x-user-team': userTeam,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(createData)
                });
                console.log('[TRACE 5] Fetch completed, response status:', response.status);

                if (!response.ok) {
                    console.log('[TRACE 6] Response not OK, reading error...');
                    const errorData = await response.json();
                    console.log('[TRACE 7] Error data:', errorData);
                    throw new Error(errorData.message || 'Error al crear la tarea');
                }

                console.log('[TRACE 8] Response OK, parsing JSON...');
                const result = await response.json();
                console.log('[TRACE 9] Concept task created successfully:', result);
                
                // Close modal
                console.log('[TRACE 10] Closing modal...');
                this.close();
                console.log('[TRACE 11] Modal closed');
                
                // Trigger callback if provided
                console.log('[TRACE 12] Triggering callback...');
                if (this.onTaskCreated) {
                    this.onTaskCreated(result.task || result.data);
                }
                console.log('[TRACE 13] Callback completed');
            }

        } catch (error) {
            console.error('Error saving task:', error);
            showNotification(`Error al guardar la tarea: ${error.message}`, 'error');
        } finally {
            this.isSaving = false;
        }
    }

    /**
     * Set callback for when task is created
     */
    setOnTaskCreatedCallback(callback) {
        this.onTaskCreated = callback;
    }
}
