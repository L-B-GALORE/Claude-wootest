# Push to Production

You are being asked to deploy the current staging code to production.

## Pre-deployment Checklist

Before proceeding, verify:
1. All features have been tested in staging environment
2. No critical bugs or errors exist
3. Database migrations (if any) have been tested in staging
4. User has explicitly confirmed staging is working perfectly

## Deployment Process

Follow these steps:

1. **Verify current branch state**
   - Check that staging branch is up to date
   - Ensure all changes are committed and pushed to staging
   - Verify staging deployment is successful and tested

2. **Create Production Pull Request**
   - Create a PR from `staging` branch to `main` branch
   - Title: "Deploy to Production - [brief description]"
   - Body should include:
     - Summary of changes being deployed
     - Confirmation that staging has been tested
     - List of any database migrations included
     - Any special deployment notes or rollback instructions

3. **Important Warnings**
   - ⚠️ This will deploy to PRODUCTION environment
   - ⚠️ Changes will affect live users immediately
   - ⚠️ Ensure you have tested everything in staging first
   - ⚠️ The PR will require manual approval in GitHub before merge
   - ⚠️ Merging will trigger automatic production deployment via GitHub Actions

4. **After PR Creation**
   - Provide the PR URL to the user
   - User should review the PR in GitHub
   - User must manually approve and merge the PR
   - Monitor the GitHub Actions deployment
   - Verify production deployment succeeds

5. **If Issues Occur**
   - Production deployments create automatic release tags
   - Can rollback using the rollback GitHub Action workflow
   - Reference: `.github/workflows/rollback.yml`

## Safety Notes

- NEVER push directly to main branch
- ALWAYS create a PR for review
- ALWAYS wait for user approval before merging
- The user has configured this workflow to prevent accidental production deployments
- Only proceed if the user has explicitly said "push to production" or equivalent

## Environment Details

- **Staging**: `staging` branch → `https://staging.claude-wootestnew.pages.dev`
- **Production**: `main` branch → `https://claude-wootestnew.pages.dev`
- **Approval**: GitHub Actions require manual approval for production
