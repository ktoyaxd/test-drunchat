// ==========================================
// js/auth.js
// ==========================================

let drunAuthAvailable = true;

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const rawLogin = document.getElementById('login').value.trim();
  const password = document.getElementById('password').value;
  const errorBox = document.getElementById('errorBox');
  const submitBtn = document.getElementById('submitBtn');

  errorBox.classList.remove('show');
  submitBtn.classList.add('loading');
  submitBtn.disabled = true;

  const isEmail = /^\S+@\S+\.\S+$/.test(rawLogin);
  const candidates = Array.from(new Set([
    rawLogin, rawLogin.replace(/^@/, ''),
    isEmail ? rawLogin : `@${rawLogin.replace(/^@/, '')}`,
    isEmail ? '' : rawLogin.replace(/^@/, '').toLowerCase(),
    isEmail ? '' : `@${rawLogin.replace(/^@/, '').toLowerCase()}`
  ].filter(Boolean)));

  let authSuccess = false;
  let authRecord = null;

  if (drunAuthAvailable) {
    for (const candidate of candidates) {
      try {
        const res = await pb.send("/api/drun/auth/login", {
          method: "POST", body: { identity: candidate, password }, requestKey: null,
        });
        if (res && res.ok && res.token && res.record) {
          pb.authStore.save(res.token, res.record);
          window.AppState.currentUserId = res.record.id;
          authRecord = res.record;
          authSuccess = true;
          break;
        }
      } catch (err) {
        if (err?.status === 404) { drunAuthAvailable = false; break; }
        if (err?.status !== 400) console.warn("[Auth] drun login:", err);
      }
    }
  }

  if (!authSuccess) {
    for (const candidate of candidates) {
      try {
        const auth = await pb.collection("users").authWithPassword(candidate, password);
        pb.authStore.save(auth.token, auth.record);
        window.AppState.currentUserId = auth.record.id;
        authRecord = auth.record;
        authSuccess = true;
        break;
      } catch (err) { if (err.status !== 400) throw err; }
    }
  }

  if (authSuccess) {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('chatScreen').classList.add('active');
    if (window.setNavVisible) window.setNavVisible(true);

    try {
      const refresh = await pb.collection("users").authRefresh();
      if (refresh?.record) {
        pb.authStore.save(refresh.token || pb.authStore.token, refresh.record);
        authRecord = refresh.record;
        window.AppState.currentUserId = refresh.record.id;
        if (typeof mergeProfileToCache === 'function') mergeProfileToCache(refresh.record);
      }
    } catch (e) {
      console.warn("[Auth] authRefresh:", e?.status, e?.message);
      if (!pb.authStore.record) pb.authStore.save(pb.authStore.token, { id: authRecord?.id || window.AppState.currentUserId });
    }

    if (authRecord) saveAccountToStorage(authRecord);
    await window.refreshChats();
    await window.initRealtime();
    submitBtn.classList.remove('loading');
    submitBtn.disabled = false;
  } else {
    errorBox.classList.add('show');
    submitBtn.classList.remove('loading');
    submitBtn.disabled = false;
  }
});

function saveAccountToStorage(user) {
  let accounts = JSON.parse(localStorage.getItem('drun_accounts') || '[]');
  accounts = accounts.filter(a => a.id !== user.id);
  accounts.push({ id: user.id, name: user.name || user.username, username: user.username, avatar: user.avatar || user.ProfileImg || null });
  localStorage.setItem('drun_accounts', JSON.stringify(accounts));
}

window.addEventListener("load", async () => {
  if (pb.authStore.isValid) {
    window.AppState.currentUserId = pb.authStore.record?.id || pb.authStore.model?.id;
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('chatScreen').classList.add('active');
    if (window.setNavVisible) window.setNavVisible(true);
    
    try {
      const refresh = await pb.collection("users").authRefresh();
      if (refresh?.record) {
        pb.authStore.save(refresh.token || pb.authStore.token, refresh.record);
        if (typeof mergeProfileToCache === 'function') mergeProfileToCache(refresh.record);
      }
    } catch (e) { console.warn("[Auth] auto authRefresh:", e?.status); }
    
    setTimeout(async () => {
      await window.refreshChats();
      await window.initRealtime();
    }, 100);
  } else {
    if (window.setNavVisible) window.setNavVisible(false);
  }
});