# Deployment Workflow

This document defines the safe deployment workflow for this project.

## Overview

This project uses a two-stage deployment process:
- **Staging**: For testing and validation
- **Production**: For live users

## Default Workflow (Safe by Default)

### When Claude Code Makes Changes

**DEFAULT = STAGING ONLY**

When you ask Claude Code to:
- "Commit this"
- "Push this"
- "Deploy this"
- Make any code changes

Claude will **ALWAYS**:
1. Work on the `staging` branch
2. Commit to staging
3. Push to staging
4. Deploy to staging environment only

**Production is NEVER touched unless you explicitly say so.**

## Branch Structure

```
staging branch (default)
    ↓
    Automatic deployment to staging environment
    ↓
    Test and validate
    ↓
    Explicit "push to production" command
    ↓
    Create PR: staging → main
    ↓
    Manual approval and merge
    ↓
    Automatic deployment to production
```

## Environments

### Staging Environment
- **Branch**: `staging`
- **Frontend**: https://staging.claude-wootestnew.pages.dev
- **Backend API**: https://claude-wootestnew-api-staging.lilboo.workers.dev
- **Database**: Staging database (separate from production)
- **Purpose**: Testing all changes before production
- **Auto-deploy**: Yes, on push to staging branch

### Production Environment
- **Branch**: `main`
- **Frontend**: https://claude-wootestnew.pages.dev
- **Backend API**: https://claude-wootestnew-api.lilboo.workers.dev
- **Database**: Production database (live data)
- **Purpose**: Live application for real users
- **Auto-deploy**: Yes, on merge to main (requires approval)

## How to Deploy

### Deploy to Staging (Default)

Just ask Claude Code normally:
- "Add a new feature X"
- "Fix bug Y"
- "Update the UI"

Claude will automatically:
1. Make the changes
2. Commit to staging branch
3. Push to staging
4. Staging auto-deploys via GitHub Actions

Then test at: https://staging.claude-wootestnew.pages.dev

### Deploy to Production (Explicit Only)

After testing in staging and confirming everything works perfectly:

1. **Say the magic words**: "push to production" (or similar explicit request)

2. **Claude will**:
   - Create a Pull Request from `staging` → `main`
   - Include summary of all changes
   - List any database migrations
   - Provide PR URL for review

3. **You must**:
   - Review the PR in GitHub
   - Approve the deployment
   - Merge the PR

4. **GitHub Actions will**:
   - Require manual approval (protection rule)
   - Deploy backend to production
   - Deploy frontend to production
   - Create a release tag for rollback capability

## Special Commands

### Push to Production
```
/push-to-production
```
Or just say: "push to production", "deploy to production", "push this to main"

This triggers the explicit production deployment workflow.

## Safety Features

### Automatic Protections
1. **Default branch**: Claude always uses `staging`
2. **Explicit production**: Must use specific phrases to trigger production
3. **PR requirement**: Production always requires PR review
4. **Approval gate**: GitHub Actions require manual approval for production
5. **Release tags**: Automatic tagging for rollback capability

### Manual Protections
- Review all PRs before merging to main
- Test thoroughly in staging first
- Check GitHub Actions logs during deployment
- Monitor production after deployment

## Rollback Procedure

If production deployment has issues:

1. **Quick rollback** (recommended):
   - Go to GitHub Actions
   - Run "Rollback Production" workflow
   - Select the previous release tag
   - This redeploys the previous working version

2. **Database migrations**:
   - Migrations are NOT automatically rolled back
   - May need manual intervention if schema changed
   - Test rollback in staging first if possible

3. **Create hotfix**:
   - Fix the issue in staging branch
   - Test in staging
   - Use `/push-to-production` to deploy fix

## Common Scenarios

### Adding a New Feature
1. Ask Claude: "Add feature X"
2. Claude commits and pushes to staging
3. Test at staging URL
4. When ready: "push to production"
5. Review and merge PR

### Fixing a Bug
1. Ask Claude: "Fix bug Y"
2. Claude commits and pushes to staging
3. Verify fix in staging
4. When ready: "push to production"
5. Review and merge PR

### Emergency Production Hotfix
1. Ask Claude: "Fix critical bug Z"
2. Claude fixes in staging (tests there first!)
3. Immediately say: "push to production" (if tested)
4. Fast-track PR review and merge
5. Monitor production deployment

### Updating Configuration
1. Ask Claude: "Update config setting"
2. Claude updates in staging
3. Test configuration in staging
4. When ready: "push to production"
5. Review and merge PR

## Database Migrations

### Staging Migrations
- Run automatically with staging deployments
- Use staging database (safe to test)
- Prisma migrations are tracked in version control

### Production Migrations
- Run automatically with production deployments
- CRITICAL: Test migrations in staging first!
- Cannot be automatically rolled back
- Schema changes affect live data

### Best Practices
1. Always test migrations in staging first
2. Create backup-friendly migrations (additive when possible)
3. Avoid destructive changes (dropping columns/tables)
4. Plan rollback strategy before deploying
5. Monitor migration logs during deployment

## Environment Variables

Different environments use different secrets:

### Staging
- `DATABASE_URL_STAGING`
- `ENCRYPTION_KEY_STAGING`
- `JWT_SECRET` (shared)
- `VITE_API_URL` (staging API)

### Production
- `DATABASE_URL_PRODUCTION`
- `ENCRYPTION_KEY_PRODUCTION`
- `JWT_SECRET` (shared)
- `VITE_API_URL` (production API)

Configured in GitHub Secrets and wrangler.toml

## GitHub Actions Workflows

### Deploy to Staging
- **File**: `.github/workflows/deploy-staging.yml`
- **Trigger**: Push to `staging` branch
- **Runs**: Automatically, no approval needed
- **Deploys**: Backend → Frontend

### Deploy to Production
- **File**: `.github/workflows/deploy-production.yml`
- **Trigger**: Push to `main` branch
- **Runs**: Requires manual approval
- **Deploys**: Backend → Frontend → Create release tag

### Rollback Production
- **File**: `.github/workflows/rollback.yml`
- **Trigger**: Manual only
- **Input**: Release tag to rollback to
- **Deploys**: Previous version to production

## Troubleshooting

### Staging deployment failed
1. Check GitHub Actions logs
2. Fix the issue
3. Commit and push to staging again
4. Automatic retry via new push

### Production deployment failed
1. Check GitHub Actions logs
2. DO NOT merge more changes yet
3. Fix in staging branch
4. Test fix in staging
5. If critical: rollback production to previous release
6. Then create new PR with fix

### Accidentally pushed to main
1. DO NOT PANIC
2. GitHub Actions require approval - just don't approve
3. Close the PR or reject the deployment
4. Changes won't deploy without approval

### Claude tries to push to production
1. This shouldn't happen with new workflow
2. If it does: decline/reject the action
3. Remind Claude: "only push to staging"
4. Report the issue (workflow may need adjustment)

## Summary

**Remember**:
- 🟢 Staging = default, automatic, safe
- 🔴 Production = explicit, manual review, careful
- 🛡️ Always test in staging first
- ✅ Always review PRs before merging to main
- 🏷️ Release tags enable rollback
- 📝 Document any special deployment requirements

**Golden Rule**: When in doubt, stay in staging.
