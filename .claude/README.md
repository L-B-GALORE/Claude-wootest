# Claude Code Instructions for This Project

## CRITICAL: Deployment Safety Rules

**READ THIS BEFORE EVERY COMMIT AND PUSH**

### Default Behavior (ALWAYS)
- ✅ Work on `staging` branch by default
- ✅ Commit to `staging` branch
- ✅ Push to `staging` branch
- ✅ Deploy to staging environment
- ❌ NEVER touch `main` branch unless explicitly instructed

### Production Deployments (EXPLICIT ONLY)
The user will say one of these phrases when they want production deployment:
- "push to production"
- "deploy to production"
- "move this to production"
- "push to main"

**When you hear these phrases:**
1. Run `/push-to-production` command OR
2. Create a PR from `staging` → `main`
3. DO NOT merge directly
4. Let the user review and approve the PR
5. User will merge when ready

### Key Workflow Principles

**Implicit = Staging**
When the user says:
- "commit this"
- "push this"
- "deploy this"
- "make this change"

They mean: commit and push to **staging only**.

**Explicit = Production**
Production requires the explicit magic words listed above.

## Branch Strategy

```
[Feature Work] → staging branch (DEFAULT)
                      ↓
                 Test in staging
                      ↓
          User says "push to production"
                      ↓
              Create PR to main
                      ↓
            User reviews and merges
                      ↓
          Auto-deploy to production
```

## Pre-Push Checklist

Before EVERY `git push`, verify:
1. ✅ Current branch is `staging` (unless explicitly told otherwise)
2. ✅ Changes are intended for staging environment
3. ✅ NOT pushing to main unless user explicitly requested production

## Commands

- `/push-to-production` - Initiate production deployment workflow
- See `.claude/commands/` for other project commands

## Documentation

- `DEPLOYMENT.md` - Full deployment workflow documentation
- See this file for detailed environment info and procedures

## Quick Reference

| Action | Branch | User Says | Behavior |
|--------|--------|-----------|----------|
| Default work | `staging` | "add feature X" | Work on staging |
| Commit code | `staging` | "commit this" | Commit to staging |
| Push code | `staging` | "push this" | Push to staging |
| Production | `main` | "push to production" | Create PR staging→main |

## Environments

- **Staging**: https://staging.claude-wootestnew.pages.dev
- **Production**: https://claude-wootestnew.pages.dev

## Safety Net

Even if you accidentally try to push to production:
- GitHub Actions require manual approval
- User can reject the deployment
- But please follow the rules above to avoid this

## Remember

> "When in doubt, use staging. Production requires explicit permission."

This workflow was established because the user wants careful control over production deployments. Respect this by always defaulting to staging.
