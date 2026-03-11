#!/usr/bin/env python3
"""Deploy Lambda rápido"""
import subprocess
import os

os.chdir('lambda-auth-login')

# Crear ZIP
print("📦 Empaquetando...")
subprocess.run(['powershell', 'Compress-Archive', '-Path', 'lambda_handler.py,cognito_service.py', '-DestinationPath', 'lambda-auth-login.zip', '-Force'], check=True)

# Actualizar Lambda
print("🚀 Desplegando...")
result = subprocess.run([
    'aws', 'lambda', 'update-function-code',
    '--function-name', 'lambda-auth-login',
    '--zip-file', 'fileb://lambda-auth-login.zip',
    '--region', 'eu-west-1'
], capture_output=True, text=True)

print(result.stdout)
if result.returncode == 0:
    print("✅ Lambda actualizada!")
else:
    print(f"❌ Error: {result.stderr}")