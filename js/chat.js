// ==========================================
// js/chat.js
// ==========================================

const messagesArea = document.getElementById('messagesArea');
const scrollDownBtn = document.getElementById('scrollDownBtn');
const msgInput = document.getElementById('msgInput');

window.AppState.usersCache = window.AppState.usersCache || {};
window.AppState.currentChatType = "group";
window.AppState.replyingTo = null;
window.AppState.canWrite = true;

let isLoadingMore = false;
let oldestMessageDate = null;
let currentChannelId = null;
let pollingInterval = null;

function getUserAvatarUrl(user) {
  if (!user) return null;
  const avatar = user.avatar || user.image || user.ProfileImg;
  const filename = Array.isArray(avatar) ? avatar[0] : avatar;
  if (!filename) return null;
  if (/^https?:\/\//.test(filename)) return filename;
  return fileUrl("users", user, filename);
}

async function openChat(channelId, name, type = "group", chatData = {}) {
  currentChannelId = channelId;
  window.AppState.currentChatId = channelId;
  window.AppState.currentChatType = type;
  window.AppState.replyingTo = null;
  isLoadingMore = false;
  oldestMessageDate = null;
  renderReplyPreview();
  
  if (window.setNavVisible) window.setNavVisible(false);

  const inputArea = document.querySelector(".msg-input-area");
  const me = pb.authStore.record?.id || pb.authStore.model?.id;
  const currentUser = pb.authStore.record || pb.authStore.model;
  
  let canWrite = true;
  let lockReason = "";

  if (channelId === "news" || type === "news") {
    const isGlobalMod = currentUser?.moderator === true || currentUser?.isModerator === true;
    if (!isGlobalMod) { canWrite = false; lockReason = "Канал новостей только для чтения"; }
  } else if (type === "channel") {
    try {
      const channel = await pb.collection("channels").getOne(channelId);
      const creatorId = channel.creatorId || channel.creator || channel.createdBy;
      let admins = channel.admins || [];
      if (typeof admins === "string") { try { admins = JSON.parse(admins); } catch (e) { admins = []; } }
      const isAdmin = creatorId === me || (Array.isArray(admins) && admins.includes(me));
      if (!isAdmin && !currentUser?.moderator) { canWrite = false; lockReason = "Только админы могут писать"; }
    } catch (e) { canWrite = false; lockReason = "Ошибка прав"; }
  }

  window.AppState.canWrite = canWrite;

  const existingLock = document.getElementById("channel-lock-msg");
  if (existingLock) existingLock.remove();

  if (!canWrite) {
    inputArea.style.display = "none";
    const lockDiv = document.createElement("div");
    lockDiv.id = "channel-lock-msg";
    lockDiv.style.textAlign = "center";
    lockDiv.style.padding = "16px";
    lockDiv.style.background = "var(--header-bg)";
    lockDiv.style.color = "var(--tg-text-secondary)";
    lockDiv.textContent = lockReason;
    messagesArea.parentNode.insertBefore(lockDiv, inputArea);
  } else {
    inputArea.style.display = "flex";
  }

  document.getElementById("chatPartnerName").textContent = name;
  document.getElementById("messagesScreen").classList.add('active');

  const cached = await loadMessagesFromCache(channelId);
  if (cached && cached.length > 0) {
    messagesArea.innerHTML = "";
    cached.forEach(msg => renderMessage(msg));
    scrollToBottom();
  } else {
    messagesArea.innerHTML = `<div class="loader">Загрузка...</div>`;
  }

  try {
    const page = await pb.collection("messages").getList(1, 50, {
      filter: pb.filter("channelId = {:cid}", { cid: channelId }),
      sort: "-created"
    });
    
    const items = page.items.map(m => {
      let rTo = m.replyTo;
      if (typeof rTo === "string") { try { rTo = JSON.parse(rTo); } catch(e) { rTo = null; } }
      return { ...m, replyTo: rTo };
    });

    const senderIds = [...new Set(items.map(m => m.senderId).filter(Boolean))];
    const missingIds = senderIds.filter(id => !window.AppState.usersCache[id]);
    if (missingIds.length > 0) {
      const users = await fetchUsersByIds(missingIds);
      for (const u of users) window.AppState.usersCache[u.id] = u;
    }

    await saveMessagesToCache(channelId, items);

    messagesArea.innerHTML = "";
    const reversed = [...items].reverse();
    reversed.forEach(msg => renderMessage(msg));
    scrollToBottom();

    if (reversed.length > 0) oldestMessageDate = reversed[0].created;

    if (window.AppState.unsubscribeMessages) await window.AppState.unsubscribeMessages();
    window.AppState.unsubscribeMessages = await pb.collection("messages").subscribe("*", async (e) => {
      if (e.record.channelId === window.AppState.currentChatId && e.action === "create") {
        let rTo = e.record.replyTo;
        if (typeof rTo === "string") { try { rTo = JSON.parse(rTo); } catch(err) { rTo = null; } }
        const record = { ...e.record, replyTo: rTo };
        if (record.senderId && !window.AppState.usersCache[record.senderId]) {
          const users = await fetchUsersByIds([record.senderId]);
          if (users.length > 0) window.AppState.usersCache[record.senderId] = users[0];
        }
        renderMessage(record);
        scrollToBottom();
      }
    }, { filter: `channelId = "${channelId}"` });

    // 👇 Polling-fallback (если realtime не работает)
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(async () => {
      if (document.hidden) return;
      try {
        const page = await pb.collection("messages").getList(1, 5, {
          filter: pb.filter("channelId = {:cid}", { cid: channelId }),
          sort: "-created",
        });
        const latest = page.items[0];
        if (latest && latest.created > (window.AppState.lastMessageCreated || 0)) {
          window.AppState.lastMessageCreated = latest.created;
          // (можно добавить проверку новых сообщений и отрисовать)
        }
      } catch (e) {}
    }, 5000);

  } catch (e) {
    messagesArea.innerHTML = `<div class="loader">Ошибка: ${e.message}</div>`;
  }
}

// ==========================================
// Подгрузка старых сообщений
// ==========================================
messagesArea.addEventListener('scroll', async () => {
  closeContextMenu();
  
  if (messagesArea.scrollTop < 50 && !isLoadingMore && oldestMessageDate && currentChannelId) {
    isLoadingMore = true;
    try {
      const page = await pb.collection("messages").getList(1, 50, {
        filter: pb.filter("channelId = {:cid} && created < {:date}", { cid: currentChannelId, date: oldestMessageDate }),
        sort: "-created"
      });
      
      if (page.items.length > 0) {
        const items = page.items.map(m => {
          let rTo = m.replyTo;
          if (typeof rTo === "string") { try { rTo = JSON.parse(rTo); } catch(e) { rTo = null; } }
          return { ...m, replyTo: rTo };
        });
        
        const senderIds = [...new Set(items.map(m => m.senderId).filter(Boolean))];
        const missingIds = senderIds.filter(id => !window.AppState.usersCache[id]);
        if (missingIds.length > 0) {
          const users = await fetchUsersByIds(missingIds);
          for (const u of users) window.AppState.usersCache[u.id] = u;
        }
        
        const cached = await loadMessagesFromCache(currentChannelId) || [];
        await saveMessagesToCache(currentChannelId, [...items, ...cached]);
        
        const reversed = [...items].reverse();
        const firstNew = messagesArea.firstChild;
        reversed.forEach(msg => {
          const el = createMessageElement(msg);
          messagesArea.insertBefore(el, firstNew);
        });
        
        oldestMessageDate = reversed[0].created;
      } else {
        oldestMessageDate = null;
      }
    } catch (e) {
      console.error("Ошибка подгрузки:", e);
    } finally {
      isLoadingMore = false;
    }
  }
});

// ==========================================
// Отрисовка сообщения
// ==========================================
function renderMessage(msg) {
  const el = createMessageElement(msg);
  messagesArea.appendChild(el);
}

function createMessageElement(msg) {
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
  let isMoved = false;
  row.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    const startX = touch.clientX, startY = touch.clientY;
    isMoved = false;
    longPressTimer = setTimeout(() => {
      if (!isMoved) showContextMenu(msg, startX, startY);
    }, 500);
  }, { passive: true });

  row.addEventListener('touchmove', () => { isMoved = true; clearTimeout(longPressTimer); }, { passive: true });
  row.addEventListener('touchend', () => clearTimeout(longPressTimer));
  row.addEventListener('contextmenu', (e) => { e.preventDefault(); showContextMenu(msg, e.clientX, e.clientY); });

  if (showSenderInfo) {
    const user = window.AppState.usersCache[msg.senderId];
    const avatar = document.createElement("div");
    avatar.className = "msg-avatar";
    avatar.style.cssText = "width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;flex-shrink:0;overflow:hidden;";
    const avatarUrl = getUserAvatarUrl(user);
    if (avatarUrl) {
      const img = document.createElement("img");
      img.src = avatarUrl;
      img.style.cssText = "width:100%;height:100%;object-fit:cover;";
      avatar.appendChild(img);
    } else {
      const nameForAvatar = user?.name || user?.username || "?";
      avatar.style.background = AVATAR_COLORS[nameForAvatar.length % AVATAR_COLORS.length];
      avatar.textContent = nameForAvatar[0].toUpperCase();
    }
    row.appendChild(avatar);
  }

  const contentWrapper = document.createElement("div");
  contentWrapper.style.cssText = `display:flex;flex-direction:column;align-items:${isOut ? 'flex-end' : 'flex-start'};max-width:80vw;`;

  if (showSenderInfo) {
    const name = getSenderName(msg.senderId);
    const nameDiv = document.createElement("div");
    nameDiv.className = "msg-sender-name";
    nameDiv.textContent = name;
    nameDiv.style.cssText = `font-size:12px;margin-bottom:2px;margin-left:4px;font-weight:500;color:hsl(${(name.length * 45) % 360},70%,70%);`;
    contentWrapper.appendChild(nameDiv);
  }

  const createReplyBlock = () => {
    if (!msg.replyTo) return null;
    const replyBlock = document.createElement("div");
    replyBlock.className = "reply-quote";
    const authorName = getSenderName(msg.replyTo.senderId, msg.replyTo.senderName);
    const replyText = msg.replyTo.content || "";
    let preview = replyText;
    if (replyText.startsWith("mell:")) preview = "🎞️ Стикер";
    else if (replyText.startsWith("📷") || msg.replyTo.type === "image") preview = "📷 Фото";

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
        timeSpan.style.cssText = "position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,0.5);padding:2px 4px;border-radius:4px;";
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
  return row;
}

// ==========================================
// Вспомогательные функции
// ==========================================
function getSenderName(senderId, fallbackName = null) {
  if (fallbackName && !isEmptyName(fallbackName) && fallbackName !== "Вы") return fallbackName;
  
  if (senderId === window.AppState.currentUserId) {
    const me = pb.authStore.record || pb.authStore.model;
    if (me) {
      if (!isEmptyName(me.name)) return me.name;
      if (me.username) return `@${me.username.replace(/^@+/, "")}`;
    }
    return "Вы";
  }
  
  const u = window.AppState.usersCache[senderId];
  if (u) {
    if (!isEmptyName(u.name)) return u.name;
    if (u.username) return `@${u.username.replace(/^@+/, "")}`;
  }
  
  if (typeof getProfileCache === 'function') {
    const cache = getProfileCache();
    const c = cache[senderId];
    if (c) {
      if (!isEmptyName(c.name)) return c.name;
      if (c.username) return `@${c.username.replace(/^@+/, "")}`;
    }
  }
  
  return "Собеседник";
}

function jumpToMessage(id) {
  const target = document.querySelector(`[data-message-id="${id}"]`);
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target.animate([{ backgroundColor: "rgba(139,92,246,0.3)" }, { backgroundColor: "transparent" }], { duration: 1000 });
}

function showContextMenu(msg, x, y) {
  if (!window.AppState.canWrite) return;
  
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
  setTimeout(() => { document.addEventListener("click", closeContextMenu, { once: true }); }, 100);
}

function closeContextMenu() {
  const menu = document.getElementById("ctx-menu");
  if (menu) menu.remove();
}

function renderReplyPreview() {
  const existing = document.getElementById("reply-preview");
  if (existing) existing.remove();
  if (!window.AppState.replyingTo) return;
  const msg = window.AppState.replyingTo;
  const author = getSenderName(msg.senderId);
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
  const inputArea = document.querySelector(".msg-input-area");
  if (inputArea) inputArea.parentNode.insertBefore(panel, inputArea);
  document.getElementById("cancel-reply").onclick = () => {
    window.AppState.replyingTo = null;
    renderReplyPreview();
  };
}

document.getElementById("sendBtn").onclick = async () => {
  const text = msgInput.value.trim();
  if (!text || !window.AppState.currentChatId) return;
  if (!window.AppState.canWrite) { alert("Вы не можете писать в этот канал"); return; }

  const myId = pb.authStore.record?.id || pb.authStore.model?.id;
  if (!myId) { alert("Вы не авторизованы"); return; }

  let channelId = window.AppState.currentChatId;
  if (window.AppState.currentChatType === "friend") {
    const otherId = channelId.split(":").find(id => id !== myId);
    if (otherId) channelId = [myId, otherId].sort().join(":");
  }

  const payload = {
    content: text, senderId: myId, channelId, type: "text",
    timestamp: new Date().toISOString(), edited: false, status: "sent"
  };

  if (window.AppState.replyingTo) {
    const r = window.AppState.replyingTo;
    payload.replyTo = JSON.stringify({
      id: r.id, content: r.content || "", senderName: getSenderName(r.senderId),
      senderId: r.senderId, quoted: false
    });
  }

  msgInput.value = "";
  window.AppState.replyingTo = null;
  renderReplyPreview();

  try { await pb.collection("messages").create(payload); }
  catch (e) { alert("Ошибка отправки: " + e.message); }
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
  if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; }
  if (window.setNavVisible) window.setNavVisible(true);
  if (window.AppState.unsubscribeMessages) { 
    window.AppState.unsubscribeMessages(); 
    window.AppState.unsubscribeMessages = null; 
  }
};