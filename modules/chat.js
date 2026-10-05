module.exports = (app, io, db) => {

  app.get('/api/conversations', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ ok: false });
    const uid = req.session.userId;

    db.all(`SELECT * FROM conversations WHERE type='public'`, (err, publicRooms) => {
      db.all(
        `SELECT c.*, u.username AS other_username, u.id AS other_id
         FROM conversations c
         JOIN users u ON u.id = CASE WHEN c.user1_id = ? THEN c.user2_id ELSE c.user1_id END
         WHERE c.type='private' AND (c.user1_id = ? OR c.user2_id = ?)`,
        [uid, uid, uid],
        (err2, privateRooms) => {
          res.json({ ok: true, publicRooms, privateRooms });
        }
      );
    });
  });

  app.post('/api/conversations/private', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ ok: false });
    const uid = req.session.userId;
    const otherId = parseInt(req.body.userId, 10);
    if (!otherId || otherId === uid) return res.json({ ok: false, error: 'معرّف غير صالح' });

    const [a, b] = [Math.min(uid, otherId), Math.max(uid, otherId)];
    db.get(
      `SELECT * FROM conversations WHERE type='private' AND user1_id=? AND user2_id=?`,
      [a, b],
      (err, row) => {
        if (row) return res.json({ ok: true, id: row.id, type: 'private' });
        db.run(
          `INSERT INTO conversations (type, user1_id, user2_id) VALUES ('private', ?, ?)`,
          [a, b],
          function () {
            res.json({ ok: true, id: this.lastID, type: 'private' });
          }
        );
      }
    );
  });

  app.get('/api/messages/:convId', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ ok: false });
    db.all(
      `SELECT m.*, u.username AS sender_username
       FROM messages m JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = ?
       ORDER BY m.id ASC LIMIT 500`,
      [req.params.convId],
      (err, rows) => res.json({ ok: true, messages: rows || [] })
    );
  });

  io.on('connection', (socket) => {
    socket.on('join', ({ userId, username }) => {
      if (!userId) return;
      socket.userId = userId;
      socket.username = username;

      db.all(`SELECT id FROM conversations WHERE type='public'`, (e, pubs) => {
        (pubs || []).forEach(r => socket.join('room_' + r.id));
      });
      db.all(
        `SELECT id FROM conversations WHERE type='private' AND (user1_id=? OR user2_id=?)`,
        [userId, userId],
        (e, privs) => {
          (privs || []).forEach(r => socket.join('room_' + r.id));
        }
      );
    });

    socket.on('send_message', ({ conversationId, content, type }) => {
      if (!socket.userId || !conversationId || !content) return;
      const msgType = type === 'image' ? 'image' : 'text';
      db.run(
        `INSERT INTO messages (conversation_id, sender_id, content, type) VALUES (?, ?, ?, ?)`,
        [conversationId, socket.userId, content, msgType],
        function () {
          const payload = {
            id: this.lastID,
            conversation_id: conversationId,
            sender_id: socket.userId,
            sender_username: socket.username,
            content,
            type: msgType,
            created_at: new Date().toISOString()
          };
          io.to('room_' + conversationId).emit('new_message', payload);
        }
      );
    });
  });
};
