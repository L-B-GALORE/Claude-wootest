#!/bin/bash
# Script to create a new Cloudflare Pages project
# Run this locally and provide the output back

set -e

# Cloudflare credentials
ACCOUNT_ID="f09bbb81e8be554d6e67b5de063d8925"
API_TOKEN="3LJ135Ir6HXErMDEe-U98ZlkS9DfeshqbV_znaiu"
PROJECT_NAME="claude-wootestnew-fresh"
GITHUB_REPO="woophone/Claude-wootest"

echo "========================================="
echo "Cloudflare Pages Setup Script"
echo "========================================="
echo ""

# Function to make API calls
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3

    if [ -n "$data" ]; then
        curl -s -X "$method" \
            "https://api.cloudflare.com/client/v4/$endpoint" \
            -H "Authorization: Bearer $API_TOKEN" \
            -H "Content-Type: application/json" \
            -d "$data"
    else
        curl -s -X "$method" \
            "https://api.cloudflare.com/client/v4/$endpoint" \
            -H "Authorization: Bearer $API_TOKEN" \
            -H "Content-Type: application/json"
    fi
}

echo "Step 1: Checking existing Pages projects..."
EXISTING=$(api_call GET "accounts/$ACCOUNT_ID/pages/projects")
echo "$EXISTING" | jq -r '.result[]? | .name' | head -5
echo ""

echo "Step 2: Creating new Pages project: $PROJECT_NAME"
CREATE_PAYLOAD='{
  "name": "'$PROJECT_NAME'",
  "production_branch": "main",
  "build_config": {
    "build_command": "npm run build",
    "destination_dir": "dist",
    "root_dir": "frontend"
  }
}'

CREATE_RESULT=$(api_call POST "accounts/$ACCOUNT_ID/pages/projects" "$CREATE_PAYLOAD")
echo "$CREATE_RESULT" | jq '.'
echo ""

# Extract project details
PROJECT_SUBDOMAIN=$(echo "$CREATE_RESULT" | jq -r '.result.subdomain // empty')
PROJECT_ID=$(echo "$CREATE_RESULT" | jq -r '.result.id // empty')

if [ -z "$PROJECT_SUBDOMAIN" ]; then
    echo "ERROR: Failed to create project. Response:"
    echo "$CREATE_RESULT" | jq '.'
    exit 1
fi

echo "========================================="
echo "SUCCESS! Project Created"
echo "========================================="
echo ""
echo "Project Name: $PROJECT_NAME"
echo "Project ID: $PROJECT_ID"
echo "Production URL: https://$PROJECT_SUBDOMAIN.pages.dev"
echo ""
echo "========================================="
echo "NEXT STEPS (Manual in Cloudflare Dashboard):"
echo "========================================="
echo ""
echo "1. Go to: https://dash.cloudflare.com/$ACCOUNT_ID/pages/view/$PROJECT_NAME"
echo ""
echo "2. Click 'Connect to Git'"
echo ""
echo "3. Select GitHub repository: $GITHUB_REPO"
echo ""
echo "4. Configure branches:"
echo "   - Production branch: main"
echo "   - Preview branches: All non-production branches"
echo ""
echo "5. Build settings (should auto-fill):"
echo "   - Framework preset: Vite"
echo "   - Build command: npm run build"
echo "   - Build output directory: dist"
echo "   - Root directory: frontend"
echo ""
echo "6. Environment variables (Add these in Settings > Environment variables):"
echo "   - VITE_API_URL_STAGING = https://claude-wootestnew-api-staging.woophone.workers.dev"
echo "   - VITE_API_URL_PRODUCTION = https://claude-wootestnew-api.woophone.workers.dev"
echo ""
echo "========================================="
echo "COPY THIS OUTPUT AND SEND TO CLAUDE"
echo "========================================="
echo ""
echo "PROJECT_DETAILS:"
echo "NAME=$PROJECT_NAME"
echo "ID=$PROJECT_ID"
echo "SUBDOMAIN=$PROJECT_SUBDOMAIN"
echo "URL=https://$PROJECT_SUBDOMAIN.pages.dev"
echo "ACCOUNT_ID=$ACCOUNT_ID"
echo ""
echo "After you complete the Git connection in Cloudflare dashboard,"
echo "send this output back to Claude to update GitHub Actions."
