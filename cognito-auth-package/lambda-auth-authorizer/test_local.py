"""
Script de prueba local para Lambda Authorizer
Simula eventos de API Gateway y prueba la validación
"""
import json
import sys
import os

# Agregar el directorio actual al path para importar los módulos
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lambda_handler import lambda_handler


def test_without_token():
    """
    Test sin token - debe devolver Unauthorized
    """
    print("\n" + "="*60)
    print("TEST 1: Sin token (debe devolver Unauthorized)")
    print("="*60)
    
    event = {
        'type': 'TOKEN',
        'authorizationToken': '',
        'methodArn': 'arn:aws:execute-api:eu-west-1:123456789:abcdef123/prod/GET/api/users'
    }
    
    try:
        result = lambda_handler(event, None)
        print(f"✅ Resultado: {result}")
    except Exception as e:
        print(f"❌ Error: {str(e)}")


def test_with_invalid_token():
    """
    Test con token inválido - debe devolver Unauthorized
    """
    print("\n" + "="*60)
    print("TEST 2: Token inválido (debe devolver Unauthorized)")
    print("="*60)
    
    event = {
        'type': 'TOKEN',
        'authorizationToken': 'Bearer invalid_token_here',
        'methodArn': 'arn:aws:execute-api:eu-west-1:123456789:abcdef123/prod/GET/api/users'
    }
    
    try:
        result = lambda_handler(event, None)
        print(f"✅ Resultado: {result}")
    except Exception as e:
        print(f"❌ Error: {str(e)}")


def test_with_real_token():
    """
    Test con token JWT real de Cognito
    NOTA: Debes reemplazar el token con uno real obtenido del login
    """
    print("\n" + "="*60)
    print("TEST 3: Token JWT real de Cognito")
    print("="*60)
    print("⚠️  Para este test necesitas un token JWT real")
    print("   Obtén uno haciendo login en la Lambda Login")
    print("   y reemplaza el valor de 'real_token' abajo")
    print("="*60)
    
    # REEMPLAZA ESTE TOKEN CON UNO REAL
    real_token = "REEMPLAZAR_CON_TOKEN_REAL"
    
    if real_token == "REEMPLAZAR_CON_TOKEN_REAL":
        print("⏭️  Saltando test - token no configurado")
        return
    
    event = {
        'type': 'TOKEN',
        'authorizationToken': f'Bearer {real_token}',
        'methodArn': 'arn:aws:execute-api:eu-west-1:123456789:abcdef123/prod/GET/api/users'
    }
    
    try:
        result = lambda_handler(event, None)
        print(f"✅ Resultado:")
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(f"❌ Error: {str(e)}")


def test_config():
    """
    Test de configuración - verifica que los módulos se importen correctamente
    """
    print("\n" + "="*60)
    print("TEST 0: Verificación de configuración")
    print("="*60)
    
    try:
        from app_config import GROUP_TO_APPS, APP_TO_ROUTES, PUBLIC_ROUTES
        print("✅ app_config importado correctamente")
        print(f"   - Grupos configurados: {len(GROUP_TO_APPS)}")
        print(f"   - Aplicaciones configuradas: {len(APP_TO_ROUTES)}")
        print(f"   - Rutas públicas: {len(PUBLIC_ROUTES)}")
        
        from token_validator import TokenValidator
        print("✅ TokenValidator importado correctamente")
        
        from access_checker import AccessChecker
        print("✅ AccessChecker importado correctamente")
        
        from policy_generator import PolicyGenerator
        print("✅ PolicyGenerator importado correctamente")
        
        print("\n✅ Todos los módulos se importaron correctamente")
        return True
    except Exception as e:
        print(f"❌ Error importando módulos: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """
    Ejecuta todos los tests
    """
    print("\n" + "="*60)
    print("  PRUEBAS LOCALES - LAMBDA AUTHORIZER")
    print("="*60)
    
    # Test de configuración primero
    if not test_config():
        print("\n❌ Error en la configuración. Corrige los errores antes de continuar.")
        return
    
    # Tests funcionales
    test_without_token()
    test_with_invalid_token()
    test_with_real_token()
    
    print("\n" + "="*60)
    print("  PRUEBAS COMPLETADAS")
    print("="*60)
    print("\n📝 NOTAS:")
    print("   - Para probar con un token real, obtén uno del endpoint /auth/login")
    print("   - Reemplaza 'REEMPLAZAR_CON_TOKEN_REAL' en test_with_real_token()")
    print("   - El token debe ser de un usuario con grupos en Cognito")
    print("\n")


if __name__ == '__main__':
    main()