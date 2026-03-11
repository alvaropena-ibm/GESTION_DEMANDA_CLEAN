"""
Validador de Tokens JWT de Cognito
Valida y decodifica tokens JWT emitidos por AWS Cognito
"""
import json
import time
import urllib.request
from jose import jwk, jwt
from jose.utils import base64url_decode


class TokenValidator:
    """
    Clase para validar tokens JWT de AWS Cognito
    """
    
    def __init__(self, region, user_pool_id, app_client_id):
        """
        Inicializa el validador de tokens
        
        Args:
            region (str): Región de AWS (ej: eu-west-1)
            user_pool_id (str): ID del User Pool de Cognito
            app_client_id (str): ID del App Client
        """
        self.region = region
        self.user_pool_id = user_pool_id
        self.app_client_id = app_client_id
        self.keys_url = f'https://cognito-idp.{region}.amazonaws.com/{user_pool_id}/.well-known/jwks.json'
        self.keys = None
        
    def get_keys(self):
        """
        Obtiene las claves públicas de Cognito para validar el JWT
        
        Returns:
            dict: Diccionario con las claves públicas
        """
        if self.keys:
            return self.keys
            
        try:
            with urllib.request.urlopen(self.keys_url) as f:
                response = f.read()
            self.keys = json.loads(response.decode('utf-8'))['keys']
            return self.keys
        except Exception as e:
            print(f"Error obteniendo claves públicas: {str(e)}")
            raise Exception("No se pudieron obtener las claves públicas de Cognito")
    
    def validate_token(self, token):
        """
        Valida un token JWT de Cognito
        
        Args:
            token (str): Token JWT a validar
            
        Returns:
            dict: Claims del token si es válido
            
        Raises:
            Exception: Si el token es inválido
        """
        # Obtener las claves públicas
        keys = self.get_keys()
        
        # Obtener el header del token sin verificar
        headers = jwt.get_unverified_headers(token)
        kid = headers['kid']
        
        # Buscar la clave correspondiente
        key_index = -1
        for i in range(len(keys)):
            if kid == keys[i]['kid']:
                key_index = i
                break
        
        if key_index == -1:
            raise Exception('Clave pública no encontrada en jwks.json')
        
        # Construir la clave pública
        public_key = jwk.construct(keys[key_index])
        
        # Obtener el mensaje y la firma
        message, encoded_signature = str(token).rsplit('.', 1)
        
        # Decodificar la firma
        decoded_signature = base64url_decode(encoded_signature.encode('utf-8'))
        
        # Verificar la firma
        if not public_key.verify(message.encode("utf8"), decoded_signature):
            raise Exception('Firma del token inválida')
        
        # Decodificar los claims
        claims = jwt.get_unverified_claims(token)
        
        # Verificar la expiración
        if time.time() > claims['exp']:
            raise Exception('Token expirado')
        
        # Verificar el audience (client_id)
        if claims.get('aud') != self.app_client_id and claims.get('client_id') != self.app_client_id:
            raise Exception('Token no es para esta aplicación')
        
        # Verificar el issuer
        expected_issuer = f'https://cognito-idp.{self.region}.amazonaws.com/{self.user_pool_id}'
        if claims['iss'] != expected_issuer:
            raise Exception('Token no es de este User Pool')
        
        # Verificar el token_use
        if claims.get('token_use') not in ['id', 'access']:
            raise Exception('Token no es un ID token ni un Access token')
        
        return claims
    
    def extract_groups(self, claims):
        """
        Extrae los grupos del usuario desde los claims del token
        
        Args:
            claims (dict): Claims del token JWT
            
        Returns:
            list: Lista de grupos del usuario
        """
        # Los grupos pueden estar en 'cognito:groups' o 'groups'
        groups = claims.get('cognito:groups', [])
        if not groups:
            groups = claims.get('groups', [])
        
        return groups if isinstance(groups, list) else []
    
    def extract_user_info(self, claims):
        """
        Extrae información del usuario desde los claims del token
        
        Args:
            claims (dict): Claims del token JWT
            
        Returns:
            dict: Información del usuario
        """
        return {
            'sub': claims.get('sub'),
            'email': claims.get('email'),
            'username': claims.get('cognito:username', claims.get('username')),
            'groups': self.extract_groups(claims),
            'token_use': claims.get('token_use'),
            'exp': claims.get('exp'),
            'iat': claims.get('iat')
        }