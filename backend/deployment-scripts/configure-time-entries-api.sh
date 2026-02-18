#!/bin/bash

# Configure Time Entries API Gateway endpoints
# This script creates all methods and integrations for the time-entries endpoints

API_ID="xrqo2gedpl"
REGION="eu-west-1"
ACCOUNT_ID="701055077130"
LAMBDA_ARN="arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:gestion-demanda-time-entries-handler"

# Resource IDs
RESOURCE_TIME_ENTRIES="3rkpcl"  # /time-entries
RESOURCE_TIME_ENTRY_ID="wml6oo" # /time-entries/{id}

echo "🚀 Configurando Time Entries API Gateway..."

# Function to create method, integration, and enable CORS
create_method_with_lambda() {
    local RESOURCE_ID=$1
    local HTTP_METHOD=$2
    local RESOURCE_PATH=$3
    
    echo "📝 Configurando $HTTP_METHOD $RESOURCE_PATH..."
    
    # Create method
    aws apigateway put-method \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method $HTTP_METHOD \
        --authorization-type NONE \
        --request-parameters "method.request.header.x-user-team=true" \
        --region $REGION 2>/dev/null || echo "Method already exists"
    
    # Create Lambda integration
    aws apigateway put-integration \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method $HTTP_METHOD \
        --type AWS_PROXY \
        --integration-http-method POST \
        --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
        --region $REGION 2>/dev/null || echo "Integration already exists"
    
    # Add Lambda permission
    aws lambda add-permission \
        --function-name gestion-demanda-time-entries-handler \
        --statement-id "apigateway-${RESOURCE_ID}-${HTTP_METHOD}-$(date +%s)" \
        --action lambda:InvokeFunction \
        --principal apigateway.amazonaws.com \
        --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/${HTTP_METHOD}${RESOURCE_PATH}" \
        --region $REGION 2>/dev/null || echo "Permission already exists"
}

# Configure OPTIONS for CORS on /time-entries
echo "🔧 Configurando CORS para /time-entries..."
aws apigateway put-method \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_TIME_ENTRIES \
    --http-method OPTIONS \
    --authorization-type NONE \
    --region $REGION 2>/dev/null || echo "OPTIONS method already exists"

aws apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_TIME_ENTRIES \
    --http-method OPTIONS \
    --type MOCK \
    --request-templates '{"application/json": "{\"statusCode\": 200}"}' \
    --region $REGION 2>/dev/null

aws apigateway put-method-response \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_TIME_ENTRIES \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters '{"method.response.header.Access-Control-Allow-Headers": true, "method.response.header.Access-Control-Allow-Methods": true, "method.response.header.Access-Control-Allow-Origin": true}' \
    --region $REGION 2>/dev/null

aws apigateway put-integration-response \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_TIME_ENTRIES \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters '{"method.response.header.Access-Control-Allow-Headers": "'"'"'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,x-user-team'"'"'", "method.response.header.Access-Control-Allow-Methods": "'"'"'GET,POST,OPTIONS'"'"'", "method.response.header.Access-Control-Allow-Origin": "'"'"'*'"'"'"}' \
    --region $REGION 2>/dev/null

# Configure GET and POST on /time-entries
create_method_with_lambda $RESOURCE_TIME_ENTRIES "GET" "/time-entries"
create_method_with_lambda $RESOURCE_TIME_ENTRIES "POST" "/time-entries"

# Configure OPTIONS for CORS on /time-entries/{id}
echo "🔧 Configurando CORS para /time-entries/{id}..."
aws apigateway put-method \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_TIME_ENTRY_ID \
    --http-method OPTIONS \
    --authorization-type NONE \
    --region $REGION 2>/dev/null || echo "OPTIONS method already exists"

aws apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_TIME_ENTRY_ID \
    --http-method OPTIONS \
    --type MOCK \
    --request-templates '{"application/json": "{\"statusCode\": 200}"}' \
    --region $REGION 2>/dev/null

aws apigateway put-method-response \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_TIME_ENTRY_ID \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters '{"method.response.header.Access-Control-Allow-Headers": true, "method.response.header.Access-Control-Allow-Methods": true, "method.response.header.Access-Control-Allow-Origin": true}' \
    --region $REGION 2>/dev/null

aws apigateway put-integration-response \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_TIME_ENTRY_ID \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters '{"method.response.header.Access-Control-Allow-Headers": "'"'"'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,x-user-team'"'"'", "method.response.header.Access-Control-Allow-Methods": "'"'"'GET,PUT,DELETE,OPTIONS'"'"'", "method.response.header.Access-Control-Allow-Origin": "'"'"'*'"'"'"}' \
    --region $REGION 2>/dev/null

# Configure GET, PUT, DELETE on /time-entries/{id}
create_method_with_lambda $RESOURCE_TIME_ENTRY_ID "GET" "/time-entries/*"
create_method_with_lambda $RESOURCE_TIME_ENTRY_ID "PUT" "/time-entries/*"
create_method_with_lambda $RESOURCE_TIME_ENTRY_ID "DELETE" "/time-entries/*"

echo ""
echo "✅ Métodos y integraciones configurados!"
echo ""
echo "🚀 Desplegando API..."
aws apigateway create-deployment \
    --rest-api-id $API_ID \
    --stage-name prod \
    --description "Deploy time-entries endpoints" \
    --region $REGION

echo ""
echo "✅ API desplegada!"
echo ""
echo "📋 Endpoints disponibles:"
echo "  GET    https://${API_ID}.execute-api.${REGION}.amazonaws.com/prod/time-entries"
echo "  POST   https://${API_ID}.execute-api.${REGION}.amazonaws.com/prod/time-entries"
echo "  GET    https://${API_ID}.execute-api.${REGION}.amazonaws.com/prod/time-entries/{id}"
echo "  PUT    https://${API_ID}.execute-api.${REGION}.amazonaws.com/prod/time-entries/{id}"
echo "  DELETE https://${API_ID}.execute-api.${REGION}.amazonaws.com/prod/time-entries/{id}"
echo ""
echo "🎉 Configuración completada!"