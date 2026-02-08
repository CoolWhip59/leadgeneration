# Run as Administrator
$ErrorActionPreference = "Stop"

Write-Host "==> Reset Windows Update services..." -ForegroundColor Cyan
net stop wuauserv | Out-Null
net stop bits | Out-Null
net stop cryptsvc | Out-Null
net stop msiserver | Out-Null

$sd = "C:\Windows\SoftwareDistribution"
$cr = "C:\Windows\System32\catroot2"
if (Test-Path $sd) { Rename-Item $sd ($sd + ".old") -ErrorAction SilentlyContinue }
if (Test-Path $cr) { Rename-Item $cr ($cr + ".old") -ErrorAction SilentlyContinue }

net start wuauserv | Out-Null
net start bits | Out-Null
net start cryptsvc | Out-Null
net start msiserver | Out-Null

Write-Host "==> Enabling Windows optional features (WSL + VirtualMachinePlatform)..." -ForegroundColor Cyan
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart | Out-Null
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart | Out-Null

$dl = Join-Path $env:USERPROFILE "Downloads\wsl-offline"
New-Item -ItemType Directory -Force -Path $dl | Out-Null

# Download WSL2 kernel update
$kernelUrl = "https://aka.ms/wsl2kernel"
$kernelMsi = Join-Path $dl "wsl_update_x64.msi"

Write-Host "==> Downloading WSL2 kernel update..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $kernelUrl -OutFile $kernelMsi

Write-Host "==> Installing kernel update..." -ForegroundColor Cyan
Start-Process msiexec.exe -Wait -ArgumentList "/i `"$kernelMsi`" /qn /norestart"

Write-Host "==> Setting default WSL version to 2..." -ForegroundColor Cyan
wsl --set-default-version 2

# Download Ubuntu 22.04 appx (offline)
$ubuntuUrl = "https://aka.ms/wslubuntu2204"
$ubuntuAppx = Join-Path $dl "Ubuntu_2204.appx"

Write-Host "==> Downloading Ubuntu 22.04 Appx..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $ubuntuUrl -OutFile $ubuntuAppx

Write-Host "==> Installing Ubuntu Appx..." -ForegroundColor Cyan
Add-AppxPackage -Path $ubuntuAppx

Write-Host ""
Write-Host "✅ Done. Now RESTART your PC, then open 'Ubuntu' from Start Menu." -ForegroundColor Green
Write-Host "After opening Ubuntu once, check with: wsl -l -v" -ForegroundColor Green
