"""
Script para obtener un JWT token de Cognito haciendo login
"""
import boto3
import json
import sys

# Configuración
USER_POOL_ID = 'eu-west-1_zrEOVk483'
CLIENT_ID = '1kp54ebtb2npa4eukpbp1tn1ff'
REGION = 'eu-west-1'

def get_token(username, password):
    """
    Obtiene un JWT token haciendo login con Cognito
    """
    try:
        client = boto3.client('cognito-idp', region_name=REGION)
        
        print(f"\n🔐 Intentando login con usuario: {username}")
        print("="*60)
        
        response = client.initiate_auth(
            ClientId=CLIENT_ID,
            AuthFlow='USER_PASSWORD_AUTH',
            AuthParameters={
                'USERNAME': username,
                'PASSWORD': password
            }
        )
        
        # Verificar si necesita cambio de contraseña
        if 'ChallengeName' in response:
            if response['ChallengeName'] == 'NEW_PASSWORD_REQUIRED':
                print("⚠️  El usuario necesita cambiar la contraseña temporal")
                print("   Usa el endpoint /auth/login del backend para cambiarla")
                return None
        
        # Extraer tokens
        id_token = response['AuthenticationResult']['IdToken']
        access_token = response['AuthenticationResult']['AccessToken']
        refresh_token = response['AuthenticationResult']['RefreshToken']
        
        print("✅ Login exitoso!")
        print("\n📋 TOKENS OBTENIDOS:")
        print("="*60)
        print(f"\n🔑 ID Token (JWT para Authorizer):")
        print(f"{id_token[:50]}...{id_token[-50:]}")
        print(f"\n📝 Token completo guardado en: token_output.txt")
        
        # Guardar en archivo
        with open('lambda-auth-authorizer/token_output.txt', 'w') as f:
            f.write(f"ID_TOKEN={id_token}\n")
            f.write(f"ACCESS_TOKEN={access_token}\n")
            f.write(f"REFRESH_TOKEN={refresh_token}\n")
        
        # Decodificar y mostrar información del token
        import base64
        parts = id_token.split('.')
        if len(parts) >= 2:
            # Decodificar payload (agregar padding si es necesario)
            payload = parts[1]
            padding = 4 - len(payload) % 4
            if padding != 4:
                payload += '=' * padding
            
            decoded = base64.b64decode(payload)
            token_data = json.loads(decoded)
            
            print(f"\n👤 INFORMACIÓN DEL USUARIO:")
            print("="*60)
            print(f"Email: {token_data.get('email', 'N/A')}")
            print(f"Username: {token_data.get('cognito:username', 'N/A')}")
            print(f"Grupos: {token_data.get('cognito:groups', [])}")
            print(f"Expira en: {token_data.get('exp', 'N/A')}")
        
        return id_token
        
    except client.exceptions.NotAuthorizedException:
        print("❌ Error: Usuario o contraseña incorrectos")
        return None
    except client.exceptions.UserNotFoundException:
        print("❌ Error: Usuario no encontrado")
        return None
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return None


def main():
    """
    Función principal
    """
    print("\n" + "="*60)
    print("  OBTENER JWT TOKEN DE COGNITO")
    print("="*60)
    
    # Solicitar credenciales
    if len(sys.argv) >= 3:
        username = sys.argv[1]
        password = sys.argv[2]
    else:
        print("\nIngresa las credenciales del usuario:")
        username = input("Email/Username: ").strip()
        password = input("Password: ").strip()
    
    if not username or not password:
        print("❌ Error: Debes proporcionar usuario y contraseña")
        print("\nUso: python get_token.py <email> <password>")
        return
    
    # Obtener token
    token = get_token(username, password)
    
    if token:
        print("\n" + "="*60)
        print("  ✅ TOKEN OBTENIDO EXITOSAMENTE")
        print("="*60)
        print("\n📝 PRÓXIMOS PASOS:")
        print("1. Copia el ID Token de token_output.txt")
        print("2. Edita test_local.py y reemplaza 'REEMPLAZAR_CON_TOKEN_REAL'")
        print("3. Ejecuta: python test_local.py")
        print("\n")
    else:
        print("\n" + "="*60)
        print("  ❌ NO SE PUDO OBTENER EL TOKEN")
        print("="*60)
        print("\n")


if __name__ == '__main__':
    main()