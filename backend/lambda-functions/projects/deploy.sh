#!/bin/bash

# Deploy Projects Lambda Function
# This script packages and deploys the projects handler to AWS Lambda

set -e

echo "========================================="
echo "Deploying Projects Lambda Function"
echo "========================================="

FUNCTION_NAME="gestiondemanda_projectsHandler"
REGION="eu-west-1"

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo ""
echo "[1/5] Installing dependencies..."
npm install --production

echo ""
echo "[2/5] Creating deployment package..."
zip -r function.zip . -x "*.git*" "deploy.sh" "*.md" "test*"

echo ""
echo "[3/5] Uploading to Lambda..."
aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file fileb://function.zip \
    --region "$REGION"

echo ""
echo "[4/5] Waiting for update to complete..."
aws lambda wait function-updated \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION"

echo ""
echo "[5/5] Cleaning up..."
rm function.zip

echo ""
echo "========================================="
echo "✅ Deployment completed successfully!"
echo "========================================="
echo ""
echo "Function: $FUNCTION_NAME"
echo "Region: $REGION"
echo ""
echo "Test the function:"
echo "curl https://xrqo2gedpl.execute-api.eu-west-1.amazonaws.com/prod/projects \\"
echo "  -H 'Authorization: Bearer YOUR_TOKEN' \\"
echo "  -H 'x-user-team: DARWIN'"
echo ""