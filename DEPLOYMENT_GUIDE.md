# CloudFront Deployment Guide

## Overview
This guide explains how to deploy the Gestión de Demanda application to AWS CloudFront.

## Prerequisites

1. **AWS CLI installed and configured**
   ```bash
   aws --version
   aws configure
   ```

2. **AWS Credentials with permissions for:**
   - S3 (read/write to the bucket)
   - CloudFront (create invalidations)

## Configuration

### CloudFront Distribution
- **Distribution ID**: E3NQXQXQXQXQXQ (update in `deploy-to-cloudfront.sh`)
- **Domain**: d3ao8ook2gaeu9.cloudfront.net
- **S3 Bucket**: gestion-demanda-frontend (update in `deploy-to-cloudfront.sh`)

### Important Files
- `deploy-to-cloudfront.sh` - Main deployment script
- `invalidate-cloudfront.sh` - Cache invalidation only
- `cloudfront-config.json` - Configuration settings

## Deployment Steps

### 1. Update Configuration
Before first deployment, update the following in `deploy-to-cloudfront.sh`:

```bash
CLOUDFRONT_DISTRIBUTION_ID="YOUR_ACTUAL_DISTRIBUTION_ID"
S3_BUCKET="s3://your-actual-bucket-name"
```

To find your distribution ID:
```bash
aws cloudfront list-distributions --query 'DistributionList.Items[*].[Id,DomainName]' --output table
```

To find your S3 bucket:
```bash
aws s3 ls
```

### 2. Make Script Executable
```bash
chmod +x deploy-to-cloudfront.sh
chmod +x invalidate-cloudfront.sh
```

### 3. Run Deployment
```bash
./deploy-to-cloudfront.sh
```

This script will:
1. ✓ Verify AWS CLI is configured
2. ✓ Sync HTML files to S3 (with no-cache headers)
3. ✓ Sync CSS files to S3 (with long cache)
4. ✓ Sync JS files to S3 (with long cache)
5. ✓ Sync images/assets if they exist
6. ✓ Create CloudFront invalidation
7. ✓ Wait for invalidation to complete

### 4. Verify Deployment
After deployment completes, access your application at:
- **Login**: https://d3ao8ook2gaeu9.cloudfront.net/html/login-new.html
- **Main App**: https://d3ao8ook2gaeu9.cloudfront.net/html/index-modular.html

## Quick Cache Invalidation

If you only need to invalidate the CloudFront cache (without uploading files):

```bash
./invalidate-cloudfront.sh
```

## Deployment Best Practices

### Cache Strategy
- **HTML files**: No cache (`no-cache, no-store, must-revalidate`)
  - Ensures users always get the latest version
- **CSS/JS/Images**: Long cache (`public, max-age=31536000`)
  - Improves performance
  - Use versioning or cache busting for updates

### File Organization
```
frontend/
├── html/          # HTML pages (no cache)
├── css/           # Stylesheets (long cache)
├── js/            # JavaScript files (long cache)
├── images/        # Images (long cache)
└── assets/        # Other assets (long cache)
```

### Deployment Checklist
- [ ] Update configuration in `deploy-to-cloudfront.sh`
- [ ] Test locally before deploying
- [ ] Run deployment script
- [ ] Verify all pages load correctly
- [ ] Check browser console for errors
- [ ] Test authentication flow
- [ ] Verify API connections work

## Troubleshooting

### AWS CLI Not Configured
```bash
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Enter your default region (e.g., us-east-1)
# Enter your default output format (json)
```

### Permission Denied
```bash
chmod +x deploy-to-cloudfront.sh
```

### S3 Sync Fails
- Verify bucket name is correct
- Check AWS credentials have S3 write permissions
- Ensure bucket exists: `aws s3 ls s3://your-bucket-name`

### CloudFront Invalidation Fails
- Verify distribution ID is correct
- Check AWS credentials have CloudFront permissions
- List distributions: `aws cloudfront list-distributions`

### Changes Not Visible
1. Wait for CloudFront invalidation to complete (can take 5-15 minutes)
2. Clear browser cache (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
3. Try incognito/private browsing mode

## Manual Deployment (Alternative)

If the script doesn't work, you can deploy manually:

### 1. Upload to S3
```bash
aws s3 sync ./frontend/html s3://your-bucket/html --delete
aws s3 sync ./frontend/css s3://your-bucket/css --delete
aws s3 sync ./frontend/js s3://your-bucket/js --delete
```

### 2. Invalidate CloudFront
```bash
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"
```

## Environment-Specific Deployments

### Development
```bash
# Use a different S3 bucket or path
S3_BUCKET="s3://gestion-demanda-dev"
```

### Production
```bash
# Use production bucket
S3_BUCKET="s3://gestion-demanda-prod"
```

## Monitoring

### Check Deployment Status
```bash
# List recent invalidations
aws cloudfront list-invalidations --distribution-id YOUR_DISTRIBUTION_ID

# Check specific invalidation
aws cloudfront get-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --id INVALIDATION_ID
```

### View S3 Contents
```bash
aws s3 ls s3://your-bucket/ --recursive
```

## Rollback

To rollback to a previous version:

1. Restore files from S3 versioning (if enabled)
2. Or re-deploy from a previous git commit:
   ```bash
   git checkout <previous-commit>
   ./deploy-to-cloudfront.sh
   git checkout main
   ```

## Additional Resources

- [AWS CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)
- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [AWS CLI Reference](https://docs.aws.amazon.com/cli/)