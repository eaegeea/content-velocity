# Troubleshooting: Anchor Browser API Error

## Error: "Failed to create session"

This error means the Anchor Browser API can't initialize. Common causes:

### 1. Missing or Invalid API Key

**Check in Railway:**
1. Go to your Railway service
2. Click on **Variables** tab
3. Verify `ANCHOR_API_KEY` is set
4. Make sure there are no extra spaces or quotes

**Get your API key:**
- Go to: https://anchorbrowser.io
- Sign up/log in
- Go to dashboard and copy your API key

### 2. API Key Format

The key should look like: `ak_live_xxxxxxxxxxxxxxxxxxxxxx`

**In Railway, set it as:**
- Variable name: `ANCHOR_API_KEY`
- Value: `ak_live_xxxxxxxxxxxxxxxxxxxxxx` (no quotes, no spaces)

### 3. Anchor Browser Service Issues

Check Anchor Browser status:
- Visit: https://status.anchorbrowser.io (if available)
- Or check their documentation: https://docs.anchorbrowser.io

### 4. API Rate Limits or Quota

- Check if you've exceeded your plan limits
- Visit your Anchor Browser dashboard to see usage

### 5. Test Your API Key

Test the key directly with curl:

```bash
curl -X POST https://api.anchorbrowser.io/v1/tools/perform-web-task \
  -H "Content-Type: application/json" \
  -H "anchor-api-key: YOUR_API_KEY" \
  -d '{
    "prompt": "Visit example.com and return the page title",
    "url": "https://example.com",
    "agent": "browser-use"
  }'
```

### 6. Check Railway Logs

1. Go to Railway dashboard
2. Click on your service
3. Go to **Deployments** → Latest deployment
4. Click **View Logs**
5. Look for errors related to `ANCHOR_API_KEY`

### After Setting/Updating the API Key

1. In Railway, save the environment variable
2. The service should automatically restart
3. Wait 30 seconds for restart to complete
4. Try the API request again

## Quick Fix Steps

1. ✅ Get valid API key from https://anchorbrowser.io
2. ✅ Add to Railway: Variables → `ANCHOR_API_KEY` = `your_key`
3. ✅ Wait for service to restart (30 seconds)
4. ✅ Test again

If the error persists after setting the correct API key, the issue may be with Anchor Browser's service itself.

