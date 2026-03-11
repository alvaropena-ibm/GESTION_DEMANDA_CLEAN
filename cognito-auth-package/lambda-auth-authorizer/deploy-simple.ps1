Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  DESPLIEGUE LAMBDA AUTHORIZER" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$FUNCTION_NAME = "lambda-auth-authorizer"
$REGION = "eu-west-1"

Write-Host "Configuracion:" -ForegroundColor Yellow
Write-Host "  Funcion: $FUNCTION_NAME"
Write-Host "  Region: $REGION"
Write-Host ""

Write-Host "Limpiando..." -ForegroundColor Yellow
if (Test-Path "package") { Remove-Item -Recurse -Force package }
if (Test-Path "lambda-auth-authorizer.zip") { Remove-Item -Force lambda-auth-authorizer.zip }
Write-Host "  OK" -ForegroundColor Green
Write-Host ""

Write-Host "Creando directorio..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path package | Out-Null
Write-Host "  OK" -ForegroundColor Green
Write-Host ""

Write-Host "Instalando dependencias..." -ForegroundColor Yellow
pip install --quiet --target package pyjwt requests cryptography
Write-Host "  OK" -ForegroundColor Green
Write-Host ""

Write-Host "Copiando archivos..." -ForegroundColor Yellow
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Copy-Item "$scriptDir/lambda_handler.py" package/
Copy-Item "$scriptDir/token_validator.py" package/
Copy-Item "$scriptDir/access_checker.py" package/
Copy-Item "$scriptDir/policy_generator.py" package/
Copy-Item "$scriptDir/app_config.py" package/
Write-Host "  OK - 5 archivos copiados" -ForegroundColor Green
Write-Host ""

Write-Host "Creando ZIP..." -ForegroundColor Yellow
Push-Location package
Compress-Archive -Path * -DestinationPath ../lambda-auth-authorizer.zip -Force
Pop-Location
$zipSize = (Get-Item "lambda-auth-authorizer.zip").Length / 1MB
Write-Host "  OK - ZIP creado: $([math]::Round($zipSize, 2)) MB" -ForegroundColor Green
Write-Host ""

Write-Host "Verificando funcion..." -ForegroundColor Yellow
$ErrorActionPreference = 'SilentlyContinue'
aws lambda get-function --function-name $FUNCTION_NAME --region $REGION 2>&1 | Out-Null
$exists = $LASTEXITCODE -eq 0
$ErrorActionPreference = 'Continue'

if ($exists) {
    Write-Host "  Funcion existe - actualizando" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "Actualizando codigo..." -ForegroundColor Yellow
    aws lambda update-function-code --function-name $FUNCTION_NAME --zip-file fileb://lambda-auth-authorizer.zip --region $REGION
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  OK - Codigo actualizado" -ForegroundColor Green
        Write-Host ""
        
        Write-Host "Actualizando configuracion..." -ForegroundColor Yellow
        $envVars = 'Variables={AWS_REGION=eu-west-1,USER_POOL_ID=eu-west-1_zrEOVk483,APP_CLIENT_ID=1kp54ebtb2npa4eukpbp1tn1ff}'
        aws lambda update-function-configuration --function-name $FUNCTION_NAME --timeout 30 --memory-size 256 --environment $envVars --region $REGION
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  OK - Configuracion actualizada" -ForegroundColor Green
        }
    }
}
else {
    Write-Host "  Funcion NO existe" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Comando para crear:" -ForegroundColor Cyan
    Write-Host "aws lambda create-function --function-name lambda-auth-authorizer --runtime python3.11 --role arn:aws:iam::ACCOUNT_ID:role/lambda-execution-role --handler lambda_handler.lambda_handler --zip-file fileb://lambda-auth-authorizer.zip --timeout 30 --memory-size 256 --environment Variables={AWS_REGION=eu-west-1,USER_POOL_ID=eu-west-1_zrEOVk483,APP_CLIENT_ID=1kp54ebtb2npa4eukpbp1tn1ff} --region eu-west-1" -ForegroundColor Gray
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  COMPLETADO" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""