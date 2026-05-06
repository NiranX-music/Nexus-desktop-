param(
  [Parameter(Mandatory = $true)]
  [string]$AccessToken,
  [string]$ProjectRef = "wtuepgtmtidhfazbvsxa",
  [string]$TemplateFile = ".\\scripts\\supabase-auth-templates.dark.json"
)

$ErrorActionPreference = "Stop"

$resolvedTemplateFile = Resolve-Path $TemplateFile
$payload = Get-Content $resolvedTemplateFile -Raw | ConvertFrom-Json
$payloadJson = $payload | ConvertTo-Json -Depth 6 -Compress

$headers = @{
  Authorization = "Bearer $AccessToken"
  "Content-Type" = "application/json"
}

$uri = "https://api.supabase.com/v1/projects/$ProjectRef/config/auth"

Invoke-RestMethod -Uri $uri -Method Patch -Headers $headers -Body $payloadJson | Out-Null
Write-Output "Supabase Auth email templates updated for project $ProjectRef."
