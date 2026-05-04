# Windows Code Signing and SmartScreen

Microsoft Defender SmartScreen is reputation based. There is no Electron setting that can register
the app and permanently hide SmartScreen for every new installer. The production fix is to ship a
trusted, timestamped Windows signature for every release and let Microsoft build reputation for that
publisher and file hash. Microsoft Store distribution is the only route Microsoft documents as
avoiding SmartScreen download warnings completely.

## Release Signing Checklist

1. Buy or provision one production signing identity:
   - Microsoft Trusted Signing / Azure Artifact Signing.
   - An OV or EV Microsoft Authenticode code-signing certificate from a trusted CA.
   - Microsoft Store submission if you want Microsoft to re-sign the package.
2. Keep the exact same verified publisher identity for all releases.
3. Keep the private key outside git. Use GitHub/Vercel/Azure secrets or a local secure certificate
   store.
4. Build signed releases with:

```powershell
$env:WIN_CSC_LINK = 'D:\secure\nexus-tech-code-signing.pfx'
$env:WIN_CSC_KEY_PASSWORD = '<certificate password>'
npm run build:win:signed
```

`CSC_LINK` and `CSC_KEY_PASSWORD` also work. `WIN_CSC_*` is preferred for Windows-only release
secrets.

For EV certificates or a certificate already installed in the Windows certificate store, set the
real certificate subject or thumbprint before the signed build:

```powershell
$env:WINDOWS_CERTIFICATE_SUBJECT_NAME = 'Exact certificate subject'
npm run build:win:signed
```

For Microsoft Trusted Signing, create the Trusted Signing account, certificate profile, signing
account, and Microsoft Entra app registration first. Then set the Entra service principal secrets
and signing profile metadata before building:

```powershell
$env:AZURE_TENANT_ID = '<tenant id>'
$env:AZURE_CLIENT_ID = '<client id>'
$env:AZURE_CLIENT_SECRET = '<client secret>'
$env:AZURE_TRUSTED_SIGNING_ENDPOINT = '<account endpoint>'
$env:AZURE_TRUSTED_SIGNING_CERTIFICATE_PROFILE_NAME = '<profile name>'
$env:AZURE_TRUSTED_SIGNING_CODE_SIGNING_ACCOUNT_NAME = '<account name>'
$env:AZURE_TRUSTED_SIGNING_PUBLISHER_NAME = '<exact certificate publisher name>'
npm run build:win:signed
```

## Verify the Installer

After packaging, verify the installer before uploading it to GitHub, Vercel Blob, Supabase, or the
updates endpoint:

```powershell
.\scripts\verify-windows-signature.ps1 .\dist\nexus-ai-1.2.7-setup.exe
```

The status must be `Valid`, and the signer certificate must show the real Nexus publisher identity.
If SmartScreen still flags a valid signed build as malware or unwanted software, submit that exact
installer file to Microsoft Security Intelligence and select Microsoft Defender SmartScreen as the
product.

## Notes

- Do not commit `.pfx`, `.p12`, passwords, Azure client secrets, or signing account metadata that
  reveals secrets.
- SmartScreen reputation is tied to both the publisher and each installer file hash. A new version
  can still warn until the exact new file gains reputation.
- Keep `electron-builder.yml` timestamping enabled so Windows can trust the signature after the
  certificate expires.
