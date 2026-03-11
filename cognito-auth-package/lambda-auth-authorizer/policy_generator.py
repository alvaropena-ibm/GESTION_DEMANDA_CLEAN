"""
Generador de Políticas IAM
Genera políticas IAM para API Gateway basadas en el resultado de la verificación de acceso
"""


class PolicyGenerator:
    """
    Clase para generar políticas IAM para API Gateway Lambda Authorizer
    """
    
    def __init__(self):
        """
        Inicializa el generador de políticas
        """
        pass
    
    def generate_policy(self, principal_id, effect, resource, context=None):
        """
        Genera una política IAM para API Gateway
        
        Args:
            principal_id (str): Identificador del usuario (ej: email o sub)
            effect (str): 'Allow' o 'Deny'
            resource (str): ARN del recurso (ej: arn:aws:execute-api:region:account:api-id/*)
            context (dict): Contexto adicional para pasar a la API (opcional)
            
        Returns:
            dict: Política IAM formateada para API Gateway
        """
        auth_response = {
            'principalId': principal_id
        }
        
        if effect and resource:
            policy_document = {
                'Version': '2012-10-17',
                'Statement': [
                    {
                        'Action': 'execute-api:Invoke',
                        'Effect': effect,
                        'Resource': resource
                    }
                ]
            }
            auth_response['policyDocument'] = policy_document
        
        # Agregar contexto si se proporciona
        if context:
            auth_response['context'] = context
        
        return auth_response
    
    def generate_allow_policy(self, principal_id, resource, user_info=None):
        """
        Genera una política de Allow
        
        Args:
            principal_id (str): Identificador del usuario
            resource (str): ARN del recurso
            user_info (dict): Información del usuario para incluir en el contexto
            
        Returns:
            dict: Política IAM de Allow
        """
        context = {}
        
        if user_info:
            # Agregar información del usuario al contexto
            # API Gateway solo acepta strings en el contexto
            if 'email' in user_info:
                context['email'] = str(user_info['email'])
            if 'sub' in user_info:
                context['sub'] = str(user_info['sub'])
            if 'username' in user_info:
                context['username'] = str(user_info['username'])
            if 'groups' in user_info:
                # Convertir lista a string separado por comas
                context['groups'] = ','.join(user_info['groups'])
            if 'user_apps' in user_info:
                # Convertir lista a string separado por comas
                context['user_apps'] = ','.join(user_info['user_apps'])
            if 'is_admin' in user_info:
                context['is_admin'] = str(user_info['is_admin'])
        
        return self.generate_policy(principal_id, 'Allow', resource, context)
    
    def generate_deny_policy(self, principal_id, resource, reason=None):
        """
        Genera una política de Deny
        
        Args:
            principal_id (str): Identificador del usuario
            resource (str): ARN del recurso
            reason (str): Razón del deny (opcional)
            
        Returns:
            dict: Política IAM de Deny
        """
        context = {}
        
        if reason:
            context['deny_reason'] = str(reason)
        
        return self.generate_policy(principal_id, 'Deny', resource, context)
    
    def generate_unauthorized_response(self):
        """
        Genera una respuesta de no autorizado (sin política)
        Esto hace que API Gateway devuelva 401 Unauthorized
        
        Returns:
            str: Mensaje de error 'Unauthorized'
        """
        return 'Unauthorized'
    
    def build_resource_arn(self, method_arn):
        """
        Construye el ARN del recurso para la política
        Por defecto, permite acceso a todos los recursos de la API
        
        Args:
            method_arn (str): ARN del método que se está invocando
            
        Returns:
            str: ARN del recurso para la política
        """
        # Ejemplo de method_arn:
        # arn:aws:execute-api:region:account-id:api-id/stage/method/resource
        
        # Extraer las partes del ARN
        arn_parts = method_arn.split(':')
        api_gateway_arn_parts = arn_parts[5].split('/')
        
        # Construir ARN que permite acceso a todos los recursos
        # arn:aws:execute-api:region:account-id:api-id/*
        resource_arn = f"{':'.join(arn_parts[:5])}:{api_gateway_arn_parts[0]}/*"
        
        return resource_arn