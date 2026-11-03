// ==========================================
// js/settings.js
// ==========================================

async function loadSettingsProfile() {
  const user = pb.authStore.record || pb.authStore.model;
  if (!user) return;

  const avatarEl = document.getElementById("settingsAvatar");
  const nameEl = document.getElementById("settingsName");
  const phoneEl = document.getElementById("settingsPhone");

  const displayName = user.name || user.username || "Без имени";
  nameEl.textContent = displayName;

  const phone = user.phone || user.phoneNumber || "";
  const username = user.username ? `@${user.username}` : "";
  phoneEl.textContent = [phone, username].filter(Boolean).join(" • ");

  avatarEl.innerHTML = "";
  if (user.avatar) {
    const avatarUrl = fileUrl("users", user, user.avatar);
    const img = document.createElement("img");
    img.src = avatarUrl;
    avatarEl.appendChild(img);
  } else {
    avatarEl.textContent = displayName[0].toUpperCase();
    avatarEl.style.background = `hsl(${(displayName.length * 45) % 360}, 60%, 50%)`;
  }
}

function initSettings() {
  // Кнопка "Назад"
  document.getElementById("backFromSettingsBtn").onclick = () => {
    showScreen("chats"); 
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
    document.querySelector('.nav-item[data-tab="chats"]').classList.add("active");
  };

  // Кнопки внутри настроек (пока заглушки)
  document.getElementById("settingsAccountBtn").onclick = () => {
    console.log("Переход в Аккаунт (в разработке)");
  };

  document.getElementById("settingsDataBtn").onclick = () => {
    console.log("Переход в Данные и память (в разработке)");
  };
}

// Инициализация при загрузке
window.addEventListener("load", () => {
  if (typeof initSettings === 'function') initSettings();
});