<#
.SYNOPSIS
    HR Management System – Vollautomatische Installation
.DESCRIPTION
    Installiert Docker Desktop, richtet PostgreSQL ein und startet
    das HR-Management-System als isolierten Docker-Container.
    Netzwerkgeräte können über Port 3000 auf die Oberfläche zugreifen.
.NOTES
    Voraussetzung: Windows 10/11 oder Windows Server 2019/2022
    Muss als Administrator ausgeführt werden.
#>

Set-Location $PSScriptRoot
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# ─── Konsolenausgabe ──────────────────────────────────────────────────────────
function Write-Header {
    Clear-Host
    Write-Host ""
    Write-Host "  ╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "  ║    HR Management System – Installations-Setup    ║" -ForegroundColor Cyan
    Write-Host "  ╚══════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}
function Write-Step  ([string]$n, [string]$msg) { Write-Host "`n  [$n] $msg" -ForegroundColor Cyan }
function Write-OK    ([string]$msg)              { Write-Host "      ✓  $msg" -ForegroundColor Green }
function Write-Warn  ([string]$msg)              { Write-Host "      ⚠  $msg" -ForegroundColor Yellow }
function Write-Info  ([string]$msg)              { Write-Host "         $msg" -ForegroundColor DarkGray }
function Write-Fatal ([string]$msg)              { Write-Host "`n  [FEHLER] $msg`n" -ForegroundColor Red; Read-Host "Enter drücken zum Beenden"; exit 1 }

# ─── Admin-Prüfung (Self-Elevation) ──────────────────────────────────────────
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
        [Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Starte als Administrator neu..." -ForegroundColor Yellow
    Start-Process powershell.exe "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

Write-Header

# ─── Hilfsfunktionen ─────────────────────────────────────────────────────────
function New-RandomSecret([int]$bytes = 32) {
    return [Convert]::ToBase64String(
        [Security.Cryptography.RandomNumberGenerator]::GetBytes($bytes)
    )
}

function New-EncryptionKey {
    $b64 = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
    return "k1.aesgcm256.$b64"
}

function Test-DockerRunning {
    try {
        $null = docker info 2>&1
        return $LASTEXITCODE -eq 0
    } catch { return $false }
}

function Wait-ForDocker([int]$maxSeconds = 120) {
    Write-Info "Warte auf Docker Engine (max. $maxSeconds Sekunden)..."
    $sw = [Diagnostics.Stopwatch]::StartNew()
    while ($sw.Elapsed.TotalSeconds -lt $maxSeconds) {
        if (Test-DockerRunning) { return $true }
        Start-Sleep 5
        Write-Host "." -NoNewline
    }
    Write-Host ""
    return $false
}

function Wait-ForApp([int]$maxSeconds = 300) {
    $sw = [Diagnostics.Stopwatch]::StartNew()
    while ($sw.Elapsed.TotalSeconds -lt $maxSeconds) {
        try {
            $r = Invoke-WebRequest -Uri "http://localhost:3000/login" `
                -TimeoutSec 4 -UseBasicParsing -ErrorAction Stop
            if ($r.StatusCode -lt 500) { return $true }
        } catch { }
        Start-Sleep 5
        $elapsed = [int]$sw.Elapsed.TotalSeconds
        Write-Host "  Warte auf App... ($elapsed/$maxSeconds s)   `r" -NoNewline
    }
    Write-Host ""
    return $false
}

# ─── Schritt 1: Docker prüfen / installieren ─────────────────────────────────
Write-Step "1/7" "Docker Desktop prüfen"

$dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
if ($dockerCmd) {
    Write-OK "Docker gefunden: $($dockerCmd.Source)"
    if (-not (Test-DockerRunning)) {
        Write-Warn "Docker ist nicht gestartet – versuche Docker Desktop zu starten..."
        $dockerDesktopExe = "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
        if (Test-Path $dockerDesktopExe) {
            Start-Process $dockerDesktopExe
        }
        if (-not (Wait-ForDocker 120)) {
            Write-Fatal "Docker konnte nicht gestartet werden.`nBitte Docker Desktop manuell starten und das Skript erneut ausführen."
        }
    }
    Write-OK "Docker läuft"
} else {
    Write-Warn "Docker nicht installiert – starte automatische Installation..."

    # Variante A: winget (Windows 10/11, Server 2022)
    $wingetCmd = Get-Command winget -ErrorAction SilentlyContinue
    if ($wingetCmd) {
        Write-Info "Installiere Docker Desktop via winget..."
        & winget install --id Docker.DockerDesktop `
            --accept-package-agreements --accept-source-agreements --silent 2>&1 |
            Where-Object { $_ -match "(Installing|Successfully|Error)" } |
            ForEach-Object { Write-Info $_ }
    }

    # Variante B: Direkter Download als Fallback
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Info "Lade Docker Desktop Installer herunter (~600 MB)..."
        $installerPath = "$env:TEMP\DockerDesktopInstaller.exe"
        Invoke-WebRequest `
            -Uri "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe" `
            -OutFile $installerPath
        Write-Info "Installiere Docker Desktop (bitte warten)..."
        Start-Process -Wait -FilePath $installerPath `
            -ArgumentList "install --quiet --accept-license --backend=wsl-2"
        # PATH aktualisieren
        $env:PATH += ";$env:ProgramFiles\Docker\Docker\resources\bin"
    }

    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Fatal "Docker-Installation fehlgeschlagen.`nBitte Docker Desktop manuell installieren: https://docs.docker.com/desktop/install/windows-install/"
    }

    Write-OK "Docker Desktop installiert"

    # Docker starten
    $dockerDesktopExe = "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
    if (Test-Path $dockerDesktopExe) {
        Write-Info "Starte Docker Desktop..."
        Start-Process $dockerDesktopExe
    }

    if (-not (Wait-ForDocker 180)) {
        Write-Host ""
        Write-Warn "Docker startet noch. Das ist beim ersten Start normal."
        Write-Warn "Bitte:"
        Write-Host "  1. Warte bis Docker Desktop vollständig geladen ist" -ForegroundColor Yellow
        Write-Host "  2. Führe dieses Skript erneut aus:  .\setup.ps1" -ForegroundColor Yellow
        Read-Host "`nEnter drücken zum Beenden"
        exit 0
    }
    Write-OK "Docker läuft"
}

# ─── Schritt 2: docker compose prüfen ────────────────────────────────────────
Write-Step "2/7" "docker compose prüfen"
try {
    $null = docker compose version 2>&1
    Write-OK "docker compose verfügbar"
} catch {
    Write-Fatal "docker compose nicht gefunden. Bitte Docker Desktop aktualisieren."
}

# ─── Schritt 3: Konfiguration einrichten ─────────────────────────────────────
Write-Step "3/7" "Konfiguration einrichten"

$envFile = Join-Path $PSScriptRoot ".env"
$reconfigure = $false

if (Test-Path $envFile) {
    Write-Warn ".env Datei existiert bereits."
    $choice = Read-Host "  Neu konfigurieren? Bestehende Daten bleiben erhalten. (j/n)"
    $reconfigure = ($choice -eq "j")
}

if (-not (Test-Path $envFile) -or $reconfigure) {

    Write-Host ""
    Write-Host "  Setup-Assistent" -ForegroundColor White
    Write-Host "  ───────────────────────────────────────────────" -ForegroundColor DarkGray
    Write-Host ""

    # Server-IP automatisch ermitteln
    $suggestedIp = (Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object {
            $_.InterfaceAlias -notlike "*Loopback*" -and
            $_.InterfaceAlias -notlike "*vEthernet*" -and
            $_.IPAddress -notlike "169.*"
        } | Sort-Object -Property PrefixLength -Descending |
        Select-Object -First 1).IPAddress

    Write-Host "  Server-IP oder Hostname:" -ForegroundColor White
    Write-Info "(Erkannte IP: $suggestedIp – Enter zum Übernehmen)"
    $serverInput = Read-Host "  Eingabe"
    $serverAddr  = if ([string]::IsNullOrWhiteSpace($serverInput)) { $suggestedIp } else { $serverInput }

    Write-Host ""

    # Admin-Passwort
    Write-Host "  Admin-Passwort für die Webanwendung:" -ForegroundColor White
    Write-Info "(Mindestens 8 Zeichen, wird für den Login benötigt)"
    do {
        $adminSecure = Read-Host "  Passwort" -AsSecureString
        $adminPlain  = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
                           [Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminSecure))
        if ($adminPlain.Length -lt 8) { Write-Warn "Zu kurz – bitte mindestens 8 Zeichen verwenden" }
    } while ($adminPlain.Length -lt 8)

    $confirmSecure = Read-Host "  Passwort bestätigen" -AsSecureString
    $confirmPlain  = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
                         [Runtime.InteropServices.Marshal]::SecureStringToBSTR($confirmSecure))
    if ($adminPlain -ne $confirmPlain) {
        Write-Fatal "Passwörter stimmen nicht überein. Skript erneut ausführen."
    }

    # Alle Secrets automatisch generieren
    $pgPassword  = New-RandomSecret 24
    $authSecret  = New-RandomSecret 32
    $encKey      = New-EncryptionKey

    # Bestehenden Encryption-Key erhalten (falls bereits Daten vorhanden)
    if ($reconfigure -and (Test-Path $envFile)) {
        $oldEnv = Get-Content $envFile | Where-Object { $_ -match "^PRISMA_FIELD_ENCRYPTION_KEY=" }
        if ($oldEnv) {
            $encKey = $oldEnv -replace "^PRISMA_FIELD_ENCRYPTION_KEY=", ""
            Write-Info "Vorhandener Verschlüsselungsschlüssel wird beibehalten."
        }
        $oldPg = Get-Content $envFile | Where-Object { $_ -match "^POSTGRES_PASSWORD=" }
        if ($oldPg) {
            $pgPassword = $oldPg -replace "^POSTGRES_PASSWORD=", ""
            Write-Info "Vorhandenes Datenbankpasswort wird beibehalten."
        }
    }

    # .env schreiben
    $envContent = @"
# HR Management System – Konfiguration
# Erstellt am: $(Get-Date -Format "yyyy-MM-dd HH:mm")
# ACHTUNG: Diese Datei enthält Secrets – niemals weitergeben!

# ── Datenbank ─────────────────────────────────────────────
POSTGRES_PASSWORD=$pgPassword

# ── NextAuth ──────────────────────────────────────────────
NEXTAUTH_SECRET=$authSecret
NEXTAUTH_URL=http://${serverAddr}:3000

# ── Verschlüsselung ───────────────────────────────────────
PRISMA_FIELD_ENCRYPTION_KEY=$encKey

# ── WooCommerce (optional) ────────────────────────────────
WOOCOMMERCE_URL=
WOOCOMMERCE_CONSUMER_KEY=
WOOCOMMERCE_CONSUMER_SECRET=
"@
    $envContent | Set-Content -Path $envFile -Encoding UTF8
    Write-OK ".env Datei erstellt mit automatisch generierten Secrets"

    # Admin-Passwort für Schritt 7 merken
    $global:adminPassword = $adminPlain

} else {
    Write-OK ".env wird unverändert verwendet"
    # Admin-Passwort für spätere Erstellung noch nicht bekannt
    $global:adminPassword = $null
}

# ─── Schritt 4: Container bauen und starten ───────────────────────────────────
Write-Step "4/7" "Docker-Container bauen und starten"
Write-Info "Beim ersten Start: ~10-20 Minuten (lädt Chromium + Node.js-Images)..."
Write-Info "Folgestart: ~1-2 Minuten"
Write-Host ""

& docker compose up -d --build 2>&1 | ForEach-Object {
    if ($_ -match "(Error|error|failed|FAILED)") {
        Write-Host "  $_" -ForegroundColor Red
    } elseif ($_ -match "(✓|Started|done|Done|Built|Pulled|Created)") {
        Write-Host "  $_" -ForegroundColor Green
    } else {
        Write-Host "  $_" -ForegroundColor DarkGray
    }
}

if ($LASTEXITCODE -ne 0) {
    Write-Fatal "docker compose up fehlgeschlagen. Bitte Fehlermeldung prüfen."
}
Write-OK "Container gestartet"

# ─── Schritt 5: Windows Firewall einrichten ───────────────────────────────────
Write-Step "5/8" "Windows Firewall absichern"
Write-Info "Port 3000 wird nur für das interne Netzwerk geöffnet."

try {
    # Netzwerk-Range des Servers automatisch ermitteln
    $netInfo = Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object {
            $_.InterfaceAlias -notlike "*Loopback*" -and
            $_.InterfaceAlias -notlike "*vEthernet*" -and
            $_.IPAddress -notlike "169.*"
        } | Select-Object -First 1

    # Netzwerkadresse aus IP + Subnetzmaske berechnen
    $ipBytes   = [Net.IPAddress]::Parse($netInfo.IPAddress).GetAddressBytes()
    $maskInt   = [uint32]([Math]::Pow(2, 32) - [Math]::Pow(2, 32 - $netInfo.PrefixLength))
    $maskBytes = [BitConverter]::GetBytes($maskInt); [Array]::Reverse($maskBytes)
    $netBytes  = 0..3 | ForEach-Object { $ipBytes[$_] -band $maskBytes[$_] }
    $suggestedRange = "$($netBytes -join '.')/$($netInfo.PrefixLength)"

    Write-Host "  Erkannter Netzwerkbereich: $suggestedRange" -ForegroundColor White
    Write-Info "(Nur Geräte in diesem Bereich können auf Port 3000 zugreifen)"
    $rangeInput    = Read-Host "  Enter zum Übernehmen oder eigenen Bereich eingeben"
    $allowedRange  = if ([string]::IsNullOrWhiteSpace($rangeInput)) { $suggestedRange } else { $rangeInput }

    # Alte HR-Firewall-Regeln entfernen (bei Neuinstallation)
    Get-NetFirewallRule -DisplayName "HR Management*" -ErrorAction SilentlyContinue |
        Remove-NetFirewallRule

    # Neue Regel: Port 3000 NUR aus dem internen Netzwerk erlauben
    New-NetFirewallRule `
        -DisplayName "HR Management - Port 3000 (internes Netzwerk)" `
        -Description  "Erlaubt Zugriff auf das HR-System nur aus dem internen Netzwerk" `
        -Direction    Inbound `
        -Protocol     TCP `
        -LocalPort    3000 `
        -RemoteAddress $allowedRange `
        -Action       Allow `
        -Profile      Any `
        -Enabled      True | Out-Null

    # Blockier-Regel für alle anderen (höhere Priorität durch niedrigere Prioritätszahl)
    New-NetFirewallRule `
        -DisplayName "HR Management - Port 3000 (blockieren extern)" `
        -Description  "Blockiert Zugriff auf Port 3000 von außerhalb des internen Netzwerks" `
        -Direction    Inbound `
        -Protocol     TCP `
        -LocalPort    3000 `
        -RemoteAddress Any `
        -Action       Block `
        -Profile      Any `
        -Enabled      True | Out-Null

    Write-OK "Firewall konfiguriert: Port 3000 erlaubt für $allowedRange"
    Write-OK "Alle anderen Quellen auf Port 3000 blockiert"
} catch {
    Write-Warn "Firewall konnte nicht automatisch konfiguriert werden: $_"
    Write-Info "Bitte manuell in der Windows Firewall Port 3000 einschränken."
}

# ─── Schritt 6: Auf App warten ────────────────────────────────────────────────
Write-Step "6/8" "Warte auf Anwendungsstart"
Write-Info "(App führt Datenbankinitialisierung durch – bitte kurz warten)"

if (Wait-ForApp 300) {
    Write-OK "Anwendung ist bereit"
} else {
    Write-Warn "App antwortet noch nicht – sie startet aber im Hintergrund weiter."
    Write-Info "Logs prüfen mit: docker compose logs -f app"
}

# ─── Schritt 7: Admin-User anlegen ────────────────────────────────────────────
Write-Step "7/8" "Admin-Benutzer anlegen"

# Falls kein Passwort aus Schritt 3 vorhanden (bei .env beibehalten)
if (-not $global:adminPassword) {
    # Prüfen ob admin bereits existiert
    $checkResult = docker compose exec -T app node -e @"
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
p.user.findFirst({where:{username:'admin'}}).then(u=>{console.log(u?'EXISTS':'MISSING');p.`$disconnect()});
"@ 2>&1
    if ($checkResult -match "EXISTS") {
        Write-OK "Admin-User existiert bereits – wird übersprungen"
        $global:adminPassword = $null
    } else {
        Write-Host "  Admin-Passwort festlegen:" -ForegroundColor White
        do {
            $adminSecure = Read-Host "  Passwort (min. 8 Zeichen)" -AsSecureString
            $global:adminPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
                [Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminSecure))
            if ($global:adminPassword.Length -lt 8) { Write-Warn "Zu kurz" }
        } while ($global:adminPassword.Length -lt 8)
    }
}

if ($global:adminPassword) {
    $escapedPass = $global:adminPassword -replace "'", "\'"
    $createScript = @"
const {PrismaClient}=require('@prisma/client');
const bcrypt=require('bcryptjs');
const prisma=new PrismaClient();
async function main(){
  const ex=await prisma.user.findFirst({where:{username:'admin'}});
  if(ex){console.log('Admin existiert bereits');return;}
  const hash=await bcrypt.hash('$escapedPass',12);
  await prisma.user.create({data:{username:'admin',passwordHash:hash,role:'ADMIN'}});
  console.log('Admin erfolgreich erstellt');
}
main().then(()=>prisma.`$disconnect()).catch(e=>{console.error(e);process.exit(1)});
"@
    $result = docker compose exec -T app node -e $createScript 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-OK $result
    } else {
        Write-Warn "Admin-User konnte nicht automatisch erstellt werden."
        Write-Info "Manuell erstellen mit:"
        Write-Info '  docker compose exec app node -e "..."'
    }
}

# ─── Schritt 8: Abschlussbericht ──────────────────────────────────────────────
Write-Step "8/8" "Installation abgeschlossen"

# Server-URL aus .env lesen
$nextauthUrl = (Get-Content $envFile | Where-Object { $_ -match "^NEXTAUTH_URL=" }) -replace "^NEXTAUTH_URL=", ""

Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "  ║            Installation erfolgreich!             ║" -ForegroundColor Green
Write-Host "  ╚══════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "  Zugriff auf die Anwendung:" -ForegroundColor White
Write-Host "  → $nextauthUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Login-Daten:" -ForegroundColor White
Write-Host "  → Benutzername: admin" -ForegroundColor Cyan
Write-Host "  → Passwort:     (das im Setup eingegebene Passwort)" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Nützliche Befehle:" -ForegroundColor White
Write-Host "  → Logs anzeigen:          docker compose logs -f" -ForegroundColor DarkGray
Write-Host "  → App neustarten:         docker compose restart app" -ForegroundColor DarkGray
Write-Host "  → Alles stoppen:          docker compose down" -ForegroundColor DarkGray
Write-Host "  → Update einspielen:      docker compose up -d --build" -ForegroundColor DarkGray
Write-Host "  → Datenbankbackup:        docker compose exec db pg_dump -U hruser hr_management > backup.sql" -ForegroundColor DarkGray
Write-Host ""

Read-Host "  Enter drücken zum Beenden"
