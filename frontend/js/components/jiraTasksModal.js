/**
 * Jira Tasks Modal Component
 * Modal for importing tasks from Jira SCOM to jira_tasks table
 */

import apiService from '../services/api.js';
import { showNotification } from '../utils/notifications.js';
import { JIRA_CONFIG_SCOM } from '../config/jiraConfig.js';

export class JiraTasksModal {
    constructor() {
        this.modal = null;
        this.isOpen = false;
    }

    /**
     * Initialize the modal
     */
    init() {
        this.createModal();
        this.attachEventListeners();
        console.log('JiraTasksModal initialized');
    }

    /**
     * Create modal HTML structure
     */
    createModal() {
        const modalHTML = `
            <div id="jira-tasks-modal" class="modal" style="display: none;">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h2>Importar Tareas desde Jira SCOM</h2>
                        <span class="close-modal" data-modal="jira-tasks-modal">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="jira-task-key">Jira Task Key (SCOM-XXX) *</label>
                            <input 
                                type="text" 
                                id="jira-task-key" 
                                placeholder="Ej: SCOM-1234"
                                required
                            >
                            <small style="color: #6b7280; display: block; margin-top: 0.25rem;">
                                Introduce la clave de la tarea de Jira SCOM
                            </small>
                        </div>

                        <div id="jira-task-preview" style="display: none; margin-top: 1.5rem; padding: 1rem; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
                            <h3 style="margin-top: 0; font-size: 1rem; color: #374151;">Vista Previa de la Tarea</h3>
                            <div id="jira-task-preview-content"></div>
                        </div>

                        <div id="jira-task-error" style="display: none; margin-top: 1rem; padding: 0.75rem; background: #fee; border-radius: 8px; color: #c00;">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-modal="jira-tasks-modal">
                            Cancelar
                        </button>
                        <button type="button" id="fetch-jira-task-btn" class="btn btn-primary">
                            Buscar Tarea
                        </button>
                        <button type="button" id="import-jira-task-btn" class="btn btn-success" style="display: none;">
                            Importar Tarea
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('jira-tasks-modal');
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Close modal buttons
        const closeButtons = this.modal.querySelectorAll('.close-modal, [data-modal="jira-tasks-modal"]');
        closeButtons.forEach(btn => {
            btn.addEventListener('click', () => this.close());
        });

        // Click outside modal to close
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });

        // Fetch task button
        const fetchBtn = document.getElementById('fetch-jira-task-btn');
        if (fetchBtn) {
            fetchBtn.addEventListener('click', () => this.fetchJiraTask());
        }

        // Import task button
        const importBtn = document.getElementById('import-jira-task-btn');
        if (importBtn) {
            importBtn.addEventListener('click', () => this.importJiraTask());
        }

        // Enter key on input
        const taskKeyInput = document.getElementById('jira-task-key');
        if (taskKeyInput) {
            taskKeyInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.fetchJiraTask();
                }
            });
        }
    }

    /**
     * Open the modal
     */
    open() {
        this.modal.style.display = 'block';
        this.isOpen = true;
        this.resetModal();
        
        // Focus on input
        setTimeout(() => {
            const input = document.getElementById('jira-task-key');
            if (input) input.focus();
        }, 100);
    }

    /**
     * Close the modal
     */
    close() {
        this.modal.style.display = 'none';
        this.isOpen = false;
        this.resetModal();
    }

    /**
     * Reset modal to initial state
     */
    resetModal() {
        const taskKeyInput = document.getElementById('jira-task-key');
        const preview = document.getElementById('jira-task-preview');
        const error = document.getElementById('jira-task-error');
        const fetchBtn = document.getElementById('fetch-jira-task-btn');
        const importBtn = document.getElementById('import-jira-task-btn');

        if (taskKeyInput) taskKeyInput.value = '';
        if (preview) preview.style.display = 'none';
        if (error) error.style.display = 'none';
        if (fetchBtn) fetchBtn.style.display = 'inline-block';
        if (importBtn) importBtn.style.display = 'none';

        this.currentTask = null;
    }

    /**
     * Fetch task from Jira SCOM
     */
    async fetchJiraTask() {
        const taskKeyInput = document.getElementById('jira-task-key');
        const taskKey = taskKeyInput.value.trim().toUpperCase();

        if (!taskKey) {
            this.showError('Por favor, introduce una clave de tarea');
            return;
        }

        // Validate format SCOM-XXX
        if (!taskKey.match(/^SCOM-\d+$/)) {
            this.showError('Formato inválido. Debe ser SCOM-XXX (ej: SCOM-1234)');
            return;
        }

        try {
            this.showLoading('Buscando tarea en Jira SCOM...');

            // Fetch from Jira API
            const response = await fetch(`${JIRA_CONFIG_SCOM.baseUrl}/rest/api/3/issue/${taskKey}`, {
                headers: {
                    'Authorization': `Basic ${btoa(`${JIRA_CONFIG_SCOM.email}:${JIRA_CONFIG_SCOM.apiToken}`)}`,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error(`Tarea ${taskKey} no encontrada en Jira SCOM`);
                }
                throw new Error(`Error al buscar tarea: ${response.status}`);
            }

            const data = await response.json();
            
            // Store task data
            this.currentTask = {
                jiraKey: data.key,
                title: data.fields.summary,
                description: data.fields.description || '',
                status: data.fields.status.name,
                priority: data.fields.priority?.name || 'Medium',
                source: 'SCOM'
            };

            this.showPreview(this.currentTask);
            this.hideError();

        } catch (error) {
            console.error('Error fetching Jira task:', error);
            this.showError(error.message);
            this.hideLoading();
        }
    }

    /**
     * Show task preview
     */
    showPreview(task) {
        const preview = document.getElementById('jira-task-preview');
        const previewContent = document.getElementById('jira-task-preview-content');
        const fetchBtn = document.getElementById('fetch-jira-task-btn');
        const importBtn = document.getElementById('import-jira-task-btn');

        if (!preview || !previewContent) return;

        previewContent.innerHTML = `
            <div style="display: grid; gap: 0.75rem;">
                <div>
                    <strong style="color: #6b7280; font-size: 0.875rem;">Clave:</strong>
                    <div style="margin-top: 0.25rem;">${task.jiraKey}</div>
                </div>
                <div>
                    <strong style="color: #6b7280; font-size: 0.875rem;">Título:</strong>
                    <div style="margin-top: 0.25rem;">${task.title}</div>
                </div>
                <div>
                    <strong style="color: #6b7280; font-size: 0.875rem;">Estado:</strong>
                    <div style="margin-top: 0.25rem;">${task.status}</div>
                </div>
                <div>
                    <strong style="color: #6b7280; font-size: 0.875rem;">Prioridad:</strong>
                    <div style="margin-top: 0.25rem;">${task.priority}</div>
                </div>
                ${task.description ? `
                <div>
                    <strong style="color: #6b7280; font-size: 0.875rem;">Descripción:</strong>
                    <div style="margin-top: 0.25rem; max-height: 100px; overflow-y: auto;">${task.description.substring(0, 200)}${task.description.length > 200 ? '...' : ''}</div>
                </div>
                ` : ''}
            </div>
        `;

        preview.style.display = 'block';
        if (fetchBtn) fetchBtn.style.display = 'none';
        if (importBtn) importBtn.style.display = 'inline-block';
    }

    /**
     * Import task to database
     */
    async importJiraTask() {
        if (!this.currentTask) {
            this.showError('No hay tarea para importar');
            return;
        }

        try {
            this.showLoading('Importando tarea...');

            // Save to jira_tasks table via API
            const result = await apiService.createJiraTask(this.currentTask);

            console.log('Task imported successfully:', result);
            showNotification('Tarea importada exitosamente', 'success');

            // Close modal
            this.close();

            // Reload tasks table if function exists
            if (typeof window.loadTasksFromAPI === 'function') {
                await window.loadTasksFromAPI();
            }

        } catch (error) {
            console.error('Error importing task:', error);
            this.showError(`Error al importar tarea: ${error.message}`);
            this.hideLoading();
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        const errorDiv = document.getElementById('jira-task-error');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        }
    }

    /**
     * Hide error message
     */
    hideError() {
        const errorDiv = document.getElementById('jira-task-error');
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
    }

    /**
     * Show loading state
     */
    showLoading(message) {
        const fetchBtn = document.getElementById('fetch-jira-task-btn');
        const importBtn = document.getElementById('import-jira-task-btn');
        
        if (fetchBtn) {
            fetchBtn.disabled = true;
            fetchBtn.textContent = message;
        }
        if (importBtn) {
            importBtn.disabled = true;
            importBtn.textContent = message;
        }
    }

    /**
     * Hide loading state
     */
    hideLoading() {
        const fetchBtn = document.getElementById('fetch-jira-task-btn');
        const importBtn = document.getElementById('import-jira-task-btn');
        
        if (fetchBtn) {
            fetchBtn.disabled = false;
            fetchBtn.textContent = 'Buscar Tarea';
        }
        if (importBtn) {
            importBtn.disabled = false;
            importBtn.textContent = 'Importar Tarea';
        }
    }
}

// Export singleton instance
const jiraTasksModal = new JiraTasksModal();
export default jiraTasksModal;