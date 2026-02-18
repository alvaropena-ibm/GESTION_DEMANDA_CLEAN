#!/bin/bash

# Configuration
API_ID="xrqo2gedpl"
PARENT_RESOURCE_ID="ojwmq4"  # /jira-tasks resource ID
LAMBDA_ARN="arn:aws:lambda:eu-west-1:701055077130:function:jira-tasks-handler"
REGION="eu-west-1"
ACCOUNT_ID="701055077130"

echo "🚀 Configuring API Gateway for /jira-tasks/{id} endpoint..."

# Create {id} resource under /jira-tasks
echo "📝 Creating {id} resource..."
RESOURCE_RESPONSE=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $PARENT_RESOURCE_ID \
    --path-part "{id}" \
    2>&1)

if echo "$RESOURCE_RESPONSE" | grep -q "ConflictException"; then
    echo "Resource {id} already exists, getting its ID..."
    ID_RESOURCE_ID=$(aws apigateway get-resources \
        --rest-api-id $API_ID \
        --query "items[?pathPart=='\\{id\\}' && parentId=='$PARENT_RESOURCE_ID'].id" \
        --output text)
else
    ID_RESOURCE_ID=$(echo "$RESOURCE_RESPONSE" | jq -r '.id')
fi

echo "✅ Resource ID: $ID_RESOURCE_ID"

# Function to configure a method
configure_method() {
    local METHOD=$1
    echo "📝 Configuring $METHOD method for /jira-tasks/{id}..."
    
    # Create method
    aws apigateway put-method \
        --rest-api-id $API_ID \
        --resource-id $ID_RESOURCE_ID \
        --http-method $METHOD \
        --authorization-type NONE \
        --request-parameters "method.request.header.Authorization=false,method.request.header.x-user-team=false,method.request.path.id=true" \
        2>/dev/null || echo "Method $METHOD already exists"
    
    # Create integration
    aws apigateway put-integration \
        --rest-api-id $API_ID \
        --resource-id $ID_RESOURCE_ID \
        --http-method $METHOD \
        --type AWS_PROXY \
        --integration-http-method POST \
        --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations" \
        2>/dev/null || echo "Integration for $METHOD already exists"
    
    echo "✅ $METHOD configured"
}

# Configure OPTIONS for CORS
echo "📝 Configuring OPTIONS method for CORS on /jira-tasks/{id}..."
aws apigateway put-method \
    --rest-api-id $API_ID \
    --resource-id $ID_RESOURCE_ID \
    --http-method OPTIONS \
    --authorization-type NONE \
    2>/dev/null || echo "OPTIONS method already exists"

aws apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $ID_RESOURCE_ID \
    --http-method OPTIONS \
    --type MOCK \
    --request-templates '{"application/json":"{\"statusCode\": 200}"}' \
    2>/dev/null || echo "OPTIONS integration already exists"

aws apigateway put-method-response \
    --rest-api-id $API_ID \
    --resource-id $ID_RESOURCE_ID \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters "method.response.header.Access-Control-Allow-Headers=true,method.response.header.Access-Control-Allow-Methods=true,method.response.header.Access-Control-Allow-Origin=true" \
    2>/dev/null || echo "OPTIONS method response already exists"

aws apigateway put-integration-response \
    --rest-api-id $API_ID \
    --resource-id $ID_RESOURCE_ID \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,Authorization,x-user-team'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,PUT,DELETE,OPTIONS'"'"'","method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'"}' \
    2>/dev/null || echo "OPTIONS integration response already exists"

echo "✅ OPTIONS configured"

# Configure REST methods
configure_method "GET"
configure_method "PUT"
configure_method "DELETE"

# Add Lambda permission for {id} resource
echo "📝 Adding Lambda permission for /jira-tasks/{id}..."
aws lambda add-permission \
    --function-name jira-tasks-handler \
    --statement-id apigateway-jira-tasks-id-invoke \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:$REGION:$ACCOUNT_ID:$API_ID/*/*/jira-tasks/*" \
    2>/dev/null || echo "Lambda permission already exists"

echo "✅ Lambda permission added"

# Deploy API
echo "📝 Deploying API to prod stage..."
aws apigateway create-deployment \
    --rest-api-id $API_ID \
    --stage-name prod \
    --description "Deploy jira-tasks/{id} endpoint with CORS"

echo ""
echo "✅ API Gateway configuration completed!"
echo ""
echo "📊 Endpoint URLs:"
echo "GET/PUT/DELETE: https://$API_ID.execute-api.$REGION.amazonaws.com/prod/jira-tasks/{id}"
echo ""
echo "🧪 Test DELETE with:"
echo "curl -X DELETE -H 'x-user-team: YOUR_TEAM' https://$API_ID.execute-api.$REGION.amazonaws.com/prod/jira-tasks/YOUR_ID"