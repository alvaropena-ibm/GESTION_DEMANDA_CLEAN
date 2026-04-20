#!/bin/bash

# Deploy Frontend to CloudFront
# This script syncs the frontend directory to S3 and invalidates CloudFront cache

set -e  # Exit on error

# Configuration
CLOUDFRONT_DISTRIBUTION_ID="E3TOPO1X778CQ6"  # Distribution for d3ao8ook2gaeu9.cloudfront.net
S3_BUCKET="s3://gestion-demanda-frontend"  # S3 bucket backing CloudFront
FRONTEND_DIR="./frontend"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  CloudFront Deployment Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI is not installed${NC}"
    echo "Please install AWS CLI: https://aws.amazon.com/cli/"
    exit 1
fi

# Check if AWS credentials are configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}Error: AWS credentials are not configured${NC}"
    echo "Please run: aws configure"
    exit 1
fi

echo -e "${GREEN}✓ AWS CLI is configured${NC}"
echo ""

# Verify frontend directory exists
if [ ! -d "$FRONTEND_DIR" ]; then
    echo -e "${RED}Error: Frontend directory not found: $FRONTEND_DIR${NC}"
    exit 1
fi

echo -e "${BLUE}Step 1: Syncing frontend files to S3...${NC}"
echo "Source: $FRONTEND_DIR"
echo "Destination: $S3_BUCKET"
echo ""

# Sync HTML files
aws s3 sync "$FRONTEND_DIR/html" "$S3_BUCKET/html" \
    --delete \
    --cache-control "no-cache, no-store, must-revalidate" \
    --content-type "text/html"

echo -e "${GREEN}✓ HTML files synced${NC}"

# Sync CSS files
aws s3 sync "$FRONTEND_DIR/css" "$S3_BUCKET/css" \
    --delete \
    --cache-control "public, max-age=31536000" \
    --content-type "text/css"

echo -e "${GREEN}✓ CSS files synced${NC}"

# Sync JS files
aws s3 sync "$FRONTEND_DIR/js" "$S3_BUCKET/js" \
    --delete \
    --cache-control "public, max-age=31536000" \
    --content-type "application/javascript"

echo -e "${GREEN}✓ JS files synced${NC}"

# Sync any images or assets if they exist
if [ -d "$FRONTEND_DIR/images" ]; then
    aws s3 sync "$FRONTEND_DIR/images" "$S3_BUCKET/images" \
        --delete \
        --cache-control "public, max-age=31536000"
    echo -e "${GREEN}✓ Images synced${NC}"
fi

if [ -d "$FRONTEND_DIR/assets" ]; then
    aws s3 sync "$FRONTEND_DIR/assets" "$S3_BUCKET/assets" \
        --delete \
        --cache-control "public, max-age=31536000"
    echo -e "${GREEN}✓ Assets synced${NC}"
fi

echo ""
echo -e "${BLUE}Step 2: Invalidating CloudFront cache...${NC}"

# Create invalidation
INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
    --paths "/*" \
    --query 'Invalidation.Id' \
    --output text)

echo -e "${GREEN}✓ Invalidation created: $INVALIDATION_ID${NC}"
echo ""

echo -e "${BLUE}Step 3: Waiting for invalidation to complete...${NC}"
aws cloudfront wait invalidation-completed \
    --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
    --id "$INVALIDATION_ID"

echo -e "${GREEN}✓ Invalidation completed${NC}"
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Deployment Successful!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Your application is now available at:"
echo -e "${BLUE}https://d3ao8ook2gaeu9.cloudfront.net/html/login-new.html${NC}"
echo ""
echo -e "Main pages:"
echo -e "  - Login: ${BLUE}https://d3ao8ook2gaeu9.cloudfront.net/html/login-new.html${NC}"
echo -e "  - Main App: ${BLUE}https://d3ao8ook2gaeu9.cloudfront.net/html/index-modular.html${NC}"
echo ""