"""
Verificador de Acceso
Verifica si un usuario tiene acceso a una ruta específica basándose en sus grupos
"""
from app_config import is_route_allowed, get_allowed_apps_for_groups, get_app_for_route


class AccessChecker:
    """
    Clase para verificar el acceso de usuarios a rutas específicas
    """
    
    def __init__(self):
        """
        Inicializa el verificador de acceso
        """
        pass
    
    def check_access(self, user_groups, requested_route, method='GET'):
        """
        Verifica si un usuario tiene acceso a una ruta específica
        
        Args:
            user_groups (list): Lista de grupos del usuario
            requested_route (str): Ruta solicitada (ej: /api/users/list)
            method (str): Método HTTP (GET, POST, PUT, DELETE, etc.)
            
        Returns:
            dict: Resultado de la verificación con la siguiente estructura:
                {
                    'allowed': bool,
                    'reason': str,
                    'app': str or None,
                    'user_apps': list
                }
        """
        # Verificar si el usuario tiene grupos
        if not user_groups or len(user_groups) == 0:
            return {
                'allowed': False,
                'reason': 'Usuario no tiene grupos asignados',
                'app': None,
                'user_apps': []
            }
        
        # Obtener aplicaciones permitidas para el usuario
        user_apps = get_allowed_apps_for_groups(user_groups)
        
        if not user_apps or len(user_apps) == 0:
            return {
                'allowed': False,
                'reason': 'Usuario no tiene acceso a ninguna aplicación',
                'app': None,
                'user_apps': []
            }
        
        # Determinar qué aplicación corresponde a la ruta
        app_for_route = get_app_for_route(requested_route)
        
        # Verificar si el usuario tiene acceso a la ruta
        has_access = is_route_allowed(user_groups, requested_route)
        
        if has_access:
            return {
                'allowed': True,
                'reason': 'Acceso permitido',
                'app': app_for_route,
                'user_apps': user_apps
            }
        else:
            return {
                'allowed': False,
                'reason': f'Usuario no tiene acceso a la ruta {requested_route}',
                'app': app_for_route,
                'user_apps': user_apps
            }
    
    def get_user_permissions(self, user_groups):
        """
        Obtiene un resumen de los permisos del usuario
        
        Args:
            user_groups (list): Lista de grupos del usuario
            
        Returns:
            dict: Resumen de permisos con la siguiente estructura:
                {
                    'groups': list,
                    'apps': list,
                    'is_admin': bool
                }
        """
        user_apps = get_allowed_apps_for_groups(user_groups)
        is_admin = 'global_admin' in user_groups
        
        return {
            'groups': user_groups,
            'apps': user_apps,
            'is_admin': is_admin
        }
    
    def check_admin_access(self, user_groups):
        """
        Verifica si el usuario es administrador global
        
        Args:
            user_groups (list): Lista de grupos del usuario
            
        Returns:
            bool: True si el usuario es admin, False en caso contrario
        """
        return 'global_admin' in user_groups