"""
Script para listar usuarios de Cognito y sus grupos
"""
import boto3
import json

# Configuración
USER_POOL_ID = 'eu-west-1_zrEOVk483'
REGION = 'eu-west-1'

def list_users():
    """
    Lista todos los usuarios del User Pool y sus grupos
    """
    try:
        client = boto3.client('cognito-idp', region_name=REGION)
        
        print("\n" + "="*60)
        print("  USUARIOS EN COGNITO USER POOL")
        print("="*60)
        
        # Listar usuarios
        response = client.list_users(
            UserPoolId=USER_POOL_ID,
            Limit=60
        )
        
        users = response.get('Users', [])
        
        if not users:
            print("\n⚠️  No se encontraron usuarios")
            return
        
        print(f"\n📊 Total de usuarios: {len(users)}\n")
        
        for i, user in enumerate(users, 1):
            username = user['Username']
            
            # Obtener atributos
            email = None
            email_verified = False
            for attr in user.get('Attributes', []):
                if attr['Name'] == 'email':
                    email = attr['Value']
                elif attr['Name'] == 'email_verified':
                    email_verified = attr['Value'] == 'true'
            
            # Obtener grupos del usuario
            try:
                groups_response = client.admin_list_groups_for_user(
                    Username=username,
                    UserPoolId=USER_POOL_ID
                )
                groups = [g['GroupName'] for g in groups_response.get('Groups', [])]
            except:
                groups = []
            
            # Mostrar información
            print(f"{i}. Usuario: {username}")
            print(f"   Email: {email or 'N/A'}")
            print(f"   Email verificado: {'✅' if email_verified else '❌'}")
            print(f"   Estado: {user.get('UserStatus', 'N/A')}")
            print(f"   Grupos: {', '.join(groups) if groups else 'Sin grupos'}")
            
            # Destacar si tiene global_admin
            if 'global_admin' in groups:
                print(f"   🌟 ADMIN GLOBAL")
            
            print()
        
        # Buscar usuarios con global_admin
        admin_users = [u for u in users if any(
            g['GroupName'] == 'global_admin' 
            for g in client.admin_list_groups_for_user(
                Username=u['Username'],
                UserPoolId=USER_POOL_ID
            ).get('Groups', [])
        )]
        
        if admin_users:
            print("="*60)
            print(f"  USUARIOS CON GRUPO global_admin: {len(admin_users)}")
            print("="*60)
            for user in admin_users:
                username = user['Username']
                email = next((a['Value'] for a in user.get('Attributes', []) if a['Name'] == 'email'), 'N/A')
                print(f"  - {username} ({email})")
        
        print("\n" + "="*60)
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    list_users()