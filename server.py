import os
#!/usr/bin/env python3
"""
SeeMTA Tracker — Backend szerver
Adatok JSON fájlba mentése, hogy minden eszközről látható legyen.
"""

import json
import os
import re
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

DATA_FILE = os.path.join(os.path.dirname(__file__), 'data.json')
STATIC_DIR = os.path.dirname(__file__)

# ===== Adat kezelés =====

def load_data():
    if not os.path.exists(DATA_FILE):
        return {}
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return {}

def save_data(data):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# ===== HTTP szerver =====

class Handler(BaseHTTPRequestHandler):

    def log_message(self, fmt, *args):  # pylint: disable=arguments-differ
        pass  # log elnyomása

    def send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def send_json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', len(body))
        self.send_cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def send_file(self, path, content_type):
        try:
            with open(path, 'rb') as f:
                body = f.read()
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', len(body))
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
            self.end_headers()
            self.wfile.write(body)
        except FileNotFoundError:
            body = b'Not Found'
            self.send_response(404)
            self.send_header('Content-Type', 'text/plain')
            self.send_header('Content-Length', len(body))
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == '/api/data':
            self.send_json(200, load_data())
            return

        MIME = {
            '.html': 'text/html; charset=utf-8',
            '.css':  'text/css; charset=utf-8',
            '.js':   'application/javascript; charset=utf-8',
            '.ico':  'image/x-icon',
            '.png':  'image/png',
            '.jpg':  'image/jpeg',
            '.json': 'application/json',
            '.webmanifest': 'application/manifest+json',
        }
        if path == '/':
            self.send_file(os.path.join(STATIC_DIR, 'index.html'), 'text/html; charset=utf-8')
        else:
            file_path = os.path.join(STATIC_DIR, path.lstrip('/'))
            ext = os.path.splitext(file_path)[1]
            mime = MIME.get(ext, 'application/octet-stream')
            self.send_file(file_path, mime)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == '/api/save':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            try:
                payload = json.loads(body)
                key = payload.get('key')
                add_duty = payload.get('dutyMinutes', 0)
                add_sessions = payload.get('sessionCount', 0)
                add_freezes = payload.get('freezeCount', 0)
                add_today = payload.get('todayMinutes', 0)
                add_reports = payload.get('reportCount', 0)
                add_today_reports = payload.get('todayReportCount', 0)
                add_offduty = payload.get('offDutyMinutes', 0)
                last_ts = payload.get('lastTimestamp', None)
                last_report_ts = payload.get('lastReportTimestamp', None)
                day_entries = payload.get('dayEntries', {})  # {YYYY-MM-DD: minutes}

                if not key:
                    self.send_json(400, {'error': 'Hiányzó key'})
                    return

                try:
                    from datetime import datetime
                    from zoneinfo import ZoneInfo
                    today_str = datetime.now(ZoneInfo("Europe/Budapest")).strftime('%Y-%m-%d')
                except (ImportError, KeyError):
                    from datetime import date
                    today_str = date.today().isoformat()  # fallback

                data = load_data()
                existing = data.get(key, {
                    'dutyMinutes': 0, 'sessionCount': 0, 'freezeCount': 0,
                    'todayMinutes': 0, 'todayDate': '', 'lastTimestamp': None,
                    'dailyMinutes': {}, 'streak': 0, 'bestDay': 0,
                    'offDutyMinutes': 0, '_liveState': None
                })

                # Napi bontás frissítése
                daily = existing.get('dailyMinutes', {})
                for day, mins in day_entries.items():
                    daily[day] = daily.get(day, 0) + mins
                
                # Streak számítás
                streak = _calc_streak(daily, today_str)
                best_day = max(daily.values()) if daily else 0

                # Today minutes
                prev_today = existing.get('todayMinutes', 0) if existing.get('todayDate') == today_str else 0

                # lastTimestamp (duty) — mindig a nagyobbat tartjuk
                old_ts = existing.get('lastTimestamp')
                if last_ts and old_ts:
                    new_ts = last_ts if last_ts > old_ts else old_ts
                else:
                    new_ts = last_ts or old_ts

                # lastReportTimestamp — külön a reportoknak
                old_report_ts = existing.get('lastReportTimestamp')
                if last_report_ts and old_report_ts:
                    new_report_ts = last_report_ts if last_report_ts > old_report_ts else old_report_ts
                else:
                    new_report_ts = last_report_ts or old_report_ts

                prev_today_reports = existing.get('todayReportCount', 0) if existing.get('todayDate') == today_str else 0

                data[key] = {
                    'dutyMinutes':      existing['dutyMinutes'] + add_duty,
                    'sessionCount':     existing['sessionCount'] + add_sessions,
                    'freezeCount':      existing['freezeCount'] + add_freezes,
                    'todayMinutes':     prev_today + add_today,
                    'todayDate':        today_str,
                    'lastTimestamp':    new_ts,
                    'dailyMinutes':     daily,
                    'streak':           streak,
                    'bestDay':          best_day,
                    'offDutyMinutes':       existing.get('offDutyMinutes', 0) + add_offduty,
                    'reportCount':          existing.get('reportCount', 0) + add_reports,
                    'todayReportCount':     prev_today_reports + add_today_reports,
                    'lastReportTimestamp':  new_report_ts,
                    '_liveState':           existing.get('_liveState'),
                }
                save_data(data)
                self.send_json(200, {'ok': True, 'data': data[key]})
            except Exception as e:  # pylint: disable=broad-exception-caught
                self.send_json(500, {'error': str(e)})
            return

        if path == '/api/live':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            try:
                payload = json.loads(body)
                line = payload.get('line', '')
                ts_match = re.search(r'\[(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})\]', line)
                if not ts_match:
                    self.send_json(200, {'ok': True, 'skipped': True})
                    return
                date_str = ts_match.group(1)
                key = date_str[:7].replace('-', '_')
                data = load_data()
                existing = data.get(key, {
                    'dutyMinutes': 0, 'sessionCount': 0, 'freezeCount': 0,
                    'todayMinutes': 0, 'todayDate': '', '_liveState': None
                })
                live = existing.get('_liveState')
                if 'adminszolgálatba lépett' in line and not live:
                    existing['_liveState'] = ts_match.group(0)[1:-1]
                elif live and ('kilépett' in line or 'quit' in line or 'logger ended' in line):
                    existing['_liveState'] = None
                data[key] = existing
                save_data(data)
                self.send_json(200, {'ok': True})
            except Exception as e:  # pylint: disable=broad-exception-caught
                self.send_json(500, {'error': str(e)})
            return

        self.send_json(404, {'error': 'Not found'})

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path
        if path.startswith('/api/delete/'):
            key = path.split('/')[-1]
            data = load_data()
            if key in data:
                del data[key]
                save_data(data)
            self.send_json(200, {'ok': True})
            return
        self.send_json(404, {'error': 'Not found'})


def _calc_streak(daily, today_str):
    """Egymást követő aktív napok száma (visszafelé a maitól vagy tegnapról)."""
    from datetime import date, timedelta
    streak = 0
    d = date.fromisoformat(today_str)
    # Ha mára még nincs adat, tegnapról indulunk (ne törje meg a streak-et)
    if daily.get(today_str, 0) == 0:
        d -= timedelta(days=1)
    while True:
        ds = d.isoformat()
        if daily.get(ds, 0) > 0:
            streak += 1
            d -= timedelta(days=1)
        else:
            break
    return streak


if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 8765), Handler)
    print('SeeMTA Tracker fut: http://0.0.0.0:8765')
    server.serve_forever()
