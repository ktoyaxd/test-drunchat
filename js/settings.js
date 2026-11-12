// ==========================================
// js/settings.js
// ==========================================

async function loadSettingsProfile() {
  const user = pb.authStore.record || pb.authStore.model;
  if (!user) return;

  const avatarEl = document.getElementById("settingsAvatar");
  const nameEl = document.getElementById("settingsName");
  const phoneEl = document.getElementById("settingsPhone");

  let displayName = "Пользователь";
  if (typeof loadProfileName === 'function') {
    displayName = await loadProfileName(user.id);
  } else {
    displayName = user.name || user.username || "Пользователь";
  }
  nameEl.textContent = displayName;

  const phone = user.phone || user.phoneNumber || "";
  const username = user.username ? `@${user.username}` : "";
  phoneEl.textContent = [phone, username].filter(Boolean).join(" • ");

  avatarEl.innerHTML = "";
  if (user.avatar || user.ProfileImg) {
    const filename = user.avatar || user.ProfileImg;
    const avatarUrl = fileUrl("users", user, filename);
    const img = document.createElement("img");
    img.src = avatarUrl;
    avatarEl.appendChild(img);
  } else {
    avatarEl.textContent = displayName[0].toUpperCase();
    avatarEl.style.background = `hsl(${(displayName.length * 45) % 360}, 60%, 50%)`;
  }
}

async function loadAccountScreen() {
  const user = pb.authStore.record || pb.authStore.model;
  if (!user) return;

  let displayName = "Пользователь";
  if (typeof loadProfileName === 'function') {
    displayName = await loadProfileName(user.id);
  } else {
    displayName = user.name || user.username || "Пользователь";
  }
  
  document.getElementById("accName").textContent = displayName;
  document.getElementById("accBio").textContent = user.bio || "—";

  const list = document.getElementById("accountsList");
  list.innerHTML = "";

  const savedAccounts = JSON.parse(localStorage.getItem('drun_accounts') || '[]');
  if (savedAccounts.length === 0) {
    const div = document.createElement("div");
    div.className = "settings-item";
    div.innerHTML = `
      <div class="settings-avatar" style="width: 32px; height: 32px; font-size: 14px; margin: 0 12px 0 0;">${(displayName || "?")[0].toUpperCase()}</div>
      <div class="settings-text"><div class="settings-title">${displayName}</div></div>
      <div style="margin-left: auto; color: var(--tg-text-secondary);">✓</div>
    `;
    list.appendChild(div);
  }

  document.getElementById("addAccountBtn").onclick = () => alert("В разработке");
  document.getElementById("logoutBtn").onclick = () => {
    pb.authStore.clear();
    localStorage.removeItem('drun_accounts');
    location.reload();
  };
}

function initSettings() {
  document.getElementById("settingsAccountBtn").onclick = () => showScreen("account");
  document.getElementById("settingsDataBtn").onclick = () => showScreen("data");
  document.getElementById("settingsSlyapaBtn").onclick = () => showScreen("slyapa");
  
  // 👇 Обработчик тестовой кнопки уведомления
  const testBtn = document.getElementById("testNotificationBtn");
  if (testBtn) {
    testBtn.onclick = () => {
      if (typeof showTestNotification === 'function') showTestNotification();
    };
  }
}

window.addEventListener("load", () => {
  if (typeof initSettings === 'function') initSettings();
});