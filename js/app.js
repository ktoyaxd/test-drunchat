const chatScreen = document.getElementById("chatScreen");
const settingsScreen = document.getElementById("settingsScreen");
const messagesScreen = document.getElementById("messagesScreen");

window.setNavVisible = function(isVisible) {
  const nav = document.getElementById("mainBottomNav");
  if (nav) {
    nav.style.setProperty("display", isVisible ? "flex" : "none", "important");
  }
};

function updateNavVisibility() {
  const inChat = document.getElementById("messagesScreen")?.classList.contains("active");
  window.setNavVisible(pb.authStore.isValid && !inChat);
}

window.addEventListener("load", updateNavVisibility);
document.addEventListener("DOMContentLoaded", updateNavVisibility);

function showScreen(screenId) {
  document.querySelectorAll('.sub-screen').forEach(el => el.classList.remove('active'));
  chatScreen.classList.remove("active");
  messagesScreen.classList.remove("active");
  settingsScreen.classList.remove("active");

  // По умолчанию меню видимо
  window.setNavVisible(true);

  if (screenId === "chats") {
    chatScreen.classList.add("active");
  } 
  else if (screenId === "settings") {
    if (typeof loadSettingsProfile === 'function') loadSettingsProfile();
    settingsScreen.classList.add("active"); 
  } 
  else if (screenId === "account" || screenId === "data" || screenId === "slyapa") {
    // На подэкранах скрываем меню
    window.setNavVisible(false); 
    
    if (screenId === "account") {
      if (typeof loadAccountScreen === 'function') loadAccountScreen();
      document.getElementById("accountScreen").classList.add("active");
    } 
    else if (screenId === "data") {
      if (typeof renderDataScreen === 'function') renderDataScreen();
      document.getElementById("dataScreen").classList.add("active");
    }
    else if (screenId === "slyapa") {
      if (typeof initSlyapaScreen === 'function') initSlyapaScreen();
      document.getElementById("slyapaScreen").classList.add("active");
    }
  }
}

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

if (typeof loadStickersCache === 'function') {
  loadStickersCache();
}