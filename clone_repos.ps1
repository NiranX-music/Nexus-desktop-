$env:PATH = "C:\Users\NiranX\AppData\Local\Programs\Git\cmd;" + $env:PATH

$repos = @(
    @{ Id = 1;  Name = "IRIS"; URL = "https://github.com/ASHR12/iris.git"; Folder = "iris" },
    @{ Id = 2;  Name = "IRIS-AI"; URL = "https://github.com/IRISX-AI/IRIS-AI.git"; Folder = "IRIS-AI" },
    @{ Id = 3;  Name = "Microsoft UFO"; URL = "https://github.com/microsoft/ufo.git"; Folder = "ufo" },
    @{ Id = 4;  Name = "Cradle"; URL = "https://github.com/BAAI-Agents/Cradle.git"; Folder = "Cradle" },
    @{ Id = 5;  Name = "Simular Agent S"; URL = "https://github.com/simular-ai/agent-s.git"; Folder = "agent-s" },
    @{ Id = 6;  Name = "Bytebot"; URL = "https://github.com/bytebot-ai/bytebot.git"; Folder = "bytebot" },
    @{ Id = 7;  Name = "ShowUI"; URL = "https://github.com/showlab/ShowUI.git"; Folder = "ShowUI" },
    @{ Id = 8;  Name = "OS-Copilot (FRIDAY)"; URL = "https://github.com/OS-Copilot/FRIDAY.git"; Folder = "FRIDAY" },
    @{ Id = 9;  Name = "OpenAdapt"; URL = "https://github.com/OpenAdaptAI/OpenAdapt.git"; Folder = "OpenAdapt" },
    @{ Id = 10; Name = "Windows Agent Arena"; URL = "https://github.com/microsoft/WindowsAgentArena.git"; Folder = "WindowsAgentArena" },
    @{ Id = 11; Name = "Open Interpreter"; URL = "https://github.com/openinterpreter/open-interpreter.git"; Folder = "open-interpreter" },
    @{ Id = 12; Name = "Goose"; URL = "https://github.com/block/goose.git"; Folder = "goose" },
    @{ Id = 13; Name = "OpenClaw"; URL = "https://github.com/openclaw/openclaw.git"; Folder = "openclaw" },
    @{ Id = 14; Name = "Hermes Agent"; URL = "https://github.com/NousResearch/hermes-agent.git"; Folder = "hermes-agent" },
    @{ Id = 15; Name = "Gemini CLI"; URL = "https://github.com/google-gemini/gemini-cli.git"; Folder = "gemini-cli" },
    @{ Id = 16; Name = "Claude Code"; URL = "https://github.com/anthropics/claude-code.git"; Folder = "claude-code" },
    @{ Id = 17; Name = "OpenHands"; URL = "https://github.com/All-Hands-AI/OpenHands.git"; Folder = "OpenHands" },
    @{ Id = 18; Name = "Aider"; URL = "https://github.com/Aider-AI/aider.git"; Folder = "aider" },
    @{ Id = 19; Name = "SWE-agent"; URL = "https://github.com/SWE-agent/SWE-agent.git"; Folder = "SWE-agent" },
    @{ Id = 20; Name = "GPT-Engineer"; URL = "https://github.com/gpt-engineer-org/gpt-engineer.git"; Folder = "gpt-engineer" },
    @{ Id = 21; Name = "MetaGPT"; URL = "https://github.com/geekan/MetaGPT.git"; Folder = "MetaGPT" },
    @{ Id = 22; Name = "Mentat"; URL = "https://github.com/AbanteAI/mentat.git"; Folder = "mentat" },
    @{ Id = 23; Name = "Plandex"; URL = "https://github.com/plandex-ai/plandex.git"; Folder = "plandex" },
    @{ Id = 24; Name = "ChatDev"; URL = "https://github.com/OpenBMB/ChatDev.git"; Folder = "ChatDev" },
    @{ Id = 25; Name = "AutoPR"; URL = "https://github.com/irgolic/AutoPR.git"; Folder = "AutoPR" },
    @{ Id = 26; Name = "Blinky"; URL = "https://github.com/victorneo/blinky.git"; Folder = "blinky" },
    @{ Id = 27; Name = "Browser-Use"; URL = "https://github.com/browser-use/browser-use.git"; Folder = "browser-use" },
    @{ Id = 28; Name = "Skyvern"; URL = "https://github.com/Skyvern-AI/skyvern.git"; Folder = "skyvern" },
    @{ Id = 29; Name = "LaVague"; URL = "https://github.com/lavague-ai/LaVague.git"; Folder = "LaVague" },
    @{ Id = 30; Name = "WebArena"; URL = "https://github.com/web-arena-x/webarena.git"; Folder = "webarena" },
    @{ Id = 31; Name = "Crawl4AI"; URL = "https://github.com/unclecode/crawl4ai.git"; Folder = "crawl4ai" },
    @{ Id = 32; Name = "Pipecat"; URL = "https://github.com/pipecat-ai/pipecat.git"; Folder = "pipecat" },
    @{ Id = 33; Name = "TEN Framework"; URL = "https://github.com/ten-framework/ten-framework.git"; Folder = "ten-framework" },
    @{ Id = 34; Name = "Bolna"; URL = "https://github.com/bolna-ai/bolna.git"; Folder = "bolna" },
    @{ Id = 35; Name = "LiveKit Agents"; URL = "https://github.com/livekit/agents.git"; Folder = "livekit-agents" },
    @{ Id = 36; Name = "LangGraph"; URL = "https://github.com/langchain-ai/langgraph.git"; Folder = "langgraph" },
    @{ Id = 37; Name = "CrewAI"; URL = "https://github.com/crewAIInc/crewAI.git"; Folder = "crewAI" },
    @{ Id = 38; Name = "Microsoft AutoGen"; URL = "https://github.com/microsoft/autogen.git"; Folder = "autogen" },
    @{ Id = 39; Name = "Agno"; URL = "https://github.com/agno-agi/agno.git"; Folder = "agno" },
    @{ Id = 40; Name = "OpenAI Agents SDK"; URL = "https://github.com/openai/openai-agents-python.git"; Folder = "openai-agents-python" },
    @{ Id = 41; Name = "Google Agent Developer Kit"; URL = "https://github.com/google/agent-developer-kit.git"; Folder = "agent-developer-kit" },
    @{ Id = 42; Name = "Semantic Kernel"; URL = "https://github.com/microsoft/semantic-kernel.git"; Folder = "semantic-kernel" },
    @{ Id = 43; Name = "AutoGPT"; URL = "https://github.com/Significant-Gravitas/AutoGPT.git"; Folder = "AutoGPT" },
    @{ Id = 44; Name = "Dify"; URL = "https://github.com/langgenius/dify.git"; Folder = "dify" },
    @{ Id = 45; Name = "Cradle App"; URL = "https://github.com/wibus-wee/cradle-app.git"; Folder = "cradle-app" },
    @{ Id = 46; Name = "GPT Researcher"; URL = "https://github.com/assafelovic/gpt-researcher.git"; Folder = "gpt-researcher" },
    @{ Id = 47; Name = "FastGPT"; URL = "https://github.com/labring/FastGPT.git"; Folder = "FastGPT" },
    @{ Id = 48; Name = "Khoj"; URL = "https://github.com/khoj-ai/khoj.git"; Folder = "khoj" },
    @{ Id = 49; Name = "Mem0"; URL = "https://github.com/mem0ai/mem0.git"; Folder = "mem0" },
    @{ Id = 50; Name = "CopilotKit"; URL = "https://github.com/CopilotKit/CopilotKit.git"; Folder = "CopilotKit" }
)

Write-Host "Starting clone of $($repos.Count) repositories..." -ForegroundColor Cyan

$results = @()

foreach ($repo in $repos) {
    $id = $repo.Id
    $name = $repo.Name
    $url = $repo.URL
    $target = $repo.Folder
    
    Write-Host "[$id/50] Checking $name ($target)..." -NoNewline
    
    if (Test-Path -Path $target) {
        Write-Host " [ALREADY EXISTS]" -ForegroundColor Yellow
        $results += [PSCustomObject]@{
            Id = $id
            Name = $name
            Folder = $target
            Status = "Already Exists"
            Error = ""
        }
        continue
    }
    
    Write-Host " Cloning..." -ForegroundColor Green
    $output = & git clone --depth 1 $url $target 2>&1
    $exitCode = $LASTEXITCODE
    
    if ($exitCode -eq 0) {
        Write-Host "  -> SUCCESS" -ForegroundColor Green
        $results += [PSCustomObject]@{
            Id = $id
            Name = $name
            Folder = $target
            Status = "Success"
            Error = ""
        }
    } else {
        $errStr = ($output | Out-String).Trim()
        Write-Host "  -> FAILED: $errStr" -ForegroundColor Red
        $results += [PSCustomObject]@{
            Id = $id
            Name = $name
            Folder = $target
            Status = "Failed"
            Error = $errStr
        }
    }
}

$results | ConvertTo-Json -Depth 3 | Set-Content -Path "clone_results.json"
Write-Host "`nCloning process complete! Summary saved to clone_results.json" -ForegroundColor Cyan
$summary = $results | Group-Object Status | Select-Object Name, Count
$summary | Format-Table -AutoSize
