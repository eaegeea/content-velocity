# Railway GitHub Connection Setup

## Verify GitHub Repository

1. **Check if code is on GitHub:**
   - Go to: https://github.com/eaegeea/content-velocity
   - Verify you can see all the files (src/, package.json, nixpacks.toml, etc.)
   - Check the commit history to see if recent commits are there

2. **Verify Git Remote:**
   ```powershell
   git remote -v
   ```
   Should show: `origin  https://github.com/eaegeea/content-velocity.git`

3. **Check if you need to push:**
   ```powershell
   git status
   git log --oneline -3
   ```

## Connect Railway to GitHub

If Railway isn't auto-deploying, you need to connect it:

### Option 1: Connect via Railway Dashboard (Recommended)

1. Go to https://railway.app
2. Open your project
3. Click on your service
4. Go to **Settings** tab
5. Scroll to **Source** section
6. Click **Connect Repo** or **Change Source**
7. Select **GitHub** as the source
8. Authorize Railway to access your GitHub account (if prompted)
9. Select the repository: `eaegeea/content-velocity`
10. Select the branch: `main`
11. Enable **Auto Deploy** (should be on by default)

### Option 2: Manual Deploy

If auto-deploy isn't working:

1. In Railway dashboard, go to **Deployments** tab
2. Click **New Deployment** or **Deploy Latest Commit**
3. Select the commit you want to deploy

### Option 3: Reconnect Repository

If the connection seems broken:

1. In Railway service settings, click **Disconnect** under Source
2. Then click **Connect Repo** again
3. Re-authorize and select the repository

## Verify Webhook

After connecting, Railway should create a webhook in your GitHub repo:

1. Go to: https://github.com/eaegeea/content-velocity/settings/hooks
2. You should see a Railway webhook
3. If not present, Railway might not be properly connected

## Test the Connection

1. Make a small change to any file
2. Commit and push:
   ```powershell
   git add .
   git commit -m "Test Railway auto-deploy"
   git push origin main
   ```
3. Check Railway dashboard - a new deployment should start automatically

## Troubleshooting

- **No deployments showing**: Railway might not be connected to the repo
- **Builds failing**: Check the build logs in Railway
- **"Repository not found"**: Make sure Railway has access to your GitHub account
- **No auto-deploy**: Check that Auto Deploy is enabled in Railway settings

