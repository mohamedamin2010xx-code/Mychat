let currentUser = null;
let currentConv = null;
const socket = io();

// ====== معالج الأخطاء ======
window.onerror = function(msg, url, line) {
  console.error('❌ JS Error at line ' + line + ':', msg);
  return false;
};

// ====== التهيئة ======
async function init() {
  const me = await fetch('/api/me').then(r => r.json());
  if (!me.ok) return location.href = '/';
  currentUser = me;
  document.getElementById('me').textContent = me.username;
  await loadConversations();
}

// ====== اتصال Socket ======
socket.on('connect', () => {
  console.log('✅ Socket متصل:', socket.id);
  if (currentUser) {
    socket.emit('join', { userId: currentUser.id, username: currentUser.username });
  }
});

socket.on('disconnect', () => console.log('❌ Socket انقطع'));
socket.on('connect_error', (e) => console.log('⚠️ خطأ اتصال:', e.message));

// ====== قائمة المحادثات ======
async function loadConversations() {
  const r = await fetch('/api/conversations').then(r => r.json());
  const pubList = document.getElementById('publicList');
  const privList = document.getElementById('privateList');
  pubList.innerHTML = '';
  privList.innerHTML = '';

  r.publicRooms.forEach(room => {
    const el = document.createElement('div');
    el.className = 'room-item';
    el.dataset.convId = room.id;
    el.textContent = '# ' + room.name;
    el.onclick = (ev) => openConversation(Number(room.id), room.name, ev);
    pubList.appendChild(el);
  });

  if (r.privateRooms.length === 0) {
    privList.innerHTML = '<div style="color:#4a7a4a;font-size:12px;padding:8px 12px">// لا توجد محادثات</div>';
  }
  r.privateRooms.forEach(room => {
    const el = document.createElement('div');
    el.className = 'room-item';
    el.dataset.convId = room.id;
    el.textContent = '@ ' + room.other_username;
    el.onclick = (ev) => openConversation(Number(room.id), room.other_username, ev);
    privList.appendChild(el);
  });
}

// ====== تبديل الشريط الجانبي (الجوال) ======
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.toggle('open');
}

// ====== فتح محادثة ======
async function openConversation(id, title, ev) {
  currentConv = Number(id);
  document.getElementById('chatTitle').textContent = title;
  document.querySelectorAll('.room-item').forEach(e => e.classList.remove('active'));
  if (ev && ev.target) ev.target.classList.add('active');

  const r = await fetch('/api/messages/' + currentConv).then(r => r.json());
  const box = document.getElementById('messages');
  box.innerHTML = '';
  r.messages.forEach(renderMessage);
  box.scrollTop = box.scrollHeight;

  // إغلاق الشريط الجانبي على الجوال
  if (window.innerWidth <= 700) {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('open');
  }
}

// ====== رسم رسالة ======
function renderMessage(m) {
  const box = document.getElementById('messages');
  const mine = Number(m.sender_id) === Number(currentUser.id);
  const div = document.createElement('div');
  div.className = 'msg-row ' + (mine ? 'mine' : 'other');

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = (m.sender_username || '?')[0].toUpperCase();

  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  if (!mine) {
    const s = document.createElement('div');
    s.className = 'sender';
    s.textContent = m.sender_username;
    bubble.appendChild(s);
  }

  if (m.type === 'image') {
    const img = document.createElement('img');
    img.src = m.content;
    bubble.appendChild(img);
  } else {
    const txt = document.createElement('div');
    txt.textContent = m.content;
    bubble.appendChild(txt);
  }

  const t = document.createElement('div');
  t.className = 'time';
  t.textContent = new Date(m.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  bubble.appendChild(t);

  div.appendChild(avatar);
  div.appendChild(bubble);
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

// ====== استقبال رسالة جديدة ======
socket.on('new_message', (m) => {
  const msgConv = Number(m.conversation_id);
  const currConv = Number(currentConv);
  if (msgConv === currConv) {
    renderMessage(m);
  }
});

// ====== إرسال رسالة ======
function sendMessage() {
  const input = document.getElementById('input');
  const content = input.value.trim();
  if (!content) return;
  if (!currentConv) {
    alert('⚠️ اختر محادثة أولاً');
    return;
  }
  if (!socket.connected) {
    alert('⚠️ لا يوجد اتصال بالسيرفر، انتظر ثانية وحاول مجدداً');
    return;
  }
  socket.emit('send_message', { conversationId: Number(currentConv), content, type: 'text' });
  input.value = '';
  input.style.height = 'auto';
}

// ====== Enter للإرسال ======
document.getElementById('input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// ====== رفع صورة ======
document.getElementById('fileInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file || !currentConv) return;
  const fd = new FormData();
  fd.append('image', file);
  const r = await fetch('/api/upload', { method: 'POST', body: fd }).then(r => r.json());
  if (r.ok) {
    socket.emit('send_message', { conversationId: Number(currentConv), content: r.path, type: 'image' });
  } else {
    alert(r.error);
  }
  e.target.value = '';
});

// ====== قائمة المستخدمين ======
async function showUsersList() {
  const box = document.getElementById('usersList');
  box.classList.toggle('hidden');
  if (!box.classList.contains('hidden')) {
    const r = await fetch('/api/users').then(r => r.json());
    box.innerHTML = '';
    r.users.forEach(u => {
      const el = document.createElement('div');
      el.className = 'user-item';
      el.textContent = u.username;
      el.onclick = async () => {
        const res = await fetch('/api/conversations/private', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: u.id })
        }).then(r => r.json());
        if (res.ok) {
          await loadConversations();
          if (currentUser) {
            socket.emit('join', { userId: currentUser.id, username: currentUser.username });
          }
          openConversation(Number(res.id), u.username);
          box.classList.add('hidden');
        }
      };
      box.appendChild(el);
    });
  }
}

// ====== خروج ======
async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  location.href = '/';
}

// ====== تشغيل ======
init();
