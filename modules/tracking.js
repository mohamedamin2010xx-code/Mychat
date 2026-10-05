module.exports = (app, io, db) => {
  // استخراج IP الحقيقي
  function getIP(req) {
    return (
      req.headers['x-forwarded-for']?.split(',')[0].trim() ||
      req.headers['x-real-ip'] ||
      req.socket?.remoteAddress ||
      req.connection?.remoteAddress ||
      'unknown'
    );
  }

  // تتبع طلبات API للمستخدمين المسجلين
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') && req.session && req.session.userId) {
      // تجاهل بعض المسارات المزعجة
      const ignore = ['/api/me', '/api/conversations', '/api/users'];
      if (!ignore.includes(req.path)) {
        db.run(
          `INSERT INTO visits (user_id, username, ip, user_agent, action) VALUES (?, ?, ?, ?, ?)`,
          [
            req.session.userId,
            req.session.username || '',
            getIP(req),
            (req.headers['user-agent'] || '').substring(0, 200),
            req.method + ' ' + req.path
          ]
        );
      }
    }
    next();
  });

  // تتبع اتصالات Socket
  io.on('connection', (socket) => {
    const ip =
      socket.handshake.headers['x-forwarded-for']?.split(',')[0].trim() ||
      socket.handshake.address ||
      'unknown';
    const ua = (socket.handshake.headers['user-agent'] || '').substring(0, 200);

    socket.on('join', ({ userId, username }) => {
      if (!userId) return;
      db.run(
        `INSERT INTO visits (user_id, username, ip, user_agent, action) VALUES (?, ?, ?, ?, ?)`,
        [userId, username || '', ip, ua, 'SOCKET_JOIN']
      );
    });
  });
};
