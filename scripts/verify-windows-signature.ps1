param(
  [Parameter(Mandatory = $true)]
  [string]$Path
)

$resolvedPath = Resolve-Path -LiteralPath $Path -ErrorAction Stop
$signature = Get-AuthenticodeSignature -FilePath $resolvedPath.Path

$signature | Format-List Status, StatusMessage, SignerCertificate, TimeStamperCertificate

if ($signature.Status -ne 'Valid') {
  throw "Signature is not valid for $($resolvedPath.Path): $($signature.StatusMessage)"
}

$signTool = Get-Command signtool.exe -ErrorAction SilentlyContinue
if ($signTool) {
  & $signTool.Source verify /pa /tw /v $resolvedPath.Path
  if ($LASTEXITCODE -ne 0) {
    throw "signtool verification failed with exit code $LASTEXITCODE"
  }
}
else {
  Write-Host 'signtool.exe not found; Get-AuthenticodeSignature verification passed.'
}
