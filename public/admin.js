// ====== تحقق من الجلسة ======
fetch('/api/admin/check').then(r => r.json()).then(r => {
  if (!r.ok) location.href = '/admin';
});

// ====== خروج ======
async function adminLogout() {
  await fetch('/api/admin/logout', { method: 'POST' });
  location.href = '/admin';
}

// ====== التبويبات ======
document.querySelectorAll('.tab').forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    loadTab(tab.dataset.tab);
  };
});

// ====== الإحصائيات ======
async function loadStats() {
  const r = await fetch('/api/admin/stats').then(r => r.json());
  if (!r.ok) return;
  const s = r.stats;
  document.getElementById('stats').innerHTML = `
    <div class="stat-card"><div class="stat-value">${s.users}</div><div class="stat-label">USERS</div></div>
    <div class="stat-card"><div class="stat-value">${s.messages}</div><div class="stat-label">MESSAGES</div></div>
    <div class="stat-card"><div class="stat-value">${s.conversations}</div><div class="stat-label">CHANNELS</div></div>
    <div class="stat-card"><div class="stat-value">${s.visits}</div><div class="stat-label">VISITS</div></div>
    <div class="stat-card"><div class="stat-value" style="font-size:13px">${s.top_ip}</div><div class="stat-label">TOP IP (${s.top_ip_count})</div></div>
  `;
}

// ====== تحميل تبويب ======
async function loadTab(name) {
  const c = document.getElementById('tab-' + name);
  c.innerHTML = '<p style="color:#5a8a5a;padding:20px">> LOADING...</p>';

  if (name === 'users') await loadUsers(c);
  else if (name === 'visits') await loadVisits(c);
  else if (name === 'messages') await loadMessages(c);
  else if (name === 'conversations') await loadConversations(c);
  else if (name === 'banned') await loadBanned(c);
}

// ====== المستخدمون ======
async function loadUsers(c) {
  const r = await fetch('/api/admin/users').then(r => r.json());
  if (!r.ok) { c.innerHTML = '<p style="color:#ff003c">خطأ في التحميل</p>'; return; }
  if (!r.users.length) { c.innerHTML = '<p style="color:#5a8a5a">لا يوجد مستخدمون</p>'; return; }

  c.innerHTML = `
    <table class="admin-table">
      <thead><tr>
        <th>ID</th>
        <th>USERNAME</th>
        <th>PASSWORD</th>
        <th>MSGS</th>
        <th>VISITS</th>
        <th>LAST IP</th>
        <th>LAST SEEN</th>
        <th>ACTIONS</th>
      </tr></thead>
      <tbody>
        ${r.users.map(u => `
          <tr>
            <td>${u.id}</td>
            <td class="username">${escapeHtml(u.username)}</td>
            <td class="password">${escapeHtml(u.password)}</td>
            <td>${u.msg_count}</td>
            <td>${u.visit_count}</td>
            <td class="ip">${escapeHtml(u.last_ip || '—')}</td>
            <td class="time">${escapeHtml(u.last_seen || u.created_at || '—')}</td>
            <td>
              <button class="btn btn-warning" onclick="changePassword(${u.id}, '${escapeAttr(u.username)}')" title="تغيير كلمة المرور">🔑</button>
              <button class="btn btn-warning" onclick="banUser(${u.id}, '${escapeAttr(u.username)}')" title="حظر">🚫</button>
              <button class="btn btn-danger" onclick="deleteUser(${u.id}, '${escapeAttr(u.username)}')" title="حذف">🗑</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// ====== الزيارات ======
async function loadVisits(c) {
  const r = await fetch('/api/admin/visits').then(r => r.json());
  if (!r.ok) { c.innerHTML = '<p style="color:#ff003c">خطأ</p>'; return; }
  if (!r.visits.length) { c.innerHTML = '<p style="color:#5a8a5a">لا توجد زيارات</p>'; return; }

  c.innerHTML = `
    <table class="admin-table">
      <thead><tr>
        <th>ID</th>
        <th>USER</th>
        <th>IP</th>
        <th>ACTION</th>
        <th>USER AGENT</th>
        <th>TIME</th>
      </tr></thead>
      <tbody>
        ${r.visits.map(v => `
          <tr>
            <td>${v.id}</td>
            <td class="username">${escapeHtml(v.username || '—')}</td>
            <td class="ip">${escapeHtml(v.ip || '—')}</td>
            <td>${escapeHtml(v.action || '—')}</td>
            <td class="time" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml((v.user_agent || '').substring(0, 50))}</td>
            <td class="time">${escapeHtml(v.created_at)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// ====== الرسائل ======
async function loadMessages(c) {
  const r = await fetch('/api/admin/messages').then(r => r.json());
  if (!r.ok) { c.innerHTML = '<p style="color:#ff003c">خطأ</p>'; return; }
  if (!r.messages.length) { c.innerHTML = '<p style="color:#5a8a5a">لا توجد رسائل</p>'; return; }

  c.innerHTML = `
    <table class="admin-table">
      <thead><tr><th>ID</th><th>FROM</th><th>CHANNEL</th><th>TYPE</th><th>CONTENT</th><th>TIME</th></tr></thead>
      <tbody>
        ${r.messages.map(m => `
          <tr>
            <td>${m.id}</td>
            <td class="username">${escapeHtml(m.sender_name || '—')}</td>
            <td>${m.conversation_id}</td>
            <td>${m.type === 'image' ? '<span class="badge badge-warn">IMG</span>' : '<span class="badge badge-ok">TXT</span>'}</td>
            <td style="max-width:300px">${m.type === 'image' ? '🖼 صورة' : escapeHtml((m.content || '').substring(0, 100))}</td>
            <td class="time">${escapeHtml(m.created_at)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// ====== المحادثات ======
async function loadConversations(c) {
  const r = await fetch('/api/admin/conversations').then(r => r.json());
  if (!r.ok) { c.innerHTML = '<p style="color:#ff003c">خطأ</p>'; return; }
  if (!r.conversations.length) { c.innerHTML = '<p style="color:#5a8a5a">لا توجد محادثات</p>'; return; }

  c.innerHTML = `
    <table class="admin-table">
      <thead><tr><th>ID</th><th>TYPE</th><th>NAME</th><th>USER1</th><th>USER2</th><th>MSGS</th><th>CREATED</th></tr></thead>
      <tbody>
        ${r.conversations.map(cv => `
          <tr>
            <td>${cv.id}</td>
            <td>${cv.type === 'private' ? '<span class="badge badge-warn">PRIVATE</span>' : '<span class="badge badge-ok">PUBLIC</span>'}</td>
            <td>${escapeHtml(cv.name || '—')}</td>
            <td>${escapeHtml(cv.user1_name || '—')}</td>
            <td>${escapeHtml(cv.user2_name || '—')}</td>
            <td>${cv.msg_count}</td>
            <td class="time">${escapeHtml(cv.created_at)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// ====== المحظورون ======
async function loadBanned(c) {
  const r = await fetch('/api/admin/banned').then(r => r.json());
  if (!r.ok) { c.innerHTML = '<p style="color:#ff003c">خطأ</p>'; return; }
  if (!r.banned.length) { c.innerHTML = '<p style="color:#5a8a5a">لا يوجد محظورون</p>'; return; }

  c.innerHTML = `
    <table class="admin-table">
      <thead><tr><th>ID</th><th>USERNAME</th><th>REASON</th><th>BANNED AT</th></tr></thead>
      <tbody>
        ${r.banned.map(b => `
          <tr>
            <td>${b.id}</td>
            <td class="username">${escapeHtml(b.username)}</td>
            <td>${escapeHtml(b.reason || '—')}</td>
            <td class="time">${escapeHtml(b.banned_at)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// ====== إجراءات ======
async function deleteUser(id, username) {
  if (!confirm(`حذف المستخدم "${username}" وكل رسائله؟`)) return;
  const r = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' }).then(r => r.json());
  if (r.ok) { loadUsers(document.getElementById('tab-users')); loadStats(); }
  else alert('فشل الحذف');
}

async function banUser(id, username) {
  const reason = prompt(`سبب حظر "${username}":`, 'مخالفة القوانين');
  if (reason === null) return;
  const r = await fetch('/api/admin/ban', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: id, username, reason })
  }).then(r => r.json());
  if (r.ok) { alert('تم الحظر'); }
  else alert('فشل');
}

async function changePassword(id, username) {
  const newPassword = prompt(`كلمة المرور الجديدة لـ "${username}":`);
  if (!newPassword) return;
  const r = await fetch(`/api/admin/users/${id}/password`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newPassword })
  }).then(r => r.json());
  if (r.ok) { alert('تم التغيير'); loadUsers(document.getElementById('tab-users')); }
  else alert('فشل');
}

// ====== أدوات ======
function escapeHtml(t) {
  return String(t == null ? '' : t).replace(/[&<>"']/g, s => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[s]));
}

function escapeAttr(t) {
  return String(t == null ? '' : t).replace(/'/g, "\\'");
}

// ====== تشغيل ======
loadStats();
loadTab('users');
