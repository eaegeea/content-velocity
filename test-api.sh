#!/bin/bash
# Test Content Velocity API
# Replace YOUR_RAILWAY_URL with your actual Railway deployment URL

RAILWAY_URL="https://your-app-name.railway.app"

echo "Testing Content Velocity API"
echo "================================"
echo ""

# Test 1: Health Check
echo "1. Testing Health Endpoint..."
curl -X GET "$RAILWAY_URL/health" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n" \
  -s | jq '.'

echo ""

# Test 2: Analyze Velocity
echo "2. Testing Analyze Velocity Endpoint..."
echo "   (This may take a few minutes as it scrapes the blog)"
curl -X POST "$RAILWAY_URL/analyze-velocity" \
  -H "Content-Type: application/json" \
  -d '{"website_url": "example.com"}' \
  -w "\nStatus: %{http_code}\n" \
  -s | jq '.'

