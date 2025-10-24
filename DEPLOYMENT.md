# Deployment Guide

This document explains how automatic deployment works and how to set it up.

## GitHub Actions Setup

The repository uses GitHub Actions to automatically deploy to Cloudflare whenever code is pushed.

### One-Time Setup Required

You need to add your Cloudflare API token as a GitHub Secret:

1. **Go to your GitHub repository**: https://github.com/woophone/Claude-wootest
2. **Click**: Settings → Secrets and variables → Actions
3. **Click**: "New repository secret"
4. **Name**: `CLOUDFLARE_API_TOKEN`
5. **Value**: Paste your Cloudflare API token: `I2qMHoufZ9gt5GQEZb5HBdOjZ6FLW73gFXP3zHWO`
6. **Click**: "Add secret"

That's it! After this one-time setup, everything deploys automatically.

---

## How Automatic Deployment Works

### Backend (Cloudflare Workers)

**Trigger**: Pushing code to `backend/` directory
**Workflow**: `.github/workflows/deploy-backend.yml`
**What it does**:
1. Installs backend dependencies
2. Deploys Worker using Wrangler
3. Worker available at: `https://customer-service-platform-api.f09bbb81e8be554d6e67b5de063d8925.workers.dev`

### Frontend (Cloudflare Pages)

**Trigger**: Pushing code to `frontend/` directory
**Workflow**: `.github/workflows/deploy-frontend.yml`
**What it does**:
1. Installs frontend dependencies
2. Builds React app with Vite
3. Deploys to Cloudflare Pages
4. Frontend available at: `https://customer-service-platform.pages.dev`

---

## Deployment Process

Every time Claude (or you) pushes code:

1. **Code is pushed** to GitHub
2. **GitHub Actions detects** the push
3. **Workflows run** automatically
4. **Deployment completes** in ~2-3 minutes
5. **Live URLs update** with new code

You can view deployment status:
- Go to: https://github.com/woophone/Claude-wootest/actions
- See real-time deployment progress
- View logs if anything fails

---

## Manual Deployment

You can also trigger deployments manually:

1. Go to: https://github.com/woophone/Claude-wootest/actions
2. Click on "Deploy Backend" or "Deploy Frontend"
3. Click "Run workflow"
4. Select the branch
5. Click "Run workflow"

---

## Environment Variables

The workflows use these environment variables:

**Backend**:
- `CLOUDFLARE_API_TOKEN` - Your API token (from GitHub Secrets)
- Account ID is hardcoded in wrangler.toml

**Frontend Build**:
- `VITE_API_URL` - Backend Worker URL
- `VITE_WS_URL` - WebSocket URL (same Worker)

These are automatically set in the workflow files.

---

## What You Never Have to Do

✅ Never manually run `wrangler deploy`
✅ Never manually build the frontend
✅ Never manually upload files
✅ Never SSH into servers
✅ Never configure deployments

**Just push code, and it deploys automatically!**

---

## Viewing Your Deployed Apps

**Backend Worker**:
- URL: https://customer-service-platform-api.f09bbb81e8be554d6e67b5de063d8925.workers.dev
- Cloudflare Dashboard: https://dash.cloudflare.com/f09bbb81e8be554d6e67b5de063d8925/workers/services/view/customer-service-platform-api

**Frontend Pages**:
- URL: https://customer-service-platform.pages.dev
- Cloudflare Dashboard: https://dash.cloudflare.com/f09bbb81e8be554d6e67b5de063d8925/pages

---

## Next Steps

After adding the GitHub Secret, you're all set! Claude will:
1. Write code
2. Commit and push
3. GitHub Actions deploys automatically
4. You test the live URLs

Easy! 🚀
