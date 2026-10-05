const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/image\/(jpeg|png|gif|webp)/.test(file.mimetype)) cb(null, true);
    else cb(new Error('يُسمح بالصور فقط'));
  }
});

module.exports = (app, io, db) => {
  app.post('/api/upload', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ ok: false });
    upload.single('image')(req, res, (err) => {
      if (err) return res.json({ ok: false, error: err.message });
      if (!req.file) return res.json({ ok: false, error: 'لم يتم اختيار صورة' });
      res.json({ ok: true, path: '/uploads/' + req.file.filename });
    });
  });
};
