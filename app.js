require('dotenv').config();
const express = require('express');
const http = require('http');
const session = require('express-session');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');

const db = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.set('trust proxy', true);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'default-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ====== الوحدات ======
const modules = ['tracking', 'auth', 'chat', 'upload', 'admin', 'monitor'];
modules.forEach(m => require(`./modules/${m}`)(app, io, db));

// ====== الصفحات ======
app.get('/chat', (req, res) => {
  if (!req.session.userId) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

app.get('/admin', (req, res) => {
  if (req.session && req.session.isAdmin === true) return res.redirect('/admin-panel');
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/admin-panel', (req, res) => {
  if (!req.session || req.session.isAdmin !== true) return res.redirect('/admin');
  res.sendFile(path.join(__dirname, 'public', 'admin-panel.html'));
});

app.get('/monitor', (req, res) => {
  if (!req.session || req.session.isAdmin !== true) return res.redirect('/admin');
  res.sendFile(path.join(__dirname, 'public', 'monitor.html'));
});

app.get('/console', (req, res) => {
  if (!req.session || req.session.isAdmin !== true) return res.redirect('/admin');
  res.sendFile(path.join(__dirname, 'public', 'console.html'));
});

// ====== الألوان ======
const G = '\x1b[32m';
const C = '\x1b[36m';
const Y = '\x1b[33m';
const R = '\x1b[31m';
const B = '\x1b[1m';
const D = '\x1b[2m';
const X = '\x1b[0m';

const START_TIME = Date.now();

function formatUptime() {
  const total = Math.floor((Date.now() - START_TIME) / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const parts = [];
  if (days > 0) parts.push(days + 'd');
  if (hours > 0) parts.push(hours + 'h');
  if (minutes > 0) parts.push(minutes + 'm');
  parts.push(seconds + 's');
  return parts.join(' ');
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}

function printBanner(PORT) {
  console.clear();
  console.log('');
  console.log(`${G}${B}  ██████╗  █████╗ ██████╗ ██╗  ██╗${X}`);
  console.log(`${G}${B}  ██╔══██╗██╔══██╗██╔══██╗██║ ██╔╝${X}`);
  console.log(`${G}${B}  ██║  ██║███████║██████╔╝█████╔╝ ${X}`);
  console.log(`${G}${B}  ██║  ██║██╔══██║██╔══██╗██╔═██╗ ${X}`);
  console.log(`${G}${B}  ██████╔╝██║  ██║██║  ██║██║  ██╗${X}`);
  console.log(`${G}${B}  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝${X}`);
  console.log('');
  console.log(`${G}${B}     ╔═══════════════════════════════════╗${X}`);
  console.log(`${G}${B}     ║   DARK ANONIMOS CHAT  v1.0 💀     ║${X}`);
  console.log(`${G}${B}     ╚═══════════════════════════════════╝${X}`);
  console.log('');
  console.log(`${C}  ┌─────────────────────────────────────┐${X}`);
  console.log(`${C}  │${G} ✅ السيرفر:${X}      ${G}http://localhost:${PORT}${X}`);
  console.log(`${C}  │${G} 🔐 لوحة الإدارة:${X} ${G}http://localhost:${PORT}/admin${X}`);
  console.log(`${C}  │${G} 📊 المراقبة:${X}     ${G}http://localhost:${PORT}/monitor${X}`);
  console.log(`${C}  │${G} ⌨️  الطرفية:${X}     ${G}http://localhost:${PORT}/console${X}`);
  console.log(`${C}  └─────────────────────────────────────┘${X}`);
  console.log('');
  console.log(`${Y}  [INFO]${X} SYSTEM READY ${G}●${X}`);
  console.log(`${Y}  [INFO]${X} قاعدة البيانات: ${C}chat.db${X}`);
  console.log(`${Y}  [INFO]${X} اضغط ${R}Ctrl+C${X} للإيقاف`);
  console.log('');
}

function printStats() {
  const mem = process.memoryUsage();
  const cpus = os.cpus().length;
  const loadAvg = os.loadavg()[0].toFixed(2);
  const uptime = formatUptime();
  const connections = io.engine.clientsCount;

  db.get(`SELECT COUNT(*) AS c FROM users`, (e1, u) => {
    db.get(`SELECT COUNT(*) AS c FROM messages`, (e2, m) => {
      db.get(`SELECT COUNT(*) AS c FROM visits`, (e4, v) => {
        console.log(`${D}  ─── ${new Date().toLocaleTimeString('en-GB')} ───${X}`);
        console.log(`${C}  ⏱️  Uptime:${X} ${Y}${uptime}${X} ${D}|${X} ${C}👥 Users:${X} ${Y}${u ? u.c : 0}${X} ${D}|${X} ${C}💬 Msgs:${X} ${Y}${m ? m.c : 0}${X} ${D}|${X} ${C}🌐 Visits:${X} ${Y}${v ? v.c : 0}${X}`);
        console.log(`${C}  🟢 Online:${X} ${Y}${connections}${X} ${D}|${X} ${C}💾 Heap:${X} ${Y}${formatBytes(mem.heapUsed)}${X} ${D}|${X} ${C}📦 RSS:${X} ${Y}${formatBytes(mem.rss)}${X}`);
        console.log(`${C}  ⚙️  CPUs:${X} ${Y}${cpus}${X} ${D}|${X} ${C}📈 Load:${X} ${Y}${loadAvg}${X}`);
        console.log('');
      });
    });
  });
}

// ====== التشغيل ======
const PORT = process.env.PORT || 3000;
const ADMIN_CODE = process.env.ADMIN_CODE;

server.listen(PORT, '0.0.0.0', () => {
  printBanner(PORT);
  if (!ADMIN_CODE) {
    console.log(`${R}  [WARN]${X} لم يتم تعيين ADMIN_CODE في ملف .env`);
    console.log('');
  }
  setTimeout(printStats, 2000);
  setInterval(printStats, 20000);
});
