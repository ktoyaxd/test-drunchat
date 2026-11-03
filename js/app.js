// ==========================================
// js/app.js
// ==========================================

const chatScreen = document.getElementById("chatScreen");
const settingsScreen = document.getElementById("settingsScreen");
const messagesScreen = document.getElementById("messagesScreen");
const bottomNav = document.getElementById("mainBottomNav");

function showScreen(screenId) {
  // Скрываем все экраны
  chatScreen.classList.remove("active");
  messagesScreen.classList.remove("active");
  settingsScreen.classList.remove("active");

  // Показываем нужный
  if (screenId === "chats") {
    chatScreen.classList.add("active");
    document.getElementById("headerTitle").textContent = "ДрунЧат";
  } 
  else if (screenId === "settings") {
    if (typeof loadSettingsProfile === 'function') loadSettingsProfile(); 
    settingsScreen.classList.add("active"); 
  }
}

// Нижняя навигация
document.querySelectorAll(".nav-item").forEach(item => {
  item.onclick = (e) => {
    e.preventDefault();
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
    item.classList.add("active");
    
    const tab = item.dataset.tab;
    if (tab === "chats") showScreen("chats");
    else if (tab === "settings") showScreen("settings");
  };
});

// Поиск
document.getElementById("searchBtn").onclick = () => {
  document.getElementById("searchContainer").classList.toggle("active");
};

document.getElementById("searchInput").oninput = (e) => {
  const q = e.target.value.toLowerCase();
  const filtered = window.AppState.allChats.filter(c => 
    c.name.toLowerCase().includes(q) || 
    c.lastMessage.toLowerCase().includes(q)
  );
  renderSidebar(filtered, []); 
};

// Кнопка "Назад" в переписке
document.getElementById("backToChatsBtn").onclick = () => {
  messagesScreen.classList.remove('active');
  if (window.AppState.unsubscribeMessages) { 
    window.AppState.unsubscribeMessages(); 
    window.AppState.unsubscribeMessages = null; 
  }
};