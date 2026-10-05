module.exports = (app, io, db) => {

  app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password)
      return res.json({ ok: false, error: 'املأ جميع الحقول' });

    db.run(
      `INSERT INTO users (username, password) VALUES (?, ?)`,
      [username, password],
      function (err) {
        if (err) return res.json({ ok: false, error: 'اسم المستخدم موجود مسبقاً' });
        req.session.userId = this.lastID;
        req.session.username = username;
        res.json({ ok: true, username });
      }
    );
  });

  app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get(
      `SELECT * FROM users WHERE username = ? AND password = ?`,
      [username, password],
      (err, user) => {
        if (!user) return res.json({ ok: false, error: 'بيانات خاطئة' });
        req.session.userId = user.id;
        req.session.username = user.username;
        res.json({ ok: true, username: user.username });
      }
    );
  });

  app.post('/api/logout', (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  app.get('/api/me', (req, res) => {
    if (req.session.userId) {
      return res.json({ ok: true, username: req.session.username, id: req.session.userId });
    }
    res.json({ ok: false });
  });

  app.get('/api/users', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ ok: false });
    db.all(
      `SELECT id, username FROM users WHERE id != ?`,
      [req.session.userId],
      (err, rows) => res.json({ ok: true, users: rows || [] })
    );
  });
};
