# Script de despliegue para Lambda Login Service
# Despliega la función Lambda de autenticación a AWS

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DESPLIEGUE LAMBDA LOGIN SERVICE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Configuración
$FUNCTION_NAME = "lambda-auth-login"
$REGION = "eu-west-1"
$RUNTIME = "python3.11"
$HANDLER = "lambda_handler.lambda_handler"
$ROLE_NAME = "lambda-auth-login-role"
$ZIP_FILE = "lambda-auth-login.zip"

# Variables de entorno
$USER_POOL_ID = "eu-west-1_zrEOVk483"  # IdentityManagementUserPool
$CLIENT_ID = "1kp54ebtb2npa4eukpbp1tn1ff"  # IdentityManagementAppClient

Write-Host "📦 Paso 1: Creando paquete de despliegue..." -ForegroundColor Yellow

# Limpiar archivos anteriores
if (Test-Path $ZIP_FILE) {
    Remove-Item $ZIP_FILE
    Write-Host "   ✓ Archivo ZIP anterior eliminado" -ForegroundColor Green
}

# Crear directorio temporal
$TEMP_DIR = "temp_package"
if (Test-Path $TEMP_DIR) {
    Remove-Item -Recurse -Force $TEMP_DIR
}
New-Item -ItemType Directory -Path $TEMP_DIR | Out-Null

# Copiar archivos de la Lambda
Copy-Item "lambda_handler.py" -Destination $TEMP_DIR
Copy-Item "cognito_service.py" -Destination $TEMP_DIR
Write-Host "   ✓ Archivos Python copiados" -ForegroundColor Green

# Instalar dependencias
Write-Host "   📥 Instalando dependencias..." -ForegroundColor Yellow
pip install boto3 -t $TEMP_DIR --quiet
Write-Host "   ✓ Dependencias instaladas" -ForegroundColor Green

# Crear ZIP
Write-Host "   📦 Creando archivo ZIP..." -ForegroundColor Yellow
Push-Location $TEMP_DIR
Compress-Archive -Path * -DestinationPath "..\$ZIP_FILE" -Force
Pop-Location
Write-Host "   ✓ Paquete creado: $ZIP_FILE" -ForegroundColor Green

# Limpiar directorio temporal
Remove-Item -Recurse -Force $TEMP_DIR
Write-Host "   ✓ Archivos temporales eliminados" -ForegroundColor Green

Write-Host ""
Write-Host "🔍 Paso 2: Verificando si la función Lambda existe..." -ForegroundColor Yellow

$functionExists = $false
try {
    aws lambda get-function --function-name $FUNCTION_NAME --region $REGION 2>$null
    if ($LASTEXITCODE -eq 0) {
        $functionExists = $true
        Write-Host "   ✓ Función Lambda encontrada" -ForegroundColor Green
    }
} catch {
    Write-Host "   ℹ Función Lambda no existe, se creará" -ForegroundColor Cyan
}

if ($functionExists) {
    Write-Host ""
    Write-Host "🔄 Paso 3: Actualizando código de la función..." -ForegroundColor Yellow
    
    aws lambda update-function-code `
        --function-name $FUNCTION_NAME `
        --zip-file "fileb://$ZIP_FILE" `
        --region $REGION
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✓ Código actualizado exitosamente" -ForegroundColor Green
    } else {
        Write-Host "   ✗ Error al actualizar el código" -ForegroundColor Red
        exit 1
    }
    
    Write-Host ""
    Write-Host "⚙️  Paso 4: Actualizando variables de entorno..." -ForegroundColor Yellow
    
    aws lambda update-function-configuration `
        --function-name $FUNCTION_NAME `
        --environment "Variables={USER_POOL_ID=$USER_POOL_ID,CLIENT_ID=$CLIENT_ID,REGION=$REGION}" `
        --region $REGION
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✓ Variables de entorno actualizadas" -ForegroundColor Green
    } else {
        Write-Host "   ✗ Error al actualizar variables de entorno" -ForegroundColor Red
        exit 1
    }
    
} else {
    Write-Host ""
    Write-Host "🔐 Paso 3: Verificando rol IAM..." -ForegroundColor Yellow
    
    $roleArn = aws iam get-role --role-name $ROLE_NAME --query 'Role.Arn' --output text 2>$null
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ℹ Rol no existe, creando..." -ForegroundColor Cyan
        
        # Crear trust policy
        $trustPolicy = @"
{
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
}
"@
        
        $trustPolicy | Out-File -FilePath "trust-policy.json" -Encoding utf8
        
        # Crear rol
        $roleArn = aws iam create-role `
            --role-name $ROLE_NAME `
            --assume-role-policy-document file://trust-policy.json `
            --query 'Role.Arn' `
            --output text
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✓ Rol IAM creado: $roleArn" -ForegroundColor Green
        } else {
            Write-Host "   ✗ Error al crear rol IAM" -ForegroundColor Red
            exit 1
        }
        
        # Adjuntar políticas
        Write-Host "   📎 Adjuntando políticas..." -ForegroundColor Yellow
        
        aws iam attach-role-policy `
            --role-name $ROLE_NAME `
            --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
        
        aws iam attach-role-policy `
            --role-name $ROLE_NAME `
            --policy-arn "arn:aws:iam::aws:policy/AmazonCognitoPowerUser"
        
        Write-Host "   ✓ Políticas adjuntadas" -ForegroundColor Green
        
        # Esperar a que el rol se propague
        Write-Host "   ⏳ Esperando propagación del rol (10 segundos)..." -ForegroundColor Yellow
        Start-Sleep -Seconds 10
        
        Remove-Item "trust-policy.json"
    } else {
        Write-Host "   ✓ Rol IAM encontrado: $roleArn" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "🚀 Paso 4: Creando función Lambda..." -ForegroundColor Yellow
    
    aws lambda create-function `
        --function-name $FUNCTION_NAME `
        --runtime $RUNTIME `
        --role $roleArn `
        --handler $HANDLER `
        --zip-file "fileb://$ZIP_FILE" `
        --timeout 30 `
        --memory-size 256 `
        --environment "Variables={USER_POOL_ID=$USER_POOL_ID,CLIENT_ID=$CLIENT_ID,REGION=$REGION}" `
        --region $REGION
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✓ Función Lambda creada exitosamente" -ForegroundColor Green
    } else {
        Write-Host "   ✗ Error al crear función Lambda" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "✅ Paso 5: Verificando despliegue..." -ForegroundColor Yellow

$functionInfo = aws lambda get-function --function-name $FUNCTION_NAME --region $REGION --output json | ConvertFrom-Json

if ($functionInfo) {
    Write-Host "   ✓ Función desplegada correctamente" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 INFORMACIÓN DE LA FUNCIÓN:" -ForegroundColor Cyan
    Write-Host "   Nombre: $($functionInfo.Configuration.FunctionName)" -ForegroundColor White
    Write-Host "   ARN: $($functionInfo.Configuration.FunctionArn)" -ForegroundColor White
    Write-Host "   Runtime: $($functionInfo.Configuration.Runtime)" -ForegroundColor White
    Write-Host "   Handler: $($functionInfo.Configuration.Handler)" -ForegroundColor White
    Write-Host "   Timeout: $($functionInfo.Configuration.Timeout)s" -ForegroundColor White
    Write-Host "   Memory: $($functionInfo.Configuration.MemorySize)MB" -ForegroundColor White
    Write-Host "   Last Modified: $($functionInfo.Configuration.LastModified)" -ForegroundColor White
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ✅ DESPLIEGUE COMPLETADO" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 PRÓXIMOS PASOS:" -ForegroundColor Yellow
Write-Host "   1. Probar la función con: aws lambda invoke --function-name $FUNCTION_NAME --payload file://test-payload.json response.json" -ForegroundColor White
Write-Host "   2. Verificar logs en CloudWatch" -ForegroundColor White
Write-Host "   3. Configurar API Gateway (opcional)" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  IMPORTANTE:" -ForegroundColor Yellow
Write-Host "   Asegúrate de haber configurado USER_POOL_ID y CLIENT_ID correctamente en este script" -ForegroundColor White
Write-Host ""