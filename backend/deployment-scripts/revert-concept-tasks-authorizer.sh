#!/bin/bash

echo "========================================"
echo "  REVERT CONCEPT-TASKS AUTHORIZER"
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
echo "✓ API ID: $API_ID"
echo ""

# Function to remove authorizer from a resource and method
remove_authorizer() {
    local RESOURCE_PATH=$1
    local HTTP_METHOD=$2
    
    echo "Removing authorizer from $HTTP_METHOD $RESOURCE_PATH..."
    
    # Get resource ID
    RESOURCE_ID=$(aws apigateway get-resources \
        --rest-api-id $API_ID \
        --region $REGION \
        --query "items[?path=='$RESOURCE_PATH'].id" \
        --output text)
    
    if [ -z "$RESOURCE_ID" ]; then
        echo "  ⚠️  Resource not found: $RESOURCE_PATH"
        return
    fi
    
    # Update method to remove authorizer (set to NONE)
    aws apigateway update-method \
        --rest-api-id $API_ID \
        --region $REGION \
        --resource-id $RESOURCE_ID \
        --http-method $HTTP_METHOD \
        --patch-operations \
            op=replace,path=/authorizationType,value=NONE \
        2>/dev/null && echo "  ✓ Authorizer removed" || echo "  ⚠️  Method may not exist"
}

# Remove authorizer from concept-tasks endpoints
echo "Removing authorizer from /concept-tasks endpoints..."
remove_authorizer "/concept-tasks" "GET"
remove_authorizer "/concept-tasks" "POST"
remove_authorizer "/concept-tasks/{id}" "GET"
remove_authorizer "/concept-tasks/{id}" "PUT"
remove_authorizer "/concept-tasks/{id}" "DELETE"
echo ""

# Deploy API
echo "Deploying API to prod stage..."
aws apigateway create-deployment \
    --rest-api-id $API_ID \
    --region $REGION \
    --stage-name prod \
    --description "Remove Cognito authorizer from concept-tasks endpoints" \
    >/dev/null

echo "✓ Deployment complete"
echo ""
echo "========================================"
echo "  REVERT COMPLETE"
echo "========================================"
echo ""
echo "Authorizer removed from:"
echo "  - /concept-tasks (GET, POST)"
echo "  - /concept-tasks/{id} (GET, PUT, DELETE)"