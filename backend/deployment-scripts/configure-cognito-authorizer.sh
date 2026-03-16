#!/bin/bash

echo "========================================"
echo "  CONFIGURE COGNITO AUTHORIZER"
echo "========================================"
echo ""

REGION="eu-west-1"
API_NAME="gestion-demanda-api"
AUTHORIZER_NAME="CognitoAuthorizer"
USER_POOL_ARN="arn:aws:cognito-idp:eu-west-1:211125768252:userpool/eu-west-1_EzHfFsGq8"

# Get API ID
echo "Finding API Gateway..."
API_ID=$(aws apigateway get-rest-apis --region $REGION --query "items[?name=='$API_NAME'].id" --output text)

if [ -z "$API_ID" ]; then
    echo "Error: API '$API_NAME' not found"
    exit 1
fi
echo "✓ API ID: $API_ID"
echo ""

# Check if authorizer exists
echo "Checking for existing Cognito authorizer..."
AUTHORIZER_ID=$(aws apigateway get-authorizers \
    --rest-api-id $API_ID \
    --region $REGION \
    --query "items[?name=='$AUTHORIZER_NAME'].id" \
    --output text)

if [ -z "$AUTHORIZER_ID" ]; then
    echo "Creating Cognito authorizer..."
    AUTHORIZER_ID=$(aws apigateway create-authorizer \
        --rest-api-id $API_ID \
        --region $REGION \
        --name $AUTHORIZER_NAME \
        --type COGNITO_USER_POOLS \
        --provider-arns $USER_POOL_ARN \
        --identity-source "method.request.header.Authorization" \
        --query 'id' \
        --output text)
    echo "✓ Created authorizer: $AUTHORIZER_ID"
else
    echo "✓ Authorizer already exists: $AUTHORIZER_ID"
fi
echo ""

# Function to configure authorizer for a resource and method
configure_authorizer() {
    local RESOURCE_PATH=$1
    local HTTP_METHOD=$2
    
    echo "Configuring $HTTP_METHOD $RESOURCE_PATH..."
    
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
    
    # Update method to use Cognito authorizer
    aws apigateway update-method \
        --rest-api-id $API_ID \
        --region $REGION \
        --resource-id $RESOURCE_ID \
        --http-method $HTTP_METHOD \
        --patch-operations \
            op=replace,path=/authorizationType,value=COGNITO_USER_POOLS \
            op=replace,path=/authorizerId,value=$AUTHORIZER_ID \
        2>/dev/null && echo "  ✓ Configured" || echo "  ⚠️  Method may not exist"
}

# Configure authorizer for concept-tasks endpoints
echo "Configuring /concept-tasks endpoints..."
configure_authorizer "/concept-tasks" "GET"
configure_authorizer "/concept-tasks" "POST"
configure_authorizer "/concept-tasks/{id}" "GET"
configure_authorizer "/concept-tasks/{id}" "PUT"
configure_authorizer "/concept-tasks/{id}" "DELETE"
echo ""

# Configure authorizer for assignments endpoints
echo "Configuring /assignments endpoints..."
configure_authorizer "/assignments" "GET"
configure_authorizer "/assignments" "POST"
configure_authorizer "/assignments" "DELETE"
echo ""

# Deploy API
echo "Deploying API to prod stage..."
aws apigateway create-deployment \
    --rest-api-id $API_ID \
    --region $REGION \
    --stage-name prod \
    --description "Configure Cognito authorizer for concept-tasks and assignments" \
    >/dev/null

echo "✓ Deployment complete"
echo ""
echo "========================================"
echo "  CONFIGURATION COMPLETE"
echo "========================================"
echo ""
echo "Cognito authorizer configured for:"
echo "  - /concept-tasks (GET, POST)"
echo "  - /concept-tasks/{id} (GET, PUT, DELETE)"
echo "  - /assignments (GET, POST, DELETE)"
echo ""
echo "User Pool ARN: $USER_POOL_ARN"
echo "Authorizer ID: $AUTHORIZER_ID"
echo ""
echo "Test with:"
echo "  Authorization: Bearer <cognito_access_token>"