// ====== تحقق من الجلسة ======
fetch('/api/admin/check').then(r => r.json()).then(r => {
  if (!r.ok) location.href = '/admin';
});

const output = document.getElementById('output');
const cmdInput = document.getElementById('cmdInput');
const prompt = document.getElementById('prompt');

// ====== سجل الأوامر ======
const history = [];
let historyIndex = -1;

// ====== طباعة سطر ======
function print(text, cls = 'console-out') {
  if (text === null || text === undefined) text = '';
  const line = document.createElement('div');
  line.className = 'console-line ' + cls;
  line.textContent = text;
  output.appendChild(line);
  output.scrollTop = output.scrollHeight;
}

// ====== مسح الشاشة ======
function clearConsole() {
  output.innerHTML = '';
  print('> Console cleared.', 'console-info');
  print('', '');
}

// ====== ضبط الأمر في الصندوق ======
function setCmd(cmd) {
  cmdInput.value = cmd;
  cmdInput.focus();
}

// ====== تنفيذ الأمر ======
async function execCommand(cmd) {
  if (!cmd.trim()) return;

  // سجل الأمر
  history.push(cmd);
  historyIndex = history.length;

  // اطبع الأمر
  print('~ $ ' + cmd, 'console-cmd');
  print('', '');

  try {
    const r = await fetch('/api/console/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: cmd })
    }).then(r => r.json());

    if (!r.ok) {
      print('❌ ' + (r.error || 'خطأ'), 'console-err');
      print('', '');
      return;
    }

    // طباعة stdout
    if (r.stdout) {
      const lines = r.stdout.replace(/\n$/, '').split('\n');
      lines.forEach(l => print(l, 'console-out'));
    }

    // طباعة stderr
    if (r.stderr) {
      const lines = r.stderr.replace(/\n$/, '').split('\n');
      lines.forEach(l => print(l, 'console-err'));
    }

    // رسالة النجاح/الفشل
    if (r.exitCode === 0) {
      print(`✓ exit ${r.exitCode} (${r.duration}ms)`, 'console-success');
    } else {
      print(`✗ exit ${r.exitCode} (${r.duration}ms)`, 'console-err');
    }
    print('', '');

  } catch (err) {
    print('❌ فشل الاتصال: ' + err.message, 'console-err');
    print('', '');
  }
}

// ====== معالجة الإدخال ======
cmdInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const cmd = cmdInput.value;
    cmdInput.value = '';
    execCommand(cmd);
  }
  // السهم العلوي
  else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (history.length === 0) return;
    if (historyIndex > 0) historyIndex--;
    cmdInput.value = history[historyIndex] || '';
  }
  // السهم السفلي
  else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (historyIndex < history.length - 1) {
      historyIndex++;
      cmdInput.value = history[historyIndex];
    } else {
      historyIndex = history.length;
      cmdInput.value = '';
    }
  }
});

// ====== رسالة ترحيب ======
(async function welcome() {
  try {
    const r = await fetch('/api/console/info').then(r => r.json());
    if (r.ok) {
      print('╔══════════════════════════════════════════════╗', 'console-info');
      print('║   DARK ANONIMOS CHAT — WEB CONSOLE v1.0     ║', 'console-info');
      print('╚══════════════════════════════════════════════╝', 'console-info');
      print('', '');
      print('Platform:  ' + r.platform, 'console-out');
      print('Node:      ' + r.nodeVersion, 'console-out');
      print('PID:       ' + r.pid, 'console-out');
      print('CWD:       ' + r.cwd, 'console-out');
      print('Shell:     ' + r.shell, 'console-out');
      print('', '');
      print('> Type a command or click a shortcut below', 'console-info');
      print('> Use ↑ ↓ arrows for command history', 'console-info');
      print('', '');
    }
  } catch (e) {
    print('❌ تعذر الاتصال بالسيرفر', 'console-err');
  }
  cmdInput.focus();
})();

