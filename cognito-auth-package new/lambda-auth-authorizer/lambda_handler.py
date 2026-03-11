"""
Lambda Authorizer - Handler Principal
Autoriza requests a API Gateway basándose en JWT de Cognito y grupos del usuario
"""
import os
import json
from token_validator import TokenValidator
from access_checker import AccessChecker
from policy_generator import PolicyGenerator


# Configuración desde variables de entorno
REGION = os.environ.get('AWS_REGION', 'eu-west-1')
USER_POOL_ID = os.environ.get('USER_POOL_ID', 'eu-west-1_zrEOVk483')
APP_CLIENT_ID = os.environ.get('APP_CLIENT_ID', '1kp54ebtb2npa4eukpbp1tn1ff')

# Inicializar componentes
token_validator = TokenValidator(REGION, USER_POOL_ID, APP_CLIENT_ID)
access_checker = AccessChecker()
policy_generator = PolicyGenerator()


def lambda_handler(event, context):
    """
    Handler principal de la Lambda Authorizer
    
    Args:
        event (dict): Evento de API Gateway con el token en authorizationToken
        context: Contexto de Lambda
        
    Returns:
        dict: Política IAM (Allow/Deny) o 'Unauthorized'
    """
    
    try:
        print(f"Event: {json.dumps(event)}")
        
        # Extraer el token del header Authorization
        token = extract_token(event)
        
        if not token:
            print("No se encontró token en el request")
            return policy_generator.generate_unauthorized_response()
        
        # Validar el token JWT
        try:
            claims = token_validator.validate_token(token)
            print(f"Token válido. Claims: {json.dumps(claims, default=str)}")
        except Exception as e:
            print(f"Token inválido: {str(e)}")
            return policy_generator.generate_unauthorized_response()
        
        # Extraer información del usuario
        user_info = token_validator.extract_user_info(claims)
        user_groups = user_info['groups']
        user_email = user_info.get('email', 'unknown')
        
        print(f"Usuario: {user_email}")
        print(f"Grupos: {user_groups}")
        
        # Verificar que el usuario tenga grupos
        if not user_groups or len(user_groups) == 0:
            print("Usuario no tiene grupos asignados")
            # Construir ARN del recurso
            method_arn = event.get('methodArn', '')
            resource_arn = policy_generator.build_resource_arn(method_arn)
            return policy_generator.generate_deny_policy(
                user_email,
                resource_arn,
                'Usuario no tiene grupos asignados'
            )
        
        # Extraer la ruta solicitada
        method_arn = event.get('methodArn', '')
        requested_route = extract_route_from_arn(method_arn)
        http_method = extract_method_from_arn(method_arn)
        
        print(f"Ruta solicitada: {http_method} {requested_route}")
        
        # Verificar acceso
        access_result = access_checker.check_access(user_groups, requested_route, http_method)
        
        print(f"Resultado de verificación: {json.dumps(access_result)}")
        
        # Construir ARN del recurso
        resource_arn = policy_generator.build_resource_arn(method_arn)
        
        # Generar política basada en el resultado
        if access_result['allowed']:
            # Acceso permitido - generar política Allow
            print(f"Acceso PERMITIDO para {user_email} a {requested_route}")
            
            # Preparar información del usuario para el contexto
            context_user_info = {
                'email': user_email,
                'sub': user_info.get('sub'),
                'username': user_info.get('username'),
                'groups': user_groups,
                'user_apps': access_result.get('user_apps', []),
                'is_admin': access_checker.check_admin_access(user_groups)
            }
            
            return policy_generator.generate_allow_policy(
                user_email,
                resource_arn,
                context_user_info
            )
        else:
            # Acceso denegado - generar política Deny
            print(f"Acceso DENEGADO para {user_email} a {requested_route}")
            print(f"Razón: {access_result['reason']}")
            
            return policy_generator.generate_deny_policy(
                user_email,
                resource_arn,
                access_result['reason']
            )
            
    except Exception as e:
        print(f"Error en lambda_handler: {str(e)}")
        import traceback
        traceback.print_exc()
        return policy_generator.generate_unauthorized_response()


def extract_token(event):
    """
    Extrae el token JWT del evento de API Gateway
    
    Args:
        event (dict): Evento de API Gateway
        
    Returns:
        str: Token JWT o None si no se encuentra
    """
    # El token viene en authorizationToken para Lambda Authorizer tipo TOKEN
    auth_token = event.get('authorizationToken', '')
    
    if not auth_token:
        # Intentar obtener del header Authorization
        headers = event.get('headers', {})
        auth_token = headers.get('Authorization', headers.get('authorization', ''))
    
    # Remover el prefijo "Bearer " si existe
    if auth_token.startswith('Bearer '):
        auth_token = auth_token[7:]
    
    return auth_token if auth_token else None


def extract_route_from_arn(method_arn):
    """
    Extrae la ruta del ARN del método
    
    Args:
        method_arn (str): ARN del método (ej: arn:aws:execute-api:region:account:api-id/stage/GET/api/users)
        
    Returns:
        str: Ruta extraída (ej: /api/users)
    """
    try:
        # Formato: arn:aws:execute-api:region:account-id:api-id/stage/method/resource
        parts = method_arn.split('/')
        
        if len(parts) >= 4:
            # Unir todas las partes después del método (índice 3 en adelante)
            route = '/' + '/'.join(parts[3:])
            return route
        
        return '/'
    except Exception as e:
        print(f"Error extrayendo ruta del ARN: {str(e)}")
        return '/'


def extract_method_from_arn(method_arn):
    """
    Extrae el método HTTP del ARN
    
    Args:
        method_arn (str): ARN del método
        
    Returns:
        str: Método HTTP (GET, POST, etc.)
    """
    try:
        # Formato: arn:aws:execute-api:region:account-id:api-id/stage/method/resource
        parts = method_arn.split('/')
        
        if len(parts) >= 3:
            return parts[2]  # El método está en el índice 2
        
        return 'GET'
    except Exception as e:
        print(f"Error extrayendo método del ARN: {str(e)}")
        return 'GET'


# Para testing local
if __name__ == '__main__':
    # Evento de prueba
    test_event = {
        'type': 'TOKEN',
        'authorizationToken': 'Bearer eyJhbGc...',  # Token JWT de prueba
        'methodArn': 'arn:aws:execute-api:eu-west-1:123456789:abcdef123/prod/GET/api/users'
    }
    
    result = lambda_handler(test_event, None)
    print(json.dumps(result, indent=2))