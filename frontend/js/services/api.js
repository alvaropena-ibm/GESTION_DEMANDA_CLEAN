/**
 * API Service
 * Centralized API calls for the application
 * Soporta autenticación con Cognito (JWT) e IAM (Access Keys)
 */

import { API_CONFIG } from '../config/data.js';
import authService from './authService.js';

class ApiService {
    constructor() {
        this.baseUrl = API_CONFIG.BASE_URL;
    }

    /**
     * Make authenticated API call with automatic token refresh
     * @param {string} endpoint - API endpoint
     * @param {Object} options - Fetch options
     * @returns {Promise<any>}
     */
    async fetch(endpoint, options = {}) {
        // Verificar autenticación
        if (!authService.isAuthenticated()) {
            console.warn('User not authenticated, redirecting to login');
            window.location.href = 'login.html';
            throw new Error('Not authenticated');
        }

        // Si es Cognito, verificar si el token está próximo a expirar y refrescarlo
        const authType = authService.getAuthType();
        if (authType === 'cognito' && authService.isTokenExpiringSoon()) {
            try {
                console.log('Token expiring soon, refreshing...');
                await authService.refreshToken();
            } catch (error) {
                console.error('Failed to refresh token:', error);
                // Si falla el refresh, el authService ya hizo logout
                throw error;
            }
        }

        // Obtener headers de autenticación (Cognito o IAM)
        const authHeaders = authService.getAuthHeaders();

        // Merge headers
        const headers = {
            ...authHeaders,
            ...(options.headers || {})
        };

        const url = `${this.baseUrl}${endpoint}`;
        
        try {
            const response = await fetch(url, {
                ...options,
                headers
            });
            
            // Manejar 401 Unauthorized
            if (response.status === 401) {
                console.warn('Unauthorized (401), logging out');
                authService.logout();
                throw new Error('Unauthorized');
            }

            // Manejar 403 Forbidden
            if (response.status === 403) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'No tienes permisos para realizar esta acción');
            }
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error(`API Error [${endpoint}]:`, error);
            throw error;
        }
    }

    // ==================== PROJECTS ====================

    /**
     * Get all projects
     * @returns {Promise<Array>}
     */
    async getProjects() {
        const data = await this.fetch('/projects');
        return data.data?.projects || data.projects || [];
    }

    /**
     * Get project by ID
     * @param {string|number} projectId
     * @returns {Promise<Object>}
     */
    async getProject(projectId) {
        const data = await this.fetch(`/projects/${projectId}`);
        return data.data?.project || data.project;
    }

    /**
     * Create project
     * @param {Object} projectData
     * @returns {Promise<Object>}
     */
    async createProject(projectData) {
        return await this.fetch('/projects', {
            method: 'POST',
            body: JSON.stringify(projectData)
        });
    }

    /**
     * Update project
     * @param {string|number} projectId
     * @param {Object} projectData
     * @returns {Promise<Object>}
     */
    async updateProject(projectId, projectData) {
        return await this.fetch(`/projects/${projectId}`, {
            method: 'PUT',
            body: JSON.stringify(projectData)
        });
    }

    /**
     * Delete project
     * @param {string|number} projectId
     * @returns {Promise<Object>}
     */
    async deleteProject(projectId) {
        return await this.fetch(`/projects/${projectId}`, {
            method: 'DELETE'
        });
    }

    // ==================== RESOURCES ====================

    /**
     * Get all resources
     * @returns {Promise<Array>}
     */
    async getResources() {
        const data = await this.fetch('/resources');
        return data.data?.resources || data.resources || [];
    }

    /**
     * Get resource by ID
     * @param {string|number} resourceId
     * @returns {Promise<Object>}
     */
    async getResource(resourceId) {
        const data = await this.fetch(`/resources/${resourceId}`);
        return data.data?.resource || data.resource;
    }

    /**
     * Create resource
     * @param {Object} resourceData
     * @returns {Promise<Object>}
     */
    async createResource(resourceData) {
        return await this.fetch('/resources', {
            method: 'POST',
            body: JSON.stringify(resourceData)
        });
    }

    /**
     * Update resource
     * @param {string|number} resourceId
     * @param {Object} resourceData
     * @returns {Promise<Object>}
     */
    async updateResource(resourceId, resourceData) {
        return await this.fetch(`/resources/${resourceId}`, {
            method: 'PUT',
            body: JSON.stringify(resourceData)
        });
    }

    /**
     * Delete resource
     * @param {string|number} resourceId
     * @returns {Promise<Object>}
     */
    async deleteResource(resourceId) {
        return await this.fetch(`/resources/${resourceId}`, {
            method: 'DELETE'
        });
    }

    // ==================== ASSIGNMENTS ====================

    /**
     * Get all assignments
     * @param {Object} filters - Optional filters (projectId, resourceId, etc.)
     * @returns {Promise<Array>}
     */
    async getAssignments(filters = {}) {
        const queryParams = new URLSearchParams(filters).toString();
        const endpoint = queryParams ? `/assignments?${queryParams}` : '/assignments';
        const data = await this.fetch(endpoint);
        return data.data?.assignments || data.assignments || [];
    }

    /**
     * Create assignment
     * @param {Object} assignmentData
     * @returns {Promise<Object>}
     */
    async createAssignment(assignmentData) {
        return await this.fetch('/assignments', {
            method: 'POST',
            body: JSON.stringify(assignmentData)
        });
    }

    /**
     * Update assignment
     * @param {string|number} assignmentId
     * @param {Object} assignmentData
     * @returns {Promise<Object>}
     */
    async updateAssignment(assignmentId, assignmentData) {
        return await this.fetch(`/assignments/${assignmentId}`, {
            method: 'PUT',
            body: JSON.stringify(assignmentData)
        });
    }

    /**
     * Delete assignment
     * @param {string|number} assignmentId
     * @returns {Promise<Object>}
     */
    async deleteAssignment(assignmentId) {
        return await this.fetch(`/assignments/${assignmentId}`, {
            method: 'DELETE'
        });
    }

    /**
     * Delete all assignments for a project
     * @param {string|number} projectId
     * @returns {Promise<Object>}
     */
    async deleteProjectAssignments(projectId) {
        return await this.fetch(`/assignments?projectId=${projectId}`, {
            method: 'DELETE'
        });
    }

    // ==================== CONCEPT TASKS ====================

    /**
     * Get concept tasks
     * @param {Object} filters - Optional filters (projectId, etc.)
     * @returns {Promise<Array>}
     */
    async getConceptTasks(filters = {}) {
        // Add cache-busting parameter
        const params = { ...filters, _: Date.now() };
        const queryParams = new URLSearchParams(params).toString();
        const endpoint = `/concept-tasks?${queryParams}`;
        const data = await this.fetch(endpoint);
        return data.data?.tasks || data.tasks || [];
    }

    /**
     * Create concept task
     * @param {Object} taskData
     * @returns {Promise<Object>}
     */
    async createConceptTask(taskData) {
        return await this.fetch('/concept-tasks', {
            method: 'POST',
            body: JSON.stringify(taskData)
        });
    }

    /**
     * Update concept task
     * @param {string|number} taskId
     * @param {Object} taskData
     * @returns {Promise<Object>}
     */
    async updateConceptTask(taskId, taskData) {
        return await this.fetch(`/concept-tasks/${taskId}`, {
            method: 'PUT',
            body: JSON.stringify(taskData)
        });
    }

    /**
     * Delete concept task
     * @param {string|number} taskId
     * @returns {Promise<Object>}
     */
    async deleteConceptTask(taskId) {
        return await this.fetch(`/concept-tasks/${taskId}`, {
            method: 'DELETE'
        });
    }

    // ==================== DOMAINS ====================

    /**
     * Get all domains
     * @returns {Promise<Array>}
     */
    async getDomains() {
        const data = await this.fetch('/domains');
        return data.data?.domains || data.domains || [];
    }

    // ==================== STATUSES ====================

    /**
     * Get all statuses
     * @returns {Promise<Array>}
     */
    async getStatuses() {
        const data = await this.fetch('/statuses');
        return data.data?.statuses || data.statuses || [];
    }

    // ==================== SKILLS ====================

    /**
     * Get all skills
     * @returns {Promise<Array>}
     */
    async getSkills() {
        const data = await this.fetch('/skills');
        return data.data?.skills || data.skills || [];
    }

    // ==================== JIRA TASKS ====================

    /**
     * Get all jira tasks
     * @returns {Promise<Array>}
     */
    async getJiraTasks() {
        const data = await this.fetch('/jira-tasks');
        return data.data?.tasks || data.tasks || [];
    }

    /**
     * Get jira task by ID
     * @param {string|number} taskId
     * @returns {Promise<Object>}
     */
    async getJiraTask(taskId) {
        const data = await this.fetch(`/jira-tasks/${taskId}`);
        return data.data || data;
    }

    /**
     * Create jira task
     * @param {Object} taskData
     * @returns {Promise<Object>}
     */
    async createJiraTask(taskData) {
        return await this.fetch('/jira-tasks', {
            method: 'POST',
            body: JSON.stringify(taskData)
        });
    }

    /**
     * Update jira task
     * @param {string|number} taskId
     * @param {Object} taskData
     * @returns {Promise<Object>}
     */
    async updateJiraTask(taskId, taskData) {
        return await this.fetch(`/jira-tasks/${taskId}`, {
            method: 'PUT',
            body: JSON.stringify(taskData)
        });
    }

    /**
     * Delete jira task
     * @param {string|number} taskId
     * @returns {Promise<Object>}
     */
    async deleteJiraTask(taskId) {
        return await this.fetch(`/jira-tasks/${taskId}`, {
            method: 'DELETE'
        });
    }

    // ==================== APP CONFIG ====================

    /**
     * Get configuration value by key
     * @param {string} key - Configuration key
     * @param {string} team - Team name (optional, for team-specific configs)
     * @returns {Promise<any>}
     */
    async getConfig(key, team = null) {
        const params = new URLSearchParams({ key });
        if (team) {
            params.append('team', team);
        }
        const data = await this.fetch(`/config?${params.toString()}`);
        return data.data || data;
    }

    /**
     * Get task types for a specific team
     * @param {string} team - Team name (SAP, SAPLCORP, Mulesoft, Darwin)
     * @returns {Promise<Array<string>>}
     */
    async getTaskTypes(team) {
        try {
            const config = await this.getConfig('tasks_type', team);
            if (config && config.value) {
                // Parse JSON array from config value
                const types = typeof config.value === 'string' 
                    ? JSON.parse(config.value) 
                    : config.value;
                return Array.isArray(types) ? types : [];
            }
            // Fallback to default types if config not found
            return ['Soporte_PAP', 'Tareas_Varias'];
        } catch (error) {
            console.error('Error loading task types:', error);
            // Return default types on error
            return ['Soporte_PAP', 'Tareas_Varias'];
        }
    }

    // ==================== TIME ENTRIES (CLAIMS) ====================

    /**
     * Get all time entries with optional filters
     * @param {Object} filters - Optional filters (projectId, resourceId, startDate, endDate, activity)
     * @returns {Promise<Array>}
     */
    async getTimeEntries(filters = {}) {
        const queryParams = new URLSearchParams(filters).toString();
        const endpoint = queryParams ? `/time-entries?${queryParams}` : '/time-entries';
        const data = await this.fetch(endpoint);
        return data.data?.timeEntries || data.timeEntries || [];
    }

    /**
     * Get time entry by ID
     * @param {string|number} timeEntryId
     * @returns {Promise<Object>}
     */
    async getTimeEntry(timeEntryId) {
        const data = await this.fetch(`/time-entries/${timeEntryId}`);
        return data.data?.timeEntry || data.timeEntry;
    }

    /**
     * Create time entry (claim)
     * @param {Object} timeEntryData - { projectId, resourceName, workDate, taskTitle, taskDescription, activity, hours, module }
     * @returns {Promise<Object>}
     */
    async createTimeEntry(timeEntryData) {
        return await this.fetch('/time-entries', {
            method: 'POST',
            body: JSON.stringify(timeEntryData)
        });
    }

    /**
     * Update time entry
     * @param {string|number} timeEntryId
     * @param {Object} timeEntryData
     * @returns {Promise<Object>}
     */
    async updateTimeEntry(timeEntryId, timeEntryData) {
        return await this.fetch(`/time-entries/${timeEntryId}`, {
            method: 'PUT',
            body: JSON.stringify(timeEntryData)
        });
    }

    /**
     * Delete time entry
     * @param {string|number} timeEntryId
     * @returns {Promise<Object>}
     */
    async deleteTimeEntry(timeEntryId) {
        return await this.fetch(`/time-entries/${timeEntryId}`, {
            method: 'DELETE'
        });
    }
}

// Create singleton instance
const apiService = new ApiService();

// Export singleton
export default apiService;
