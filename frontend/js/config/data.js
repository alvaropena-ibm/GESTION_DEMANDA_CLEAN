// Data Configuration and Storage

// API Configuration
export const API_CONFIG = {
    BASE_URL: 'https://xrqo2gedpl.execute-api.eu-west-1.amazonaws.com/prod',
    // Auth API URL - Cognito Authentication (login-authorization-service)
    AUTH_API_URL: 'https://xrqo2gedpl.execute-api.eu-west-1.amazonaws.com/prod/auth',
    // IAM Auth URL (compatibilidad con sistema anterior)
    IAM_AUTH_URL: 'https://lupjqx01jf.execute-api.eu-west-1.amazonaws.com/prod/auth/login',
    ENDPOINTS: {
        PROJECTS: '/projects',
        RESOURCES: '/resources',
        ASSIGNMENTS: '/assignments',
        CAPACITY: '/capacity',
        CONCEPT_TASKS: '/concept-tasks'
    }
};

// Global data storage
export let resources = [
    { id: 'juan', name: 'Juan Pérez', type: 'developer', capacity: 160, cost: 4500, status: 'available' },
    { id: 'maria', name: 'María García', type: 'designer', capacity: 160, cost: 3800, status: 'assigned' },
    { id: 'carlos', name: 'Carlos López', type: 'pm', capacity: 160, cost: 5200, status: 'available' },
    { id: 'ana', name: 'Ana Martín', type: 'qa', capacity: 160, cost: 3200, status: 'assigned' }
];

export let projects = [
    { id: 'app-mobile', name: 'App Mobile', start: '2025-01', end: '2025-05', priority: 'alta', status: 'planned' },
    { id: 'web-corp', name: 'Web Corporativa', start: '2025-02', end: '2025-06', priority: 'media', status: 'planned' },
    { id: 'api-int', name: 'API Integración', start: '2025-04', end: '2025-07', priority: 'baja', status: 'planned' }
];

export let capacityMatrix = {
    'app-mobile': { 'ene': 2, 'feb': 3, 'mar': 4, 'abr': 2, 'may': 1 },
    'web-corp': { 'feb': 1, 'mar': 2, 'abr': 2, 'may': 2, 'jun': 1 },
    'api-int': { 'abr': 1, 'may': 1, 'jun': 1, 'jul': 1 }
};

// Project skill breakdown data structure
export const projectSkillBreakdown = {
    'NC-249': {
        skills: {
            'Construcción': { ene: 0, feb: 0, mar: 0, abr: 0, may: 0, jun: 200, jul: 100, ago: 0, sep: 0, oct: 0, nov: 0, dic: 0 },
            'Análisis': { ene: 0, feb: 0, mar: 0, abr: 0, may: 0, jun: 80, jul: 40, ago: 0, sep: 0, oct: 0, nov: 0, dic: 0 },
            'QA': { ene: 0, feb: 0, mar: 0, abr: 0, may: 0, jun: 40, jul: 20, ago: 0, sep: 0, oct: 0, nov: 0, dic: 0 }
        }
    },
    'NC-15': {
        skills: {
            'Construcción': { ene: 0, feb: 0, mar: 0, abr: 0, may: 0, jun: 80, jul: 160, ago: 80, sep: 0, oct: 0, nov: 0, dic: 0 },
            'Análisis': { ene: 0, feb: 0, mar: 0, abr: 0, may: 0, jun: 50, jul: 100, ago: 50, sep: 0, oct: 0, nov: 0, dic: 0 },
            'Diseño': { ene: 0, feb: 0, mar: 0, abr: 0, may: 0, jun: 30, jul: 60, ago: 30, sep: 0, oct: 0, nov: 0, dic: 0 }
        }
    },
    'NC-16': {
        skills: {
            'Construcción': { ene: 0, feb: 0, mar: 0, abr: 0, may: 0, jun: 160, jul: 240, ago: 240, sep: 160, oct: 0, nov: 0, dic: 0 },
            'Análisis': { ene: 0, feb: 0, mar: 0, abr: 0, may: 0, jun: 100, jul: 150, ago: 150, sep: 100, oct: 0, nov: 0, dic: 0 },
            'Diseño': { ene: 0, feb: 0, mar: 0, abr: 0, may: 0, jun: 40, jul: 60, ago: 60, sep: 40, oct: 0, nov: 0, dic: 0 },
            'QA': { ene: 0, feb: 0, mar: 0, abr: 0, may: 0, jun: 20, jul: 30, ago: 30, sep: 20, oct: 0, nov: 0, dic: 0 }
        }
    },
    'NC-17': {
        skills: {
            'Construcción': { ene: 0, feb: 0, mar: 0, abr: 0, may: 0, jun: 80, jul: 160, ago: 0, sep: 0, oct: 0, nov: 0, dic: 0 },
            'Análisis': { ene: 0, feb: 0, mar: 0, abr: 0, may: 0, jun: 50, jul: 100, ago: 0, sep: 0, oct: 0, nov: 0, dic: 0 },
            'Diseño': { ene: 0, feb: 0, mar: 0, abr: 0, may: 0, jun: 30, jul: 60, ago: 0, sep: 0, oct: 0, nov: 0, dic: 0 }
        }
    },
    'NC-18': {
        skills: {
            'Construcción': { ene: 0, feb: 0, mar: 0, abr: 0, may: 0, jun: 80, jul: 80, ago: 160, sep: 0, oct: 0, nov: 0, dic: 0 },
            'Análisis': { ene: 0, feb: 0, mar: 0, abr: 0, may: 0, jun: 50, jul: 50, ago: 100, sep: 0, oct: 0, nov: 0, dic: 0 },
            'General': { ene: 0, feb: 0, mar: 0, abr: 0, may: 0, jun: 30, jul: 30, ago: 60, sep: 0, oct: 0, nov: 0, dic: 0 }
        }
    },
    'NC-19': {
        skills: {
            'Construcción': { ene: 0, feb: 0, mar: 0, abr: 0, may: 0, jun: 0, jul: 0, ago: 80, sep: 160, oct: 240, nov: 0, dic: 0 },
            'Análisis': { ene: 0, feb: 0, mar: 0, abr: 0, may: 0, jun: 0, jul: 0, ago: 50, sep: 100, oct: 150, nov: 0, dic: 0 },
            'QA': { ene: 0, feb: 0, mar: 0, abr: 0, may: 0, jun: 0, jul: 0, ago: 30, sep: 60, oct: 90, nov: 0, dic: 0 }
        }
    },
    'NC-20': {
        skills: {
            'Construcción': { ene: 0, feb: 0, mar: 0, abr: 0, may: 0, jun: 0, jul: 80, ago: 160, sep: 240, oct: 240, nov: 160, dic: 0 },
            'Análisis': { ene: 0, feb: 0, mar: 0, abr: 0, may: 0, jun: 0, jul: 50, ago: 100, sep: 150, oct: 150, nov: 100, dic: 0 },
            'Project Management': { ene: 0, feb: 0, mar: 0, abr: 0, may: 0, jun: 0, jul: 20, ago: 40, sep: 60, oct: 60, nov: 40, dic: 0 },
            'QA': { ene: 0, feb: 0, mar: 0, abr: 0, may: 0, jun: 0, jul: 10, ago: 20, sep: 30, oct: 30, nov: 20, dic: 0 }
        }
    }
};

// Project metadata
export const projectMetadata = {
    'NC-249': {
        title: 'Migración Sistema Legacy',
        description: 'Migración completa del sistema legacy a nueva arquitectura cloud',
        domain: 'Tecnología',
        tipo: 'Proyecto',
        dominiosPrincipales: 'Operación de Sistemas y Ciberseguridad',
        priority: 'muy-alta',
        status: 'desarrollo'
    },
    'NC-15': {
        title: 'Portal Cliente Web',
        description: 'Desarrollo de nuevo portal web para clientes con funcionalidades avanzadas',
        domain: 'Atención',
        tipo: 'Proyecto',
        dominiosPrincipales: 'Atención',
        priority: 'alta',
        status: 'desarrollo'
    },
    'NC-16': {
        title: 'Sistema Facturación Automática',
        description: 'Implementación de sistema automatizado de facturación y cobros',
        domain: 'Facturación y Cobros',
        tipo: 'Proyecto',
        dominiosPrincipales: 'Facturación y Cobros',
        priority: 'muy-alta',
        status: 'desarrollo'
    },
    'NC-17': {
        title: 'App Mobile Clientes',
        description: 'Aplicación móvil nativa para iOS y Android',
        domain: 'Atención',
        tipo: 'Proyecto',
        dominiosPrincipales: 'Atención',
        priority: 'alta',
        status: 'diseño-detallado'
    },
    'NC-18': {
        title: 'Integración CRM',
        description: 'Integración con sistema CRM corporativo',
        domain: 'Tecnología',
        tipo: 'Evolutivo',
        dominiosPrincipales: 'Integración',
        priority: 'media',
        status: 'desarrollo'
    },
    'NC-19': {
        title: 'Plataforma Analytics',
        description: 'Plataforma de análisis de datos y reporting avanzado',
        domain: 'Tecnología',
        tipo: 'Proyecto',
        dominiosPrincipales: 'Datos',
        priority: 'media',
        status: 'diseño-detallado'
    },
    'NC-20': {
        title: 'Sistema Gestión Contratos',
        description: 'Sistema integral de gestión y seguimiento de contratos',
        domain: 'Contratación',
        tipo: 'Evolutivo',
        dominiosPrincipales: 'Ventas | Contratación y SW',
        priority: 'alta',
        status: 'desarrollo'
    }
};

// Track expanded projects
export const expandedProjects = new Set();

// Month keys for iteration
export const monthKeys = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const monthLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// Current month index (July = 6)
export const currentMonthIndex = 6;
