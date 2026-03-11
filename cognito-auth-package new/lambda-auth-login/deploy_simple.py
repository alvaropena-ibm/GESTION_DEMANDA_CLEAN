#!/usr/bin/env python3
"""
Script simple para desplegar Lambda Login Service
"""
import os
import shutil
import subprocess
import sys

# Cambiar al directorio del script
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# Configuración
FUNCTION_NAME = "auth-login-service"
REGION = "eu-west-1"
RUNTIME = "python3.11"
HANDLER = "lambda_handler.lambda_handler"
ROLE_NAME = "lambda-auth-login-role"
ZIP_FILE = "lambda-auth-login.zip"
USER_POOL_ID = "eu-west-1_zrEOVk483"
CLIENT_ID = "1kp54ebtb2npa4eukpbp1tn1ff"

print("=" * 50)
print("  DESPLIEGUE LAMBDA LOGIN SERVICE")
print("=" * 50)
print()

# Paso 1: Crear paquete
print("📦 Paso 1: Creando paquete de despliegue...")
TEMP_DIR = "temp_package"

# Limpiar archivos anteriores
if os.path.exists(ZIP_FILE):
    os.remove(ZIP_FILE)
    print("   ✓ Archivo ZIP anterior eliminado")

if os.path.exists(TEMP_DIR):
    shutil.rmtree(TEMP_DIR)

os.makedirs(TEMP_DIR)

# Copiar archivos
shutil.copy("lambda_handler.py", TEMP_DIR)
shutil.copy("cognito_service.py", TEMP_DIR)
print("   ✓ Archivos Python copiados")

# Instalar dependencias
print("   📥 Instalando dependencias...")
subprocess.run([sys.executable, "-m", "pip", "install", "boto3", "-t", TEMP_DIR, "--quiet"], check=True)
print("   ✓ Dependencias instaladas")

# Crear ZIP
print("   📦 Creando archivo ZIP...")
shutil.make_archive(ZIP_FILE.replace('.zip', ''), 'zip', TEMP_DIR)
print(f"   ✓ Paquete creado: {ZIP_FILE}")

# Limpiar directorio temporal
shutil.rmtree(TEMP_DIR)
print("   ✓ Archivos temporales eliminados")

print()
print("🔍 Paso 2: Verificando si la función Lambda existe...")

# Verificar si existe
result = subprocess.run(
    ["aws", "lambda", "get-function", "--function-name", FUNCTION_NAME, "--region", REGION],
    capture_output=True
)

function_exists = result.returncode == 0

if function_exists:
    print("   ✓ Función Lambda encontrada")
    print()
    print("🔄 Paso 3: Actualizando código de la función...")
    
    subprocess.run([
        "aws", "lambda", "update-function-code",
        "--function-name", FUNCTION_NAME,
        "--zip-file", f"fileb://{ZIP_FILE}",
        "--region", REGION
    ], check=True)
    print("   ✓ Código actualizado exitosamente")
    
    print()
    print("⚙️  Paso 4: Actualizando variables de entorno...")
    
    subprocess.run([
        "aws", "lambda", "update-function-configuration",
        "--function-name", FUNCTION_NAME,
        "--environment", f"Variables={{USER_POOL_ID={USER_POOL_ID},CLIENT_ID={CLIENT_ID},REGION={REGION}}}",
        "--region", REGION
    ], check=True)
    print("   ✓ Variables de entorno actualizadas")
    
else:
    print("   ℹ Función Lambda no existe, se creará")
    print()
    print("🔐 Paso 3: Verificando rol IAM...")
    
    # Verificar rol
    result = subprocess.run(
        ["aws", "iam", "get-role", "--role-name", ROLE_NAME],
        capture_output=True
    )
    
    if result.returncode != 0:
        print("   ℹ Rol no existe, creando...")
        
        # Crear trust policy
        trust_policy = '''{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}'''
        
        with open("trust-policy.json", "w") as f:
            f.write(trust_policy)
        
        # Crear rol
        result = subprocess.run([
            "aws", "iam", "create-role",
            "--role-name", ROLE_NAME,
            "--assume-role-policy-document", "file://trust-policy.json"
        ], capture_output=True, text=True, check=True)
        
        print("   ✓ Rol IAM creado")
        
        # Adjuntar políticas
        print("   📎 Adjuntando políticas...")
        
        subprocess.run([
            "aws", "iam", "attach-role-policy",
            "--role-name", ROLE_NAME,
            "--policy-arn", "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
        ], check=True)
        
        subprocess.run([
            "aws", "iam", "attach-role-policy",
            "--role-name", ROLE_NAME,
            "--policy-arn", "arn:aws:iam::aws:policy/AmazonCognitoPowerUser"
        ], check=True)
        
        print("   ✓ Políticas adjuntadas")
        
        # Esperar propagación
        print("   ⏳ Esperando propagación del rol (10 segundos)...")
        import time
        time.sleep(10)
        
        os.remove("trust-policy.json")
        
        # Obtener ARN del rol
        result = subprocess.run([
            "aws", "iam", "get-role",
            "--role-name", ROLE_NAME,
            "--query", "Role.Arn",
            "--output", "text"
        ], capture_output=True, text=True, check=True)
        role_arn = result.stdout.strip()
    else:
        print("   ✓ Rol IAM encontrado")
        result = subprocess.run([
            "aws", "iam", "get-role",
            "--role-name", ROLE_NAME,
            "--query", "Role.Arn",
            "--output", "text"
        ], capture_output=True, text=True, check=True)
        role_arn = result.stdout.strip()
    
    print()
    print("🚀 Paso 4: Creando función Lambda...")
    
    subprocess.run([
        "aws", "lambda", "create-function",
        "--function-name", FUNCTION_NAME,
        "--runtime", RUNTIME,
        "--role", role_arn,
        "--handler", HANDLER,
        "--zip-file", f"fileb://{ZIP_FILE}",
        "--timeout", "30",
        "--memory-size", "256",
        "--environment", f"Variables={{USER_POOL_ID={USER_POOL_ID},CLIENT_ID={CLIENT_ID},REGION={REGION}}}",
        "--region", REGION
    ], check=True)
    
    print("   ✓ Función Lambda creada exitosamente")

print()
print("✅ Paso 5: Verificando despliegue...")

result = subprocess.run([
    "aws", "lambda", "get-function",
    "--function-name", FUNCTION_NAME,
    "--region", REGION,
    "--output", "json"
], capture_output=True, text=True, check=True)

print("   ✓ Función desplegada correctamente")
print()
print("=" * 50)
print("  ✅ DESPLIEGUE COMPLETADO")
print("=" * 50)
print()
print("📝 PRÓXIMOS PASOS:")
print(f"   1. Probar la función con: aws lambda invoke --function-name {FUNCTION_NAME} --payload file://test-payload.json response.json")
print("   2. Verificar logs en CloudWatch")
print("   3. Configurar API Gateway (opcional)")
print()