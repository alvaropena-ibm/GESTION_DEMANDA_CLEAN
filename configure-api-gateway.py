#!/usr/bin/env python3
"""
Script para configurar API Gateway con autenticación Cognito
Configura el endpoint /auth/login y el Lambda Authorizer
"""
import subprocess
import json
import sys

def run_cmd(cmd):
    """Ejecuta comando y retorna resultado"""
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"❌ Error: {e.stderr}")
        return None

def get_account_id():
    """Obtiene Account ID"""
    output = run_cmd(['aws', 'sts', 'get-caller-identity', '--query', 'Account', '--output', 'text'])
    return output

def list_apis():
    """Lista APIs disponibles"""
    output = run_cmd(['aws', 'apigateway', 'get-rest-apis', '--region', 'eu-west-1'])
    if output:
        apis = json.loads(output)
        return apis.get('items', [])
    return []

print("=" * 60)
print("  CONFIGURACIÓN DE API GATEWAY PARA COGNITO")
print("=" * 60)
print()

# Obtener Account ID
print("🔍 Obteniendo información de la cuenta...")
account_id = get_account_id()
if not account_id:
    print("❌ No se pudo obtener Account ID")
    sys.exit(1)
print(f"   ✓ Account ID: {account_id}")

# Listar APIs
print("\n📋 APIs disponibles:")
apis = list_apis()
if not apis:
    print("❌ No se encontraron APIs")
    sys.exit(1)

for i, api in enumerate(apis, 1):
    print(f"   {i}. {api['name']} (ID: {api['id']})")

print("\n📝 Selecciona el API a configurar (número):")
selection = input("   > ")

try:
    api_index = int(selection) - 1
    selected_api = apis[api_index]
    api_id = selected_api['id']
    api_name = selected_api['name']
    print(f"\n✓ Seleccionado: {api_name} ({api_id})")
except (ValueError, IndexError):
    print("❌ Selección inválida")
    sys.exit(1)

# Mostrar URL del API
print(f"\n📍 URL del API:")
print(f"   https://{api_id}.execute-api.eu-west-1.amazonaws.com/prod")

# Guardar configuración
config = {
    'api_id': api_id,
    'api_name': api_name,
    'account_id': account_id,
    'region': 'eu-west-1',
    'auth_api_url': f'https://{api_id}.execute-api.eu-west-1.amazonaws.com/prod/auth'
}

with open('api-gateway-config.json', 'w') as f:
    json.dump(config, f, indent=2)

print(f"\n✅ Configuración guardada en api-gateway-config.json")
print(f"\n📝 Actualiza frontend/js/config/data.js con:")
print(f"   AUTH_API_URL: '{config['auth_api_url']}'")
print(f"\n⚠️  IMPORTANTE: Ahora debes configurar manualmente:")
print(f"   1. Crear recurso /auth/login en API Gateway")
print(f"   2. Integrar con Lambda auth-login-service")
print(f"   3. Configurar CORS")
print(f"   4. Crear Lambda Authorizer")
print(f"   5. Aplicar Authorizer a endpoints /api/*")
print(f"\n📖 Ver GUIA_DESPLIEGUE_COGNITO.md para instrucciones detalladas")
