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
  for (const candidate of candidates) {
    try {
      const auth = await pb.collection("users").authWithPassword(candidate, password);
      pb.authStore.save(auth.token, auth.record);
      window.AppState.currentUserId = auth.record.id;
      authSuccess = true;
      break;
    } catch (err) { 
      if (err.status !== 400) throw err; 
    }
  }

  if (authSuccess) {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('chatScreen').classList.add('active');
    
    await window.refreshChats();
    await window.initRealtime();
  } else {
    errorBox.classList.add('show');
    submitBtn.classList.remove('loading');
    submitBtn.disabled = false;
  }
});

// АВТО-ВХОД
window.addEventListener("load", async () => {
  if (pb.authStore.isValid) {
    window.AppState.currentUserId = pb.authStore.model.id;
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('chatScreen').classList.add('active');
    
    setTimeout(async () => {
      await window.refreshChats();
      await window.initRealtime();
    }, 100);
  }
});