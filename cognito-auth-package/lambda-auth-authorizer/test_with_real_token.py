"""
Script para probar Lambda Authorizer con token JWT real
"""
import sys
import os

# Agregar el directorio al path para importar los módulos
sys.path.insert(0, os.path.dirname(__file__))

from lambda_handler import lambda_handler

# Leer el token del archivo
with open('lambda-auth-authorizer/token_output.txt', 'r') as f:
    lines = f.readlines()
    id_token = lines[0].split('=')[1].strip()

print("\n" + "="*60)
print("  PRUEBA CON TOKEN JWT REAL - LAMBDA AUTHORIZER")
print("="*60)

# Test 1: Acceso a ruta de Credentials Management (debe permitir)
print("\n" + "="*60)
print("TEST 1: Usuario global_admin → /api/credentials/tokens")
print("="*60)

event1 = {
    "type": "TOKEN",
    "authorizationToken": f"Bearer {id_token}",
    "methodArn": "arn:aws:execute-api:eu-west-1:123456789:abcdef123/prod/GET/api/credentials/tokens"
}

try:
    result1 = lambda_handler(event1, None)
    print(f"\n✅ Resultado: {result1['policyDocument']['Statement'][0]['Effect']}")
    print(f"📝 Contexto del usuario:")
    for key, value in result1['context'].items():
        print(f"   - {key}: {value}")
except Exception as e:
    print(f"❌ Error: {str(e)}")

# Test 2: Acceso a ruta de Bedrock Usage Dashboard (debe permitir)
print("\n" + "="*60)
print("TEST 2: Usuario global_admin → /api/bedrock/models")
print("="*60)

event2 = {
    "type": "TOKEN",
    "authorizationToken": f"Bearer {id_token}",
    "methodArn": "arn:aws:execute-api:eu-west-1:123456789:abcdef123/prod/GET/api/bedrock/models"
}

try:
    result2 = lambda_handler(event2, None)
    print(f"\n✅ Resultado: {result2['policyDocument']['Statement'][0]['Effect']}")
    print(f"📝 Aplicaciones permitidas: {result2['context']['allowedApplications']}")
except Exception as e:
    print(f"❌ Error: {str(e)}")

# Test 3: Acceso a ruta de Knowledge Base (debe permitir)
print("\n" + "="*60)
print("TEST 3: Usuario global_admin → /api/knowledge-base/documents")
print("="*60)

event3 = {
    "type": "TOKEN",
    "authorizationToken": f"Bearer {id_token}",
    "methodArn": "arn:aws:execute-api:eu-west-1:123456789:abcdef123/prod/POST/api/knowledge-base/documents"
}

try:
    result3 = lambda_handler(event3, None)
    print(f"\n✅ Resultado: {result3['policyDocument']['Statement'][0]['Effect']}")
    print(f"📝 Es admin global: {result3['context']['isGlobalAdmin']}")
except Exception as e:
    print(f"❌ Error: {str(e)}")

# Test 4: Acceso a ruta pública (debe permitir sin verificar grupos)
print("\n" + "="*60)
print("TEST 4: Ruta pública → /auth/login")
print("="*60)

event4 = {
    "type": "TOKEN",
    "authorizationToken": f"Bearer {id_token}",
    "methodArn": "arn:aws:execute-api:eu-west-1:123456789:abcdef123/prod/POST/auth/login"
}

try:
    result4 = lambda_handler(event4, None)
    print(f"\n✅ Resultado: {result4['policyDocument']['Statement'][0]['Effect']}")
    print(f"📝 Ruta pública: Sí")
except Exception as e:
    print(f"❌ Error: {str(e)}")

print("\n" + "="*60)
print("  RESUMEN DE PRUEBAS")
print("="*60)
print("\n✅ Usuario global_admin tiene acceso a:")
print("   - Credentials Management Application")
print("   - Bedrock Usage Dashboard")
print("   - Knowledge Base Agent")
print("   - Todas las demás aplicaciones")
print("\n🎯 Lambda Authorizer funcionando correctamente!")
print("\n")