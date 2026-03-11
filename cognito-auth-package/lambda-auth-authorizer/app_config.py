"""
Configuración de Aplicaciones y Grupos
Mapeo entre grupos de Cognito y aplicaciones permitidas
"""

# Mapeo de grupos a aplicaciones
# Cada grupo tiene acceso a una o más aplicaciones
GROUP_TO_APPS = {
    # Super admin - acceso a todas las aplicaciones
    "global_admin": [
        "credentials_management_application",
        "bedrock_usage_dashboard",
        "knowledge_base_agent_chat",
        "knowledge_base_agent_document_management",
        "knowledge_base_usage_dashboard",
        "sap_newco_batch_monitoring",
        "test_planning_agent",
        "capacity_planning_application"
    ],
    
    # Aplicaciones individuales
    "credentials_management_application": ["credentials_management_application"],
    "bedrock_usage_dashboard": ["bedrock_usage_dashboard"],
    "knowledge_base_agent_chat": ["knowledge_base_agent_chat"],
    "knowledge_base_agent_document_management": ["knowledge_base_agent_document_management"],
    "knowledge_base_usage_dashboard": ["knowledge_base_usage_dashboard"],
    "sap_newco_batch_monitoring": ["sap_newco_batch_monitoring"],
    "test_planning_agent": ["test_planning_agent"],
    "capacity_planning_application": ["capacity_planning_application"]
}

# Mapeo de aplicaciones a rutas de API
# Define qué rutas pertenecen a cada aplicación
APP_TO_ROUTES = {
    "credentials_management_application": [
        "/api/users/*",
        "/api/credentials/*",  # Incluye /api/credentials/tokens, /api/credentials/access-keys, etc.
        "/api/applications/*",
        "/api/permissions/*",
        "/api/audit/*",
        "/api/notifications/*"
    ],
    "bedrock_usage_dashboard": [
        "/api/bedrock/*",  # Incluye /api/bedrock/models, /api/bedrock/usage, /api/bedrock/metrics
    ],
    "knowledge_base_agent_chat": [
        "/api/knowledge-base/chat/*"
    ],
    "knowledge_base_agent_document_management": [
        "/api/knowledge-base/documents/*"
    ],
    "knowledge_base_usage_dashboard": [
        "/api/knowledge-base/usage/*",
        "/api/knowledge-base/metrics/*"
    ],
    "sap_newco_batch_monitoring": [
        "/api/sap/batch/*",
        "/api/sap/monitoring/*"
    ],
    "test_planning_agent": [
        "/api/test-planning/*"
    ],
    "capacity_planning_application": [
        "/api/capacity-planning/*"
    ]
}

# Rutas públicas que NO requieren autorización
PUBLIC_ROUTES = [
    "/auth/login",
    "/auth/refresh",
    "/auth/logout",
    "/health",
    "/api/health"
]


def get_allowed_apps_for_groups(groups):
    """
    Obtiene la lista de aplicaciones permitidas para un conjunto de grupos
    
    Args:
        groups (list): Lista de grupos del usuario
        
    Returns:
        list: Lista de aplicaciones permitidas (sin duplicados)
    """
    allowed_apps = set()
    
    for group in groups:
        if group in GROUP_TO_APPS:
            allowed_apps.update(GROUP_TO_APPS[group])
    
    return list(allowed_apps)


def is_route_allowed(user_groups, requested_route):
    """
    Verifica si un usuario tiene acceso a una ruta específica
    
    Args:
        user_groups (list): Lista de grupos del usuario
        requested_route (str): Ruta solicitada (ej: /api/users/list)
        
    Returns:
        bool: True si el usuario tiene acceso, False en caso contrario
    """
    # Verificar si es una ruta pública
    for public_route in PUBLIC_ROUTES:
        if requested_route.startswith(public_route):
            return True
    
    # Obtener aplicaciones permitidas para los grupos del usuario
    allowed_apps = get_allowed_apps_for_groups(user_groups)
    
    # Verificar si alguna de las aplicaciones permitidas tiene acceso a la ruta
    for app in allowed_apps:
        if app in APP_TO_ROUTES:
            for route_pattern in APP_TO_ROUTES[app]:
                # Convertir patrón con * a regex simple
                if route_pattern.endswith("/*"):
                    route_prefix = route_pattern[:-2]  # Quitar /*
                    if requested_route.startswith(route_prefix):
                        return True
                elif requested_route == route_pattern:
                    return True
    
    return False


def get_app_for_route(route):
    """
    Determina qué aplicación corresponde a una ruta
    
    Args:
        route (str): Ruta solicitada
        
    Returns:
        str: Nombre de la aplicación o None si no se encuentra
    """
    for app, routes in APP_TO_ROUTES.items():
        for route_pattern in routes:
            if route_pattern.endswith("/*"):
                route_prefix = route_pattern[:-2]
                if route.startswith(route_prefix):
                    return app
            elif route == route_pattern:
                return app
    
    return None