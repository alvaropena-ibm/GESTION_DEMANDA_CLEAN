#!/bin/bash

echo "🚀 Deploying jira-tasks-handler Lambda function..."

# Configuration
FUNCTION_NAME="jira-tasks-handler"
REGION="eu-west-1"

# Create deployment package
echo "📦 Creating deployment package..."
zip -r function.zip jiraTasksHandler.js package.json node_modules/ -x "*.git*" "*.DS_Store"

# Update Lambda function
echo "⬆️  Updating Lambda function code..."
aws lambda update-function-code \
    --function-name $FUNCTION_NAME \
    --zip-file fileb://function.zip \
    --region $REGION

# Wait for update to complete
echo "⏳ Waiting for function update to complete..."
aws lambda wait function-updated \
    --function-name $FUNCTION_NAME \
    --region $REGION

# Clean up
echo "🧹 Cleaning up..."
rm function.zip

echo ""
echo "✅ Deployment completed successfully!"
echo ""
echo "📊 Function: $FUNCTION_NAME"
echo "🌍 Region: $REGION"
echo ""
echo "🧪 Test with:"
echo "aws lambda invoke --function-name $FUNCTION_NAME --region $REGION response.json"