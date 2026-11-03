// ==========================================
// js/chat.js (ИСПРАВЛЕННЫЙ С ЦИТАТАМИ)
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

async function openChat(channelId, name, type = "group") {
  window.AppState.currentChatId = channelId;
  window.AppState.currentChatType = type;
  window.AppState.replyingTo = null;
  renderReplyPreview();
  
  document.getElementById("chatPartnerName").textContent = name;
  document.getElementById("messagesScreen").classList.add('active');
  messagesArea.innerHTML = `<div class="loader">Загрузка...</div>`;
  window.AppState.lastMessageCreated = null;

  try {
    const page = await pb.collection("messages").getList(1, 100, {
      filter: pb.filter("channelId = {:cid}", { cid: channelId }),
      sort: "-created"
    });
    
    // Парсим replyTo (вдруг пришло строкой)
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
// Отрисовка сообщения (С ПРАВИЛЬНОЙ ЦИТАТОЙ)
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

  // --- ЛОГИКА ДОЛГОГО НАЖАТИЯ ---
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

  // Аватарка
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

  // Имя отправителя
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

  // --- ФУНКЦИЯ ДЛЯ БЛОКА ЦИТАТЫ ---
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

  // --- РЕНДЕР КОНТЕНТА ---
  if (content.startsWith("mell:")) {
    // Стикер
    const wrapper = document.createElement("div");
    const replyBlock = createReplyBlock();
    if (replyBlock) wrapper.appendChild(replyBlock);
    wrapper.appendChild(renderSticker(content.slice(5)));
    contentWrapper.appendChild(wrapper);
  } 
  else if (msg.image) {
    // Фото
    const mediaWrap = document.createElement("div");
    mediaWrap.className = "media-wrap" + (msg.replyTo ? " reply-media" : "");
    
    const replyBlock = createReplyBlock();
    if (replyBlock) mediaWrap.appendChild(replyBlock);

    mediaWrap.appendChild(renderImageMessage(msg));

    if (content.trim()) {
      const caption = document.createElement("div");
      caption.className = "bubble";
      caption.style.marginTop = "4px";
      caption.textContent = content;
      
      const timeSpan = document.createElement("span");
      timeSpan.className = "msg-time";
      timeSpan.textContent = formatTime(msg.created);
      caption.appendChild(timeSpan);
      
      mediaWrap.appendChild(caption);
    } else {
      // Время поверх фото
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
      imgContainer.appendChild(renderImageMessage(msg));
      imgContainer.appendChild(timeSpan);
      
      // Удаляем предыдущий вызов renderImageMessage, чтобы не дублировать
      mediaWrap.querySelector('.photo-wrap')?.remove();
      mediaWrap.appendChild(imgContainer);
    }
    
    contentWrapper.appendChild(mediaWrap);
  } 
  else {
    // Текст (цитата строго внутри пузыря)
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
// Контекстное меню
// ==========================================
function showContextMenu(msg, x, y) {
  closeContextMenu();

  const menu = document.createElement("div");
  menu.className = "context-menu";
  menu.id = "ctx-menu";
  menu.style.left = `${Math.min(x, window.innerWidth - 160)}px`;
  menu.style.top = `${Math.min(y, window.innerHeight - 60)}px`;

  const replyBtn = document.createElement("button");
  replyBtn.innerHTML = "↩️ Ответить";
  replyBtn.onclick = (e) => {
    e.stopPropagation();
    window.AppState.replyingTo = msg;
    renderReplyPreview();
    msgInput.focus();
    closeContextMenu();
  };

  menu.appendChild(replyBtn);
  document.body.appendChild(menu);

  setTimeout(() => {
    document.addEventListener("click", closeContextMenu, { once: true });
  }, 100);
}

function closeContextMenu() {
  const menu = document.getElementById("ctx-menu");
  if (menu) menu.remove();
}

// ==========================================
// Прыжок к сообщению
// ==========================================
function jumpToMessage(id) {
  const target = document.querySelector(`[data-message-id="${id}"]`);
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target.animate([
    { backgroundColor: "rgba(139,92,246,0.3)" },
    { backgroundColor: "transparent" }
  ], { duration: 1000 });
}

// ==========================================
// Панель ответа над инпутом
// ==========================================
function renderReplyPreview() {
  const existing = document.getElementById("reply-preview");
  if (existing) existing.remove();

  if (!window.AppState.replyingTo) return;

  const msg = window.AppState.replyingTo;
  const author = window.AppState.usersCache[msg.senderId]?.name || "Вы";
  const text = msg.content || (msg.image ? "📷 Фото" : "Вложение");

  const panel = document.createElement("div");
  panel.id = "reply-preview";
  panel.innerHTML = `
    <div class="reply-info">
      <div class="reply-name">Ответ: ${author}</div>
      <div class="reply-text">${text}</div>
    </div>
    <button class="cancel-reply" id="cancel-reply">✕</button>
  `;

  msgInputArea.parentNode.insertBefore(panel, msgInputArea);

  document.getElementById("cancel-reply").onclick = () => {
    window.AppState.replyingTo = null;
    renderReplyPreview();
  };
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

document.getElementById("backToChatsBtn").onclick = () => {
  document.getElementById("messagesScreen").classList.remove('active');
  if (window.AppState.unsubscribeMessages) { 
    window.AppState.unsubscribeMessages(); 
    window.AppState.unsubscribeMessages = null; 
  }
};