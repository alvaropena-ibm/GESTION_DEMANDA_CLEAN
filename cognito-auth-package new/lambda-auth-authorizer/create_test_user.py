"""
Script para crear un usuario de prueba con grupo global_admin
"""
import boto3
import sys

# Configuración
USER_POOL_ID = 'eu-west-1_zrEOVk483'
REGION = 'eu-west-1'

def create_test_user():
    """
    Crea un usuario de prueba con grupo global_admin
    """
    try:
        client = boto3.client('cognito-idp', region_name=REGION)
        
        # Datos del usuario de prueba
        username = 'test-admin@example.com'
        password = 'TestAdmin123!'  # Contraseña temporal
        
        print("\n" + "="*60)
        print("  CREAR USUARIO DE PRUEBA")
        print("="*60)
        print(f"\nEmail: {username}")
        print(f"Password: {password}")
        print(f"Grupo: global_admin")
        
        # Crear usuario
        print("\n1. Creando usuario...")
        try:
            response = client.admin_create_user(
                UserPoolId=USER_POOL_ID,
                Username=username,
                UserAttributes=[
                    {'Name': 'email', 'Value': username},
                    {'Name': 'email_verified', 'Value': 'true'}
                ],
                TemporaryPassword=password,
                MessageAction='SUPPRESS'  # No enviar email
            )
            print("   ✅ Usuario creado")
        except client.exceptions.UsernameExistsException:
            print("   ⚠️  Usuario ya existe, continuando...")
        
        # Establecer contraseña permanente
        print("\n2. Estableciendo contraseña permanente...")
        client.admin_set_user_password(
            UserPoolId=USER_POOL_ID,
            Username=username,
            Password=password,
            Permanent=True
        )
        print("   ✅ Contraseña establecida")
        
        # Agregar a grupo global_admin
        print("\n3. Agregando a grupo global_admin...")
        try:
            client.admin_add_user_to_group(
                UserPoolId=USER_POOL_ID,
                Username=username,
                GroupName='global_admin'
            )
            print("   ✅ Usuario agregado al grupo")
        except:
            print("   ⚠️  Usuario ya está en el grupo")
        
        print("\n" + "="*60)
        print("  ✅ USUARIO DE PRUEBA LISTO")
        print("="*60)
        print(f"\n📧 Email: {username}")
        print(f"🔑 Password: {password}")
        print(f"👥 Grupo: global_admin")
        print("\n📝 PRÓXIMOS PASOS:")
        print(f"1. Ejecuta: python lambda-auth-authorizer/get_token.py {username} {password}")
        print("2. El token se guardará en token_output.txt")
        print("3. Ejecuta: python lambda-auth-authorizer/test_local.py")
        print("\n")
        
        return username, password
        
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return None, None


if __name__ == '__main__':
    create_test_user()