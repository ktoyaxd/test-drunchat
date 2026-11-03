// ==========================================
// js/sidebar.js 
// ==========================================

function dmKey(a, b) {
  return [a, b].sort().join(":");
}

// ==========================================
// 1. Мои каналы (с учетом createdBy и admins)
// ==========================================
async function loadMyChannels() {
  const me = window.AppState.currentUserId;
  const raw = await pb.collection("channels").getFullList().catch(() => []);
  
  return raw.filter(c =>
    c.creatorId === me ||
    c.createdBy === me ||
    (Array.isArray(c.members) && c.members.includes(me)) ||
    (Array.isArray(c.admins) && c.admins.includes(me))
  );
}

// ==========================================
// 2. Друзья
// ==========================================
async function loadFriends() {
  const me = window.AppState.currentUserId;
  const reqs = await pb.collection("friendRequests").getFullList({
    filter: pb.filter('status = "accepted" && (from = {:id} || to = {:id})', { id: me })
  }).catch(() => []);

  const friendIds = [...new Set(
    reqs.map(r => (r.from === me ? r.to : r.from)).filter(id => id && id !== me)
  )];
  if (friendIds.length === 0) return [];

  const users = await fetchUsersByIds(friendIds);
  return users.filter(u => u && u.id);
}

// ==========================================
// 3. Загрузка последних сообщений (Вариант B - N+1)
// ==========================================
async function loadLastMessages(mine, friends) {
  const me = window.AppState.currentUserId;
  const lastMessages = {};

  // Собираем все нужные ID
  const targetIds = [];
  for (const c of mine) {
    if (c.id) targetIds.push({ id: c.id, prefix: c.type === "channel" ? "channel" : "group" });
  }
  for (const f of friends) {
    const key = dmKey(me, f.id);
    targetIds.push({ id: key, prefix: "friend", friendId: f.id });
  }
  targetIds.push({ id: "news", prefix: "news" });
  targetIds.push({ id: "__global__", prefix: "global" });

  // Убираем дубликаты по id
  const uniqueTargets = [];
  const seen = new Set();
  for (const t of targetIds) {
    if (!seen.has(t.id)) {
      seen.add(t.id);
      uniqueTargets.push(t);
    }
  }

  // Функция для получения одного сообщения
  const fetchOne = async (target) => {
    try {
      const page = await pb.collection("messages").getList(1, 1, {
        sort: "-created",
        filter: pb.filter("channelId = {:id}", { id: target.id }),
        fields: "channelId,content,text,created,timestamp,senderId"
      });
      const m = page.items[0];
      if (!m) return null;
      
      const entry = {
        content: m.content || m.text || "",
        timestamp: m.timestamp || m.created,
        senderId: m.senderId
      };

      // Записываем под все возможные ключи для этого чата
      lastMessages[target.id] = entry;
      if (target.prefix === "channel") lastMessages[`channel-${target.id}`] = entry;
      if (target.prefix === "group") lastMessages[`group-${target.id}`] = entry;
      if (target.prefix === "friend") lastMessages[`friend-${target.friendId}`] = entry;
      
      return entry;
    } catch (e) {
      console.error(`[Sidebar] Ошибка загрузки сообщения для ${target.id}:`, e);
      return null;
    }
  };

  // Запускаем параллельно, но чанками по 10, чтобы не заспамить сервер
  const CHUNK_SIZE = 10;
  for (let i = 0; i < uniqueTargets.length; i += CHUNK_SIZE) {
    const chunk = uniqueTargets.slice(i, i + CHUNK_SIZE);
    await Promise.all(chunk.map(fetchOne));
  }

  console.log("[Sidebar] Загружено lastMessages для:", Object.keys(lastMessages).length, "ключей");
  return lastMessages;
}

// ==========================================
// 4. Сборка сайдбара
// ==========================================
async function fetchSidebar() {
  try {
    const me = window.AppState.currentUserId;
    const [mine, friends] = await Promise.all([loadMyChannels(), loadFriends()]);
    const lastMessages = await loadLastMessages(mine, friends);

    // Закреплённые
    const newsMsg = lastMessages["news"];
    const globalMsg = lastMessages["__global__"];
    const pinned = [
      {
        key: "news", type: "news", id: "news", name: "Новости",
        lastMessage: newsMsg?.content || "Нет сообщений",
        time: newsMsg?.timestamp ? formatTime(newsMsg.timestamp) : "",
        timestamp: newsMsg?.timestamp || 0
      },
      {
        key: "__global__", type: "group", id: "__global__", name: "Общий чат",
        lastMessage: globalMsg?.content || "Нет сообщений",
        time: globalMsg?.timestamp ? formatTime(globalMsg.timestamp) : "",
        timestamp: globalMsg?.timestamp || 0
      }
    ];

    // Друзья
    const friendItems = friends.map(f => {
      const chatKey = dmKey(me, f.id);
      const msg = lastMessages[`friend-${f.id}`] || lastMessages[chatKey];
      let text = msg?.content || "Нет сообщений";
      if (msg?.senderId === me) text = "Вы: " + text;
      if (text.startsWith("e2ee:")) text = "🔒 Зашифровано";
      return {
        key: `friend-${f.id}`,
        type: "friend",
        id: chatKey,
        name: f.name || f.username || "Без имени",
        lastMessage: text,
        time: msg?.timestamp ? formatTime(msg.timestamp) : "",
        timestamp: msg?.timestamp || 0
      };
    });

    // Каналы и группы
    const channelItems = mine.map(c => {
      const isChannel = c.type === "channel";
      const msg = lastMessages[`${isChannel ? 'channel' : 'group'}-${c.id}`] || lastMessages[c.id];
      
      let text = msg?.content || "Нет сообщений";
      if (text.startsWith("e2ee:")) text = "🔒 Зашифровано";
      return {
        key: isChannel ? `channel-${c.id}` : `group-${c.id}`,
        type: isChannel ? "channel" : "group",
        id: c.id,
        name: c.name || "Без названия",
        lastMessage: text,
        time: msg?.timestamp ? formatTime(msg.timestamp) : "",
        timestamp: msg?.timestamp || 0
      };
    });

    channelItems.sort((a, b) => b.timestamp - a.timestamp);
    friendItems.sort((a, b) => b.timestamp - a.timestamp);

    return { pinned, rest: [...friendItems, ...channelItems] };
  } catch (e) {
    console.error("[Sidebar] Ошибка сборки:", e);
    return { pinned: [], rest: [] };
  }
}

// ==========================================
// 5. Рендер
// ==========================================
function renderSidebar(pinned, rest) {
  const list = document.getElementById("chatList");
  list.innerHTML = "";

  const renderItem = (c) => {
    const el = document.createElement("div");
    el.className = "chat-item";

    const avatarDiv = document.createElement("div");
    avatarDiv.className = "avatar";
    const nameForAvatar = c.name || "?";
    avatarDiv.style.background = AVATAR_COLORS[nameForAvatar.length % AVATAR_COLORS.length];
    avatarDiv.textContent = nameForAvatar[0].toUpperCase();

    const bodyDiv = document.createElement("div");
    bodyDiv.className = "chat-body";

    const topDiv = document.createElement("div");
    topDiv.className = "chat-top";

    const nameDiv = document.createElement("div");
    nameDiv.className = "chat-name";
    nameDiv.textContent = c.name || "Без названия";

    const timeDiv = document.createElement("div");
    timeDiv.className = "chat-time";
    timeDiv.textContent = c.time || "";

    topDiv.appendChild(nameDiv);
    topDiv.appendChild(timeDiv);

    const msgDiv = document.createElement("div");
    msgDiv.className = "chat-message";
    let cleanMsg = (c.lastMessage || "Нет сообщений").replace(/[\r\n]+/g, " ");
    if (cleanMsg.length > 60) cleanMsg = cleanMsg.substring(0, 60) + "...";
    msgDiv.textContent = cleanMsg;

    bodyDiv.appendChild(topDiv);
    bodyDiv.appendChild(msgDiv);

    el.appendChild(avatarDiv);
    el.appendChild(bodyDiv);

    el.onclick = () => openChat(c.id, c.name, c.type);
    return el;
  };

  pinned.forEach(c => list.appendChild(renderItem(c)));
  rest.forEach(c => list.appendChild(renderItem(c)));
}

// ==========================================
// 6. Публичные функции
// ==========================================
async function refreshChats() {
  const { pinned, rest } = await fetchSidebar();
  window.AppState.allChats = [...pinned, ...rest];
  renderSidebar(pinned, rest);
}

async function initRealtime() {
  if (window.AppState.unsubscribeRealtime) {
    await window.AppState.unsubscribeRealtime();
  }
  window.AppState.unsubscribeRealtime = await pb.collection("messages").subscribe("*", () => {
    refreshChats();
  });
}

window.refreshChats = refreshChats;
window.initRealtime = initRealtime;
window.renderSidebar = renderSidebar;