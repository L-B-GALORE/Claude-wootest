# Database Schema Changes - MANDATORY PROCEDURE

**CRITICAL: Claude Code MUST follow this procedure for ALL schema changes**

This document establishes the mandatory process for database schema modifications. Following this procedure is NON-NEGOTIABLE and must happen automatically without user prompting.

---

## The Golden Rule

**IF YOU MODIFY `backend/prisma/schema.prisma`, YOU MUST CREATE A MIGRATION.**

No exceptions. No shortcuts. Every single time.

---

## Why This Matters

**What happens if you skip creating a migration:**

1. Code expects new schema structure
2. Database still has old schema structure
3. Application crashes with database errors
4. Production breaks when deployed
5. No way to rollback safely
6. User loses trust in the system

**What happens when you follow the procedure:**

1. Schema changes are tracked in version control
2. Migrations run automatically during deployment
3. Staging tests the migration before production
4. Production applies the same tested migration
5. Rollback is possible using migration history
6. Everything works smoothly

---

## MANDATORY Procedure - Schema Changes

### Step 1: Modify Schema (if needed)

Edit `backend/prisma/schema.prisma` with your changes.

Examples:
- Adding a new model (table)
- Adding fields to existing models
- Changing field types
- Adding indexes or constraints
- Modifying relationships

### Step 2: Create Migration (REQUIRED)

**IMMEDIATELY after modifying schema.prisma, run:**

```bash
cd backend
npx prisma migrate dev --name descriptive_name
```

**The `--name` should describe the change:**
- Good: `add_priority_to_conversations`
- Good: `create_tags_table`
- Good: `add_index_to_messages`
- Bad: `migration` (not descriptive)
- Bad: `update` (vague)

**What this command does:**
1. Compares schema.prisma to current database
2. Generates SQL migration file
3. Applies migration to development database
4. Updates Prisma Client types
5. Records migration in migration history

**Output you'll see:**
```
Prisma Migrate created a new migration:
migrations/
  └─ 20251030123456_add_priority_to_conversations/
      └─ migration.sql

Generated Prisma Client
```

### Step 3: Review Migration SQL

**Check the generated migration file:**

```bash
cat backend/prisma/migrations/[timestamp]_[name]/migration.sql
```

**Verify:**
- SQL looks correct
- No accidental destructive changes (DROP TABLE, DROP COLUMN)
- Default values are sensible
- Data won't be lost

**For complex migrations** (type changes, column renames), you may need to edit the SQL file to add data transformation logic.

### Step 4: Test Locally

The migration already ran on your local database (from step 2), but verify:

```bash
# Generate fresh Prisma Client
cd backend
npx prisma generate

# If you have tests, run them
npm test
```

### Step 5: Commit Everything

**Commit BOTH the schema AND migration files:**

```bash
git add backend/prisma/schema.prisma
git add backend/prisma/migrations/
git commit -m "Add [description of schema change]

- Modified schema: [what changed]
- Created migration: [migration_name]
- Tested locally: [what you verified]

Generated with Claude Code"
```

### Step 6: Push to Staging

```bash
git push origin staging
```

**What happens automatically:**
1. GitHub Actions runs: `npx prisma migrate deploy`
2. Migration applies to STAGING database
3. Backend deploys with new schema
4. Frontend deploys

### Step 7: Test in Staging

**Verify in staging environment:**
- New fields/tables are accessible
- Existing data is intact
- No errors in application logs
- Features using new schema work correctly

### Step 8: Push to Production (when ready)

When user says "push to production":
1. Create PR from staging → main
2. Mention in PR description: "Includes database migration: [name]"
3. User reviews and merges
4. Same migration runs on PRODUCTION database automatically

---

## How Migrations Flow Through Environments

**The migration files ARE code - they travel through git:**

```
1. Create in staging branch:
   npx prisma migrate dev --name add_priority
   └─ Creates: backend/prisma/migrations/20251030_add_priority/migration.sql

2. Commit and push to staging:
   git add backend/prisma/migrations/
   git push origin staging
   └─ Migration FILE goes to GitHub
   └─ GitHub Actions runs: npx prisma migrate deploy
   └─ Applies migration.sql to STAGING database

3. Merge staging → main (production):
   └─ Migration FILE travels through git to main branch
   └─ GitHub Actions runs: npx prisma migrate deploy
   └─ Applies SAME migration.sql to PRODUCTION database
```

**Key insight:** The `.sql` files in your repo are the source of truth. When deployed, Prisma reads these files and applies them to the database.

---

## Common Schema Changes

### Adding a New Field

```prisma
model Conversation {
  // ... existing fields
  priority Int @default(1)  // New field
}
```

**Migration will generate:**
```sql
ALTER TABLE "conversations" ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 1;
```

### Adding a New Table

```prisma
model Tag {
  id        String   @id @default(uuid())
  name      String
  color     String?
  createdAt DateTime @default(now())
}
```

**Migration will generate:**
```sql
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("id")
);
```

### Making Field Optional

```prisma
model User {
  // Before: name String
  name String?  // Now optional
}
```

**Migration will generate:**
```sql
ALTER TABLE "users" ALTER COLUMN "name" DROP NOT NULL;
```

### Adding Relationship

```prisma
model Conversation {
  tags ConversationTag[]  // New relation
}

model Tag {
  conversations ConversationTag[]
}

model ConversationTag {
  id             String       @id @default(uuid())
  conversationId String
  tagId          String
  conversation   Conversation @relation(fields: [conversationId], references: [id])
  tag            Tag          @relation(fields: [tagId], references: [id])

  @@unique([conversationId, tagId])
}
```

---

## Checklist for Claude Code

**Before committing ANY schema change:**

- [ ] Modified `backend/prisma/schema.prisma`
- [ ] Ran `npx prisma migrate dev --name descriptive_name`
- [ ] Migration file created in `backend/prisma/migrations/`
- [ ] Reviewed migration SQL (no accidental drops)
- [ ] Ran `npx prisma generate` to update client
- [ ] Added both schema.prisma AND migrations/ to git
- [ ] Committed with descriptive message
- [ ] Ready to push to staging

**If ANY checkbox is unchecked, DO NOT COMMIT.**

---

## What Claude Code Will Do Automatically

From now on, Claude Code will:

1. **Always recognize** when schema.prisma is modified
2. **Always run** `npx prisma migrate dev` immediately after
3. **Always commit** both schema and migration files together
4. **Always mention** in commit message that migration was created
5. **Never skip** this process, even if user doesn't mention it
6. **Always test** in staging before production

**The user NEVER needs to ask for this. It happens automatically.**

---

## Complex Migrations - Special Cases

Some changes need custom SQL because Prisma can't detect intent:

### Renaming a Column

**Problem:** Prisma sees it as DROP + ADD (data loss!)

**Solution:** Edit migration SQL manually

```sql
-- Instead of:
-- ALTER TABLE "users" DROP COLUMN "phone";
-- ALTER TABLE "users" ADD COLUMN "phone_number" TEXT;

-- Use:
ALTER TABLE "users" RENAME COLUMN "phone" TO "phone_number";
```

### Changing Column Type

**Problem:** May need data conversion

**Solution:** Multi-step migration

```sql
-- Step 1: Add new column
ALTER TABLE "conversations" ADD COLUMN "priority_new" INTEGER;

-- Step 2: Convert and copy data
UPDATE "conversations" SET "priority_new" = CAST("priority" AS INTEGER);

-- Step 3: Drop old column
ALTER TABLE "conversations" DROP COLUMN "priority";

-- Step 4: Rename new column
ALTER TABLE "conversations" RENAME COLUMN "priority_new" TO "priority";
```

### Data Backfill

**Problem:** New required field needs values for existing rows

**Solution:** Two-step migration

```sql
-- Step 1: Add as optional
ALTER TABLE "users" ADD COLUMN "role" TEXT;

-- Step 2: Backfill data
UPDATE "users" SET "role" = 'AGENT' WHERE "role" IS NULL;

-- Step 3: Make required
ALTER TABLE "users" ALTER COLUMN "role" SET NOT NULL;
```

---

## Red Flags - Stop and Think

**If you're about to:**

- Drop a table - Will delete ALL data, very dangerous
- Drop a column - Will delete ALL data in that column
- Change column type - May cause data loss or conversion errors
- Make nullable field required - Existing NULLs will break
- Rename column/table - Prisma can't detect, needs manual SQL

**Then:**

1. **STOP** and think about data preservation
2. **Check** if there's existing data that will be affected
3. **Test** in staging extra carefully
4. **Consider** multi-step migration for safety
5. **Ask user** if unclear about data loss implications

---

## Error Recovery

### "Migration failed to apply"

**In staging:**
1. Fix the migration SQL issue
2. Create a new migration that fixes it
3. Push again to staging
4. Test thoroughly

**In production:**
1. DO NOT PANIC
2. Check if rollback is needed
3. Fix in staging first
4. Test fix thoroughly in staging
5. Then deploy fix to production

### "Forgot to create migration"

**If you realize AFTER committing but BEFORE pushing:**

```bash
# Create the migration now
cd backend
npx prisma migrate dev --name forgot_to_create

# Amend previous commit to include it
git add backend/prisma/migrations/
git commit --amend --no-edit

# Push
git push origin staging
```

**If you already pushed to staging:**

1. Staging deployment will fail (good! caught early)
2. Create the migration locally
3. Commit it: "Add missing migration for [schema change]"
4. Push to staging again
5. Verify deployment succeeds

---

## Examples - Full Workflow

### Example 1: Adding Priority Field

**User request:** "Add a priority field to conversations"

**Claude's process:**

1. Modify schema:
```prisma
model Conversation {
  // ... existing fields
  priority Int @default(1)
}
```

2. Create migration:
```bash
cd backend
npx prisma migrate dev --name add_priority_to_conversations
```

3. Review migration.sql:
```sql
ALTER TABLE "conversations" ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 1;
```

4. Commit:
```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "Add priority field to conversations

- Added priority field with default value of 1
- Created migration: add_priority_to_conversations
- All existing conversations will have priority=1

Generated with Claude Code"
```

5. Push to staging:
```bash
git push origin staging
```

6. Report to user: "Added priority field to conversations. Migration created and pushed to staging. Test at: https://staging.claude-wootestnew.pages.dev"

### Example 2: Creating Tags Feature

**User request:** "Let's add tags to conversations"

**Claude's process:**

1. Modify schema - add Tag, ConversationTag models
2. Create migration: `npx prisma migrate dev --name create_tags_and_conversation_tags`
3. Review migration.sql
4. Commit and push following same process as Example 1

---

## Summary - What You Need to Know

**For the user:**

- You don't need to ask me to create migrations - I'll do it automatically
- You don't need to remind me - it's built into my process now
- You can trust that schema changes will be handled correctly
- Just ask for features, I'll handle the database part
- Staging will test migrations before production
- If something goes wrong, we catch it in staging

**For Claude Code:**

- Schema changes = migrations, ALWAYS
- Never commit schema.prisma without migration
- Never skip this, never forget this
- This is as important as git commit itself
- User doesn't need to ask, just do it

---

## This is a System Guarantee

This procedure is not optional. This procedure is not dependent on user request. This procedure is AUTOMATIC.

**When schema changes, migrations happen. Period.**
