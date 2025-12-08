# Test Content Velocity API
# Replace YOUR_RAILWAY_URL with your actual Railway deployment URL

$RAILWAY_URL = "https://your-app-name.railway.app"

Write-Host "Testing Content Velocity API" -ForegroundColor Green
Write-Host "================================`n"

# Test 1: Health Check
Write-Host "1. Testing Health Endpoint..." -ForegroundColor Yellow
try {
    $healthResponse = Invoke-RestMethod -Uri "$RAILWAY_URL/health" -Method Get
    Write-Host "✓ Health Check Response:" -ForegroundColor Green
    $healthResponse | ConvertTo-Json
    Write-Host ""
} catch {
    Write-Host "✗ Health Check Failed: $_" -ForegroundColor Red
}

# Test 2: Analyze Velocity with a real website
Write-Host "2. Testing Analyze Velocity Endpoint..." -ForegroundColor Yellow
Write-Host "   (This may take a few minutes as it scrapes the blog)" -ForegroundColor Cyan

$body = @{
    website_url = "example.com"
} | ConvertTo-Json

try {
    $velocityResponse = Invoke-RestMethod -Uri "$RAILWAY_URL/analyze-velocity" -Method Post -Body $body -ContentType "application/json"
    Write-Host "✓ Velocity Analysis Response:" -ForegroundColor Green
    $velocityResponse | ConvertTo-Json -Depth 10
} catch {
    Write-Host "✗ Velocity Analysis Failed: $_" -ForegroundColor Red
    Write-Host "Response: $($_.Exception.Response)" -ForegroundColor Red
}

