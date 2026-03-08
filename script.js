// =====================================================
// KONSTANSOK
// =====================================================
const TOTAL_GOAL = 4000; // fallback, felülírja a dutyGoal input

function getDutyGoal() {
    const el = document.getElementById('dutyGoal');
    return el ? (parseInt(el.value) || 3500) : 3500;
}
function getOffDutyLimit() {
    const el = document.getElementById('offDutyLimit');
    return el ? (parseInt(el.value) || 500) : 500;
}

// localStorage-ból betöltés oldalinduláskor
document.addEventListener('DOMContentLoaded', () => {
    const savedDuty = localStorage.getItem('seemta-duty-goal');
    const savedOff  = localStorage.getItem('seemta-offduty-limit');
    if (savedDuty) { const el = document.getElementById('dutyGoal');    if (el) el.value = savedDuty; }
    if (savedOff)  { const el = document.getElementById('offDutyLimit'); if (el) el.value = savedOff; }

    // Mentés változáskor
    document.getElementById('dutyGoal')?.addEventListener('change', () => {
        localStorage.setItem('seemta-duty-goal', document.getElementById('dutyGoal').value);
        updateMonthlyUI();
    });
    document.getElementById('offDutyLimit')?.addEventListener('change', () => {
        localStorage.setItem('seemta-offduty-limit', document.getElementById('offDutyLimit').value);
        updateMonthlyUI();
    });
});
// API_BASE — localStorage-ból vagy auto-detect
function getApiBase() {
    const saved = localStorage.getItem('seemta-api-url');
    if (saved) return saved.replace(/\/$/, '');
    // GitHub Pages-en (github.io) soha ne próbáljon API-t elérni
    if (window.location.hostname.includes('github.io')) return '';
    return window.location.pathname.startsWith('/seemta') ? '/seemta' : '';
}
let API_BASE = getApiBase();

// =====================================================
// HÁTTÉR ANIMÁCIÓ
// =====================================================
const bgLogos = [];
const logoCount = 50;
let mouse = { x: null, y: null };
const repulsionRadius = 150;

document.addEventListener('DOMContentLoaded', initBackgroundAnimation);

function initBackgroundAnimation() {
    const container = document.getElementById('background-animation');
    if (!container) return;

    window.addEventListener('mousemove', (e) => { mouse.x = e.x; mouse.y = e.y; });
    window.addEventListener('mouseout',  () => { mouse.x = null; mouse.y = null; });

    for (let i = 0; i < logoCount; i++) {
        const logoElement = document.createElement('img');
        logoElement.src = 'files/logo.png';
        logoElement.className = 'flying-logo';
        container.appendChild(logoElement);

        const size = Math.random() * 60 + 20;
        bgLogos.push({
            element:  logoElement,
            x:        Math.random() * window.innerWidth,
            y:        Math.random() * window.innerHeight,
            size:     size,
            speedY:   Math.random() * 1 + 0.5,
            initialX: Math.random() * window.innerWidth,
        });
        logoElement.style.width  = `${size}px`;
        logoElement.style.height = `${size}px`;
    }
    animate();
}

function animate() {
    bgLogos.forEach(logo => {
        logo.y -= logo.speedY;
        if (mouse.x !== null) {
            const dx = logo.x - mouse.x;
            const dy = logo.y - mouse.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < repulsionRadius) {
                const force = (repulsionRadius - distance) / repulsionRadius;
                const angle = Math.atan2(dy, dx);
                logo.x += Math.cos(angle) * force * 5;
                logo.y += Math.sin(angle) * force * 5;
            }
        }
        logo.x += (logo.initialX - logo.x) * 0.01;
        if (logo.y < -logo.size) {
            logo.y = window.innerHeight + logo.size;
            logo.x = Math.random() * window.innerWidth;
            logo.initialX = logo.x;
        }
        logo.element.style.transform = `translate3d(${logo.x}px, ${logo.y}px, 0)`;
    });
    requestAnimationFrame(animate);
}

// =====================================================
// FÁJL KIVÁLASZTÓ
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('logFiles');
    if (fileInput) fileInput.addEventListener('change', updateFileList);
    const reportInput = document.getElementById('reportFiles');
    if (reportInput) reportInput.addEventListener('change', updateReportFileList);
    document.getElementById('processButton').addEventListener('click', processLogs);
    document.getElementById('reportButton').addEventListener('click', processReports);
    document.getElementById('btn-reset').addEventListener('click', resetMonth);

    // Téma váltó
    const savedTheme = localStorage.getItem('seemta-theme') || 'dark';
    applyTheme(savedTheme);

    // Settings panel
    const settingsBtn   = document.getElementById('settings-toggle');
    const settingsPanel = document.getElementById('settings-panel');
    const apiUrlInput   = document.getElementById('api-url-input');
    const apiUrlSave    = document.getElementById('api-url-save');
    const apiUrlStatus  = document.getElementById('api-url-status');

    apiUrlInput.value = localStorage.getItem('seemta-api-url') || '';

    settingsBtn.addEventListener('click', () => {
        settingsPanel.style.display = settingsPanel.style.display === 'none' ? 'block' : 'none';
    });

    apiUrlSave.addEventListener('click', async () => {
        const val = apiUrlInput.value.trim().replace(/\/$/, '');
        if (val) {
            localStorage.setItem('seemta-api-url', val);
        } else {
            localStorage.removeItem('seemta-api-url');
        }
        API_BASE = getApiBase();
        apiUrlStatus.textContent = '✅ Mentve! Újratöltés...';
        apiUrlStatus.style.color = '#34d399';
        setTimeout(() => location.reload(), 1000);
    });

    document.getElementById('theme-toggle').addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        applyTheme(current === 'dark' ? 'light' : 'dark');
    });

    // Hónap választó
    document.getElementById('month-selector').addEventListener('change', function() {
        selectedMonthKey = this.value;
        updateMonthlyUI();
    });

    loadMonthlyStats();

    // Manuális off-duty hozzáadás
    document.getElementById('addOffDutyBtn').addEventListener('click', async () => {
        const fromVal = document.getElementById('offdutyFrom').value;
        const toVal   = document.getElementById('offdutyTo').value;
        const status  = document.getElementById('offduty-manual-status');

        if (!fromVal || !toVal) {
            status.textContent = '⚠️ Add meg a kezdő és záró időpontot!';
            status.style.color = '#f87171';
            return;
        }

        const [fH, fM] = fromVal.split(':').map(Number);
        const [tH, tM] = toVal.split(':').map(Number);
        let mins = (tH * 60 + tM) - (fH * 60 + fM);

        if (mins <= 0) {
            status.textContent = '⚠️ A záró időpontnak a kezdő után kell lennie!';
            status.style.color = '#f87171';
            return;
        }

        const now = new Date();
        const key = `${now.getFullYear()}_${String(now.getMonth()+1).padStart(2,'0')}`;

        status.textContent = '⏳ Mentés...';
        status.style.color = '#8b5cf6';

        try {
            await apiSave(key, 0, 0, 0, 0, null, {}, mins);
            status.textContent = `✅ +${mins} perc off-duty hozzáadva (${fromVal} – ${toVal})`;
            status.style.color = '#34d399';
            document.getElementById('offdutyFrom').value = '';
            document.getElementById('offdutyTo').value = '';
            await loadMonthlyStats();
        } catch (e) {
            status.textContent = '❌ Hiba: ' + e.message;
            status.style.color = '#f87171';
        }
    });

});

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('seemta-theme', theme);
    const btn = document.getElementById('theme-toggle');
    // sötét módban 🌙 (kattintásra világosba megy), világos módban ☀️ (kattintásra sötétbe)
    if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

let selectedMonthKey = null;

function updateReportFileList() {
    const fileInput     = document.getElementById('reportFiles');
    const fileCountSpan = document.getElementById('report-file-count');
    const count = fileInput.files.length;
    if (count === 1)    fileCountSpan.textContent = '1 fájl kiválasztva';
    else if (count > 1) fileCountSpan.textContent = `${count} fájl kiválasztva`;
    else                fileCountSpan.textContent = 'Nincs kiválasztott fájl';
}

function updateFileList() {
    const fileInput   = document.getElementById('logFiles');
    const fileCountSpan = document.getElementById('file-count');
    const count = fileInput.files.length;
    if (count === 1)     fileCountSpan.textContent = '1 fájl kiválasztva';
    else if (count > 1)  fileCountSpan.textContent = `${count} fájl kiválasztva`;
    else                 fileCountSpan.textContent = 'Nincs kiválasztott fájl';
}


// =====================================================
// LOG FELDOLGOZÁS (eredeti logika)
// =====================================================
function parseDateTime(str) {
    const match = str.match(/\[(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})]/);
    if (match) return new Date(`${match[1]}T${match[2]}`); // lokális időként parse-ol minden böngészőben
    return null;
}

function formatDuration(ms) {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const hours   = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}ó ${minutes}p ${seconds}mp`;
}

function getLastValidDate(lines) {
    for (let i = lines.length - 1; i >= 0; i--) {
        const date = parseDateTime(lines[i]);
        if (date) return date;
    }
    return null;
}

function getPreviousValidDate(lines, currentIndex) {
    for (let i = currentIndex - 1; i >= 0; i--) {
        const date = parseDateTime(lines[i]);
        if (date) return date;
    }
    return null;
}

async function processLogs() {
    const adminName     = document.getElementById('adminName').value.trim();
    const files         = document.getElementById('logFiles').files;
    const resultsDiv    = document.getElementById('results');
    const processButton = document.getElementById('processButton');
    resultsDiv.innerHTML = '';

    if (!adminName || files.length === 0) {
        alert('Kérlek add meg az adminnevet, és tölts fel fájlokat!');
        return;
    }

    processButton.classList.add('loading');
    processButton.disabled = true;

    try {

    let grandTotal = 0;
    const allFileResults = [];

    const key        = getCurrentMonthKey();
    allMonthData     = await apiLoadAll();
    const serverData = allMonthData[key] || {};
    const lastTS     = serverData.lastTimestamp || null;
    const cutoff     = lastTS ? new Date(lastTS) : null;

    let newDutyMs    = 0;
    let newSessions  = 0;
    let todayMs      = 0;
    let latestDate   = null;
    const todayStr   = toLocalDateStr(new Date());
    const dayEntries = {}; // {YYYY-MM-DD: ms} — napi bontás az új intervallumokból

    for (const file of files) {
        let text;
        try {
            text = await file.text();
        } catch(e) {
            try {
                text = await new Promise((resolve, reject) => {
                    const fr = new FileReader();
                    fr.onload = () => resolve(fr.result);
                    fr.onerror = () => reject(fr.error);
                    fr.readAsText(file, 'utf-8');
                });
            } catch(e2) {
                alert(`Nem sikerült olvasni a fájlt: ${file.name}\n\nPróbáld más böngészővel (Chrome/Firefox).`);
                continue;
            }
        }
        const lines = text.replace(/\r/g, '').split('\n').filter(Boolean);
        let dutyIntervals = [];
        let dutyStart     = null;

        for (let i = 0; i < lines.length; i++) {
            const line     = lines[i];
            const datetime = parseDateTime(line);
            if (!datetime) continue;

            const isStart = line.includes(`[SeeMTA - AdminDuty]: ${adminName} adminszolgálatba lépett.`);
            const isEnd   =
                line.includes(`[SeeMTA - AdminDuty]: ${adminName} kilépett az adminszolgálatból.`) ||
                line.includes('[Input]  : quit')       ||
                line.includes('[Input]  : reconnect')  ||
                line.includes('[Input]  : exit')       ||
                line.includes('[Input]  : disconnect') ||
                line.includes(`[SeeMTA - Kick]: ${adminName}`) ||
                line.includes('SeeMTA logger ended');
            const isCrashRestart = line.includes('SeeMTA logger started');

            if (isStart) {
                if (dutyStart) dutyIntervals.push({ start: dutyStart, end: datetime });
                dutyStart = datetime;
            } else if (isEnd && dutyStart) {
                dutyIntervals.push({ start: dutyStart, end: datetime });
                dutyStart = null;
            } else if (isCrashRestart && dutyStart) {
                // Időrés logika: megnézzük volt-e normál kilépés az újraindítás előtt 2 percen belül
                const lastValid = getPreviousValidDate(lines, i);
                const prevKilep = (() => {
                    // Visszafelé keresünk kilépés sort az utolsó 50 sorban
                    for (let j = i - 1; j >= Math.max(0, i - 50); j--) {
                        if (lines[j].includes(`${adminName} kilépett az adminszolgálatból.`) ||
                            lines[j].includes('SeeMTA logger ended') ||
                            lines[j].includes('[Input]  : quit') ||
                            lines[j].includes('[Input]  : disconnect')) {
                            const t = parseDateTime(lines[j]);
                            if (t) return t;
                        }
                    }
                    return null;
                })();

                // Crash = nincs kilépés sor az újraindítás előtt (időrés mindegy)
                const isCrash = !prevKilep;

                if (isCrash && lastValid && lastValid > dutyStart) {
                    // Crash: az utolsó loggolt időpontig számoljuk
                    dutyIntervals.push({ start: dutyStart, end: lastValid });
                } else if (!isCrash && prevKilep && prevKilep > dutyStart) {
                    // Normál kilépés volt, de a logger ended/started köré esett
                    dutyIntervals.push({ start: dutyStart, end: prevKilep });
                } else if (lastValid && lastValid > dutyStart) {
                    dutyIntervals.push({ start: dutyStart, end: lastValid });
                }
                dutyStart = null;
            }
        }

        if (dutyStart) {
            const lastDate = getLastValidDate(lines);
            if (lastDate && lastDate > dutyStart) {
                dutyIntervals.push({ start: dutyStart, end: lastDate });
            }
        }

        // Csak a cutoff utáni intervallumokat számoljuk
        const newIntervals = dutyIntervals.filter(iv => !cutoff || iv.end > cutoff).map(iv => ({
            start: cutoff && iv.start < cutoff ? cutoff : iv.start,
            end:   iv.end
        }));

        allFileResults.push({ name: file.name, intervals: dutyIntervals, newIntervals });

        for (const iv of newIntervals) {
            const ms = iv.end - iv.start;
            newDutyMs   += ms;
            newSessions += 1;
            if (!latestDate || iv.end > latestDate) latestDate = iv.end;

            // Napi bontás — éjfélen átnyúló session esetén napokra bontjuk
            let cursor = new Date(iv.start);
            while (cursor < iv.end) {
                // A következő éjfél (lokális)
                const nextMidnight = new Date(cursor);
                nextMidnight.setHours(24, 0, 0, 0);

                const chunkEnd = nextMidnight < iv.end ? nextMidnight : iv.end;
                const chunkMs  = chunkEnd - cursor;
                const dayKey   = toLocalDateStr(cursor);

                dayEntries[dayKey] = (dayEntries[dayKey] || 0) + chunkMs;
                if (dayKey === todayStr) todayMs += chunkMs;

                cursor = nextMidnight;
            }
        }

        // Grand total az összes intervallumból (megjelenítéshez)
        for (const iv of dutyIntervals) {
            grandTotal += iv.end - iv.start;
        }
    }

    // Megjelenítés — eredeti stílus
    resultsDiv.innerHTML = '';

    const grandTotalDiv = document.createElement('div');
    grandTotalDiv.className = 'grand-total';
    grandTotalDiv.innerHTML = `
        <h3>Összesen: ${formatDuration(grandTotal)} (${Math.floor(grandTotal / 60000)} perc)</h3>
    `;
    resultsDiv.appendChild(grandTotalDiv);

    const breakdownContent = document.createElement('div');
    breakdownContent.className = 'breakdown-content';

    for (const result of allFileResults) {
        const detailsElement = document.createElement('details');
        detailsElement.className = 'file-result';

        const summaryElement = document.createElement('summary');
        summaryElement.innerHTML = `<span class="summary-title">${result.name}</span><span class="summary-total"></span>`;

        const detailsContent = document.createElement('div');
        detailsContent.className = 'details-content';

        let fileTotal = 0;
        if (result.intervals.length === 0) {
            detailsContent.innerHTML = `<p>Nincs adminduty adat a következő névhez: "${adminName}".</p>`;
        } else {
            result.intervals.forEach((interval, idx) => {
                const duration = interval.end - interval.start;
                fileTotal += duration;
                const p = document.createElement('p');
                const startStr = interval.start.toLocaleString('hu-HU', {month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'});
                const endStr   = interval.end.toLocaleString('hu-HU', {month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'});
                p.textContent = `${idx + 1}. session: ${startStr} → ${endStr} (${formatDuration(duration)})`;
                detailsContent.appendChild(p);
            });
        }

        summaryElement.querySelector('.summary-total').textContent = `Összesen: ${formatDuration(fileTotal)}`;
        detailsElement.appendChild(summaryElement);
        detailsElement.appendChild(detailsContent);
        breakdownContent.appendChild(detailsElement);
    }

    if (allFileResults.length > 0) {
        const breakdownDetails = document.createElement('details');
        breakdownDetails.className = 'breakdown-details';
        const breakdownSummary = document.createElement('summary');
        breakdownDetails.appendChild(breakdownSummary);
        breakdownDetails.appendChild(breakdownContent);
        resultsDiv.appendChild(breakdownDetails);
    }

    if (newDutyMs > 0 && latestDate) {
        const newMins      = newDutyMs / 60000;
        const todayMins    = todayMs / 60000;
        const lastTSStr    = latestDate.toISOString();
        const dayMins = {};
        for (const [d, ms] of Object.entries(dayEntries)) dayMins[d] = ms / 60000;
        await apiSave(key, newMins, newSessions, 0, todayMins, lastTSStr, dayMins);
        await loadMonthlyStats();
    }

    } catch (err) {
        console.error('Feldolgozási hiba:', err);
        resultsDiv.innerHTML = `<p style="color:#ef4444">⚠️ Hiba történt: ${err.message}</p>`;
    }

    processButton.classList.remove('loading');
    processButton.disabled = false;
}


// =====================================================
// REPORT FELDOLGOZÁS
// =====================================================
async function processReports() {
    const files = document.getElementById('reportFiles').files;
    const resultsDiv = document.getElementById('report-results');
    const btn        = document.getElementById('reportButton');
    resultsDiv.innerHTML = '';

    if (files.length === 0) {
        alert('Kérlek tölts fel fájlokat!');
        return;
    }

    btn.classList.add('loading');
    btn.disabled = true;

    try {
        allMonthData = await apiLoadAll();

        // Fájlonként külön kulcs — a fájl első timestampje alapján
        // (ha februári logot töltesz fel, 2026_02 kulcs alá megy, nem 2026_03)
        const fileTexts = [];
        for (const file of files) {
            let text;
            try {
                text = await file.text();
            } catch(e) {
                try {
                    text = await new Promise((resolve, reject) => {
                        const fr = new FileReader();
                        fr.onload = () => resolve(fr.result);
                        fr.onerror = () => reject(fr.error);
                        fr.readAsText(file, 'utf-8');
                    });
                } catch(e2) {
                    continue;
                }
            }
            fileTexts.push({ name: file.name, text });
        }

        // Csoportosítjuk hónap szerint
        const byMonth = {}; // { '2026_03': [ {line, dt, reportId} ] }
        for (const { text } of fileTexts) {
            const lines = text.replace(/\r/g, '').split('\n').filter(Boolean);
            for (const line of lines) {
                if (!line.includes('[SeeMTA - Siker]: Sikeresen elvállaltad az ügyet!')) continue;
                const dt = parseDateTime(line);
                if (!dt) continue;
                // Ügyazonosító kinyerése: (344201)
                const idMatch = line.match(/\((\d+)\)/);
                const reportId = idMatch ? idMatch[1] : '?';
                const monthKey = `${dt.getFullYear()}_${String(dt.getMonth() + 1).padStart(2, '0')}`;
                if (!byMonth[monthKey]) byMonth[monthKey] = [];
                byMonth[monthKey].push({ line, dt, reportId });
            }
        }

        let grandNewReports = 0;
        const allNewEntries = []; // összes új entry a megjelenítéshez

        for (const [monthKey, entries] of Object.entries(byMonth)) {
            const serverData   = allMonthData[monthKey] || {};
            const lastReportTS = serverData.lastReportTimestamp || null;
            const cutoff       = lastReportTS ? new Date(lastReportTS) : null;

            let newReports = 0;
            let latestDate = null;
            const newEntries = [];
            for (const { dt, reportId } of entries) {
                if (cutoff && dt <= cutoff) continue;
                newReports++;
                newEntries.push({ dt, reportId });
                if (!latestDate || dt > latestDate) latestDate = dt;
            }

            if (newReports > 0 && latestDate) {
                const result = await apiSaveReports(monthKey, newReports, latestDate.toISOString());
                if (result && result.ok) {
                    grandNewReports += newReports;
                    allNewEntries.push(...newEntries);
                } else {
                    throw new Error(`Szerver hiba (${monthKey}): ${result?.error || 'ismeretlen'}`);
                }
            }
        }

        // Megjelenítés
        if (grandNewReports > 0) {
            // Időrendbe rendezés
            allNewEntries.sort((a, b) => a.dt - b.dt);

            const div = document.createElement('div');
            div.className = 'grand-total';
            div.style.marginTop = '1.5rem';

            // Fejléc — kattintásra nyílik/csukódik
            div.innerHTML = `<h3 id="report-detail-toggle" style="cursor:pointer;user-select:none;">📋 Új reportok: +${grandNewReports} db <span id="report-toggle-icon" style="font-size:0.85rem;opacity:0.6;">▼ részletek</span></h3>`;

            // Részletes lista (alapból nyitva)
            const table = document.createElement('div');
            table.className = 'report-detail-list';
            table.id = 'report-detail-list';
            table.innerHTML = allNewEntries.map((e, i) => {
                const timeStr = e.dt.toLocaleString('hu-HU', {
                    month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit'
                });
                return `<div class="report-detail-row">
                    <span class="report-detail-num">#${i + 1}</span>
                    <span class="report-detail-id">Ügy #${e.reportId}</span>
                    <span class="report-detail-time">${timeStr}</span>
                </div>`;
            }).join('');

            div.appendChild(table);

            // Toggle logika
            div.querySelector('#report-detail-toggle').addEventListener('click', () => {
                const list = div.querySelector('#report-detail-list');
                const icon = div.querySelector('#report-toggle-icon');
                const isOpen = list.style.display !== 'none';
                list.style.display = isOpen ? 'none' : 'block';
                icon.textContent = isOpen ? '▶ részletek' : '▼ bezár';
            });
            resultsDiv.appendChild(div);
            await loadMonthlyStats();
        } else {
            resultsDiv.innerHTML = `<p style="color:#a0a0a0; margin-top:1rem; text-align:center;">Nincs új report (már fel volt töltve).</p>`;
        }

    } catch (err) {
        console.error('Report feldolgozási hiba:', err);
        resultsDiv.innerHTML = `<p style="color:#ef4444">⚠️ Hiba: ${err.message}</p>`;
    }

    btn.classList.remove('loading');
    btn.disabled = false;
}

// =====================================================
// API
// =====================================================
let allMonthData = {};

// localStorage kulcs prefix (offline mód)
const LS_PREFIX = 'seemta_data_';

async function apiLoadAll() {
    if (!API_BASE) {
        // Offline mód — localStorage-ból olvas
        const result = {};
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(LS_PREFIX)) {
                try { result[k.slice(LS_PREFIX.length)] = JSON.parse(localStorage.getItem(k)); } catch {}
            }
        }
        return result;
    }
    try {
        const res = await fetch(`${API_BASE}/api/data`);
        return await res.json();
    } catch { return {}; }
}

async function apiSaveReports(key, reportCount, lastReportTimestamp) {
    if (!API_BASE) {
        const existing = JSON.parse(localStorage.getItem(LS_PREFIX + key) || '{}');
        existing.reportCount = reportCount;
        existing.lastReportTimestamp = lastReportTimestamp;
        localStorage.setItem(LS_PREFIX + key, JSON.stringify(existing));
        return existing;
    }
    const res = await fetch(`${API_BASE}/api/save`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ key, reportCount, lastReportTimestamp,
                                  dutyMinutes: 0, sessionCount: 0, freezeCount: 0,
                                  todayMinutes: 0, lastTimestamp: null, dayEntries: {} })
    });
    return await res.json();
}

async function apiSave(key, dutyMinutes, sessionCount, freezeCount, todayMinutes, lastTimestamp, dayEntries = {}, offDutyMinutes = 0) {
    if (!API_BASE) {
        // Offline mód — localStorage-ba ment
        const data = { key, dutyMinutes, sessionCount, freezeCount, todayMinutes, lastTimestamp, dayEntries, offDutyMinutes };
        localStorage.setItem(LS_PREFIX + key, JSON.stringify(data));
        return data;
    }
    const res = await fetch(`${API_BASE}/api/save`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ key, dutyMinutes, sessionCount, freezeCount, todayMinutes, lastTimestamp, dayEntries, offDutyMinutes })
    });
    return await res.json();
}

// ===== DÁTUM SEGÉDFÜGGVÉNYEK =====
function toLocalDateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

async function apiDelete(key) {
    if (!API_BASE) {
        localStorage.removeItem(LS_PREFIX + key);
        return;
    }
    await fetch(`${API_BASE}/api/delete/${key}`, { method: 'DELETE' });
}

// =====================================================
// HAVI ÖSSZESÍTŐ UI
// =====================================================
function getCurrentMonthKey() {
    const d = new Date();
    return `${d.getFullYear()}_${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthKeyToLabel(key) {
    const [y, m] = key.split('_');
    const hu = ['január','február','március','április','május','június',
                'július','augusztus','szeptember','október','november','december'];
    return `${y}. ${hu[parseInt(m, 10) - 1]}`;
}

function daysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
}

async function loadMonthlyStats() {
    allMonthData = await apiLoadAll();

    // Hónap választó feltöltése
    const selector = document.getElementById('month-selector');
    if (selector) {
        const currentKey = getCurrentMonthKey();
        const keys = Object.keys(allMonthData).sort().reverse();
        if (!keys.includes(currentKey)) keys.unshift(currentKey);
        selector.innerHTML = keys.map(k =>
            `<option value="${k}"${k === (selectedMonthKey || currentKey) ? ' selected' : ''}>${monthKeyToLabel(k)}</option>`
        ).join('');
        if (!selectedMonthKey) selectedMonthKey = currentKey;
    }

    updateMonthlyUI();
}

function updateMonthlyUI() {
    const key = selectedMonthKey || getCurrentMonthKey();
    const [y, m] = key.split('_').map(Number);
    const data = allMonthData[key] || { dutyMinutes: 0, sessionCount: 0, todayMinutes: 0, todayDate: '', dailyMinutes: {}, streak: 0, bestDay: 0 };

    document.getElementById('monthly-title').textContent = monthKeyToLabel(key);
    document.getElementById('monthly-badge').textContent = key.replace('_', '/');

    // Streak + best day
    document.getElementById('streak-value').textContent   = data.streak || 0;
    document.getElementById('best-day-value').textContent = Math.round(data.bestDay || 0);

    const totalMins = Math.round(data.dutyMinutes);
    document.getElementById('m-total-minutes').textContent = totalMins;
    document.getElementById('m-total-hours').textContent   = (data.dutyMinutes / 60).toFixed(1);
    document.getElementById('m-sessions').textContent      = data.sessionCount;

    const reportEl = document.getElementById('m-reports');
    if (reportEl) reportEl.textContent = (data.reportCount || 0) + ' db';

    // Heti átlag (utolsó 7 nap)
    const weeklyAvgEl = document.getElementById('m-weekly-avg');
    if (weeklyAvgEl) {
        const daily = data.dailyMinutes || {};
        const now = new Date();
        let weekSum = 0, weekDays = 0;
        for (let i = 0; i < 7; i++) {
            const d = new Date(now); d.setDate(d.getDate() - i);
            const ds = toLocalDateStr(d);
            if (daily[ds] !== undefined) { weekSum += daily[ds]; weekDays++; }
        }
        weeklyAvgEl.textContent = weekDays > 0 ? (weekSum / weekDays).toFixed(1) + ' p' : '—';
    }

    // Report/óra arány
    const rateEl = document.getElementById('m-report-rate');
    if (rateEl) {
        const hours = data.dutyMinutes / 60;
        rateEl.textContent = hours > 0 ? ((data.reportCount || 0) / hours).toFixed(1) : '—';
    }

    // Célok (localStorage-ból vagy inputból)
    const dutyGoal   = getDutyGoal();
    const offDutyLim = getOffDutyLimit();

    // Duty goal label frissítés
    const dutyGoalLbl = document.getElementById('duty-goal-label');
    if (dutyGoalLbl) dutyGoalLbl.textContent = dutyGoal;

    // Off-duty sáv
    const offDone  = Math.round(data.offDutyMinutes || 0);
    const offPct   = offDutyLim > 0 ? Math.min(Math.round((offDone / offDutyLim) * 100), 100) : 0;
    const offBar   = document.getElementById('offduty-bar');
    const offPctEl = document.getElementById('offduty-pct');
    const offDoneEl = document.getElementById('offduty-done');
    const offLimLbl = document.getElementById('offduty-limit-label');
    if (offBar)    offBar.style.width    = offPct + '%';
    if (offPctEl)  offPctEl.textContent  = offPct + '%';
    if (offDoneEl) offDoneEl.textContent = offDone;
    if (offLimLbl) offLimLbl.textContent = offDutyLim;

    // Admin duty progress
    const pct = Math.min(Math.round((data.dutyMinutes / dutyGoal) * 100), 100);
    document.getElementById('prog-bar').style.width = pct + '%';
    document.getElementById('prog-pct').textContent = pct + '%';

    // Napi kvóta (duty goal alapján)
    const totalDays  = daysInMonth(y, m);
    const dailyQuota = Math.ceil(dutyGoal / totalDays);
    document.getElementById('daily-quota').textContent = dailyQuota + ' perc';

    // Mai teljesítmény + trend nyíl
    const todayStr     = toLocalDateStr(new Date());
    const yesterdayStr = toLocalDateStr(new Date(Date.now() - 86400000));
    const daily        = data.dailyMinutes || {};
    const todayDone    = data.todayDate === todayStr ? Math.round(data.todayMinutes || 0) : Math.round(daily[todayStr] || 0);
    const yesterdayVal = Math.round(daily[yesterdayStr] || 0);
    const todayMiss    = Math.max(0, dailyQuota - todayDone);

    const donEl = document.getElementById('daily-done');
    let trendHtml = '';
    if (todayDone > dailyQuota) trendHtml = '<span class="trend-up">↑</span>';
    else if (todayDone < dailyQuota) trendHtml = '<span class="trend-down">↓</span>';
    donEl.innerHTML = todayDone + ' perc' + trendHtml;
    donEl.className = 'daily-value ' + (todayDone >= dailyQuota ? 'done' : 'accent');

    const misEl = document.getElementById('daily-missing');
    if (todayDone >= dailyQuota) {
        misEl.textContent = '✅ Kész!';
        misEl.className   = 'daily-value done';
    } else {
        misEl.textContent = todayMiss + ' perc';
        misEl.className   = 'daily-value warn';
    }

    // Deadline kalkulátor
    const lastDayOfMonth = new Date(y, m, 0).getDate();
    const today          = new Date();
    const remainingDays  = lastDayOfMonth - today.getDate();
    const missingMins    = Math.max(0, dutyGoal - data.dutyMinutes);
    const dailyNeeded    = remainingDays > 0 ? Math.ceil(missingMins / remainingDays) : '—';

    const daysEl = document.getElementById('deadline-days');
    const missEl = document.getElementById('deadline-missing');
    const dailyNEl = document.getElementById('deadline-daily');
    if (daysEl)   daysEl.textContent  = remainingDays + ' nap';
    if (missEl)   missEl.textContent  = Math.round(missingMins) + ' perc';
    if (dailyNEl) dailyNEl.textContent = missingMins <= 0 ? '✅ Elérve!' : (dailyNeeded + ' perc');

    // Grafikon
    renderBarChart(daily, dailyQuota);
}

function renderBarChart(dailyMinutes, quota) {
    const chart = document.getElementById('bar-chart');
    if (!chart) return;
    chart.innerHTML = '';

    // Utolsó 14 nap
    const days = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        days.push(toLocalDateStr(d));
    }

    const maxVal = Math.max(quota * 1.5, ...days.map(d => dailyMinutes[d] || 0), 1);

    days.forEach(day => {
        const mins = Math.round(dailyMinutes[day] || 0);
        const pct  = Math.min((mins / maxVal) * 100, 100);
        const isToday = day === toLocalDateStr(new Date());
        const hitQuota = mins >= quota;

        const col = document.createElement('div');
        col.className = 'bar-col';

        const bar = document.createElement('div');
        bar.className = 'bar' + (isToday ? ' bar-today' : '') + (hitQuota ? ' bar-done' : '');
        bar.style.height = pct + '%';
        bar.title = `${day}: ${mins} perc`;

        const label = document.createElement('div');
        label.className = 'bar-label';
        label.textContent = day.slice(8); // csak a nap száma

        col.appendChild(bar);
        col.appendChild(label);
        chart.appendChild(col);
    });
}

async function resetMonth() {
    const key = getCurrentMonthKey();
    if (confirm(`Biztosan törlöd ${monthKeyToLabel(key)} összes adatát?`)) {
        await apiDelete(key);
        await loadMonthlyStats();
        document.getElementById('results').innerHTML = '';
    }
}
