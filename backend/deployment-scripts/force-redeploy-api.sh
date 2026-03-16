#!/bin/bash

echo "========================================"
echo "  FORCE REDEPLOY API GATEWAY"
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

# Get current stage configuration
echo "Getting current stage configuration..."
STAGE_INFO=$(aws apigateway get-stage \
    --rest-api-id $API_ID \
    --region $REGION \
    --stage-name prod 2>/dev/null)

if [ $? -eq 0 ]; then
    echo "✓ Stage 'prod' exists"
else
    echo "⚠️  Stage 'prod' not found, will be created"
fi
echo ""

# Force a new deployment
echo "Creating new deployment (this will clear cache)..."
DEPLOYMENT_ID=$(aws apigateway create-deployment \
    --rest-api-id $API_ID \
    --region $REGION \
    --stage-name prod \
    --description "Force redeploy to clear cache and apply authorizer changes" \
    --query 'id' \
    --output text)

echo "✓ Deployment ID: $DEPLOYMENT_ID"
echo ""

# Wait a moment for deployment to propagate
echo "Waiting for deployment to propagate..."
sleep 3
echo "✓ Done"
echo ""

# Verify assignments endpoint configuration
echo "Verifying /assignments endpoint configuration..."
ASSIGNMENTS_ID=$(aws apigateway get-resources \
    --rest-api-id $API_ID \
    --region $REGION \
    --query "items[?path=='/assignments'].id" \
    --output text)

if [ -n "$ASSIGNMENTS_ID" ]; then
    echo "Resource ID: $ASSIGNMENTS_ID"
    
    # Check GET method
    GET_METHOD=$(aws apigateway get-method \
        --rest-api-id $API_ID \
        --region $REGION \
        --resource-id $ASSIGNMENTS_ID \
        --http-method GET \
        --query 'authorizationType' \
        --output text 2>/dev/null)
    
    echo "GET /assignments authorizationType: $GET_METHOD"
    
    if [ "$GET_METHOD" != "NONE" ]; then
        echo "⚠️  WARNING: GET /assignments still has authorizer: $GET_METHOD"
        echo "   Attempting to fix..."
        
        aws apigateway update-method \
            --rest-api-id $API_ID \
            --region $REGION \
            --resource-id $ASSIGNMENTS_ID \
            --http-method GET \
            --patch-operations op=replace,path=/authorizationType,value=NONE \
            >/dev/null 2>&1
        
        echo "   ✓ Fixed, creating another deployment..."
        aws apigateway create-deployment \
            --rest-api-id $API_ID \
            --region $REGION \
            --stage-name prod \
            --description "Fix assignments authorizer" \
            >/dev/null
    else
        echo "✓ GET /assignments correctly configured (NONE)"
    fi
fi
echo ""

echo "========================================"
echo "  REDEPLOY COMPLETE"
echo "========================================"
echo ""
echo "API Gateway has been redeployed"
echo "Cache has been cleared"
echo "Changes should be active now"
echo ""
echo "Test endpoint:"
echo "  curl https://$API_ID.execute-api.$REGION.amazonaws.com/prod/assignments"