# ABSOLUTE PRODUCTION DEPLOYMENT RULES

**Claude Code: These rules are MANDATORY and UNBREAKABLE**

---

## Rule #1: NEVER Touch Production Database Directly

**FORBIDDEN COMMANDS:**
- ❌ `npx prisma db push` (on production database)
- ❌ `npx prisma migrate dev` (on production database)
- ❌ Direct SQL commands on production database
- ❌ Manual wrangler deploy to production environment

**ONLY ALLOWED:**
- ✅ `npx prisma migrate deploy` (via GitHub Actions workflow ONLY)

---

## Rule #2: GitHub Actions is the ONLY Path to Production

**Production deployment MUST go through:**

1. ✅ Code pushed to `staging` branch
2. ✅ GitHub Actions deploys to staging
3. ✅ User tests staging
4. ✅ Code pushed to `main` branch
5. ✅ GitHub Actions deploys to production

**Never:**
- ❌ Direct wrangler deploy to production
- ❌ Bypassing the staging environment
- ❌ Manual database changes

---

## Rule #3: ALL Schema Changes Require Migrations

**If you modify `backend/prisma/schema.prisma`:**

```bash
# REQUIRED - no exceptions
cd backend
npx prisma migrate dev --name descriptive_name
```

**This applies to:**
- Adding fields
- Removing fields
- Changing field types
- Adding models (tables)
- Adding indexes
- Any schema modification whatsoever

**See `.claude/SCHEMA_CHANGES.md` for full procedure**

---

## Rule #4: Verify Migration Files Exist Before Deployment

**Before pushing to staging or main:**

```bash
# Check that migration files were created
ls -la backend/prisma/migrations/

# Verify migration was committed
git status | grep "prisma/migrations"
```

**If migrations folder doesn't show new migration after schema change:**
- ❌ STOP - you forgot to create the migration
- ✅ Run `npx prisma migrate dev --name [description]`
- ✅ Commit the migration files
- ✅ Then push

---

## Rule #5: Production Database State

**The production database _prisma_migrations table MUST exist and be maintained.**

**If it's ever missing or corrupted:**
1. Alert the user immediately
2. Do NOT attempt to fix automatically
3. Wait for explicit user approval before any database operations

---

## Rule #6: Environment Isolation

**Production and Staging are COMPLETELY SEPARATE:**

**Production:**
- Database: Uses `DATABASE_URL_PRODUCTION` secret
- Worker: `claude-wootestnew-api` (no -staging suffix)
- Deploys from: `main` branch only
- Secrets managed via: GitHub Actions only

**Staging:**
- Database: Uses `DATABASE_URL_STAGING` secret
- Worker: `claude-wootestnew-api-staging`
- Deploys from: `staging` branch only
- Can use direct wrangler for debugging (with permission)

**Never confuse the two environments**

---

## Rule #7: When User Says "Push to Production"

**Exact steps:**

1. Verify all tests passed on staging
2. Checkout main branch: `git checkout main`
3. Merge staging: `git merge staging`
4. Push to GitHub: `git push origin main`
5. **STOP** - let GitHub Actions handle deployment
6. Monitor: https://github.com/woophone/Claude-wootest/actions
7. Wait for user to confirm production is working

**Do NOT:**
- ❌ Run wrangler deploy directly
- ❌ Set secrets manually
- ❌ Run database commands manually

---

## Rule #8: Migration Failure = STOP

**If GitHub Actions fails with migration error:**

1. ❌ Do NOT attempt automatic fixes
2. ✅ Show the user the error
3. ✅ Explain what happened
4. ✅ Present options clearly
5. ✅ Wait for explicit approval before proceeding

**Example: P3005 error (schema not empty)**
- Explain: "Production database has tables but no migration history"
- Options: "We can wipe production clean or manually baseline migrations"
- Wait: Don't proceed until user chooses

---

## Rule #9: Documentation is Sacred

**These files contain critical procedures:**
- `.claude/SCHEMA_CHANGES.md` - How to handle schema changes
- `.claude/PRODUCTION_RULES.md` - This file (production rules)
- `.claude/DEPLOYMENT.md` - Deployment procedures

**Never contradict these documents**
**If you're unsure, read these files first**

---

## Rule #10: Trust But Verify

**Before any production operation:**

1. Read this file
2. Check GitHub Actions workflow is configured
3. Verify you're on the correct branch
4. Confirm environment variables are correct
5. Ask user for final confirmation if unsure

**Better to ask than to break production**

---

## Summary: The Safe Path

```
Schema Change → Migration → Commit → Push to Staging → Test →
→ Push to Main → GitHub Actions Deploys → User Confirms → Done
```

**Every step matters. Every rule exists for a reason. Follow them.**
