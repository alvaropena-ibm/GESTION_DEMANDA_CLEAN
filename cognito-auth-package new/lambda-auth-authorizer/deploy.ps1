#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Script de despliegue para Lambda Authorizer
    
.DESCRIPTION
    Empaqueta y despliega la Lambda Authorizer en AWS
    
.EXAMPLE
    .\deploy.ps1
#>

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  DESPLIEGUE DE LAMBDA AUTHORIZER" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Configuración
$FUNCTION_NAME = "identity-management-authorizer"
$RUNTIME = "python3.11"
$HANDLER = "lambda_handler.lambda_handler"
$TIMEOUT = 30
$MEMORY = 256
$REGION = "eu-west-1"

# Variables de entorno de Cognito
$USER_POOL_ID = "eu-west-1_zrEOVk483"
$APP_CLIENT_ID = "1kp54ebtb2npa4eukpbp1tn1ff"

Write-Host "📋 Configuración:" -ForegroundColor Yellow
Write-Host "   Función: $FUNCTION_NAME"
Write-Host "   Runtime: $RUNTIME"
Write-Host "   Handler: $HANDLER"
Write-Host "   Región: $REGION"
Write-Host "   User Pool: $USER_POOL_ID"
Write-Host ""

# Paso 1: Limpiar directorio anterior
Write-Host "🧹 Paso 1: Limpiando archivos anteriores..." -ForegroundColor Yellow
if (Test-Path "package") {
    Remove-Item -Recurse -Force package
    Write-Host "   ✅ Directorio package eliminado" -ForegroundColor Green
}
if (Test-Path "lambda-authorizer.zip") {
    Remove-Item -Force lambda-authorizer.zip
    Write-Host "   ✅ ZIP anterior eliminado" -ForegroundColor Green
}
Write-Host ""

# Paso 2: Crear directorio de empaquetado
Write-Host "📦 Paso 2: Creando directorio de empaquetado..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path package | Out-Null
Write-Host "   ✅ Directorio package creado" -ForegroundColor Green
Write-Host ""

# Paso 3: Instalar dependencias
Write-Host "📚 Paso 3: Instalando dependencias..." -ForegroundColor Yellow
Write-Host "   Instalando pyjwt, requests, cryptography..." -ForegroundColor Gray
pip install --quiet --target package pyjwt requests cryptography
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Dependencias instaladas" -ForegroundColor Green
} else {
    Write-Host "   ❌ Error instalando dependencias" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Paso 4: Copiar archivos de código
Write-Host "📄 Paso 4: Copiando archivos de código..." -ForegroundColor Yellow
$files = @(
    "lambda_handler.py",
    "token_validator.py",
    "access_checker.py",
    "policy_generator.py",
    "app_config.py"
)

foreach ($file in $files) {
    Copy-Item $file package/
    Write-Host "   ✅ Copiado: $file" -ForegroundColor Green
}
Write-Host ""

# Paso 5: Crear archivo ZIP
Write-Host "🗜️  Paso 5: Creando archivo ZIP..." -ForegroundColor Yellow
Push-Location package
if (Get-Command Compress-Archive -ErrorAction SilentlyContinue) {
    # Usar Compress-Archive de PowerShell
    Get-ChildItem -Recurse | Compress-Archive -DestinationPath ../lambda-authorizer.zip -Force
} else {
    # Usar 7-Zip si está disponible
    if (Get-Command 7z -ErrorAction SilentlyContinue) {
        7z a -tzip ../lambda-authorizer.zip * -r
    } else {
        Write-Host "   ⚠️  No se encontró Compress-Archive ni 7-Zip" -ForegroundColor Yellow
        Write-Host "   Usando método alternativo..." -ForegroundColor Yellow
        # Método alternativo usando .NET
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        [System.IO.Compression.ZipFile]::CreateFromDirectory($PWD, "$PWD\..\lambda-authorizer.zip")
    }
}
Pop-Location

if (Test-Path "lambda-authorizer.zip") {
    $zipSize = (Get-Item "lambda-authorizer.zip").Length / 1MB
    Write-Host "   ✅ ZIP creado: $([math]::Round($zipSize, 2)) MB" -ForegroundColor Green
} else {
    Write-Host "   ❌ Error creando ZIP" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Paso 6: Verificar si la función ya existe
Write-Host "🔍 Paso 6: Verificando si la función existe..." -ForegroundColor Yellow
$functionExists = $false
try {
    aws lambda get-function --function-name $FUNCTION_NAME --region $REGION 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
        $functionExists = $true
        Write-Host "   ℹ️  La función ya existe, se actualizará" -ForegroundColor Cyan
    }
} catch {
    Write-Host "   ℹ️  La función no existe, se creará" -ForegroundColor Cyan
}
Write-Host ""

# Paso 7: Crear o actualizar la función
if ($functionExists) {
    Write-Host "🔄 Paso 7: Actualizando código de la función..." -ForegroundColor Yellow
    aws lambda update-function-code `
        --function-name $FUNCTION_NAME `
        --zip-file fileb://lambda-authorizer.zip `
        --region $REGION
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Código actualizado" -ForegroundColor Green
        
        Write-Host ""
        Write-Host "🔧 Actualizando configuración..." -ForegroundColor Yellow
        aws lambda update-function-configuration `
            --function-name $FUNCTION_NAME `
            --timeout $TIMEOUT `
            --memory-size $MEMORY `
            --environment "Variables={AWS_REGION=$REGION,USER_POOL_ID=$USER_POOL_ID,APP_CLIENT_ID=$APP_CLIENT_ID}" `
            --region $REGION
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ Configuración actualizada" -ForegroundColor Green
        }
    } else {
        Write-Host "   ❌ Error actualizando función" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "🚀 Paso 7: Creando función Lambda..." -ForegroundColor Yellow
    Write-Host "   ⚠️  NOTA: Necesitas especificar el ARN del rol IAM" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   Ejecuta manualmente:" -ForegroundColor Cyan
    Write-Host '   aws lambda create-function \' -ForegroundColor Gray
    Write-Host "     --function-name $FUNCTION_NAME \" -ForegroundColor Gray
    Write-Host "     --runtime $RUNTIME \" -ForegroundColor Gray
    Write-Host '     --role arn:aws:iam::ACCOUNT_ID:role/lambda-execution-role \' -ForegroundColor Gray
    Write-Host "     --handler $HANDLER \" -ForegroundColor Gray
    Write-Host '     --zip-file fileb://lambda-authorizer.zip \' -ForegroundColor Gray
    Write-Host "     --timeout $TIMEOUT \" -ForegroundColor Gray
    Write-Host "     --memory-size $MEMORY \" -ForegroundColor Gray
    Write-Host "     --environment Variables={AWS_REGION=$REGION,USER_POOL_ID=$USER_POOL_ID,APP_CLIENT_ID=$APP_CLIENT_ID} \" -ForegroundColor Gray
    Write-Host "     --region $REGION" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   Reemplaza ACCOUNT_ID con tu ID de cuenta de AWS" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  ✅ DESPLIEGUE COMPLETADO" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 Próximos pasos:" -ForegroundColor Yellow
Write-Host "   1. Verificar la función en AWS Console" -ForegroundColor White
Write-Host "   2. Configurar Lambda Authorizer en API Gateway" -ForegroundColor White
Write-Host "   3. Asociar el authorizer a las rutas protegidas" -ForegroundColor White
Write-Host ""
Write-Host "🔗 Recursos creados:" -ForegroundColor Yellow
Write-Host "   - Función Lambda: $FUNCTION_NAME" -ForegroundColor White
Write-Host "   - Región: $REGION" -ForegroundColor White
Write-Host "   - Runtime: $RUNTIME" -ForegroundColor White
Write-Host ""