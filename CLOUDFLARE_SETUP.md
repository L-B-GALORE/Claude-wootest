# Cloudflare Pages Setup - GitHub Actions Deployment

## Project Created

- **Project Name**: claude-wootestnew-fresh
- **Project ID**: 946d3134-155f-46aa-8ade-fd51265baf9d
- **Production URL**: https://claude-wootestnew-fresh.pages.dev
- **Account ID**: f09bbb81e8be554d6e67b5de063d8925

## GitHub Secrets Required

You need to add these secrets to your GitHub repository:

1. Go to: https://github.com/woophone/Claude-wootest/settings/secrets/actions

2. Click "New repository secret" and add the following:

### Secret 1: CLOUDFLARE_API_TOKEN
3LJ135Ir6HXErMDEe-U98ZlkS9DfeshqbV_znaiu

### Secret 2: CLOUDFLARE_ACCOUNT_ID
f09bbb81e8be554d6e67b5de063d8925

## How It Works

The GitHub Actions workflow will:

1. **On Push to Main**:
   - Build your frontend (from `frontend/` directory)
   - Deploy to production: https://claude-wootestnew-fresh.pages.dev

2. **On Pull Requests**:
   - Build a preview deployment
   - Comment on the PR with the preview URL
   - Each PR gets its own unique URL like: https://pr-123.claude-wootestnew-fresh.pages.dev

## Next Steps

1. Add the GitHub secrets (see above)
2. Commit and push the `.github/workflows/deploy-pages.yml` file to your repository
3. Push to main or create a PR to trigger the first deployment

## Environment Variables (Optional)

If you need different API URLs for staging vs production, you can add these as GitHub secrets:

- `VITE_API_URL_STAGING` (already set in workflow)
- `VITE_API_URL_PRODUCTION` (already set in workflow)

Currently hardcoded to:
- Staging: https://claude-wootestnew-api-staging.woophone.workers.dev
- Production: https://claude-wootestnew-api.woophone.workers.dev
