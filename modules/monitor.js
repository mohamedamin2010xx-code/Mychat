const si = require('systeminformation');
const { exec } = require('child_process');

module.exports = (app, io, db) => {
  const ADMIN_CODE = process.env.ADMIN_CODE || 'ADMIN';
  const START_TIME = Date.now();

  function requireAdmin(req, res, next) {
    if (req.session && req.session.isAdmin === true) return next();
    res.status(401).json({ ok: false, error: 'غير مصرح' });
  }

  // ====== بيانات حية ======
  app.get('/api/monitor/stats', requireAdmin, async (req, res) => {
    try {
      const [cpu, mem, disk, battery, net, temp, osInfo, currentLoad] = await Promise.all([
        si.cpu(),
        si.mem(),
        si.fsSize(),
        si.battery(),
        si.networkStats(),
        si.cpuTemperature(),
        si.osInfo(),
        si.currentLoad()
      ]);

      const mainDisk = disk[0] || {};
      const mainNet = net[0] || {};

      // عدد الاتصالات
      db.get(`SELECT COUNT(*) AS c FROM users`, (e1, u) => {
        db.get(`SELECT COUNT(*) AS c FROM messages`, (e2, m) => {
          res.json({
            ok: true,
            uptime: Date.now() - START_TIME,
            serverTime: new Date().toISOString(),
            cpu: {
              manufacturer: cpu.manufacturer,
              brand: cpu.brand,
              cores: cpu.cores,
              speed: cpu.speed,
              load: Math.round(currentLoad.currentLoad * 10) / 10,
              loadPerCore: currentLoad.cpus ? currentLoad.cpus.map(c => Math.round(c.load * 10) / 10) : []
            },
            memory: {
              total: mem.total,
              used: mem.active,
              free: mem.available,
              percent: Math.round((mem.active / mem.total) * 1000) / 10
            },
            disk: {
              fs: mainDisk.fs || '—',
              size: mainDisk.size || 0,
              used: mainDisk.used || 0,
              available: mainDisk.available || 0,
              percent: mainDisk.use || 0
            },
            battery: {
              hasBattery: battery.hasBattery,
              percent: battery.percent,
              isCharging: battery.isCharging,
              timeRemaining: battery.timeRemaining
            },
            network: {
              iface: mainNet.iface || '—',
              rx_sec: mainNet.rx_sec || 0,
              tx_sec: mainNet.tx_sec || 0,
              rx_bytes: mainNet.rx_bytes || 0,
              tx_bytes: mainNet.tx_bytes || 0
            },
            temperature: temp.main || null,
            os: {
              platform: osInfo.platform,
              distro: osInfo.distro,
              release: osInfo.release,
              arch: osInfo.arch,
              hostname: osInfo.hostname
            },
            node: {
              version: process.version,
              heapUsed: process.memoryUsage().heapUsed,
              heapTotal: process.memoryUsage().heapTotal,
              rss: process.memoryUsage().rss
            },
            connections: io.engine.clientsCount,
            db: {
              users: u ? u.c : 0,
              messages: m ? m.c : 0
            }
          });
        });
      });
    } catch (err) {
      res.json({ ok: false, error: err.message });
    }
  });

  // ====== طرفية الأوامر ======
  app.post('/api/console/exec', requireAdmin, (req, res) => {
    const { command } = req.body;
    if (!command || typeof command !== 'string') {
      return res.json({ ok: false, error: 'أمر فارغ' });
    }

    // قائمة أوامر محظورة (أمان)
    const blocked = [
      'rm -rf /', 'mkfs', 'dd if=', ':(){', 'shutdown', 'reboot',
      'halt', 'poweroff', 'init 0', 'init 6', 'passwd', 'su ', 'sudo rm'
    ];
    for (const b of blocked) {
      if (command.includes(b)) {
        return res.json({ ok: false, error: 'أمر محظور: ' + b });
      }
    }

    const startTime = Date.now();

    exec(command, {
      cwd: require('os').homedir() + '/mychat',
      timeout: 10000,
      maxBuffer: 1024 * 1024,
      shell: '/data/data/com.termux/files/usr/bin/bash'
    }, (error, stdout, stderr) => {
      const duration = Date.now() - startTime;

      // سجّل الأمر في visits
      db.run(
        `INSERT INTO visits (user_id, username, ip, user_agent, action) VALUES (?, ?, ?, ?, ?)`,
        [null, 'ADMIN', 'console', 'web-console', 'EXEC: ' + command.substring(0, 100)]
      );

      res.json({
        ok: true,
        command,
        stdout: stdout || '',
        stderr: stderr || '',
        exitCode: error ? (error.code || 1) : 0,
        duration,
        timestamp: new Date().toISOString()
      });
    });
  });

  // ====== معلومات سريعة عن النظام ======
  app.get('/api/console/info', requireAdmin, (req, res) => {
    const os = require('os');
    res.json({
      ok: true,
      cwd: process.cwd(),
      home: os.homedir(),
      shell: process.env.SHELL || '/bin/sh',
      platform: process.platform,
      nodeVersion: process.version,
      pid: process.pid,
      env: {
        PATH: (process.env.PATH || '').substring(0, 200),
        PREFIX: process.env.PREFIX || '',
        HOME: process.env.HOME || ''
      }
    });
  });
};

