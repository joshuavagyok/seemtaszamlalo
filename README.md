# SeeMTA Tracker 🚔

A personal admin duty tracker for **SeeMTA** (SA-MP roleplay server) administrators.  
Track your monthly duty time, sessions, freezes, reports and off-duty time — all from your browser.

## Features

- 📊 **Monthly stats** — duty minutes, hours, sessions, reports
- 📅 **Daily breakdown** — bar chart of duty per day
- 🔥 **Streak tracking** — consecutive days with duty
- 📋 **Report counting** — auto-detects accepted reports from logs
- 🎮 **Off-duty tracking** — manual entry of off-duty time
- 🌙 **Dark/Light theme** toggle
- 📱 **PWA support** — installable on mobile

## How it works

1. You play on SeeMTA and use the **AdminDuty** system
2. The **SeeMTA-Watcher.ps1** PowerShell script watches your log folder and sends log files to the tracker
3. The tracker parses duty intervals and report lines, stores monthly stats
4. View your stats in the browser

## Setup

### Requirements
- Docker
- Python 3.x (for server)
- PowerShell (for watcher, Windows only)

### Deploy with Docker

```bash
# Clone the repo
git clone https://github.com/yourusername/seemta-tracker.git
cd seemta-tracker

# Create empty data file
echo '{}' > data.json

# Build and run
docker build -t seemta-tracker .
docker run -d --name seemta-tracker --restart always -p 8765:8765 \
    -v $(pwd)/data.json:/app/data.json seemta-tracker
```

Open `http://localhost:8765` in your browser.

### Configure the Watcher

Edit `SeeMTA-Watcher.ps1` and set:
```powershell
$TrackerUrl = "http://YOUR-SERVER-IP:8765"
$LogFolder  = "C:\path\to\your\SeeMTA\logs"
```

Then run it in PowerShell.

## Log format

The tracker expects **AdminDuty** log lines like:
```
[2026-03-05 14:32:11] [AdminDuty - Start]: You are now on admin duty.
[2026-03-05 16:45:22] [AdminDuty - End]: You are no longer on admin duty.
[2026-03-05 15:10:05] [SeeMTA - Siker]: Sikeresen elvállaltad az ügyet! (344201)
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/data` | Get all monthly data |
| POST | `/api/save` | Add duty/session/report data (additive) |
| POST | `/api/save-reports` | Add report count |
| DELETE | `/api/delete/{key}` | Delete a month's data |
| POST | `/api/live` | Update live state |

## License

MIT
