// ==========================================
// js/auth.js
// ==========================================

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

  for (const candidate of candidates) {
    try {
      const auth = await pb.collection("users").authWithPassword(candidate, password);
      pb.authStore.save(auth.token, auth.record);
      window.AppState.currentUserId = auth.record.id;
      authRecord = auth.record;
      authSuccess = true;
      break;
    } catch (err) { 
      if (err.status !== 400) throw err; 
    }
  }

  if (authSuccess) {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('chatScreen').classList.add('active');
    
    // Принудительно показываем меню
    if (window.setNavVisible) window.setNavVisible(true);

    if (authRecord) {
      saveAccountToStorage(authRecord);
    }
    
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

// Функция сохранения аккаунта в localStorage
function saveAccountToStorage(user) {
  let accounts = JSON.parse(localStorage.getItem('drun_accounts') || '[]');
  accounts = accounts.filter(a => a.id !== user.id);
  accounts.push({
    id: user.id,
    name: user.name || user.username,
    username: user.username,
    avatar: user.avatar || null
  });
  localStorage.setItem('drun_accounts', JSON.stringify(accounts));
}

// ==========================================
// АВТО-ВХОД ПРИ ЗАГРУЗКЕ
// ==========================================
window.addEventListener("load", async () => {
  if (pb.authStore.isValid) {
    window.AppState.currentUserId = pb.authStore.record?.id || pb.authStore.model?.id;
    
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('chatScreen').classList.add('active');
    
    // Принудительно показываем меню
    if (window.setNavVisible) window.setNavVisible(true);
    
    setTimeout(async () => {
      await window.refreshChats();
      await window.initRealtime();
    }, 100);
  } else {
    // Скрываем меню, если не авторизованы
    if (window.setNavVisible) window.setNavVisible(false);
  }
});