/**
 * Tasks Manager
 * Manages SCOM Jira tasks (jira_tasks table)
 */

import { API_CONFIG } from '../config/data.js';
import { showNotification } from '../utils/notifications.js';

class TasksManager {
    constructor() {
        this.tasks = [];
        this.currentPage = 1;
        this.pageSize = 10;
        this.searchTerm = '';
    }

    /**
     * Load all tasks
     */
    async loadTasks() {
        try {
            const awsAccessKey = sessionStorage.getItem('aws_access_key');
            const userTeam = sessionStorage.getItem('user_team');

            if (!awsAccessKey || !userTeam) {
                throw new Error('No authentication tokens found');
            }

            const response = await fetch(`${API_CONFIG.BASE_URL}/jira-tasks`, {
                headers: {
                    'Authorization': awsAccessKey,
                    'x-user-team': userTeam
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.tasks = data.data?.tasks || [];
                console.log(`✅ Loaded ${this.tasks.length} tasks`);
                return this.tasks;
            } else {
                throw new Error(`Error loading tasks: ${response.status}`);
            }
        } catch (error) {
            console.error('Error loading tasks:', error);
            showNotification('Error al cargar tareas', 'error');
            return [];
        }
    }

    /**
     * Get task by ID
     */
    async getTaskById(id) {
        try {
            const awsAccessKey = sessionStorage.getItem('aws_access_key');
            const userTeam = sessionStorage.getItem('user_team');

            const response = await fetch(`${API_CONFIG.BASE_URL}/jira-tasks/${id}`, {
                headers: {
                    'Authorization': awsAccessKey,
                    'x-user-team': userTeam
                }
            });

            if (response.ok) {
                const data = await response.json();
                return data.data;
            } else {
                throw new Error(`Error loading task: ${response.status}`);
            }
        } catch (error) {
            console.error('Error loading task:', error);
            showNotification('Error al cargar tarea', 'error');
            return null;
        }
    }

    /**
     * Create new task
     */
    async createTask(taskData) {
        try {
            const awsAccessKey = sessionStorage.getItem('aws_access_key');
            const userTeam = sessionStorage.getItem('user_team');

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
                const data = await response.json();
                showNotification('Tarea creada exitosamente', 'success');
                return data.data;
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Error creating task');
            }
        } catch (error) {
            console.error('Error creating task:', error);
            showNotification(error.message || 'Error al crear tarea', 'error');
            return null;
        }
    }

    /**
     * Update task
     */
    async updateTask(id, taskData) {
        try {
            const awsAccessKey = sessionStorage.getItem('aws_access_key');
            const userTeam = sessionStorage.getItem('user_team');

            const response = await fetch(`${API_CONFIG.BASE_URL}/jira-tasks/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': awsAccessKey,
                    'x-user-team': userTeam
                },
                body: JSON.stringify(taskData)
            });

            if (response.ok) {
                const data = await response.json();
                showNotification('Tarea actualizada exitosamente', 'success');
                return data.data;
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Error updating task');
            }
        } catch (error) {
            console.error('Error updating task:', error);
            showNotification(error.message || 'Error al actualizar tarea', 'error');
            return null;
        }
    }

    /**
     * Delete task
     */
    async deleteTask(id) {
        try {
            const awsAccessKey = sessionStorage.getItem('aws_access_key');
            const userTeam = sessionStorage.getItem('user_team');

            const response = await fetch(`${API_CONFIG.BASE_URL}/jira-tasks/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': awsAccessKey,
                    'x-user-team': userTeam
                }
            });

            if (response.ok) {
                showNotification('Tarea eliminada exitosamente', 'success');
                return true;
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Error deleting task');
            }
        } catch (error) {
            console.error('Error deleting task:', error);
            showNotification(error.message || 'Error al eliminar tarea', 'error');
            return false;
        }
    }

    /**
     * Get filtered tasks
     */
    getFilteredTasks() {
        if (!this.searchTerm) {
            return this.tasks;
        }

        const searchLower = this.searchTerm.toLowerCase();
        return this.tasks.filter(task => {
            return (
                task.code?.toLowerCase().includes(searchLower) ||
                task.title?.toLowerCase().includes(searchLower) ||
                task.description?.toLowerCase().includes(searchLower)
            );
        });
    }

    /**
     * Get paginated tasks
     */
    getPaginatedTasks() {
        const filtered = this.getFilteredTasks();
        const start = (this.currentPage - 1) * this.pageSize;
        const end = start + this.pageSize;
        return filtered.slice(start, end);
    }

    /**
     * Get total pages
     */
    getTotalPages() {
        const filtered = this.getFilteredTasks();
        return Math.ceil(filtered.length / this.pageSize);
    }

    /**
     * Set search term
     */
    setSearchTerm(term) {
        this.searchTerm = term;
        this.currentPage = 1; // Reset to first page
    }

    /**
     * Set page
     */
    setPage(page) {
        const totalPages = this.getTotalPages();
        if (page >= 1 && page <= totalPages) {
            this.currentPage = page;
        }
    }

    /**
     * Next page
     */
    nextPage() {
        this.setPage(this.currentPage + 1);
    }

    /**
     * Previous page
     */
    previousPage() {
        this.setPage(this.currentPage - 1);
    }
}

// Create singleton instance
const tasksManager = new TasksManager();

export default tasksManager;