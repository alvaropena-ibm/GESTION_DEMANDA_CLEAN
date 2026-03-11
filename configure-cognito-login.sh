#!/bin/bash

# Script de Configuración Automática del Login con Cognito
# Configura API Gateway para usar la Lambda login-authorization-service

set -e  # Salir si hay algún error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuración
REGION="eu-west-1"
API_NAME="gestion-demanda-api"
LAMBDA_NAME="login-authorization-service"
STAGE_NAME="prod"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Configuración de Login con Cognito${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 1. Obtener API Gateway ID
echo -e "${YELLOW}[1/7] Buscando API Gateway...${NC}"
API_ID=$(aws apigateway get-rest-apis \
    --region $REGION \
    --query "items[?name=='$API_NAME'].id" \
    --output text)

if [ -z "$API_ID" ]; then
    echo -e "${RED}❌ Error: No se encontró el API Gateway '$API_NAME'${NC}"
    exit 1
fi

echo -e "${GREEN}✓ API Gateway encontrado: $API_ID${NC}"

# 2. Obtener Root Resource ID
echo -e "${YELLOW}[2/7] Obteniendo Root Resource...${NC}"
ROOT_RESOURCE_ID=$(aws apigateway get-resources \
    --rest-api-id $API_ID \
    --region $REGION \
    --query "items[?path=='/'].id" \
    --output text)

echo -e "${GREEN}✓ Root Resource ID: $ROOT_RESOURCE_ID${NC}"

# 3. Crear recurso /auth si no existe
echo -e "${YELLOW}[3/7] Creando recurso /auth...${NC}"
AUTH_RESOURCE_ID=$(aws apigateway get-resources \
    --rest-api-id $API_ID \
    --region $REGION \
    --query "items[?path=='/auth'].id" \
    --output text)

if [ -z "$AUTH_RESOURCE_ID" ]; then
    AUTH_RESOURCE_ID=$(aws apigateway create-resource \
        --rest-api-id $API_ID \
        --region $REGION \
        --parent-id $ROOT_RESOURCE_ID \
        --path-part "auth" \
        --query 'id' \
        --output text)
    echo -e "${GREEN}✓ Recurso /auth creado: $AUTH_RESOURCE_ID${NC}"
else
    echo -e "${GREEN}✓ Recurso /auth ya existe: $AUTH_RESOURCE_ID${NC}"
fi

# 4. Crear recurso /auth/login si no existe
echo -e "${YELLOW}[4/7] Creando recurso /auth/login...${NC}"
LOGIN_RESOURCE_ID=$(aws apigateway get-resources \
    --rest-api-id $API_ID \
    --region $REGION \
    --query "items[?path=='/auth/login'].id" \
    --output text)

if [ -z "$LOGIN_RESOURCE_ID" ]; then
    LOGIN_RESOURCE_ID=$(aws apigateway create-resource \
        --rest-api-id $API_ID \
        --region $REGION \
        --parent-id $AUTH_RESOURCE_ID \
        --path-part "login" \
        --query 'id' \
        --output text)
    echo -e "${GREEN}✓ Recurso /auth/login creado: $LOGIN_RESOURCE_ID${NC}"
else
    echo -e "${GREEN}✓ Recurso /auth/login ya existe: $LOGIN_RESOURCE_ID${NC}"
fi

# 5. Obtener Lambda ARN
echo -e "${YELLOW}[5/7] Obteniendo Lambda ARN...${NC}"
LAMBDA_ARN=$(aws lambda get-function \
    --function-name $LAMBDA_NAME \
    --region $REGION \
    --query 'Configuration.FunctionArn' \
    --output text)

if [ -z "$LAMBDA_ARN" ]; then
    echo -e "${RED}❌ Error: No se encontró la Lambda '$LAMBDA_NAME'${NC}"
    echo -e "${YELLOW}Por favor, despliega primero la Lambda usando:${NC}"
    echo -e "${BLUE}cd cognito-auth-package\ new/lambda-auth-login${NC}"
    echo -e "${BLUE}./deploy_simple.py${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Lambda ARN: $LAMBDA_ARN${NC}"

# 6. Configurar método POST en /auth/login
echo -e "${YELLOW}[6/7] Configurando método POST...${NC}"

# Verificar si el método POST ya existe
METHOD_EXISTS=$(aws apigateway get-method \
    --rest-api-id $API_ID \
    --resource-id $LOGIN_RESOURCE_ID \
    --http-method POST \
    --region $REGION \
    2>/dev/null || echo "")

if [ -z "$METHOD_EXISTS" ]; then
    # Crear método POST
    aws apigateway put-method \
        --rest-api-id $API_ID \
        --resource-id $LOGIN_RESOURCE_ID \
        --http-method POST \
        --authorization-type NONE \
        --region $REGION \
        --no-api-key-required > /dev/null

    echo -e "${GREEN}✓ Método POST creado${NC}"
else
    echo -e "${GREEN}✓ Método POST ya existe${NC}"
fi

# Configurar integración con Lambda
aws apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $LOGIN_RESOURCE_ID \
    --http-method POST \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations" \
    --region $REGION > /dev/null

echo -e "${GREEN}✓ Integración con Lambda configurada${NC}"

# Dar permisos a API Gateway para invocar la Lambda
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
SOURCE_ARN="arn:aws:execute-api:$REGION:$ACCOUNT_ID:$API_ID/*/*/*"

aws lambda add-permission \
    --function-name $LAMBDA_NAME \
    --statement-id apigateway-invoke-login-$(date +%s) \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "$SOURCE_ARN" \
    --region $REGION 2>/dev/null || echo -e "${YELLOW}⚠ Permiso ya existe (ignorando)${NC}"

echo -e "${GREEN}✓ Permisos configurados${NC}"

# Configurar método OPTIONS para CORS
echo -e "${YELLOW}[6.1/7] Configurando CORS (OPTIONS)...${NC}"

OPTIONS_EXISTS=$(aws apigateway get-method \
    --rest-api-id $API_ID \
    --resource-id $LOGIN_RESOURCE_ID \
    --http-method OPTIONS \
    --region $REGION \
    2>/dev/null || echo "")

if [ -z "$OPTIONS_EXISTS" ]; then
    # Crear método OPTIONS
    aws apigateway put-method \
        --rest-api-id $API_ID \
        --resource-id $LOGIN_RESOURCE_ID \
        --http-method OPTIONS \
        --authorization-type NONE \
        --region $REGION > /dev/null

    # Configurar integración MOCK para OPTIONS
    aws apigateway put-integration \
        --rest-api-id $API_ID \
        --resource-id $LOGIN_RESOURCE_ID \
        --http-method OPTIONS \
        --type MOCK \
        --request-templates '{"application/json": "{\"statusCode\": 200}"}' \
        --region $REGION > /dev/null

    # Configurar respuesta del método OPTIONS
    aws apigateway put-method-response \
        --rest-api-id $API_ID \
        --resource-id $LOGIN_RESOURCE_ID \
        --http-method OPTIONS \
        --status-code 200 \
        --response-parameters '{"method.response.header.Access-Control-Allow-Headers": false, "method.response.header.Access-Control-Allow-Methods": false, "method.response.header.Access-Control-Allow-Origin": false}' \
        --region $REGION > /dev/null

    # Configurar respuesta de integración OPTIONS
    aws apigateway put-integration-response \
        --rest-api-id $API_ID \
        --resource-id $LOGIN_RESOURCE_ID \
        --http-method OPTIONS \
        --status-code 200 \
        --response-parameters '{"method.response.header.Access-Control-Allow-Headers": "'"'"'Content-Type,Authorization'"'"'", "method.response.header.Access-Control-Allow-Methods": "'"'"'POST,OPTIONS'"'"'", "method.response.header.Access-Control-Allow-Origin": "'"'"'*'"'"'"}' \
        --region $REGION > /dev/null

    echo -e "${GREEN}✓ CORS configurado${NC}"
else
    echo -e "${GREEN}✓ CORS ya configurado${NC}"
fi

# 7. Desplegar API
echo -e "${YELLOW}[7/7] Desplegando API Gateway...${NC}"
aws apigateway create-deployment \
    --rest-api-id $API_ID \
    --stage-name $STAGE_NAME \
    --region $REGION > /dev/null

echo -e "${GREEN}✓ API desplegada en stage '$STAGE_NAME'${NC}"

# Mostrar resumen
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Configuración completada exitosamente${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}URL del endpoint:${NC}"
echo -e "${GREEN}https://$API_ID.execute-api.$REGION.amazonaws.com/$STAGE_NAME/auth/login${NC}"
echo ""
echo -e "${YELLOW}Próximos pasos:${NC}"
echo -e "1. Actualizar ${BLUE}frontend/js/config/data.js${NC} con la URL del endpoint"
echo -e "2. Crear usuarios de prueba en Cognito"
echo -e "3. Probar el login en ${BLUE}login-new.html${NC}"
echo ""
echo -e "${YELLOW}Para crear un usuario de prueba:${NC}"
echo -e "${BLUE}cd cognito-auth-package\\ new/lambda-auth-authorizer${NC}"
echo -e "${BLUE}python create_test_user.py${NC}"
echo ""