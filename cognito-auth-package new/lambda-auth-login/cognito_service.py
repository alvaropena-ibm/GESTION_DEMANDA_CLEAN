"""
Cognito Service - Maneja toda la lógica de autenticación con AWS Cognito
"""
import boto3
import base64
import hashlib
import hmac
from botocore.exceptions import ClientError


class CognitoService:
    """
    Servicio para interactuar con AWS Cognito User Pool
    """
    
    def __init__(self, user_pool_id, client_id, region='eu-west-1'):
        """
        Inicializa el servicio de Cognito
        
        Args:
            user_pool_id: ID del User Pool de Cognito
            client_id: ID del App Client
            region: Región de AWS
        """
        self.user_pool_id = user_pool_id
        self.client_id = client_id
        self.region = region
        self.client = boto3.client('cognito-idp', region_name=region)
    
    def authenticate(self, email, password, new_password=None):
        """
        Autentica un usuario con email y password
        
        Args:
            email: Email del usuario
            password: Password del usuario
            new_password: Nueva contraseña (opcional, para cambio de contraseña)
            
        Returns:
            dict: Información del usuario y tokens, o desafío de cambio de contraseña
            
            Login exitoso:
            {
                "access_token": "...",
                "id_token": "...",
                "refresh_token": "...",
                "expires_in": 3600,
                "token_type": "Bearer",
                "user": {
                    "email": "...",
                    "groups": [...],
                    "sub": "..."
                }
            }
            
            Requiere cambio de contraseña:
            {
                "challenge": "NEW_PASSWORD_REQUIRED",
                "session": "...",
                "message": "New password required"
            }
        """
        try:
            # Autenticar con Cognito usando USER_PASSWORD_AUTH
            response = self.client.initiate_auth(
                ClientId=self.client_id,
                AuthFlow='USER_PASSWORD_AUTH',
                AuthParameters={
                    'USERNAME': email,
                    'PASSWORD': password
                }
            )
            
            # Verificar si hay un desafío (ej: NEW_PASSWORD_REQUIRED)
            if 'ChallengeName' in response:
                challenge_name = response['ChallengeName']
                
                if challenge_name == 'NEW_PASSWORD_REQUIRED':
                    # Si se proporcionó nueva contraseña, responder al desafío
                    if new_password:
                        print(f"Responding to NEW_PASSWORD_REQUIRED challenge for {email}")
                        challenge_response = self.client.respond_to_auth_challenge(
                            ClientId=self.client_id,
                            ChallengeName='NEW_PASSWORD_REQUIRED',
                            Session=response['Session'],
                            ChallengeResponses={
                                'USERNAME': email,
                                'NEW_PASSWORD': new_password
                            }
                        )
                        
                        # Extraer tokens después del cambio de contraseña
                        auth_result = challenge_response['AuthenticationResult']
                        access_token = auth_result['AccessToken']
                        id_token = auth_result['IdToken']
                        refresh_token = auth_result['RefreshToken']
                        expires_in = auth_result['ExpiresIn']
                        
                        # Obtener información del usuario
                        user_info = self.get_user_info(access_token)
                        
                        # Obtener grupos del usuario
                        groups = self.get_user_groups(email)
                        
                        return {
                            'access_token': access_token,
                            'id_token': id_token,
                            'refresh_token': refresh_token,
                            'expires_in': expires_in,
                            'token_type': 'Bearer',
                            'user': {
                                'email': user_info.get('email', email),
                                'sub': user_info.get('sub'),
                                'groups': groups,
                                'email_verified': user_info.get('email_verified', False)
                            }
                        }
                    else:
                        # Devolver desafío al frontend para que solicite nueva contraseña
                        print(f"NEW_PASSWORD_REQUIRED challenge for {email}")
                        return {
                            'challenge': 'NEW_PASSWORD_REQUIRED',
                            'session': response['Session'],
                            'message': 'New password required',
                            'user': {
                                'email': email,
                                'requires_password_change': True
                            }
                        }
                else:
                    # Otro tipo de desafío no soportado
                    raise Exception(f"Unsupported challenge: {challenge_name}")
            
            # Login exitoso sin desafíos
            auth_result = response['AuthenticationResult']
            access_token = auth_result['AccessToken']
            id_token = auth_result['IdToken']
            refresh_token = auth_result['RefreshToken']
            expires_in = auth_result['ExpiresIn']
            
            # Obtener información del usuario
            user_info = self.get_user_info(access_token)
            
            # Obtener grupos del usuario
            groups = self.get_user_groups(email)
            
            return {
                'access_token': access_token,
                'id_token': id_token,
                'refresh_token': refresh_token,
                'expires_in': expires_in,
                'token_type': 'Bearer',
                'user': {
                    'email': user_info.get('email', email),
                    'sub': user_info.get('sub'),
                    'groups': groups,
                    'email_verified': user_info.get('email_verified', False)
                }
            }
            
        except self.client.exceptions.NotAuthorizedException as e:
            print(f"Authentication failed: {str(e)}")
            raise
        except self.client.exceptions.UserNotFoundException as e:
            print(f"User not found: {str(e)}")
            raise
        except self.client.exceptions.UserNotConfirmedException as e:
            print(f"User not confirmed: {str(e)}")
            raise
        except Exception as e:
            print(f"Unexpected error during authentication: {str(e)}")
            raise
    
    def get_user_info(self, access_token):
        """
        Obtiene información del usuario usando el access token
        
        Args:
            access_token: Access token de Cognito
            
        Returns:
            dict: Información del usuario
        """
        try:
            response = self.client.get_user(
                AccessToken=access_token
            )
            
            # Convertir atributos a diccionario
            user_attributes = {}
            for attr in response.get('UserAttributes', []):
                user_attributes[attr['Name']] = attr['Value']
            
            return user_attributes
            
        except Exception as e:
            print(f"Error getting user info: {str(e)}")
            return {}
    
    def get_user_groups(self, email):
        """
        Obtiene los grupos a los que pertenece un usuario
        
        Args:
            email: Email del usuario
            
        Returns:
            list: Lista de nombres de grupos
        """
        try:
            response = self.client.admin_list_groups_for_user(
                Username=email,
                UserPoolId=self.user_pool_id
            )
            
            groups = [group['GroupName'] for group in response.get('Groups', [])]
            print(f"User {email} belongs to groups: {groups}")
            
            return groups
            
        except Exception as e:
            print(f"Error getting user groups: {str(e)}")
            return []
    
    def refresh_token(self, refresh_token):
        """
        Refresca los tokens usando el refresh token
        
        Args:
            refresh_token: Refresh token de Cognito
            
        Returns:
            dict: Nuevos tokens
            {
                "access_token": "...",
                "id_token": "...",
                "expires_in": 3600,
                "token_type": "Bearer"
            }
        """
        try:
            response = self.client.initiate_auth(
                ClientId=self.client_id,
                AuthFlow='REFRESH_TOKEN_AUTH',
                AuthParameters={
                    'REFRESH_TOKEN': refresh_token
                }
            )
            
            auth_result = response['AuthenticationResult']
            
            return {
                'access_token': auth_result['AccessToken'],
                'id_token': auth_result['IdToken'],
                'expires_in': auth_result['ExpiresIn'],
                'token_type': 'Bearer'
            }
            
        except self.client.exceptions.NotAuthorizedException as e:
            print(f"Refresh token invalid: {str(e)}")
            raise
        except Exception as e:
            print(f"Error refreshing token: {str(e)}")
            raise
    
    def logout(self, access_token):
        """
        Cierra la sesión del usuario (invalida el refresh token)
        
        Args:
            access_token: Access token del usuario
        """
        try:
            self.client.global_sign_out(
                AccessToken=access_token
            )
            print("User logged out successfully")
            
        except Exception as e:
            print(f"Error during logout: {str(e)}")
            # No lanzamos excepción porque el logout debe ser exitoso
            # incluso si falla (el frontend borrará el token de todas formas)
    
    def verify_token(self, access_token):
        """
        Verifica si un access token es válido
        
        Args:
            access_token: Access token a verificar
            
        Returns:
            bool: True si el token es válido, False en caso contrario
        """
        try:
            self.client.get_user(AccessToken=access_token)
            return True
        except:
            return False
    
    def change_password(self, access_token, old_password, new_password):
        """
        Cambia la contraseña del usuario
        
        Args:
            access_token: Access token del usuario
            old_password: Contraseña actual
            new_password: Nueva contraseña
        """
        try:
            self.client.change_password(
                PreviousPassword=old_password,
                ProposedPassword=new_password,
                AccessToken=access_token
            )
            print("Password changed successfully")
            
        except self.client.exceptions.NotAuthorizedException:
            raise Exception("Current password is incorrect")
        except self.client.exceptions.InvalidPasswordException as e:
            raise Exception(f"Invalid password: {str(e)}")
        except Exception as e:
            print(f"Error changing password: {str(e)}")
            raise
    
    def forgot_password(self, email):
        """
        Inicia el proceso de recuperación de contraseña
        
        Args:
            email: Email del usuario
        """
        try:
            self.client.forgot_password(
                ClientId=self.client_id,
                Username=email
            )
            print(f"Password reset code sent to {email}")
            
        except Exception as e:
            print(f"Error initiating password reset: {str(e)}")
            raise
    
    def confirm_forgot_password(self, email, confirmation_code, new_password):
        """
        Confirma el cambio de contraseña con el código recibido
        
        Args:
            email: Email del usuario
            confirmation_code: Código de confirmación
            new_password: Nueva contraseña
        """
        try:
            self.client.confirm_forgot_password(
                ClientId=self.client_id,
                Username=email,
                ConfirmationCode=confirmation_code,
                Password=new_password
            )
            print(f"Password reset confirmed for {email}")
            
        except self.client.exceptions.CodeMismatchException:
            raise Exception("Invalid confirmation code")
        except self.client.exceptions.ExpiredCodeException:
            raise Exception("Confirmation code has expired")
        except Exception as e:
            print(f"Error confirming password reset: {str(e)}")
            raise


# Para testing local
if __name__ == '__main__':
    import json
    
    # Inicializar servicio
    service = CognitoService(
        user_pool_id='eu-west-1_zrEOVk483',
        client_id='1kp54ebtb2npa4eukpbp1tn1ff',
        region='eu-west-1'
    )
    
    # Test de autenticación (reemplazar con credenciales reales para probar)
    try:
        result = service.authenticate(
            email='test@example.com',
            password='TestPassword123!'
        )
        print("Authentication successful!")
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(f"Authentication failed: {str(e)}")