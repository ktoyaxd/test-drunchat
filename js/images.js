// ==========================================
// js/images.js
// ==========================================

/**
 * Отправляет фото в чат.
 */
async function sendImage(chatId, file, caption = "") {
  const fd = new FormData();
  fd.append("image", file);
  fd.append("senderId", window.AppState.currentUserId);
  fd.append("channelId", chatId);
  fd.append("type", "image");
  fd.append("content", caption);
  fd.append("timestamp", new Date().toISOString());
  fd.append("status", "sent");

  // 🔥 ДОБАВЛЯЕМ ОТВЕТ, ЕСЛИ НУЖНО
  if (window.AppState.replyingTo) {
    const r = window.AppState.replyingTo;
    fd.append("replyTo", JSON.stringify({
      id: r.id,
      content: r.content || "",
      senderName: window.AppState.usersCache[r.senderId]?.name || "Неизвестно",
      senderId: r.senderId,
      quoted: false
    }));
    window.AppState.replyingTo = null;
    renderReplyPreview();
  }

  const record = await pb.collection("messages").create(fd);
  return {
    ...record,
    imageUrl: fileUrl("messages", record, record.image)
  };
}

/**
 * Открывает полноэкранную модалку с фото.
 */
function openFullImage(url) {
  if (!url) return;
  const overlay = document.createElement("div");
  overlay.className = "photo-modal";
  overlay.addEventListener("click", () => overlay.remove());

  const close = document.createElement("button");
  close.className = "photo-modal-close";
  close.textContent = "✕";
  close.addEventListener("click", (e) => { e.stopPropagation(); overlay.remove(); });

  const img = document.createElement("img");
  img.src = url;
  img.alt = "Full size";
  img.addEventListener("click", (e) => e.stopPropagation());

  overlay.appendChild(close);
  overlay.appendChild(img);
  document.body.appendChild(overlay);
}

/**
 * Рендерит превью фото в ленте.
 * ВАЖНО: эта функция должна быть доступна глобально для chat.js
 */
function renderImageMessage(msg) {
  const wrap = document.createElement("div");
  wrap.className = "photo-wrap";

  // Используем хелпер fileUrl из utils.js
  const url = msg.imageUrl || (msg.image ? fileUrl("messages", msg, msg.image) : "");
  
  if (!url) {
    wrap.textContent = "🖼️ Ошибка загрузки фото";
    wrap.style.padding = "10px";
    wrap.style.color = "#fff";
    return wrap;
  }

  const img = document.createElement("img");
  img.className = "photo-img";
  img.src = url;
  img.alt = "photo";
  img.loading = "lazy";
  img.onerror = () => { 
    wrap.textContent = "🖼️ Не удалось загрузить"; 
  };
  
  img.onclick = (e) => {
    e.stopPropagation();
    openFullImage(url);
  };

  wrap.appendChild(img);
  return wrap;
}