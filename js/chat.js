// ==========================================
// js/chat.js (ИСПРАВЛЕННЫЙ С ЦИТАТАМИ И МЕНЮ)
// ==========================================

const messagesArea = document.getElementById('messagesArea');
const scrollDownBtn = document.getElementById('scrollDownBtn');
const msgInput = document.getElementById('msgInput');
const msgInputArea = document.querySelector('.msg-input-area');

window.AppState.usersCache = window.AppState.usersCache || {};
window.AppState.currentChatType = "group";
window.AppState.replyingTo = null;

function getUserAvatarUrl(user) {
  if (!user) return null;
  const avatar = user.avatar || user.image;
  const filename = Array.isArray(avatar) ? avatar[0] : avatar;
  if (!filename) return null;
  if (/^https?:\/\//.test(filename)) return filename;
  return fileUrl("users", user, filename);
}

async function openChat(channelId, name, type = "group", chatData = {}) {
  window.AppState.currentChatId = channelId;
  window.AppState.currentChatType = type;
  window.AppState.replyingTo = null;
  renderReplyPreview();
  
  if (window.setNavVisible) window.setNavVisible(false);

  // 👇 ПРОВЕРКА ПРАВ
  const msgInputArea = document.querySelector(".msg-input-area");
  const me = window.AppState.currentUserId;
  const currentUser = pb.authStore.record || pb.authStore.model;
  
  let canWrite = true;
  let lockReason = "";

  // 1. Проверка для системного канала «Новости»
  if (channelId === "news" || type === "news") {
    const isGlobalMod = currentUser?.moderator === true 
      || currentUser?.isModerator === true 
      || currentUser?.email === "mikhail02323@gmail.com"; // Захардкоженный email админа из оригинала
    
    if (!isGlobalMod) {
      canWrite = false;
      lockReason = "Канал новостей только для чтения";
    }
  }
  
  // 2. Проверка для обычных каналов
  else if (type === "channel") {
    try {
      const channel = await pb.collection("channels").getOne(channelId);
      const creatorId = channel.creatorId || channel.creator || channel.createdBy || channel.user;
      
      let admins = channel.admins || [];
      if (typeof admins === "string") {
        try { admins = JSON.parse(admins); } catch (e) { admins = []; }
      }
      
      const isCreator = creatorId === me;
      const isAdmin = Array.isArray(admins) && admins.includes(me);
      const isGlobalMod = currentUser?.moderator === true || currentUser?.isModerator === true;

      if (!isCreator && !isAdmin && !isGlobalMod) {
        canWrite = false;
        lockReason = "Только администраторы канала могут отправлять сообщения";
      }
    } catch (e) {
      console.error("Ошибка проверки прав канала:", e);
      canWrite = false;
      lockReason = "Не удалось проверить права доступа";
    }
  }
  
  // 3. Общий чат (__global__) и группы — писать можно всем авторизованным
  // (canWrite остается true)

  // Настраиваем UI
  const existingLock = document.getElementById("channel-lock-msg");
  if (existingLock) existingLock.remove();

  if (!canWrite) {
    msgInputArea.style.display = "none";
    const lockDiv = document.createElement("div");
    lockDiv.id = "channel-lock-msg";
    lockDiv.style.textAlign = "center";
    lockDiv.style.padding = "16px";
    lockDiv.style.background = "var(--header-bg)";
    lockDiv.style.color = "var(--tg-text-secondary)";
    lockDiv.style.fontSize = "14px";
    lockDiv.style.flexShrink = "0";
    lockDiv.textContent = lockReason;
    messagesArea.parentNode.insertBefore(lockDiv, msgInputArea);
  } else {
    msgInputArea.style.display = "flex";
  }

  // Дальше стандартный код загрузки сообщений...
  document.getElementById("chatPartnerName").textContent = name;
  document.getElementById("messagesScreen").classList.add('active');
  messagesArea.innerHTML = `<div class="loader">Загрузка...</div>`;
  window.AppState.lastMessageCreated = null;

  try {
    const page = await pb.collection("messages").getList(1, 100, {
      filter: pb.filter("channelId = {:cid}", { cid: channelId }),
      sort: "-created"
    });
    
    const items = page.items.map(m => {
      let rTo = m.replyTo;
      if (typeof rTo === "string") {
        try { rTo = JSON.parse(rTo); } catch(e) { rTo = null; }
      }
      return { ...m, replyTo: rTo };
    });

    const senderIds = [...new Set(items.map(m => m.senderId).filter(Boolean))];
    const missingIds = senderIds.filter(id => !window.AppState.usersCache[id]);
    
    if (missingIds.length > 0) {
      const users = await fetchUsersByIds(missingIds);
      for (const u of users) window.AppState.usersCache[u.id] = u;
    }

    messagesArea.innerHTML = "";
    const reversed = [...items].reverse();
    if (reversed.length > 0) window.AppState.lastMessageCreated = reversed[0].created;

    reversed.forEach(msg => renderMessage(msg));
    scrollToBottom();

    if (window.AppState.unsubscribeMessages) await window.AppState.unsubscribeMessages();
    window.AppState.unsubscribeMessages = await pb.collection("messages").subscribe("*", async (e) => {
      if (e.record.channelId === window.AppState.currentChatId && e.action === "create") {
        let rTo = e.record.replyTo;
        if (typeof rTo === "string") {
          try { rTo = JSON.parse(rTo); } catch(err) { rTo = null; }
        }
        const record = { ...e.record, replyTo: rTo };
        
        if (record.senderId && !window.AppState.usersCache[record.senderId]) {
          const users = await fetchUsersByIds([record.senderId]);
          if (users.length > 0) window.AppState.usersCache[record.senderId] = users[0];
        }
        renderMessage(record);
        scrollToBottom();
      }
    }, { filter: `channelId = "${channelId}"` });

  } catch (e) {
    console.error("Ошибка загрузки чата:", e);
    messagesArea.innerHTML = `<div class="loader">Ошибка загрузки: ${e.message}</div>`;
  }
}
// ==========================================
// Отрисовка сообщения
// ==========================================
function renderMessage(msg) {
  const isOut = msg.senderId === window.AppState.currentUserId;
  const chatType = window.AppState.currentChatType;
  const content = msg.content || msg.text || "";
  const showSenderInfo = !isOut && ["group", "channel", "news"].includes(chatType);

  const row = document.createElement("div");
  row.className = `message-row ${isOut ? 'out' : 'in'}`;
  row.dataset.messageId = msg.id;
  row.style.display = "flex";
  row.style.alignItems = "flex-end";
  row.style.gap = "8px";
  row.style.marginBottom = "8px";

  let longPressTimer = null;
  let startX = 0, startY = 0;
  let isMoved = false;

  row.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    isMoved = false;
    longPressTimer = setTimeout(() => {
      if (!isMoved) showContextMenu(msg, startX, startY);
    }, 450);
  }, { passive: true });

  row.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    if (Math.abs(touch.clientX - startX) > 10 || Math.abs(touch.clientY - startY) > 10) {
      isMoved = true;
      clearTimeout(longPressTimer);
    }
  }, { passive: true });

  row.addEventListener('touchend', () => clearTimeout(longPressTimer));
  row.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showContextMenu(msg, e.clientX, e.clientY);
  });

  if (showSenderInfo) {
    const user = window.AppState.usersCache[msg.senderId];
    const avatar = document.createElement("div");
    avatar.className = "msg-avatar";
    Object.assign(avatar.style, {
      width: "32px", height: "32px", borderRadius: "50%",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontSize: "14px", flexShrink: "0", overflow: "hidden"
    });

    const avatarUrl = getUserAvatarUrl(user);
    if (avatarUrl) {
      const img = document.createElement("img");
      img.src = avatarUrl;
      Object.assign(img.style, { width: "100%", height: "100%", objectFit: "cover" });
      avatar.appendChild(img);
    } else {
      const nameForAvatar = user?.name || user?.username || "?";
      avatar.style.background = AVATAR_COLORS[nameForAvatar.length % AVATAR_COLORS.length];
      avatar.textContent = nameForAvatar[0].toUpperCase();
    }
    row.appendChild(avatar);
  }

  const contentWrapper = document.createElement("div");
  Object.assign(contentWrapper.style, {
    display: "flex", flexDirection: "column",
    alignItems: isOut ? "flex-end" : "flex-start",
    maxWidth: "80vw"
  });

  if (showSenderInfo) {
    const user = window.AppState.usersCache[msg.senderId];
    const name = user?.name || user?.username || "Неизвестно";
    const nameDiv = document.createElement("div");
    nameDiv.className = "msg-sender-name";
    nameDiv.textContent = name;
    Object.assign(nameDiv.style, {
      fontSize: "12px", marginBottom: "2px", marginLeft: "4px",
      fontWeight: "500", color: `hsl(${(name.length * 45) % 360}, 70%, 70%)`
    });
    contentWrapper.appendChild(nameDiv);
  }

  const createReplyBlock = () => {
    if (!msg.replyTo) return null;
    const replyBlock = document.createElement("div");
    replyBlock.className = "reply-quote" + (msg.replyTo.quoted ? " quoted" : "");
    
    const authorName = msg.replyTo.senderName || "Неизвестно";
    const replyText = msg.replyTo.content || "";
    
    let preview = replyText;
    if (replyText.startsWith("mell:")) {
      preview = "🎞️ Стикер";
    } else if (replyText.startsWith("📷") || msg.replyTo.type === "image") {
      preview = "📷 Фото";
    }

    replyBlock.innerHTML = `
      <div class="reply-author">${authorName}</div>
      <div class="reply-preview-text">${preview}</div>
    `;

    replyBlock.onclick = (e) => {
      e.stopPropagation();
      jumpToMessage(msg.replyTo.id);
    };
    return replyBlock;
  };

  if (content.startsWith("mell:")) {
    const wrapper = document.createElement("div");
    const replyBlock = createReplyBlock();
    if (replyBlock) wrapper.appendChild(replyBlock);
    wrapper.appendChild(renderSticker(content.slice(5)));
    contentWrapper.appendChild(wrapper);
  } 
  else if (msg.image) {
    const mediaWrap = document.createElement("div");
    mediaWrap.className = "media-wrap" + (msg.replyTo ? " reply-media" : "");
    
    const replyBlock = createReplyBlock();
    if (replyBlock) mediaWrap.appendChild(replyBlock);

    // 👇 Асинхронно ждем загрузки фото из кеша/сети
    renderImageMessage(msg).then(photoEl => {
      if (content.trim()) {
        const caption = document.createElement("div");
        caption.className = "bubble";
        caption.style.marginTop = "4px";
        caption.textContent = content;
        
        const timeSpan = document.createElement("span");
        timeSpan.className = "msg-time";
        timeSpan.textContent = formatTime(msg.created);
        caption.appendChild(timeSpan);
        
        mediaWrap.appendChild(photoEl);
        mediaWrap.appendChild(caption);
      } else {
        const timeSpan = document.createElement("span");
        timeSpan.className = "msg-time";
        timeSpan.style.position = "absolute";
        timeSpan.style.bottom = "8px";
        timeSpan.style.right = "8px";
        timeSpan.style.background = "rgba(0,0,0,0.5)";
        timeSpan.style.padding = "2px 4px";
        timeSpan.style.borderRadius = "4px";
        timeSpan.textContent = formatTime(msg.created);
        
        const imgContainer = document.createElement("div");
        imgContainer.style.position = "relative";
        imgContainer.appendChild(photoEl);
        imgContainer.appendChild(timeSpan);
        mediaWrap.appendChild(imgContainer);
      }
    });
    
    contentWrapper.appendChild(mediaWrap);
  } 
  else {
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    
    const replyBlock = createReplyBlock();
    if (replyBlock) bubble.appendChild(replyBlock);

    let text = content;
    if (text.startsWith("e2ee:")) text = "🔒 Зашифровано";
    
    const textNode = document.createElement("div");
    textNode.textContent = text;
    bubble.appendChild(textNode);

    const timeSpan = document.createElement("span");
    timeSpan.className = "msg-time";
    timeSpan.textContent = formatTime(msg.created);
    bubble.appendChild(timeSpan);

    contentWrapper.appendChild(bubble);
  }

  row.appendChild(contentWrapper);
  messagesArea.appendChild(row);
}

// ==========================================
// Отправка
// ==========================================
document.getElementById("sendBtn").onclick = async () => {
  const text = msgInput.value.trim();
  if (!text || !window.AppState.currentChatId) return;
  
  const payload = {
    content: text,
    senderId: window.AppState.currentUserId,
    channelId: window.AppState.currentChatId,
    type: "text",
    timestamp: new Date().toISOString(),
    status: "sent"
  };

  if (window.AppState.replyingTo) {
    const r = window.AppState.replyingTo;
    payload.replyTo = JSON.stringify({
      id: r.id,
      content: r.content || "",
      senderName: window.AppState.usersCache[r.senderId]?.name || "Неизвестно",
      senderId: r.senderId,
      quoted: false
    });
  }

  msgInput.value = "";
  window.AppState.replyingTo = null;
  renderReplyPreview();

  try {
    await pb.collection("messages").create(payload);
  } catch (e) { 
    alert("Ошибка отправки: " + e.message); 
  }
};

msgInput.addEventListener("keypress", (e) => { 
  if (e.key === "Enter") document.getElementById("sendBtn").click(); 
});

function scrollToBottom() {
  messagesArea.scrollTop = messagesArea.scrollHeight;
  scrollDownBtn.classList.remove("visible");
}

scrollDownBtn.onclick = () => scrollToBottom();
messagesArea.onscroll = () => {
  const distToBottom = messagesArea.scrollHeight - messagesArea.scrollTop - messagesArea.clientHeight;
  if (distToBottom > 200) scrollDownBtn.classList.add("visible");
  else scrollDownBtn.classList.remove("visible");
};

// 👇 ВОЗВРАЩАЕМ МЕНЮ ПРИ НАЖАТИИ "НАЗАД"
document.getElementById("backToChatsBtn").onclick = () => {
  document.getElementById("messagesScreen").classList.remove('active');
  
  // Показываем меню
  if (window.setNavVisible) window.setNavVisible(true);
  
  if (window.AppState.unsubscribeMessages) { 
    window.AppState.unsubscribeMessages(); 
    window.AppState.unsubscribeMessages = null; 
  }
};
function renderReplyPreview() {
  const existing = document.getElementById("reply-preview");
  if (existing) existing.remove();

  if (!window.AppState.replyingTo) return;

  const msg = window.AppState.replyingTo;
  const author = window.AppState.usersCache[msg.senderId]?.name || "Вы";
  const text = msg.content || (msg.image ? "Фото" : "Вложение");

  const panel = document.createElement("div");
  panel.id = "reply-preview";
  panel.innerHTML = `
    <div class="reply-info">
      <div class="reply-name">Ответ: ${author}</div>
      <div class="reply-text">${text}</div>
    </div>
    <button class="cancel-reply" id="cancel-reply">✕</button>
  `;

  const inputArea = document.querySelector(".msg-input-area");
  if (inputArea) {
    inputArea.parentNode.insertBefore(panel, inputArea);
  }

  document.getElementById("cancel-reply").onclick = () => {
    window.AppState.replyingTo = null;
    renderReplyPreview();
  };
}