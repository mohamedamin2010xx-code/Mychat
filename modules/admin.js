module.exports = (app, io, db) => {
  const ADMIN_CODE = process.env.ADMIN_CODE || 'ADMIN';

  function getIP(req) {
    return (
      req.headers['x-forwarded-for']?.split(',')[0].trim() ||
      req.headers['x-real-ip'] ||
      req.socket?.remoteAddress ||
      'unknown'
    );
  }

  function requireAdmin(req, res, next) {
    if (req.session && req.session.isAdmin === true) return next();
    res.status(401).json({ ok: false, error: 'غير مصرح' });
  }

  // ====== دخول الأدمن ======
  app.post('/api/admin/login', (req, res) => {
    const { code } = req.body;
    if (!code) return res.json({ ok: false, error: 'أدخل الرمز' });
    if (code !== ADMIN_CODE) {
      db.run(
        `INSERT INTO visits (user_id, username, ip, user_agent, action) VALUES (?, ?, ?, ?, ?)`,
        [null, 'ADMIN_ATTEMPT', getIP(req), req.headers['user-agent'] || '', 'FAILED_ADMIN_LOGIN']
      );
      return res.json({ ok: false, error: 'رمز خاطئ' });
    }
    req.session.isAdmin = true;
    db.run(
      `INSERT INTO visits (user_id, username, ip, user_agent, action) VALUES (?, ?, ?, ?, ?)`,
      [null, 'ADMIN', getIP(req), req.headers['user-agent'] || '', 'ADMIN_LOGIN']
    );
    res.json({ ok: true });
  });

  // ====== خروج الأدمن ======
  app.post('/api/admin/logout', (req, res) => {
    req.session.isAdmin = false;
    res.json({ ok: true });
  });

  // ====== التحقق من الجلسة ======
  app.get('/api/admin/check', (req, res) => {
    res.json({ ok: req.session && req.session.isAdmin === true });
  });

  // ====== كل المستخدمين + تفاصيلهم ======
  app.get('/api/admin/users', requireAdmin, (req, res) => {
    db.all(
      `SELECT 
        u.id, u.username, u.password, u.created_at,
        (SELECT COUNT(*) FROM messages WHERE sender_id = u.id) AS msg_count,
        (SELECT MAX(created_at) FROM visits WHERE user_id = u.id) AS last_seen,
        (SELECT ip FROM visits WHERE user_id = u.id ORDER BY id DESC LIMIT 1) AS last_ip,
        (SELECT COUNT(*) FROM visits WHERE user_id = u.id) AS visit_count
       FROM users u
       ORDER BY u.id DESC`,
      (err, rows) => res.json({ ok: true, users: rows || [] })
    );
  });

  // ====== كل الزيارات ======
  app.get('/api/admin/visits', requireAdmin, (req, res) => {
    db.all(
      `SELECT * FROM visits ORDER BY id DESC LIMIT 300`,
      (err, rows) => res.json({ ok: true, visits: rows || [] })
    );
  });

  // ====== إحصائيات ======
  app.get('/api/admin/stats', requireAdmin, (req, res) => {
    db.get(`SELECT COUNT(*) AS total FROM users`, (e1, r1) => {
      db.get(`SELECT COUNT(*) AS total FROM messages`, (e2, r2) => {
        db.get(`SELECT COUNT(*) AS total FROM conversations`, (e3, r3) => {
          db.get(`SELECT COUNT(*) AS total FROM visits`, (e4, r4) => {
            db.get(
              `SELECT ip, COUNT(*) AS cnt FROM visits WHERE ip != 'unknown' AND ip IS NOT NULL GROUP BY ip ORDER BY cnt DESC LIMIT 1`,
              (e5, r5) => {
                res.json({
                  ok: true,
                  stats: {
                    users: r1 ? r1.total : 0,
                    messages: r2 ? r2.total : 0,
                    conversations: r3 ? r3.total : 0,
                    visits: r4 ? r4.total : 0,
                    top_ip: (r5 && r5.ip) || '—',
                    top_ip_count: (r5 && r5.cnt) || 0
                  }
                });
              }
            );
          });
        });
      });
    });
  });

  // ====== حذف مستخدم ======
  app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    db.run(`DELETE FROM messages WHERE sender_id = ?`, [id], () => {
      db.run(`DELETE FROM conversations WHERE user1_id = ? OR user2_id = ?`, [id, id], () => {
        db.run(`DELETE FROM users WHERE id = ?`, [id], function () {
          res.json({ ok: true, deleted: this.changes });
        });
      });
    });
  });

  // ====== حظر مستخدم ======
  app.post('/api/admin/ban', requireAdmin, (req, res) => {
    const { userId, username, reason } = req.body;
    db.run(
      `INSERT INTO banned_users (user_id, username, reason) VALUES (?, ?, ?)`,
      [userId, username, reason || 'بدون سبب'],
      function () {
        res.json({ ok: true, id: this.lastID });
      }
    );
  });

  // ====== المحظورون ======
  app.get('/api/admin/banned', requireAdmin, (req, res) => {
    db.all(`SELECT * FROM banned_users ORDER BY id DESC`, (err, rows) => {
      res.json({ ok: true, banned: rows || [] });
    });
  });

  // ====== كل المحادثات ======
  app.get('/api/admin/conversations', requireAdmin, (req, res) => {
    db.all(
      `SELECT c.*, 
        (SELECT username FROM users WHERE id = c.user1_id) AS user1_name,
        (SELECT username FROM users WHERE id = c.user2_id) AS user2_name,
        (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) AS msg_count
       FROM conversations c
       ORDER BY c.id DESC`,
      (err, rows) => res.json({ ok: true, conversations: rows || [] })
    );
  });

  // ====== كل الرسائل ======
  app.get('/api/admin/messages', requireAdmin, (req, res) => {
    db.all(
      `SELECT m.*, u.username AS sender_name 
       FROM messages m 
       LEFT JOIN users u ON u.id = m.sender_id 
       ORDER BY m.id DESC LIMIT 100`,
      (err, rows) => res.json({ ok: true, messages: rows || [] })
    );
  });

  // ====== تغيير كلمة مرور ======
  app.put('/api/admin/users/:id/password', requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    const { newPassword } = req.body;
    if (!newPassword) return res.json({ ok: false, error: 'كلمة مرور فارغة' });
    db.run(`UPDATE users SET password = ? WHERE id = ?`, [newPassword, id], function () {
      res.json({ ok: true });
    });
  });
};
