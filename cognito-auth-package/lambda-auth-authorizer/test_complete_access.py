"""
Test Exhaustivo de Acceso para Usuario global_admin
Verifica acceso a TODAS las rutas de TODAS las aplicaciones
"""
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from lambda_handler import lambda_handler

# Leer el token del archivo
with open('lambda-auth-authorizer/token_output.txt', 'r') as f:
    lines = f.readlines()
    id_token = lines[0].split('=')[1].strip()

print("\n" + "="*70)
print("  TEST EXHAUSTIVO - USUARIO global_admin")
print("  Verificando acceso a TODAS las rutas de TODAS las aplicaciones")
print("="*70)

# Definir TODAS las rutas de TODAS las aplicaciones
test_routes = {
    "Credentials Management Application": [
        ("GET", "/api/users"),
        ("POST", "/api/users"),
        ("GET", "/api/users/123"),
        ("PUT", "/api/users/123"),
        ("DELETE", "/api/users/123"),
        ("GET", "/api/credentials/tokens"),
        ("POST", "/api/credentials/tokens"),
        ("DELETE", "/api/credentials/tokens/123"),
        ("GET", "/api/credentials/access-keys"),
        ("POST", "/api/credentials/access-keys"),
        ("DELETE", "/api/credentials/access-keys/123"),
        ("GET", "/api/credentials/bedrock-api-keys"),
        ("POST", "/api/credentials/bedrock-api-keys"),
        ("PUT", "/api/credentials/bedrock-api-keys/123"),
        ("DELETE", "/api/credentials/bedrock-api-keys/123"),
        ("GET", "/api/applications"),
        ("POST", "/api/applications"),
        ("GET", "/api/applications/123"),
        ("PUT", "/api/applications/123"),
        ("DELETE", "/api/applications/123"),
        ("GET", "/api/permissions"),
        ("POST", "/api/permissions"),
        ("GET", "/api/permissions/user/test@example.com"),
        ("PUT", "/api/permissions/user/test@example.com"),
        ("DELETE", "/api/permissions/user/test@example.com"),
        ("GET", "/api/audit"),
        ("GET", "/api/audit/logs"),
        ("GET", "/api/notifications"),
        ("POST", "/api/notifications"),
        ("PUT", "/api/notifications/123"),
        ("DELETE", "/api/notifications/123"),
    ],
    "Bedrock Usage Dashboard": [
        ("GET", "/api/bedrock/models"),
        ("POST", "/api/bedrock/models"),
        ("GET", "/api/bedrock/models/123"),
        ("PUT", "/api/bedrock/models/123"),
        ("DELETE", "/api/bedrock/models/123"),
        ("GET", "/api/bedrock/usage"),
        ("GET", "/api/bedrock/usage/summary"),
        ("GET", "/api/bedrock/usage/by-model"),
        ("GET", "/api/bedrock/usage/by-user"),
        ("GET", "/api/bedrock/metrics"),
        ("GET", "/api/bedrock/metrics/tokens"),
        ("GET", "/api/bedrock/metrics/costs"),
        ("POST", "/api/bedrock/invoke"),
    ],
    "Knowledge Base Agent - Chat": [
        ("GET", "/api/knowledge-base/chat"),
        ("POST", "/api/knowledge-base/chat"),
        ("GET", "/api/knowledge-base/chat/history"),
        ("DELETE", "/api/knowledge-base/chat/123"),
    ],
    "Knowledge Base Agent - Document Management": [
        ("GET", "/api/knowledge-base/documents"),
        ("POST", "/api/knowledge-base/documents"),
        ("GET", "/api/knowledge-base/documents/123"),
        ("PUT", "/api/knowledge-base/documents/123"),
        ("DELETE", "/api/knowledge-base/documents/123"),
        ("POST", "/api/knowledge-base/documents/upload"),
        ("GET", "/api/knowledge-base/documents/search"),
    ],
    "Knowledge Base Usage Dashboard": [
        ("GET", "/api/knowledge-base/usage"),
        ("GET", "/api/knowledge-base/usage/summary"),
        ("GET", "/api/knowledge-base/usage/by-user"),
        ("GET", "/api/knowledge-base/metrics"),
        ("GET", "/api/knowledge-base/metrics/queries"),
        ("GET", "/api/knowledge-base/metrics/documents"),
    ],
    "SAP NewCo Batch Monitoring": [
        ("GET", "/api/sap/batch"),
        ("GET", "/api/sap/batch/jobs"),
        ("GET", "/api/sap/batch/jobs/123"),
        ("POST", "/api/sap/batch/jobs"),
        ("PUT", "/api/sap/batch/jobs/123"),
        ("DELETE", "/api/sap/batch/jobs/123"),
        ("GET", "/api/sap/monitoring"),
        ("GET", "/api/sap/monitoring/status"),
        ("GET", "/api/sap/monitoring/alerts"),
    ],
    "Test Planning Agent": [
        ("GET", "/api/test-planning"),
        ("POST", "/api/test-planning"),
        ("GET", "/api/test-planning/plans"),
        ("GET", "/api/test-planning/plans/123"),
        ("PUT", "/api/test-planning/plans/123"),
        ("DELETE", "/api/test-planning/plans/123"),
        ("POST", "/api/test-planning/generate"),
    ],
    "Capacity Planning Application": [
        ("GET", "/api/capacity-planning"),
        ("POST", "/api/capacity-planning"),
        ("GET", "/api/capacity-planning/forecasts"),
        ("GET", "/api/capacity-planning/forecasts/123"),
        ("PUT", "/api/capacity-planning/forecasts/123"),
        ("DELETE", "/api/capacity-planning/forecasts/123"),
        ("GET", "/api/capacity-planning/resources"),
        ("POST", "/api/capacity-planning/analyze"),
    ],
}

# Contadores
total_tests = 0
passed_tests = 0
failed_tests = 0
results_by_app = {}

# Ejecutar tests para cada aplicación
for app_name, routes in test_routes.items():
    print(f"\n{'='*70}")
    print(f"  {app_name}")
    print(f"{'='*70}")
    
    app_passed = 0
    app_failed = 0
    failed_routes = []
    
    for method, route in routes:
        total_tests += 1
        
        event = {
            "type": "TOKEN",
            "authorizationToken": f"Bearer {id_token}",
            "methodArn": f"arn:aws:execute-api:eu-west-1:123456789:abcdef123/prod/{method}{route}"
        }
        
        try:
            result = lambda_handler(event, None)
            effect = result['policyDocument']['Statement'][0]['Effect']
            
            if effect == 'Allow':
                app_passed += 1
                passed_tests += 1
                print(f"  ✅ {method:6} {route}")
            else:
                app_failed += 1
                failed_tests += 1
                failed_routes.append((method, route))
                print(f"  ❌ {method:6} {route} - DENEGADO")
        except Exception as e:
            app_failed += 1
            failed_tests += 1
            failed_routes.append((method, route))
            print(f"  ❌ {method:6} {route} - ERROR: {str(e)}")
    
    results_by_app[app_name] = {
        'passed': app_passed,
        'failed': app_failed,
        'total': len(routes),
        'failed_routes': failed_routes
    }
    
    print(f"\n  Resultado: {app_passed}/{len(routes)} rutas permitidas")

# Resumen final
print("\n" + "="*70)
print("  RESUMEN FINAL")
print("="*70)

print(f"\n📊 ESTADÍSTICAS GLOBALES:")
print(f"   Total de rutas probadas: {total_tests}")
print(f"   ✅ Rutas permitidas: {passed_tests}")
print(f"   ❌ Rutas denegadas: {failed_tests}")
print(f"   📈 Tasa de éxito: {(passed_tests/total_tests*100):.1f}%")

print(f"\n📋 RESULTADOS POR APLICACIÓN:")
for app_name, results in results_by_app.items():
    status = "✅" if results['failed'] == 0 else "⚠️"
    print(f"\n{status} {app_name}:")
    print(f"   {results['passed']}/{results['total']} rutas permitidas")
    
    if results['failed_routes']:
        print(f"   ❌ Rutas denegadas:")
        for method, route in results['failed_routes']:
            print(f"      - {method} {route}")

# Verificación final
print("\n" + "="*70)
if failed_tests == 0:
    print("  ✅ ¡ÉXITO TOTAL!")
    print("  Usuario global_admin tiene acceso completo a TODAS las aplicaciones")
    print("="*70)
    exit(0)
else:
    print("  ⚠️ ATENCIÓN: Algunas rutas fueron denegadas")
    print(f"  {failed_tests} de {total_tests} rutas no están accesibles")
    print("="*70)
    exit(1)