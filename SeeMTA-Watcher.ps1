# SeeMTA Admin Duty — Automatikus Log Figyelő
# Figyeli a MTA clientscript.log fájlt és valós időben elküldi az eseményeket a szervernek
# Elindítás: jobb klikk → "Futtatás PowerShell-lel"

# =====================================================
# BEÁLLÍTÁSOK — csak ezt kell módosítani
# =====================================================

$LogFile   = "C:\Program Files (x86)\MTA San Andreas\MTA\logs\clientscript.log"
$ServerUrl = "http://192.168.1.119:8765/api/live"

# =====================================================
# SCRIPT
# =====================================================

$Host.UI.RawUI.WindowTitle = "SeeMTA Duty Watcher — Joshua"

function Write-Status($msg, $color = "Cyan") {
    $ts = Get-Date -Format "HH:mm:ss"
    Write-Host "[$ts] $msg" -ForegroundColor $color
}

function Send-Line($line) {
    try {
        $body = @{ line = $line } | ConvertTo-Json
        $response = Invoke-RestMethod -Uri $ServerUrl -Method POST `
            -Body $body -ContentType "application/json; charset=utf-8" `
            -TimeoutSec 5
        return $response
    } catch {
        Write-Status "⚠️  Szerver nem elérhető: $_" "Yellow"
        return $null
    }
}

# Ellenőrzés
if (-not (Test-Path $LogFile)) {
    Write-Status "❌ Log fájl nem található: $LogFile" "Red"
    Write-Status "Ellenőrizd az elérési utat és indítsd újra!" "Red"
    Read-Host "Nyomj Enter-t a kilépéshez"
    exit
}

Write-Status "✅ SeeMTA Duty Watcher elindult" "Green"
Write-Status "📄 Figyelt fájl: $LogFile" "White"
Write-Status "🌐 Szerver: $ServerUrl" "White"
Write-Status "⏳ Várakozás eseményekre..." "Gray"
Write-Host ""

# Beolvassuk a fájl jelenlegi méretét (a régi sorokat átugorjuk)
$lastSize = (Get-Item $LogFile).Length

while ($true) {
    Start-Sleep -Milliseconds 500

    if (-not (Test-Path $LogFile)) {
        Write-Status "⚠️  Log fájl eltűnt, várakozás..." "Yellow"
        Start-Sleep -Seconds 3
        continue
    }

    $currentSize = (Get-Item $LogFile).Length

    # Ha a fájl kisebb lett → újraindult a logger, reseteljük a pozíciót
    if ($currentSize -lt $lastSize) {
        Write-Status "🔄 Logger újraindult (fájl resetelve)" "Yellow"
        $lastSize = 0
    }

    # Ha van új tartalom
    if ($currentSize -gt $lastSize) {
        $stream = [System.IO.File]::Open($LogFile, 'Open', 'Read', 'ReadWrite')
        $stream.Seek($lastSize, 'Begin') | Out-Null
        $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
        $newContent = $reader.ReadToEnd()
        $reader.Close()
        $stream.Close()

        $lastSize = $currentSize

        # Soronként feldolgozás
        $lines = $newContent -split "`n"
        foreach ($line in $lines) {
            $line = $line.Trim()
            if (-not $line) { continue }

            # Csak a releváns sorok küldése
            $relevant = $false
            $eventType = ""

            if ($line -match "SeeMTA logger started") {
                $relevant  = $true
                $eventType = "🔄 Logger restart"
            } elseif ($line -match "Joshua adminszolgálatba lépett") {
                $relevant  = $true
                $eventType = "🟢 BELÉPÉS"
            } elseif ($line -match "Joshua kilépett az adminszolgálatból") {
                $relevant  = $true
                $eventType = "🔴 KILÉPÉS"
            }

            if ($relevant) {
                Write-Status "$eventType → küldés..." "Cyan"
                $result = Send-Line $line

                if ($result -and $result.ok) {
                    if ($result.event -eq "out" -or $result.event -eq "crash") {
                        $mins = [math]::Round($result.minutes, 1)
                        Write-Status "✅ +$mins perc jóváírva" "Green"
                    } elseif ($result.event -eq "in") {
                        Write-Status "✅ Belépés rögzítve" "Green"
                    }
                }
            }
        }
    }
}
