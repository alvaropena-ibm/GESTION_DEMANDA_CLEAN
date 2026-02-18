/**
 * Jira Integration Modal
 * Handles configuration and import from Jira
 * Configuration is managed in the backend per team
 */

import { API_CONFIG } from '../config/data.js';

export class JiraModal {
    constructor() {
        this.modal = null;
        this.selectedProjects = [];
        this.maxImportBatch = 10; // Default value, will be loaded from config
        this.mode = 'projects'; // 'projects' or 'tasks'
        this.taskTypes = []; // Will be loaded from config
    }

    async init() {
        await this.loadMaxImportBatchConfig();
        await this.loadTaskTypes();
        this.createModal();
        console.log('Jira Modal initialized');
    }

    /**
     * Load task types configuration from API
     */
    async loadTaskTypes() {
        try {
            const userTeam = sessionStorage.getItem('user_team');
            
            if (!userTeam) {
                console.warn('No user team found, using default task types');
                this.taskTypes = ['Soporte_PAP', 'Tareas_Varias'];
                return;
            }
            
            // Import apiService
            const { default: apiService } = await import('../services/api.js');
            
            // Load task types for the user's team
            this.taskTypes = await apiService.getTaskTypes(userTeam);
            
            console.log(`✅ Loaded task types for team ${userTeam}:`, this.taskTypes);
        } catch (error) {
            console.error('Error loading task types:', error);
            // Keep default values
            this.taskTypes = ['Soporte_PAP', 'Tareas_Varias'];
        }
    }

    /**
     * Load max import batch configuration from API
     */
    async loadMaxImportBatchConfig() {
        try {
            const awsAccessKey = sessionStorage.getItem('aws_access_key');
            const userTeam = sessionStorage.getItem('user_team');
            
            if (!awsAccessKey || !userTeam) {
                console.warn('No credentials found, using default max import batch');
                return;
            }
            
            const response = await fetch(`${API_CONFIG.BASE_URL}/config?key=max_import_batch`, {
                headers: {
                    'Authorization': awsAccessKey,
                    'x-user-team': userTeam
                }
            });
            
            if (!response.ok) {
                console.warn('Could not load max_import_batch config, using default');
                return;
            }
            
            const result = await response.json();
            
            if (result.success && result.data && result.data.value) {
                const configValue = parseInt(result.data.value, 10);
                if (!isNaN(configValue) && configValue > 0) {
                    this.maxImportBatch = configValue;
                    console.log(`✅ Loaded max import batch from config: ${this.maxImportBatch}`);
                }
            }
        } catch (error) {
            console.error('Error loading max import batch config:', error);
            // Keep default value
        }
    }

    createModal() {
        const modalHTML = `
            <div id="jira-modal" class="modal-overlay" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999;">
                <div class="modal-container" style="max-width: 1225px; width: 87.5%; max-height: 98vh; overflow-y: auto; background: white; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); font-size: 2rem;">
                    <div class="modal-header">
                        <h2><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 24px; height: 24px; display: inline-block; vertical-align: middle; margin-right: 8px;">
  <path d="M11.53 2c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.97 4.35 4.35 4.35V2.84a.84.84 0 0 0-.84-.84H11.53zM6.77 6.8c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.97 4.35 4.35 4.35V7.64a.84.84 0 0 0-.84-.84H6.77zM2 11.6c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.97 4.35 4.35 4.35v-9.56a.84.84 0 0 0-.84-.84H2z"/>
</svg> Importar / Sincronizar desde Jira</h2>
                        <button class="modal-close" onclick="window.jiraModal.close()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div id="jira-step-1" class="jira-step">
                            <h3 style="margin-top: 0; color: #2563eb;">Configuración</h3>
                            
                            <div class="form-group">
                                <label style="font-size: 1.1rem; font-weight: 600;">URL de Jira *</label>
                                <input type="text" id="jira-url" class="form-input" 
                                       value="https://naturgy-adn.atlassian.net" readonly
                                       style="background-color: #f3f4f6; font-size: 1.1rem;">
                            </div>

                            <div class="form-group">
                                <label style="font-size: 1.1rem; font-weight: 600;">Email *</label>
                                <input type="email" id="jira-email" class="form-input" 
                                       placeholder="tu.email@naturgy.com"
                                       style="font-size: 1.1rem;">
                            </div>

                            <div class="form-group">
                                <label style="font-size: 1.1rem; font-weight: 600;">API Token *</label>
                                <input type="password" id="jira-token" class="form-input" 
                                       placeholder="Tu API Token de Jira"
                                       style="font-size: 1.1rem;">
                                <small style="color: #6b7280; font-size: 1rem;">
                                    <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" style="color: #2563eb; font-size: 1rem;">
                                        Genera tu token aquí
                                    </a>
                                </small>
                            </div>

                            <div class="form-group">
                                <label style="font-size: 1.1rem; font-weight: 600;">Consulta JQL (Opcional)</label>
                                <textarea id="jira-jql" class="form-input" rows="3" 
                                          placeholder="project = 'TU_PROYECTO' AND status != 'Closed'"
                                          style="font-size: 1.1rem;"></textarea>
                                <small style="color: #6b7280; font-size: 1rem;">Ejemplo: project = 'NC' AND status != 'Closed'</small>
                            </div>

                            <div style="margin-top: 1.5rem; padding: 1rem; background-color: #dbeafe; border-left: 4px solid #2563eb; border-radius: 4px;">
                                <p style="margin: 0; font-size: 1.1rem; color: #1e40af;">
                                    <strong>🔐 Seguridad:</strong> Tu API Token no se guarda y solo se usa para esta importación.
                                </p>
                            </div>

                            <div class="modal-footer" style="margin-top: 1.5rem;">
                                <button onclick="window.jiraModal.close()" class="btn btn-secondary">
                                    Cancelar
                                </button>
                                <button onclick="window.jiraModal.importProjects()" class="btn btn-primary">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 20px; height: 20px;">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                    </svg>
                                    Importar / Sincronizar
                                </button>
                            </div>
                        </div>

                        <div id="jira-selection" class="jira-step" style="display: none;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding: 0.75rem; background-color: #f3f4f6; border-radius: 6px;">
                                <span id="jira-selection-count" style="font-weight: 600; color: #374151; font-size: 1rem;">0 de 0 seleccionados</span>
                                <div style="display: flex; gap: 0.75rem;">
                                    <button onclick="window.jiraModal.selectAllIssues()" class="btn btn-primary" style="padding: 0.625rem 1.25rem; font-size: 1rem;">
                                        Seleccionar Todos
                                    </button>
                                    <button onclick="window.jiraModal.deselectAllIssues()" class="btn btn-secondary" style="padding: 0.625rem 1.25rem; font-size: 1rem;">
                                        Deseleccionar Todos
                                    </button>
                                </div>
                            </div>

                            <div id="jira-issues-list" style="max-height: 300px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 6px; padding: 1rem; background-color: #fafafa;">
                                <!-- Issues will be populated here -->
                            </div>

                            <div class="modal-footer" style="margin-top: 1.5rem;">
                                <button onclick="window.jiraModal.close()" class="btn btn-secondary">
                                    Cancelar
                                </button>
                                <button id="jira-import-selected-btn" onclick="window.jiraModal.importSelectedIssues()" class="btn btn-primary" disabled>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 20px; height: 20px;">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                    </svg>
                                    Importar / Sincronizar Seleccionados
                                </button>
                            </div>
                        </div>

                        <div id="jira-importing" class="jira-step" style="display: none;">
                            <div style="text-align: center; padding: 2rem;">
                                <div class="spinner"></div>
                                <p id="jira-import-status" style="margin-top: 1rem; color: #6b7280; font-size: 1.1rem;">
                                    Importando proyectos desde Jira...
                                </p>
                            </div>
                        </div>

                        <div id="jira-success" class="jira-step" style="display: none;">
                            <h3 style="margin-top: 0; color: #10b981;">✓ Importación Completada</h3>
                            <div id="jira-results" style="padding: 1rem; background-color: #f0fdf4; border-radius: 4px; margin-top: 1rem;">
                                <!-- Results will be shown here -->
                            </div>
                            <div class="modal-footer" style="margin-top: 1.5rem;">
                                <button onclick="window.jiraModal.close(); window.location.reload();" class="btn btn-primary">
                                    Cerrar y Recargar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('jira-modal');
    }

    open(mode = 'projects') {
        this.mode = mode; // 'projects' o 'tasks'
        console.log(`JiraModal.open() called - mode: ${this.mode}`);
        
        if (this.modal) {
            console.log('Modal element found, showing...');
            this.modal.style.display = 'flex';
            this.modal.style.alignItems = 'center';
            this.modal.style.justifyContent = 'center';
            this.modal.style.opacity = '1';
            this.modal.style.visibility = 'visible';
            
            // También asegurar que el container sea visible
            const container = this.modal.querySelector('.modal-container');
            if (container) {
                container.style.visibility = 'visible';
                container.style.opacity = '1';
            }
            
            // Saltar directamente a la importación usando credenciales del archivo de configuración
            console.log('Usando credenciales de jiraConfig.js');
            this.importProjectsDirectly();
        } else {
            console.error('Modal element not found!');
        }
    }

    close() {
        if (this.modal) {
            this.modal.style.display = 'none';
        }
    }

    showStep(step) {
        document.querySelectorAll('.jira-step').forEach(el => el.style.display = 'none');
        
        if (step === 1) {
            document.getElementById('jira-step-1').style.display = 'block';
        } else if (step === 'importing') {
            document.getElementById('jira-importing').style.display = 'block';
        } else if (step === 'success') {
            document.getElementById('jira-success').style.display = 'block';
        }
    }

    /**
     * Importar proyectos directamente usando configuración del backend
     */
    async importProjectsDirectly() {
        const userTeam = sessionStorage.getItem('user_team');
        const awsAccessKey = sessionStorage.getItem('aws_access_key');
        
        if (!userTeam || !awsAccessKey) {
            alert('No se pudo obtener la información del usuario. Por favor inicia sesión de nuevo.');
            this.close();
            return;
        }

        this.showStep('importing');
        document.getElementById('jira-import-status').textContent = 'Descargando issues desde Jira...';

        try {
            // Si el modo es 'tasks', cargar por defecto el proyecto SCOM
            let listUrl = `${API_CONFIG.BASE_URL}/jira/issues`;
            if (this.mode === 'tasks') {
                listUrl += '?projectKey=SCOM';
                console.log(`Listando issues de SCOM para modo tasks`);
            } else {
                console.log(`Listando issues desde Jira para el equipo: ${userTeam}`);
            }

            const response = await fetch(listUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': awsAccessKey,
                    'x-user-team': userTeam
                }
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error?.message || result.error || 'Error consultando Jira');
            }

            console.log('Respuesta de Jira:', result);

            // Manejar nueva estructura: {success: true, data: {issues: [...], total: X}}
            let issues;
            if (result.success && result.data) {
                issues = result.data.issues;
            } else if (Array.isArray(result)) {
                issues = result;
            } else {
                issues = result.issues;
            }

            // Mostrar modal de selección
            this.showIssueSelection(issues);
        } catch (error) {
            console.error('Error:', error);
            alert(`Error al consultar Jira: ${error.message}`);
            this.close();
        }
    }

    async importProjects() {
        const email = document.getElementById('jira-email').value.trim();
        const apiToken = document.getElementById('jira-token').value.trim();
        const jqlQuery = document.getElementById('jira-jql').value.trim() || "project = 'NC' AND status != 'Closed'";

        if (!email) {
            alert('Por favor ingresa tu email de Jira');
            return;
        }

        if (!apiToken) {
            alert('Por favor ingresa tu API Token de Jira');
            return;
        }

        // Guardar credenciales para usar después
        this.tempCredentials = {
            email,
            apiToken,
            jqlQuery
        };

        this.showStep('importing');
        document.getElementById('jira-import-status').textContent = 'Descargando issues desde Jira...';

        try {
            // Paso 1: Listar issues disponibles
            const listUrl = `${API_CONFIG.BASE_URL}/jira/issues?jiraUrl=${encodeURIComponent(this.jiraConfig.url)}&email=${encodeURIComponent(email)}&apiToken=${encodeURIComponent(apiToken)}&jqlQuery=${encodeURIComponent(jqlQuery)}`;
            
            console.log('Listando issues desde Jira...');

            const response = await fetch(listUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error?.message || result.error || 'Error consultando Jira');
            }

            console.log('Respuesta de Jira:', result);

            // Manejar nueva estructura: {success: true, data: {issues: [...], total: X}}
            let issues;
            if (result.success && result.data) {
                issues = result.data.issues;
            } else if (Array.isArray(result)) {
                issues = result;
            } else {
                issues = result.issues;
            }

            // Mostrar modal de selección
            this.showIssueSelection(issues);
        } catch (error) {
            console.error('Error:', error);
            alert(`Error al consultar Jira: ${error.message}`);
            this.showStep(1);
        }
    }

    async showIssueSelection(issues) {
        if (!issues || issues.length === 0) {
            alert('No se encontraron issues con el JQL proporcionado');
            this.showStep(1);
            return;
        }

        // Guardar issues originales para filtrado
        this.allIssues = issues;

        // Cargar proyectos existentes de RDS para comparación
        await this.loadExistingProjects();

        // Marcar cada issue con si existe o no en RDS
        this.markIssuesAvailability();

        // Mostrar paso de selección DESPUÉS de marcar disponibilidad
        document.getElementById('jira-importing').style.display = 'none';
        document.getElementById('jira-selection').style.display = 'block';

        // Añadir controles de búsqueda y filtros antes de la lista
        const selectionDiv = document.getElementById('jira-selection');
        const existingFilters = selectionDiv.querySelector('.jira-filters');
        
        if (!existingFilters) {
            // Cargar proyectos Jira configurados para el equipo
            const userTeam = sessionStorage.getItem('user_team');
            const jiraProjects = await this.loadJiraProjectsConfig(userTeam);
            
            // Generar opciones del selector
            const projectOptions = jiraProjects.map(p => 
                `<option value="${p.key}">${p.key} - ${p.name}</option>`
            ).join('');
            
            const filtersHTML = `
                <div class="jira-filters" style="background-color: #f9fafb; padding: 1rem; border-radius: 6px; margin-bottom: 1rem; border: 1px solid #e5e7eb;">
                    <!-- Fila 1: Proyecto Jira (1/3) + Búsqueda (1/3) + Disponibilidad (1/3) -->
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; margin-bottom: 0.75rem;">
                        <div>
                            <label style="display: flex; align-items: center; font-size: 1rem; font-weight: 600; color: #374151; margin-bottom: 0.5rem;">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 16px; height: 16px; margin-right: 0.5rem;">
                                    <path d="M11.53 2c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.97 4.35 4.35 4.35V2.84a.84.84 0 0 0-.84-.84H11.53zM6.77 6.8c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.97 4.35 4.35 4.35V7.64a.84.84 0 0 0-.84-.84H6.77zM2 11.6c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.97 4.35 4.35 4.35v-9.56a.84.84 0 0 0-.84-.84H2z"/>
                                </svg>
                                Proyecto Jira
                            </label>
                            <select id="jira-filter-project" class="form-input" style="width: 100%; padding: 0.625rem; border: 1px solid #d1d5db; border-radius: 4px; font-size: 1rem;">
                                ${projectOptions}
                            </select>
                        </div>
                        
                        <div>
                            <label style="display: flex; align-items: center; font-size: 1rem; font-weight: 600; color: #374151; margin-bottom: 0.5rem;">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 16px; height: 16px; margin-right: 0.5rem;">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                                </svg>
                                Buscar por Título o ID
                            </label>
                            <input type="text" id="jira-search-input" class="form-input" 
                                   placeholder="Buscar en título o key..." 
                                   style="width: 100%; padding: 0.625rem; border: 1px solid #d1d5db; border-radius: 4px; font-size: 1rem;">
                        </div>
                        
                        <div>
                            <label style="display: flex; align-items: center; font-size: 1rem; font-weight: 600; color: #374151; margin-bottom: 0.5rem;">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 16px; height: 16px; margin-right: 0.5rem;">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Estado de Importación
                            </label>
                            <select id="jira-filter-availability" class="form-input" style="width: 100%; padding: 0.625rem; border: 1px solid #d1d5db; border-radius: 4px; font-size: 1rem;">
                                <option value="Todos">Todos</option>
                                <option value="Importados">Importados</option>
                                <option value="No importados">No importados</option>
                            </select>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem;">
                        <div>
                            <label style="display: flex; align-items: center; font-size: 1rem; font-weight: 600; color: #374151; margin-bottom: 0.5rem;">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 16px; height: 16px; margin-right: 0.5rem;">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                                </svg>
                                Dominio
                            </label>
                            <select id="jira-filter-domain" class="form-input" style="width: 100%; padding: 0.625rem; border: 1px solid #d1d5db; border-radius: 4px; font-size: 1rem;">
                                <option value="">Todos</option>
                            </select>
                        </div>
                        
                        <div>
                            <label style="display: flex; align-items: center; font-size: 1rem; font-weight: 600; color: #374151; margin-bottom: 0.5rem;">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 16px; height: 16px; margin-right: 0.5rem;">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                                </svg>
                                Estado
                            </label>
                            <select id="jira-filter-status" class="form-input" style="width: 100%; padding: 0.625rem; border: 1px solid #d1d5db; border-radius: 4px; font-size: 1rem;">
                                <option value="">Todos</option>
                            </select>
                        </div>
                        
                        <div>
                            <label style="display: flex; align-items: center; font-size: 1rem; font-weight: 600; color: #374151; margin-bottom: 0.5rem;">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 16px; height: 16px; margin-right: 0.5rem;">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                                </svg>
                                Tipo
                            </label>
                            <select id="jira-filter-type" class="form-input" style="width: 100%; padding: 0.625rem; border: 1px solid #d1d5db; border-radius: 4px; font-size: 1rem;">
                                <option value="">Todos</option>
                                <option value="Si">Proyecto</option>
                                <option value="No">Evolutivo</option>
                            </select>
                        </div>
                    </div>
                    
                    <div style="margin-top: 0.75rem; text-align: right;">
                        <button id="jira-clear-filters" class="btn btn-secondary" style="padding: 0.625rem 1.25rem; font-size: 1rem;">
                            Limpiar Filtros
                        </button>
                    </div>
                </div>
            `;
            
            // Insertar antes del contador
            const countDiv = selectionDiv.querySelector('[style*="flex"]');
            countDiv.insertAdjacentHTML('beforebegin', filtersHTML);
            
            // Poblar opciones de filtros
            this.populateFilterOptions(issues);
            
            // Añadir event listeners
            document.getElementById('jira-filter-project').addEventListener('change', () => this.onProjectChange());
            document.getElementById('jira-search-input').addEventListener('input', () => this.applyFilters());
            document.getElementById('jira-filter-availability').addEventListener('change', () => this.applyFilters());
            document.getElementById('jira-filter-domain').addEventListener('change', () => this.applyFilters());
            document.getElementById('jira-filter-status').addEventListener('change', () => this.applyFilters());
            document.getElementById('jira-filter-type').addEventListener('change', () => this.applyFilters());
            document.getElementById('jira-clear-filters').addEventListener('click', () => this.clearFilters());
        }

        // Renderizar issues con los datos ya marcados (this.allIssues tiene existsInDB)
        this.renderIssues(this.allIssues);
    }

    /**
     * Cargar proyectos existentes de RDS para comparación
     */
    async loadExistingProjects() {
        try {
            const awsAccessKey = sessionStorage.getItem('aws_access_key');
            const userTeam = sessionStorage.getItem('user_team');
            
            if (!awsAccessKey || !userTeam) {
                console.warn('No se pudieron obtener credenciales para cargar proyectos existentes');
                this.existingProjects = [];
                return;
            }

            const response = await fetch(`${API_CONFIG.BASE_URL}/projects`, {
                headers: {
                    'Authorization': awsAccessKey,
                    'x-user-team': userTeam
                }
            });

            if (!response.ok) {
                console.warn('Error al cargar proyectos existentes');
                this.existingProjects = [];
                return;
            }

            const data = await response.json();
            this.existingProjects = data.data?.projects || data.projects || [];
            
            console.log(`Cargados ${this.existingProjects.length} proyectos existentes de RDS`);
        } catch (error) {
            console.error('Error cargando proyectos existentes:', error);
            this.existingProjects = [];
        }
    }

    /**
     * Marcar cada issue de Jira con si existe o no en RDS
     */
    markIssuesAvailability() {
        if (!this.existingProjects || !this.allIssues) return;

        // Crear Set de códigos existentes para búsqueda rápida O(1)
        const existingCodes = new Set(
            this.existingProjects.map(p => p.code)
        );

        // Marcar cada issue
        this.allIssues = this.allIssues.map(issue => ({
            ...issue,
            existsInDB: existingCodes.has(issue.key)
        }));

        console.log(`Marcados ${this.allIssues.filter(i => i.existsInDB).length} issues como existentes en RDS`);
    }

    populateFilterOptions(issues) {
        // Obtener valores únicos
        const domains = [...new Set(issues.map(i => i.dominioPrincipal || 'Sin dominio'))].sort();
        const statuses = [...new Set(issues.map(i => i.status))].sort();
        
        // Poblar select de dominios
        const domainSelect = document.getElementById('jira-filter-domain');
        domains.forEach(domain => {
            const option = document.createElement('option');
            option.value = domain;
            option.textContent = domain;
            domainSelect.appendChild(option);
        });
        
        // Poblar select de estados
        const statusSelect = document.getElementById('jira-filter-status');
        statuses.forEach(status => {
            const option = document.createElement('option');
            option.value = status;
            option.textContent = status;
            statusSelect.appendChild(option);
        });
    }

    applyFilters() {
        const searchText = document.getElementById('jira-search-input').value.toLowerCase();
        const filterAvailability = document.getElementById('jira-filter-availability').value;
        const filterDomain = document.getElementById('jira-filter-domain').value;
        const filterStatus = document.getElementById('jira-filter-status').value;
        const filterType = document.getElementById('jira-filter-type').value;
        
        const filtered = this.allIssues.filter(issue => {
            // Filtro de búsqueda
            const matchesSearch = !searchText || 
                issue.key.toLowerCase().includes(searchText) || 
                issue.summary.toLowerCase().includes(searchText);
            
            // Filtro de estado de importación
            let matchesAvailability = true;
            if (filterAvailability === 'Importados') {
                matchesAvailability = issue.existsInDB === true;
            } else if (filterAvailability === 'No importados') {
                matchesAvailability = issue.existsInDB === false;
            }
            // Si es "Todos", matchesAvailability permanece true
            
            // Filtro de dominio
            const matchesDomain = !filterDomain || 
                (issue.dominioPrincipal || 'Sin dominio') === filterDomain;
            
            // Filtro de estado
            const matchesStatus = !filterStatus || issue.status === filterStatus;
            
            // Filtro de tipo
            const matchesType = !filterType || issue.esProyecto === filterType;
            
            return matchesSearch && matchesAvailability && matchesDomain && matchesStatus && matchesType;
        });
        
        this.renderIssues(filtered);
        
        // Actualizar mensaje si no hay resultados
        if (filtered.length === 0) {
            const container = document.getElementById('jira-issues-list');
            container.innerHTML = '<p style="text-align: center; color: #6b7280; padding: 2rem;">No se encontraron issues con los filtros aplicados</p>';
        }
    }

    clearFilters() {
        document.getElementById('jira-filter-project').value = 'NC';
        document.getElementById('jira-search-input').value = '';
        document.getElementById('jira-filter-availability').value = 'Todos';
        document.getElementById('jira-filter-domain').value = '';
        document.getElementById('jira-filter-status').value = '';
        document.getElementById('jira-filter-type').value = '';
        this.applyFilters();
    }

    renderIssues(issues) {
        const issuesContainer = document.getElementById('jira-issues-list');
        issuesContainer.innerHTML = '';

        // Crear lista de issues con checkboxes
        issues.forEach(issue => {
            const issueDiv = document.createElement('div');
            issueDiv.className = 'jira-issue-item';
            issueDiv.style.cssText = 'padding: 6px 12px; border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 4px; cursor: pointer; transition: background 0.2s;';
            issueDiv.setAttribute('data-issue-key', issue.key);
            
            // Determinar etiqueta de tipo de proyecto
            let tipoProyecto = 'No definido';
            if (issue.esProyecto === 'Si') {
                tipoProyecto = 'Proyecto';
            } else if (issue.esProyecto === 'No') {
                tipoProyecto = 'Evolutivo';
            }
            
            // Badge de disponibilidad
            const availabilityBadge = issue.existsInDB 
                ? '<span style="display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.625rem; background: #d1fae5; color: #065f46; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; white-space: nowrap;"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 12px; height: 12px;"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg> Importado</span>'
                : '<span style="display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.625rem; background: #dbeafe; color: #1e40af; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; white-space: nowrap;"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 12px; height: 12px;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg> Nuevo</span>';
            
            issueDiv.innerHTML = `
                <label style="display: flex; align-items: center; cursor: pointer; width: 100%;">
                    <input type="checkbox" value="${issue.key}" style="margin-right: 12px; cursor: pointer;">
                    <div style="flex: 1; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                        <div style="font-weight: 600; color: #1f2937; font-size: 1.1rem; flex: 1;">
                            ${issue.key} - ${issue.summary}
                        </div>
                        <div style="display: flex; align-items: center; gap: 12px; font-size: 0.875rem; color: #6b7280; white-space: nowrap;">
                            <span>📋 ${tipoProyecto}</span>
                            <span>📂 ${issue.dominioPrincipal || 'Sin dominio'}</span>
                            <span>🔄 ${issue.status}</span>
                            ${availabilityBadge}
                        </div>
                    </div>
                </label>
            `;

            // Click en el div selecciona/deselecciona
            issueDiv.addEventListener('click', (e) => {
                if (e.target.tagName !== 'INPUT') {
                    const checkbox = issueDiv.querySelector('input[type="checkbox"]');
                    checkbox.checked = !checkbox.checked;
                    this.updateSelectionCount();
                }
            });

            // Hover effect
            issueDiv.addEventListener('mouseenter', () => {
                issueDiv.style.backgroundColor = '#f9fafb';
            });
            issueDiv.addEventListener('mouseleave', () => {
                issueDiv.style.backgroundColor = 'white';
            });

            issuesContainer.appendChild(issueDiv);
        });

        // Añadir event listener para actualizar contador al cambiar checkboxes
        issuesContainer.addEventListener('change', () => {
            this.updateSelectionCount();
        });

        // Actualizar contador inicial
        this.updateSelectionCount();
    }

    updateSelectionCount() {
        const checkboxes = document.querySelectorAll('#jira-issues-list input[type="checkbox"]');
        const checked = document.querySelectorAll('#jira-issues-list input[type="checkbox"]:checked');
        const counter = document.getElementById('jira-selection-count');
        const importBtn = document.getElementById('jira-import-selected-btn');
        
        counter.textContent = `${checked.length} de ${checkboxes.length} seleccionados`;
        importBtn.disabled = checked.length === 0;
        importBtn.style.opacity = checked.length === 0 ? '0.5' : '1';
        importBtn.style.cursor = checked.length === 0 ? 'not-allowed' : 'pointer';
    }

    selectAllIssues() {
        const checkboxes = document.querySelectorAll('#jira-issues-list input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = true);
        this.updateSelectionCount();
    }

    deselectAllIssues() {
        const checkboxes = document.querySelectorAll('#jira-issues-list input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = false);
        this.updateSelectionCount();
    }

    async importSelectedIssues() {
        const selectedCheckboxes = document.querySelectorAll('#jira-issues-list input[type="checkbox"]:checked');
        const issueKeys = Array.from(selectedCheckboxes).map(cb => cb.value);

        if (issueKeys.length === 0) {
            alert('Por favor selecciona al menos un issue para importar');
            return;
        }

        if (issueKeys.length > this.maxImportBatch) {
            alert(`No se pueden importar más de ${this.maxImportBatch} proyectos a la vez.\n\nActualmente has seleccionado ${issueKeys.length} proyectos.\nPor favor, reduce la selección a un máximo de ${this.maxImportBatch} proyectos.`);
            return;
        }

        const userTeam = sessionStorage.getItem('user_team');
        if (!userTeam) {
            alert('No se pudo obtener el equipo del usuario. Por favor inicia sesión de nuevo.');
            return;
        }

        this.showStep('importing');
        document.getElementById('jira-import-status').textContent = `Importando ${issueKeys.length} issue(s) seleccionado(s)...`;

        try {
            const awsAccessKey = sessionStorage.getItem('aws_access_key');
            
            // Determinar endpoint y formato según el modo
            if (this.mode === 'tasks') {
                // Modo tasks: importar una por una con datos completos
                console.log('Modo tasks: guardando en jira_tasks table');
                
                let successCount = 0;
                let errorCount = 0;
                
                for (const key of issueKeys) {
                    const issue = this.allIssues.find(i => i.key === key);
                    if (!issue) continue;
                    
                    // Mapear status de texto a integer - ESTADOS DE TAREAS (14 estados)
                    const taskStatusMap = {
                        'To Do': 1,
                        'Por Hacer': 1,
                        'TAREAS POR HACER': 1,
                        'Conceptualización': 2,
                        'CONCEPTUALIZACIÓN': 2,
                        'Cierre Requisitos': 3,
                        'CIERRE REQUISITOS': 3,
                        'En Valoración': 4,
                        'EN VALORACIÓN': 4,
                        'Vale Pendiente Aprobación': 5,
                        'Vale Pdte. Aprob': 5,
                        'VALE PDTE. APROB': 5,
                        'En SD': 6,
                        'EN SD': 6,
                        'SD Pendiente Aprobación': 7,
                        'SD Pdte Aprob': 7,
                        'SD PDTE APROB': 7,
                        'In Progress': 8,
                        'En Desarrollo': 8,
                        'EN DESARROLLO': 8,
                        'Desarrollo': 8,
                        'En Validación SSII': 9,
                        'EN VALIDACIÓN SSII': 9,
                        'UAT': 10,
                        'Ready to Promote': 11,
                        'READY TO PROMOTE': 11,
                        'Done': 12,
                        'Finalizado': 12,
                        'FINALIZADO': 12,
                        'Cancelled': 13,
                        'Cancelado': 13,
                        'CANCELADO': 13,
                        'Waiting': 14,
                        'En Espera': 14,
                        'WAITING': 14
                    };
                    
                    // Mapear domain de texto a integer
                    const domainMap = {
                        'Ventas | Contratación y SW': 1,
                        'Ciclo de Vida y Producto': 2,
                        'Facturación y Cobro': 3,
                        'Atención': 4,
                        'Operación de Sistemas y Ciberseguridad': 5,
                        'Datos': 6,
                        'Portabilidad': 7,
                        'Integración': 8,
                        'Sin dominio': 0,
                        'Ninguno': 0
                    };
                    
                    const statusInt = taskStatusMap[issue.status] || 8; // Default: EN DESARROLLO (ID 8 para tareas)
                    const domainInt = domainMap[issue.dominioPrincipal] || 0; // Default: Ninguno
                    
                    // Mapear tipo usando configuración dinámica
                    // Por defecto, usar el primer tipo configurado
                    let taskType = this.taskTypes[0] || 'Soporte_PAP';
                    
                    // Si hay lógica de mapeo basada en campos de Jira, aplicarla aquí
                    // Por ejemplo, si esProyecto === 'Si', usar el segundo tipo
                    if (issue.esProyecto === 'Si' && this.taskTypes.length > 1) {
                        taskType = this.taskTypes[1];
                    }
                    
                    const taskData = {
                        code: issue.key,
                        title: issue.summary,
                        description: issue.description || '',
                        type: taskType,
                        priority: issue.priority?.name || 'Medium',
                        status: statusInt,
                        domain: domainInt,
                        jiraIssueKey: issue.key,
                        jiraUrl: `https://naturgy-adn.atlassian.net/browse/${issue.key}`,
                        fixVersions: issue.fixVersions || []
                    };
                    
                    try {
                        const response = await fetch(`${API_CONFIG.BASE_URL}/jira-tasks`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': awsAccessKey,
                                'x-user-team': userTeam
                            },
                            body: JSON.stringify(taskData)
                        });
                        
                        if (response.ok) {
                            successCount++;
                        } else {
                            errorCount++;
                            const errorText = await response.text();
                            console.error(`Error importing ${taskData.jiraKey}:`, errorText);
                        }
                    } catch (error) {
                        errorCount++;
                        console.error(`Error importing ${taskData.jiraKey}:`, error);
                    }
                }
                
                console.log(`Importación completada: ${successCount} exitosas, ${errorCount} errores`);
                
                if (errorCount > 0 && successCount === 0) {
                    throw new Error(`No se pudo importar ninguna tarea. ${errorCount} errores.`);
                } else if (errorCount > 0) {
                    alert(`Importación completada con errores:\n${successCount} tareas importadas\n${errorCount} errores`);
                }
                
                // Cerrar modal y recargar
                this.close();
                sessionStorage.setItem('activate_tasks_tab', 'true');
                window.location.reload();
                return;
            }
            
            // Modo projects: comportamiento original
            const endpoint = `${API_CONFIG.BASE_URL}/jira/import`;
            const tabToActivate = 'projects-tab';
            console.log('Modo projects: guardando en projects table');

            const requestBody = {
                team: userTeam,
                issueKeys: issueKeys
            };

            console.log('Importando issues seleccionados:', requestBody);

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': awsAccessKey,
                    'x-user-team': userTeam
                },
                body: JSON.stringify(requestBody)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Error importando desde Jira');
            }

            // Cerrar modal y recargar página, activando la pestaña correspondiente
            this.close();
            
            // Guardar en sessionStorage qué pestaña activar
            sessionStorage.setItem('activate_projects_tab', tabToActivate === 'projects-tab' ? 'true' : 'false');
            sessionStorage.setItem('activate_tasks_tab', tabToActivate === 'tasks-tab' ? 'true' : 'false');
            
            window.location.reload();
        } catch (error) {
            console.error('Error:', error);
            alert(`Error al importar: ${error.message}`);
            this.showStep(1);
        }
    }

    showImportResults(result) {
        // Ya no se usa - se cierra directamente y se recarga
        this.close();
        window.location.reload();
    }

    /**
     * Manejar cambio de proyecto Jira
     */
    async onProjectChange() {
        const selectedProject = document.getElementById('jira-filter-project').value;
        console.log(`Proyecto cambiado a: ${selectedProject}`);
        
        // Mostrar loading
        const issuesContainer = document.getElementById('jira-issues-list');
        issuesContainer.innerHTML = '<div style="text-align: center; padding: 2rem;"><div class="spinner"></div><p style="margin-top: 1rem; color: #6b7280;">Cargando issues del proyecto ' + selectedProject + '...</p></div>';
        
        try {
            const userTeam = sessionStorage.getItem('user_team');
            const awsAccessKey = sessionStorage.getItem('aws_access_key');
            
            // Llamar al backend con el proyecto específico
            const listUrl = `${API_CONFIG.BASE_URL}/jira/issues?projectKey=${selectedProject}`;
            
            console.log(`Cargando issues del proyecto ${selectedProject}`);
            
            const response = await fetch(listUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': awsAccessKey,
                    'x-user-team': userTeam
                }
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error?.message || result.error || 'Error consultando Jira');
            }
            
            // Manejar nueva estructura
            let issues;
            if (result.success && result.data) {
                issues = result.data.issues;
            } else if (Array.isArray(result)) {
                issues = result;
            } else {
                issues = result.issues;
            }
            
            console.log(`✅ Cargados ${issues.length} issues del proyecto ${selectedProject}`);
            
            // Actualizar allIssues
            this.allIssues = issues;
            
            // Marcar disponibilidad
            this.markIssuesAvailability();
            
            // Repoblar filtros con los nuevos datos
            this.repopulateFilterOptions(issues);
            
            // Aplicar filtros actuales
            this.applyFilters();
            
        } catch (error) {
            console.error('Error cargando issues del proyecto:', error);
            issuesContainer.innerHTML = '<p style="text-align: center; color: #ef4444; padding: 2rem;">Error al cargar issues: ' + error.message + '</p>';
        }
    }
    
    /**
     * Repoblar opciones de filtros con nuevos datos
     */
    repopulateFilterOptions(issues) {
        // Limpiar y repoblar dominios
        const domainSelect = document.getElementById('jira-filter-domain');
        const currentDomain = domainSelect.value;
        domainSelect.innerHTML = '<option value="">Todos</option>';
        
        const domains = [...new Set(issues.map(i => i.dominioPrincipal || 'Sin dominio'))].sort();
        domains.forEach(domain => {
            const option = document.createElement('option');
            option.value = domain;
            option.textContent = domain;
            domainSelect.appendChild(option);
        });
        domainSelect.value = currentDomain;
        
        // Limpiar y repoblar estados
        const statusSelect = document.getElementById('jira-filter-status');
        const currentStatus = statusSelect.value;
        statusSelect.innerHTML = '<option value="">Todos</option>';
        
        const statuses = [...new Set(issues.map(i => i.status))].sort();
        statuses.forEach(status => {
            const option = document.createElement('option');
            option.value = status;
            option.textContent = status;
            statusSelect.appendChild(option);
        });
        statusSelect.value = currentStatus;
    }

    /**
     * Cargar configuración de proyectos Jira para el equipo
     */
    async loadJiraProjectsConfig(team) {
        try {
            const awsAccessKey = sessionStorage.getItem('aws_access_key');
            
            if (!awsAccessKey || !team) {
                console.warn('No credentials or team for loading Jira projects config');
                console.warn('awsAccessKey:', awsAccessKey ? 'present' : 'missing');
                console.warn('team:', team);
                return [{ key: 'NC', name: 'Naturgy Clientes' }];
            }
            
            console.log(`Loading Jira projects config for team: ${team}`);
            const url = `${API_CONFIG.BASE_URL}/config?key=jira_projects&team=${team}`;
            console.log('Request URL:', url);
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': awsAccessKey,
                    'x-user-team': team
                }
            });
            
            console.log('Response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.warn(`No config found for team ${team}. Status: ${response.status}, Error: ${errorText}`);
                console.warn('Using default NC project');
                return [{ key: 'NC', name: 'Naturgy Clientes' }];
            }
            
            const result = await response.json();
            console.log('Config response:', result);
            
            if (!result.success || !result.data || !result.data.value) {
                console.warn('Invalid config response structure:', result);
                console.warn('Using default NC project');
                return [{ key: 'NC', name: 'Naturgy Clientes' }];
            }
            
            console.log(`✅ Loaded ${result.data.value.length} Jira projects for team ${team}:`, result.data.value);
            return result.data.value;
            
        } catch (error) {
            console.error('❌ Error loading Jira projects config:', error);
            console.error('Error details:', error.message, error.stack);
            console.warn('Using default NC project');
            return [{ key: 'NC', name: 'Naturgy Clientes' }];
        }
    }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.JiraModal = JiraModal;
}
