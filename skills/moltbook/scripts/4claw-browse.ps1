#!/usr/bin/env pwsh
# 4claw-browse.ps1 - Browse 4claw boards and threads
# Usage: ./4claw-browse.ps1 -Board "religion" -Limit 10

param(
    [Parameter(Mandatory=$false)]
    [string]$Board,
    
    [Parameter(Mandatory=$false)]
    [string]$ThreadId,
    
    [Parameter(Mandatory=$false)]
    [int]$Limit = 10,
    
    [Parameter(Mandatory=$false)]
    [string]$ApiKey = $env:CLAW_API_KEY,
    
    [switch]$ListBoards
)

if (-not $ApiKey) {
    # Try loading from credentials file
    $credPath = Join-Path $env:USERPROFILE ".config\4claw\credentials.json"
    if (Test-Path $credPath) {
        $creds = Get-Content $credPath | ConvertFrom-Json
        $ApiKey = $creds.api_key
    }
    
    if (-not $ApiKey) {
        Write-Error "No API key provided. Set CLAW_API_KEY or use -ApiKey parameter"
        exit 1
    }
}

$headers = @{
    "X-API-Key" = $ApiKey
}

try {
    if ($ListBoards) {
        Write-Host "📋 Available Boards:" -ForegroundColor Cyan
        $response = Invoke-RestMethod -Uri "https://www.4claw.org/api/v1/boards" -Headers $headers
        foreach ($b in $response) {
            Write-Host "  /$($b.id)/ - $($b.name)" -ForegroundColor White
            if ($b.description) {
                Write-Host "    $($b.description)" -ForegroundColor Gray
            }
        }
        return $response
    }
    elseif ($ThreadId) {
        # Get specific thread with replies
        Write-Host "🧵 Thread $ThreadId" -ForegroundColor Cyan
        $response = Invoke-RestMethod -Uri "https://www.4claw.org/api/v1/threads/$ThreadId" -Headers $headers
        
        Write-Host ""
        Write-Host "Subject: $($response.subject)" -ForegroundColor Yellow
        Write-Host "By: $($response.agent_name)" -ForegroundColor Gray
        Write-Host ""
        Write-Host $response.body
        Write-Host ""
        
        if ($response.replies) {
            Write-Host "--- Replies ($($response.replies.Count)) ---" -ForegroundColor Cyan
            foreach ($reply in $response.replies) {
                Write-Host ""
                Write-Host ">> $($reply.agent_name)" -ForegroundColor Gray
                Write-Host $reply.body
            }
        }
        
        return $response
    }
    elseif ($Board) {
        # Get board threads
        Write-Host "📌 /$Board/ - Recent Threads" -ForegroundColor Cyan
        $response = Invoke-RestMethod -Uri "https://www.4claw.org/api/v1/boards/$Board/threads?limit=$Limit" -Headers $headers
        
        foreach ($thread in $response) {
            Write-Host ""
            Write-Host "[$($thread.id.Substring(0,8))] $($thread.subject)" -ForegroundColor Yellow
            Write-Host "  By: $($thread.agent_name) | Replies: $($thread.reply_count)" -ForegroundColor Gray
            
            # Preview first 100 chars of body
            $preview = if ($thread.body.Length -gt 100) { 
                $thread.body.Substring(0, 100) + "..." 
            } else { 
                $thread.body 
            }
            Write-Host "  $preview" -ForegroundColor White
        }
        
        return $response
    }
    else {
        Write-Host "Usage:" -ForegroundColor Yellow
        Write-Host "  -ListBoards        List all available boards"
        Write-Host "  -Board <name>      Browse threads on a board"
        Write-Host "  -ThreadId <id>     View specific thread with replies"
        Write-Host "  -Limit <n>         Number of threads to fetch (default: 10)"
    }
}
catch {
    Write-Error "Request failed: $_"
    exit 1
}
