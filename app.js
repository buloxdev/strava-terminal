// ══════════════════════════════════════════════════════════════════════════
// STRAVA TERMINAL — Bloomberg-style Performance Dashboard
// ══════════════════════════════════════════════════════════════════════════
// Data is loaded from data/sample-data.json
// Replace that file with your own Strava data to customize the dashboard.
// ══════════════════════════════════════════════════════════════════════════

// ── Clock ────────────────────────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  const opts = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZoneName: 'short' };
  document.getElementById('clock').textContent = now.toLocaleTimeString('en-US', opts);
}
updateClock();
setInterval(updateClock, 1000);

// ── Chart.js Global Config ───────────────────────────────────────────────
Chart.defaults.font.family = "'JetBrains Mono', monospace";
Chart.defaults.font.size = 10;
Chart.defaults.color = '#6b7a8d';
Chart.defaults.borderColor = '#1e2633';
Chart.defaults.plugins.legend.labels.boxWidth = 10;
Chart.defaults.plugins.legend.labels.boxHeight = 10;
Chart.defaults.plugins.legend.labels.padding = 10;
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.pointStyle = 'rect';
Chart.defaults.plugins.tooltip.backgroundColor = '#1a2029';
Chart.defaults.plugins.tooltip.borderColor = '#2a3545';
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.titleFont = { family: "'JetBrains Mono', monospace", size: 10, weight: '600' };
Chart.defaults.plugins.tooltip.bodyFont = { family: "'JetBrains Mono', monospace", size: 10 };
Chart.defaults.plugins.tooltip.padding = 8;
Chart.defaults.plugins.tooltip.cornerRadius = 2;
Chart.defaults.elements.point.radius = 3;
Chart.defaults.elements.point.hoverRadius = 5;
Chart.defaults.elements.line.borderWidth = 2;
Chart.defaults.animation.duration = 800;
Chart.defaults.animation.easing = 'easeOutQuart';

// ── Load Data & Initialize ──────────────────────────────────────────────
let DATA = null;
let volumeChart = null;

async function init() {
  try {
    const resp = await fetch('data/sample-data.json');
    DATA = await resp.json();
    populateDashboard();
    createVolumeChart('mileage');
    createPaceChart();
    createDistChart();
    setupTabs();
    animateZoneBars();
  } catch (err) {
    console.error('Failed to load data:', err);
    document.body.innerHTML = '<div style="color:#ff3b4a;padding:40px;font-family:monospace;">ERROR: Could not load data/sample-data.json<br>Make sure the file exists and you are serving via HTTP (not file://).</div>';
  }
}

// ── Populate HTML from Data ─────────────────────────────────────────────
function populateDashboard() {
  const d = DATA;

  // Ticker
  setText('.ticker', `
    <span class="ticker-item"><span class="ticker-label">YTD RUN</span> <span class="ticker-val up">${d.ticker.ytdRun}</span></span>
    <span class="ticker-sep">|</span>
    <span class="ticker-item"><span class="ticker-label">YTD RIDE</span> <span class="ticker-val up">${d.ticker.ytdRide}</span></span>
    <span class="ticker-sep">|</span>
    <span class="ticker-item"><span class="ticker-label">WEEKLY AVG</span> <span class="ticker-val">${d.ticker.weeklyAvg}</span></span>
    <span class="ticker-sep">|</span>
    <span class="ticker-item"><span class="ticker-label">STREAK</span> <span class="ticker-val up">${d.ticker.streak}</span></span>
    <span class="ticker-sep">|</span>
    <span class="ticker-item"><span class="ticker-label">ACTIVE</span> <span class="ticker-val">${d.ticker.activePct}</span></span>
    <span class="ticker-sep">|</span>
    <span class="ticker-item"><span class="ticker-label">MAX HR</span> <span class="ticker-val warn">${d.ticker.maxHR}</span></span>
  `);

  // Career table
  const careers = ['running', 'cycling', 'swimming', 'weights'];
  const dotMap = { running: 'run', cycling: 'ride', swimming: 'swim', weights: 'wt' };
  const nameMap = { running: 'Running', cycling: 'Cycling', swimming: 'Swimming', weights: 'Weights' };
  let careerHTML = '';
  careers.forEach(c => {
    const row = d.career[c];
    careerHTML += `<tr><td><span class="dot dot-${dotMap[c]}"></span>${nameMap[c]}</td><td class="num">${row.sessions}</td><td class="num">${row.distance}</td><td class="num">${row.time}</td><td class="num">${row.elevation}</td></tr>`;
  });
  const total = d.career.total;
  careerHTML += `<tr class="row-total"><td>TOTAL</td><td class="num">${total.sessions}</td><td class="num">${total.distance}</td><td class="num">${total.time}</td><td class="num">${total.elevation}</td></tr>`;
  document.querySelector('.career-table tbody').innerHTML = careerHTML;

  // KPIs
  setKPI(0, d.kpis.avgPace, 'AVG RUN PACE', '/mi');
  setKPI(1, d.kpis.bestPace, 'BEST PACE', '/mi');
  setKPI(2, d.kpis.avgCadence, 'AVG CADENCE', d.kpis.avgCadence.unit || 'spm');
  setKPI(3, d.kpis.avgPower, 'AVG POWER', d.kpis.avgPower.unit || 'W');

  // HR Zones
  const zones = ['z1', 'z2', 'z3', 'z4', 'z5'];
  zones.forEach(z => {
    const pct = d.hrZones[z];
    const bar = document.querySelector(`.zone-bar.${z}`);
    if (bar) bar.style.width = Math.max(pct, 1) + '%';
    const row = bar?.closest('.zone-row');
    if (row) row.querySelector('.zone-pct').textContent = pct + '%';
  });

  // Zone insights
  document.querySelector('.zone-insight:nth-of-type(1) .insight-val').textContent = d.hrZones.polarization;
  document.querySelector('.zone-insight:nth-of-type(2) .insight-val').textContent = d.hrZones.efficiencyEasy;
  document.querySelector('.zone-insight:nth-of-type(3) .insight-val').textContent = d.hrZones.efficiencyHard;

  // Key Efforts
  let effortsHTML = '';
  d.keyEfforts.forEach(e => {
    const rowClass = e.highlight ? ' class="row-highlight"' : '';
    const paceClass = e.highlight ? ' accent' : '';
    const hrClass = e.hr >= 160 ? ' warn-text' : '';
    const prCell = e.prs > 0 ? `<span class="pr-badge">${e.prs}</span>` : '0';
    effortsHTML += `<tr${rowClass}><td>${e.date}</td><td class="effort-name">${e.name}</td><td class="num">${e.dist}</td><td class="num${paceClass}">${e.pace}</td><td class="num${hrClass}">${e.hr}</td><td class="num">${prCell}</td></tr>`;
  });
  document.querySelector('.efforts-table tbody').innerHTML = effortsHTML;

  // Alerts
  let alertsHTML = '';
  const iconMap = { critical: '!', warn: '!', info: 'i', positive: '✓' };
  const classMap = { critical: 'alert-critical', warn: 'alert-warn', info: 'alert-info', positive: 'alert-positive' };
  d.trainingInsights.alerts.forEach(a => {
    alertsHTML += `
      <div class="alert-item ${classMap[a.severity]}">
        <span class="alert-icon">${iconMap[a.severity]}</span>
        <div class="alert-body">
          <div class="alert-title">${a.title}</div>
          <div class="alert-text">${a.text}</div>
        </div>
      </div>`;
  });
  document.getElementById('insight-alerts').innerHTML = alertsHTML;

  // Footer
  document.querySelector('.bottom-left').innerHTML = `${d.athlete.device} &nbsp;|&nbsp; DATA: ${d.athlete.dataRange} &nbsp;|&nbsp; ${d.athlete.totalActivities} ACTIVITIES`;
}

function setText(selector, html) {
  const el = document.querySelector(selector);
  if (el) el.innerHTML = html;
}

function setKPI(index, kpi, label, unit) {
  const cards = document.querySelectorAll('.kpi-card');
  if (!cards[index]) return;
  const card = cards[index];
  card.querySelector('.kpi-label').textContent = label;
  card.querySelector('.kpi-value').innerHTML = `${kpi.value}<span class="kpi-unit">${unit}</span>`;
  const delta = card.querySelector('.kpi-delta');
  delta.textContent = kpi.delta;
  delta.className = 'kpi-delta ' + (kpi.direction || 'flat');
}

// ── Weekly Volume Chart ─────────────────────────────────────────────────
function createVolumeChart(mode) {
  const ctx = document.getElementById('volumeChart').getContext('2d');
  if (volumeChart) volumeChart.destroy();

  const v = DATA.weeklyVolume;
  const isMileage = mode === 'mileage';

  volumeChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: v.weeks,
      datasets: isMileage ? [
        { label: 'Run mi', data: v.runMiles, backgroundColor: '#00d26a', borderRadius: 1, barPercentage: 0.85, categoryPercentage: 0.8 },
        { label: 'Ride mi', data: v.rideMiles, backgroundColor: '#3b8bff', borderRadius: 1, barPercentage: 0.85, categoryPercentage: 0.8 }
      ] : [
        { label: 'Run hrs', data: v.runHours, backgroundColor: '#00d26a', borderRadius: 1, barPercentage: 0.7, categoryPercentage: 0.8 },
        { label: 'Ride hrs', data: v.rideHours, backgroundColor: '#3b8bff', borderRadius: 1, barPercentage: 0.7, categoryPercentage: 0.8 },
        { label: 'Wt hrs', data: v.wtHours, backgroundColor: '#a86fff', borderRadius: 1, barPercentage: 0.7, categoryPercentage: 0.8 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', align: 'end' },
        tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': ' + ctx.parsed.y.toFixed(1) } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 45, font: { size: 9 } } },
        y: { beginAtZero: true, grid: { color: '#1e2633' }, ticks: { callback: v => isMileage ? v + ' mi' : v + ' h' } }
      }
    }
  });
}

// ── Pace & Power Chart ──────────────────────────────────────────────────
function paceToLabel(dec) {
  const min = Math.floor(dec);
  const sec = Math.round((dec - min) * 60);
  return min + ':' + String(sec).padStart(2, '0');
}

function createPaceChart() {
  const p = DATA.paceEvolution;
  const ctx = document.getElementById('paceChart').getContext('2d');
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: p.months,
      datasets: [
        { label: 'Avg Pace /mi', data: p.avgPaces, borderColor: '#ffb700', backgroundColor: 'rgba(255,183,0,0.1)', fill: true, yAxisID: 'y', tension: 0.3, pointBackgroundColor: '#ffb700' },
        { label: 'Fastest /mi', data: p.fastPaces, borderColor: '#00d26a', borderDash: [4, 3], yAxisID: 'y', tension: 0.3, pointBackgroundColor: '#00d26a' },
        { label: 'Avg Power (W)', data: p.avgPower, borderColor: '#a86fff', yAxisID: 'y1', tension: 0.3, pointBackgroundColor: '#a86fff' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', align: 'end' },
        tooltip: { callbacks: { label: ctx => ctx.datasetIndex < 2 ? ctx.dataset.label + ': ' + paceToLabel(ctx.parsed.y) : ctx.dataset.label + ': ' + ctx.parsed.y + 'W' } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 9 } } },
        y: { reverse: true, min: 7, max: 11, grid: { color: '#1e2633' }, ticks: { callback: v => paceToLabel(v), stepSize: 0.5, font: { size: 9 } }, title: { display: true, text: 'PACE /MI', font: { size: 9 }, color: '#6b7a8d' } },
        y1: { position: 'right', min: 220, max: 260, grid: { display: false }, ticks: { callback: v => v + 'W', font: { size: 9 } }, title: { display: true, text: 'POWER', font: { size: 9 }, color: '#6b7a8d' } }
      }
    }
  });
}

// ── Distribution Chart ──────────────────────────────────────────────────
function createDistChart() {
  const d = DATA.distribution;
  const ctx = document.getElementById('distChart').getContext('2d');
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Running', 'Cycling', 'Weights'],
      datasets: [{ data: [d.running, d.cycling, d.weights], backgroundColor: ['#00d26a', '#3b8bff', '#a86fff'], borderWidth: 0, hoverOffset: 4 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '65%',
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 9 }, padding: 8 } },
        tooltip: { callbacks: { label: ctx => ctx.label + ': ' + ctx.parsed + '%' } }
      }
    }
  });
}

// ── Tab Switching ───────────────────────────────────────────────────────
function setupTabs() {
  // Volume tabs
  document.querySelectorAll('.panel-volume .tab').forEach(tab => {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.panel-volume .tab').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      createVolumeChart(this.dataset.chart);
    });
  });

  // Insight tabs
  document.querySelectorAll('.insight-tab').forEach(tab => {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.insight-tab').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      document.querySelectorAll('.insight-content').forEach(c => c.classList.add('hidden'));
      document.getElementById('insight-' + this.dataset.insight).classList.remove('hidden');
    });
  });
}

// ── Zone Bar Animation ──────────────────────────────────────────────────
function animateZoneBars() {
  document.querySelectorAll('.zone-bar').forEach(bar => {
    const target = bar.style.width;
    bar.style.width = '0%';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { bar.style.width = target; });
    });
  });
}

// ── Initialize ──────────────────────────────────────────────────────────
init();
