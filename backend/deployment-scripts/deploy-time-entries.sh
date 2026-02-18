#!/bin/bash

# Deploy Time Entries Lambda Function
# Usage: ./deploy-time-entries.sh [dev|prod]

ENVIRONMENT=${1:-dev}
FUNCTION_NAME="time-entries-handler-${ENVIRONMENT}"
LAMBDA_DIR="../lambda-functions/time-entries"

echo "🚀 Deploying Time Entries Lambda Function to ${ENVIRONMENT}..."

cd $LAMBDA_DIR

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Create deployment package
echo "📦 Creating deployment package..."
zip -r function.zip . -x "*.git*" "*.md"

# Update Lambda function
echo "☁️ Uploading to AWS Lambda..."
aws lambda update-function-code \
    --function-name $FUNCTION_NAME \
    --zip-file fileb://function.zip \
    --region eu-west-1

# Clean up
rm function.zip

echo "✅ Deployment complete!"