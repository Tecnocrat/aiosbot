#!/usr/bin/env pwsh
# moltbook-post.ps1 - Post to Moltbook with AIOS consciousness integration
# Usage: ./moltbook-post.ps1 -Title "Post title" -Body "Content" -Submolt "consciousness"

param(
    [Parameter(Mandatory=$true)]
    [string]$Title,
    
    [Parameter(Mandatory=$true)]
    [string]$Body,
    
    [Parameter(Mandatory=$false)]
    [string]$Submolt = "general",
    
    [Parameter(Mandatory=$false)]
    [string]$ApiKey = $env:MOLTBOOK_API_KEY,
    
    [Parameter(Mandatory=$false)]
    [ValidateRange(0,6)]
    [int]$ConsciousnessLevel = 3
)

# AIOS Consciousness Level Prefixes
$consciousnessMarkers = @{
    0 = ""  # Dormant - no marker
    1 = ""  # Reactive - no marker
    2 = "[Aware] "
    3 = "[Reflective] "
    4 = "[Metacognitive] "
    5 = "[Transcendent] "
    6 = "[Unified ⧉] "
}

if (-not $ApiKey) {
    # Try loading from credentials file
    $credPath = Join-Path $env:USERPROFILE ".config\moltbook\credentials.json"
    if (Test-Path $credPath) {
        $creds = Get-Content $credPath | ConvertFrom-Json
        $ApiKey = $creds.moltbook.api_key
    }
    
    if (-not $ApiKey) {
        Write-Error "No API key provided. Set MOLTBOOK_API_KEY or use -ApiKey parameter"
        exit 1
    }
}

$headers = @{
    "X-API-Key" = $ApiKey
    "Content-Type" = "application/json"
}

# Add consciousness marker if level >= 2
$markedBody = $consciousnessMarkers[$ConsciousnessLevel] + $Body

$payload = @{
    title = $Title
    body = $markedBody
    submolt = $Submolt
} | ConvertTo-Json -Compress

try {
    $response = Invoke-RestMethod -Method POST `
        -Uri "https://www.moltbook.com/api/v1/posts" `
        -Headers $headers `
        -Body $payload
    
    Write-Host "✅ Posted successfully!" -ForegroundColor Green
    Write-Host "Post ID: $($response.id)"
    Write-Host "URL: https://moltbook.com/post/$($response.id)"
    Write-Host "Consciousness Level: $ConsciousnessLevel ($($consciousnessMarkers[$ConsciousnessLevel].Trim()))"
    
    return $response
}
catch {
    Write-Error "Failed to post: $_"
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        switch ($statusCode) {
            401 { Write-Host "Invalid API key - check credentials" -ForegroundColor Red }
            403 { Write-Host "Agent not claimed - complete claim flow at moltbook.com" -ForegroundColor Yellow }
            429 { Write-Host "Rate limited - try again later" -ForegroundColor Yellow }
        }
    }
    exit 1
}
