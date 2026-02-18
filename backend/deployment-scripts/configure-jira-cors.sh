#!/bin/bash

echo "========================================"
echo "  CONFIGURE CORS - JIRA ENDPOINTS"
echo "========================================"
echo ""

REGION="eu-west-1"
API_NAME="gestion-demanda-api"

# Get API ID
echo "Finding API Gateway..."
API_ID=$(aws apigateway get-rest-apis --region $REGION --query "items[?name=='$API_NAME'].id" --output text)

if [ -z "$API_ID" ]; then
    echo "Error: API '$API_NAME' not found"
    exit 1
fi
echo "API ID: $API_ID"

# Get root resource ID
ROOT_ID=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --query "items[?path=='/'].id" --output text)
echo "Root ID: $ROOT_ID"

# Get /jira resource ID
JIRA_ID=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --query "items[?path=='/jira'].id" --output text)
echo "Jira resource ID: $JIRA_ID"

if [ -z "$JIRA_ID" ]; then
    echo "Error: /jira resource not found"
    exit 1
fi

# Get /jira/import resource ID
JIRA_IMPORT_ID=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --query "items[?path=='/jira/import'].id" --output text)
echo "Jira Import resource ID: $JIRA_IMPORT_ID"

if [ -z "$JIRA_IMPORT_ID" ]; then
    echo "Error: /jira/import resource not found"
    exit 1
fi

# Configure OPTIONS method for CORS on /jira/import
echo ""
echo "Configuring OPTIONS method for /jira/import..."
aws apigateway put-method \
    --rest-api-id $API_ID \
    --region $REGION \
    --resource-id $JIRA_IMPORT_ID \
    --http-method OPTIONS \
    --authorization-type NONE \
    --no-api-key-required

aws apigateway put-integration \
    --rest-api-id $API_ID \
    --region $REGION \
    --resource-id $JIRA_IMPORT_ID \
    --http-method OPTIONS \
    --type MOCK \
    --request-templates '{"application/json": "{\"statusCode\": 200}"}'

aws apigateway put-method-response \
    --rest-api-id $API_ID \
    --region $REGION \
    --resource-id $JIRA_IMPORT_ID \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters \
        "method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false,method.response.header.Access-Control-Allow-Origin=false"

aws apigateway put-integration-response \
    --rest-api-id $API_ID \
    --region $REGION \
    --resource-id $JIRA_IMPORT_ID \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,x-user-team'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,POST,PUT,DELETE,OPTIONS'"'"'","method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'"}'

echo "✓ CORS configured for /jira/import"

# Get /jira/issues resource ID
JIRA_ISSUES_ID=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --query "items[?path=='/jira/issues'].id" --output text)

if [ ! -z "$JIRA_ISSUES_ID" ]; then
    echo ""
    echo "Configuring OPTIONS method for /jira/issues..."
    aws apigateway put-method \
        --rest-api-id $API_ID \
        --region $REGION \
        --resource-id $JIRA_ISSUES_ID \
        --http-method OPTIONS \
        --authorization-type NONE \
        --no-api-key-required

    aws apigateway put-integration \
        --rest-api-id $API_ID \
        --region $REGION \
        --resource-id $JIRA_ISSUES_ID \
        --http-method OPTIONS \
        --type MOCK \
        --request-templates '{"application/json": "{\"statusCode\": 200}"}'

    aws apigateway put-method-response \
        --rest-api-id $API_ID \
        --region $REGION \
        --resource-id $JIRA_ISSUES_ID \
        --http-method OPTIONS \
        --status-code 200 \
        --response-parameters \
            "method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false,method.response.header.Access-Control-Allow-Origin=false"

    aws apigateway put-integration-response \
        --rest-api-id $API_ID \
        --region $REGION \
        --resource-id $JIRA_ISSUES_ID \
        --http-method OPTIONS \
        --status-code 200 \
        --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,x-user-team'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,POST,PUT,DELETE,OPTIONS'"'"'","method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'"}'

    echo "✓ CORS configured for /jira/issues"
fi

# Deploy API
echo ""
echo "Deploying API..."
aws apigateway create-deployment \
    --rest-api-id $API_ID \
    --region $REGION \
    --stage-name prod \
    --description "Configure CORS for jira endpoints"

echo ""
echo "========================================"
echo "  CONFIGURATION COMPLETE"
echo "========================================"
echo ""
echo "Endpoints configured:"
echo "  - https://$API_ID.execute-api.$REGION.amazonaws.com/prod/jira/import"
echo "  - https://$API_ID.execute-api.$REGION.amazonaws.com/prod/jira/issues"
echo ""
echo "CORS enabled for all origins with x-user-team header"
echo ""
echo "To run this script:"
echo "  chmod +x backend/deployment-scripts/configure-jira-cors.sh"
echo "  ./backend/deployment-scripts/configure-jira-cors.sh"