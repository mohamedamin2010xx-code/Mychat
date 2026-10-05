// ====== تحقق من الجلسة ======
fetch('/api/admin/check').then(r => r.json()).then(r => {
  if (!r.ok) location.href = '/admin';
});

// ====== تنسيق الأحجام ======
function formatBytes(b) {
  if (!b || b < 1024) return (b || 0) + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  if (b < 1024 * 1024 * 1024) return (b / 1024 / 1024).toFixed(1) + ' MB';
  return (b / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}

function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p = [];
  if (d > 0) p.push(d + 'd');
  if (h > 0) p.push(h + 'h');
  if (m > 0) p.push(m + 'm');
  p.push(sec + 's');
  return p.join(' ');
}

// ====== الساعة ======
function updateClock() {
  const now = new Date();
  const c = document.getElementById('clock');
  const d = document.getElementById('date');
  if (c) c.textContent = now.toLocaleTimeString('en-GB');
  if (d) d.textContent = now.toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}
updateClock();
setInterval(updateClock, 1000);

// ====== الرسم البياني ======
const history = { cpu: [], ram: [] };
const MAX_POINTS = 60;
let canvas, ctx;

function initChart() {
  canvas = document.getElementById('liveChart');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
  if (!canvas) return;
  canvas.width = canvas.offsetWidth;
  canvas.height = 150;
  drawChart();
}

function drawChart() {
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  // شبكة خلفية
  ctx.strokeStyle = '#1a3a1a';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = (h / 4) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  const step = w / (MAX_POINTS - 1);
  drawLine(history.cpu, '#00ff41', step, h);
  drawLine(history.ram, '#00ffff', step, h);
}

function drawLine(data, color, step, h) {
  if (data.length < 2) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  for (let i = 0; i < data.length; i++) {
    const x = i * step;
    const y = h - (data[i] / 100) * h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
}

// ====== جلب البيانات ======
async function fetchStats() {
  try {
    const r = await fetch('/api/monitor/stats').then(r => r.json());
    if (!r.ok) return;

    // CPU
    setText('cpuLoad', r.cpu.load);
    setBar('cpuBar', r.cpu.load);
    setText('cpuCores', r.cpu.cores);
    setText('cpuSpeed', r.cpu.speed);

    // RAM
    setText('memPercent', r.memory.percent);
    setBar('memBar', r.memory.percent);
    setText('memUsed', formatBytes(r.memory.used));
    setText('memTotal', formatBytes(r.memory.total));

    // DISK
    setText('diskPercent', r.disk.percent);
    setBar('diskBar', r.disk.percent);
    setText('diskUsed', formatBytes(r.disk.used));
    setText('diskTotal', formatBytes(r.disk.size));

    // BATTERY
    if (r.battery.hasBattery) {
      setText('batPercent', r.battery.percent);
      setBar('batBar', r.battery.percent);
      setText('batStatus', r.battery.isCharging ? '⚡ Charging' : 'On battery');
    } else {
      setText('batStatus', 'No battery info');
    }

    // TEMPERATURE
    if (r.temperature) {
      setText('temp', Math.round(r.temperature));
      const ts = r.temperature > 60 ? '🔥 HOT' : r.temperature > 45 ? '⚠️ Warm' : '✅ OK';
      setText('tempStatus', ts);
    } else {
      setText('temp', 'N/A');
      setText('tempStatus', 'Not available');
    }

    // NETWORK
    setText('netTx', formatBytes(r.network.tx_sec) + '/s');
    setText('netRx', formatBytes(r.network.rx_sec) + '/s');
    setText('netIface', r.network.iface);

    // UPTIME
    setText('uptime', formatUptime(r.uptime));
    setText('serverTime', new Date(r.serverTime).toLocaleString('en-GB'));

    // CONNECTIONS
    setText('connections', r.connections);

    // NODE
    setText('nodeVersion', r.node.version);
    setText('nodeRss', formatBytes(r.node.rss));
    setText('nodeHeap', formatBytes(r.node.heapUsed));

    // DB
    setText('dbUsers', r.db.users);
    setText('dbMessages', r.db.messages);

    // OS
    setText('osInfo', r.os.distro + ' (' + r.os.arch + ')');
    setText('hostname', '@ ' + r.os.hostname);

    // History
    history.cpu.push(r.cpu.load);
    history.ram.push(r.memory.percent);
    if (history.cpu.length > MAX_POINTS) history.cpu.shift();
    if (history.ram.length > MAX_POINTS) history.ram.shift();
    drawChart();

  } catch (err) {
    console.error('Monitor error:', err);
  }
}

// ====== أدوات مساعدة ======
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function setBar(id, percent) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.width = percent + '%';
  el.style.background = percent > 85 ? '#ff003c'
                     : percent > 60 ? '#ffb000'
                     : '#00ff41';
}

// ====== تشغيل ======
initChart();
fetchStats();
setInterval(fetchStats, 2000);
