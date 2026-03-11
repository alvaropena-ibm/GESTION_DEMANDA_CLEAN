"""
Lambda Login Service - Handler Principal
Servicio de autenticación compartido para todas las aplicaciones
"""
import json
import os
from cognito_service import CognitoService

# Inicializar servicio de Cognito
cognito_service = CognitoService(
    user_pool_id=os.environ.get('USER_POOL_ID', 'eu-west-1_zrEOVk483'),
    client_id=os.environ.get('CLIENT_ID', '1kp54ebtb2npa4eukpbp1tn1ff'),
    region=os.environ.get('AWS_REGION', 'eu-west-1')
)


def lambda_handler(event, context):
    """
    Handler principal de la Lambda de Login
    
    Endpoints soportados:
    - POST /auth/login - Login con email/password
    - POST /auth/refresh - Refresh token
    - POST /auth/logout - Logout (invalidar refresh token)
    - POST /auth/change-password - Cambiar contraseña
    """
    
    try:
        # Extraer información del request
        http_method = event.get('httpMethod', event.get('requestContext', {}).get('http', {}).get('method', 'POST'))
        path = event.get('path', event.get('rawPath', '/auth/login'))
        body = json.loads(event.get('body', '{}'))
        
        print(f"Request: {http_method} {path}")
        print(f"Body: {json.dumps(body, indent=2)}")
        
        # Manejar preflight OPTIONS request
        if http_method == 'OPTIONS':
            return create_response(200, {'message': 'OK'})
        
        # Routing - soportar tanto /login como /cognito-login
        if (path.endswith('/login') or path.endswith('/cognito-login')) and http_method == 'POST':
            return handle_login(body)
        elif (path.endswith('/refresh') or path.endswith('/cognito-refresh')) and http_method == 'POST':
            return handle_refresh(body)
        elif path.endswith('/logout') and http_method == 'POST':
            return handle_logout(body)
        elif path.endswith('/change-password') and http_method == 'POST':
            return handle_change_password(body)
        else:
            return create_response(404, {'error': f'Endpoint not found: {path}'})
            
    except Exception as e:
        print(f"Error: {str(e)}")
        return create_response(500, {
            'error': 'Internal server error',
            'message': str(e)
        })


def handle_login(body):
    """
    Maneja el login con email y password
    
    Request body:
    {
        "email": "user@example.com",
        "password": "password123",
        "new_password": "newPassword123" (opcional, para cambio de contraseña)
    }
    
    Response (login exitoso):
    {
        "success": true,
        "auth_type": "cognito",
        "user": {
            "email": "user@example.com",
            "groups": ["group1", "group2"],
            "sub": "uuid",
            "requires_password_change": false
        },
        "tokens": {
            "access_token": "eyJhbGc...",
            "id_token": "eyJhbGc...",
            "refresh_token": "eyJhbGc...",
            "expires_in": 3600
        }
    }
    
    Response (requiere cambio de contraseña):
    {
        "success": true,
        "user": {
            "email": "user@example.com",
            "requires_password_change": true
        },
        "challenge": "NEW_PASSWORD_REQUIRED",
        "session": "session_token"
    }
    """
    
    # Validar campos requeridos
    email = body.get('email')
    password = body.get('password')
    new_password = body.get('new_password')
    session = body.get('session')  # Session token de Cognito para cambio forzado
    
    if not email:
        return create_response(400, {
            'error': 'Bad Request',
            'message': 'Email is required'
        })
    
    # Validar campos según el caso:
    # - Si hay session + new_password: cambio forzado (NO requiere password)
    # - Si NO hay session: requiere password para login normal
    if not session and not password:
        return create_response(400, {
            'error': 'Bad Request',
            'message': 'Email and password are required'
        })
    
    # Si hay session, debe haber new_password
    if session and not new_password:
        return create_response(400, {
            'error': 'Bad Request',
            'message': 'New password is required when using session token'
        })
    
    try:
        # Si hay session token, es un cambio de contraseña FORZADO
        if session and new_password:
            print(f"Forced password change with session for {email}")
            # Responder directamente al challenge usando el session token
            try:
                challenge_response = cognito_service.client.respond_to_auth_challenge(
                    ClientId=cognito_service.client_id,
                    ChallengeName='NEW_PASSWORD_REQUIRED',
                    Session=session,
                    ChallengeResponses={
                        'USERNAME': email,
                        'NEW_PASSWORD': new_password,
                        # Cognito puede requerir atributos como 'name'
                        # Si no se proporciona, usar el email como nombre
                        'userAttributes.name': email.split('@')[0]
                    }
                )
                
                # Extraer tokens después del cambio de contraseña
                auth_result = challenge_response['AuthenticationResult']
                access_token = auth_result['AccessToken']
                id_token = auth_result['IdToken']
                refresh_token = auth_result['RefreshToken']
                expires_in = auth_result['ExpiresIn']
                
                # Obtener información del usuario
                user_info = cognito_service.get_user_info(access_token)
                
                # Obtener grupos del usuario
                groups = cognito_service.get_user_groups(email)
                
                return create_response(200, {
                    'success': True,
                    'auth_type': 'cognito',
                    'user': {
                        'email': user_info.get('email', email),
                        'sub': user_info.get('sub'),
                        'groups': groups,
                        'email_verified': user_info.get('email_verified', False),
                        'requires_password_change': False
                    },
                    'tokens': {
                        'access_token': access_token,
                        'id_token': id_token,
                        'refresh_token': refresh_token,
                        'expires_in': expires_in
                    }
                })
            except Exception as e:
                print(f"Error responding to password challenge: {str(e)}")
                return create_response(500, {
                    'error': 'Internal server error',
                    'message': f'Failed to change password: {str(e)}'
                })
        
        # Si se proporciona new_password SIN session, intentar cambio de contraseña voluntario
        if new_password and password:
            # Primero intentar autenticar (cambio voluntario)
            auth_result = cognito_service.authenticate(email, password, new_password)
            
            # Si tiene challenge NEW_PASSWORD_REQUIRED, ya se manejó en authenticate()
            if 'challenge' in auth_result:
                # Formato para el frontend
                return create_response(200, {
                    'success': True,
                    'user': auth_result.get('user', {}),
                    'challenge': auth_result['challenge'],
                    'session': auth_result.get('session')
                })
            
            # Si authenticate() devolvió tokens, significa que era cambio forzado y ya se completó
            # Formatear respuesta para el frontend
            return create_response(200, {
                'success': True,
                'auth_type': 'cognito',
                'user': {
                    **auth_result['user'],
                    'requires_password_change': False
                },
                'tokens': {
                    'access_token': auth_result['access_token'],
                    'id_token': auth_result['id_token'],
                    'refresh_token': auth_result['refresh_token'],
                    'expires_in': auth_result['expires_in']
                }
            })
        
        # Login normal sin cambio de contraseña
        result = cognito_service.authenticate(email, password, new_password)
        
        # Si requiere cambio de contraseña
        if 'challenge' in result:
            return create_response(200, {
                'success': True,
                'user': result.get('user', {}),
                'challenge': result['challenge'],
                'session': result.get('session'),
                'message': result.get('message', 'New password required')
            })
        
        # Login exitoso - formatear respuesta para el frontend
        return create_response(200, {
            'success': True,
            'auth_type': 'cognito',
            'user': {
                **result['user'],
                'requires_password_change': False
            },
            'tokens': {
                'access_token': result['access_token'],
                'id_token': result['id_token'],
                'refresh_token': result['refresh_token'],
                'expires_in': result['expires_in']
            }
        })
        
    except cognito_service.client.exceptions.NotAuthorizedException:
        return create_response(401, {
            'error': 'Unauthorized',
            'message': 'Invalid email or password'
        })
    except cognito_service.client.exceptions.UserNotFoundException:
        return create_response(401, {
            'error': 'Unauthorized',
            'message': 'Invalid email or password'
        })
    except cognito_service.client.exceptions.UserNotConfirmedException:
        return create_response(403, {
            'error': 'Forbidden',
            'message': 'User account is not confirmed'
        })
    except Exception as e:
        print(f"Login error: {str(e)}")
        return create_response(500, {
            'error': 'Internal server error',
            'message': 'Authentication failed'
        })


def handle_refresh(body):
    """
    Maneja el refresh de tokens
    
    Request body:
    {
        "refresh_token": "eyJhbGc..."
    }
    
    Response:
    {
        "access_token": "eyJhbGc...",
        "id_token": "eyJhbGc...",
        "expires_in": 3600,
        "token_type": "Bearer"
    }
    """
    
    refresh_token = body.get('refresh_token')
    
    if not refresh_token:
        return create_response(400, {
            'error': 'Bad Request',
            'message': 'Refresh token is required'
        })
    
    try:
        result = cognito_service.refresh_token(refresh_token)
        return create_response(200, result)
        
    except cognito_service.client.exceptions.NotAuthorizedException:
        return create_response(401, {
            'error': 'Unauthorized',
            'message': 'Invalid or expired refresh token'
        })
    except Exception as e:
        print(f"Refresh error: {str(e)}")
        return create_response(500, {
            'error': 'Internal server error',
            'message': 'Token refresh failed'
        })


def handle_logout(body):
    """
    Maneja el logout (invalidar refresh token)
    
    Request body:
    {
        "access_token": "eyJhbGc..."
    }
    
    Response:
    {
        "message": "Logout successful"
    }
    """
    
    access_token = body.get('access_token')
    
    if not access_token:
        return create_response(400, {
            'error': 'Bad Request',
            'message': 'Access token is required'
        })
    
    try:
        cognito_service.logout(access_token)
        return create_response(200, {
            'message': 'Logout successful'
        })
        
    except Exception as e:
        print(f"Logout error: {str(e)}")
        # Incluso si falla, devolvemos éxito (el frontend borrará el token)
        return create_response(200, {
            'message': 'Logout successful'
        })


def handle_change_password(body):
    """
    Maneja el cambio de contraseña
    
    Request body:
    {
        "access_token": "eyJhbGc...",
        "old_password": "OldPassword123!",
        "new_password": "NewPassword123!"
    }
    
    Response:
    {
        "message": "Password changed successfully"
    }
    """
    
    access_token = body.get('access_token')
    old_password = body.get('old_password')
    new_password = body.get('new_password')
    
    if not access_token or not old_password or not new_password:
        return create_response(400, {
            'error': 'Bad Request',
            'message': 'Access token, old password and new password are required'
        })
    
    try:
        cognito_service.change_password(access_token, old_password, new_password)
        return create_response(200, {
            'message': 'Password changed successfully'
        })
        
    except cognito_service.client.exceptions.NotAuthorizedException:
        return create_response(401, {
            'error': 'Unauthorized',
            'message': 'Invalid old password or access token'
        })
    except cognito_service.client.exceptions.InvalidPasswordException as e:
        return create_response(400, {
            'error': 'Bad Request',
            'message': str(e)
        })
    except cognito_service.client.exceptions.LimitExceededException:
        return create_response(429, {
            'error': 'Too Many Requests',
            'message': 'Attempt limit exceeded, please try again later'
        })
    except Exception as e:
        print(f"Change password error: {str(e)}")
        return create_response(500, {
            'error': 'Internal server error',
            'message': 'Password change failed'
        })


def create_response(status_code, body):
    """
    Crea una respuesta HTTP formateada para API Gateway
    """
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',  # Configurar según necesidad
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'POST,OPTIONS'
        },
        'body': json.dumps(body)
    }


# Para testing local
if __name__ == '__main__':
    # Test event
    test_event = {
        'httpMethod': 'POST',
        'path': '/auth/login',
        'body': json.dumps({
            'email': 'test@example.com',
            'password': 'TestPassword123!'
        })
    }
    
    result = lambda_handler(test_event, None)
    print(json.dumps(result, indent=2))