/**
 * Jira Configuration
 * Configuración para integración con Jira
 * 
 * NC: Naturgy Clientes (Gestión de Proyectos)
 * SCOM: SAP LCORP (Gestión de Tareas)
 */

// Configuración para NC - Naturgy Clientes
export const JIRA_CONFIG_NC = {
    source: 'NC',
    name: 'NC - Naturgy Clientes',
    url: 'https://tu-instancia.atlassian.net',
    email: 'tu.email@ejemplo.com',
    apiToken: 'TU_API_TOKEN_AQUI',
    projectKey: 'NC',
    jqlQuery: "project = NC AND status != Closed"
};

// Configuración para SCOM - SAP LCORP
export const JIRA_CONFIG_SCOM = {
    source: 'SCOM',
    name: 'SCOM - SAP LCORP',
    url: 'https://tu-instancia.atlassian.net',
    email: 'tu.email@ejemplo.com',
    apiToken: 'TU_API_TOKEN_AQUI',
    projectKey: 'SCOM',
    jqlQuery: "project = SCOM AND status != Closed"
};

// Configuración por defecto (mantener compatibilidad)
export const JIRA_CONFIG = JIRA_CONFIG_NC;

// Helper para obtener configuración según source
export function getJiraConfig(source) {
    if (source === 'SCOM') {
        return JIRA_CONFIG_SCOM;
    }
    return JIRA_CONFIG_NC;
}
