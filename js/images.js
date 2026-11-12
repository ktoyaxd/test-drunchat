// ==========================================
// js/images.js
// ==========================================

/**
 * Сжатие изображения (как в оригинале)
 */
async function compressImage(file, maxCompressedSize = 75, type = "messages") {
  if (file.size / 1024 <= 50) return file;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    
    reader.onload = (e) => { img.src = e.target.result; };
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Failed to get canvas context")); return; }

      let width = img.width;
      let height = img.height;
      const maxSide = type === "stickers" ? 512 : 1920;
      
      if (width > maxSide || height > maxSide) {
        if (width > height) {
          height = height / width * maxSide;
          width = maxSide;
        } else {
          width = width / height * maxSide;
          height = maxSide;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      let quality = 0.9;
      let attempts = 0;
      const maxAttempts = 10;

      const tryCompress = (q) => {
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error("Failed to compress image")); return; }
          if (blob.size / 1024 <= maxCompressedSize || attempts >= maxAttempts) {
            resolve(blob);
            return;
          }
          attempts++;
          tryCompress(q * 0.8);
        }, "image/jpeg", q);
      };

      tryCompress(quality);
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    reader.readAsDataURL(file);
  });
}

/**
 * Отправляет фото в чат (с сжатием)
 */
async function sendImage(chatId, file, caption = "") {
  // 👇 Берем senderId из authStore
  const myId = pb.authStore.record?.id || pb.authStore.model?.id;
  if (!myId) {
    alert("Вы не авторизованы");
    return;
  }

  // 👇 Сжимаем фото
  let compressedBlob;
  try {
    compressedBlob = await compressImage(file, 75, "messages");
  } catch (e) {
    console.warn("Не удалось сжать, отправляем оригинал:", e);
    compressedBlob = file;
  }

  const compressedFile = new File([compressedBlob], file.name, {
    type: file.size / 1024 <= 50 ? file.type : "image/jpeg"
  });

  const fd = new FormData();
  fd.append("image", compressedFile);
  fd.append("senderId", myId);
  fd.append("channelId", chatId);
  fd.append("type", "image");
  fd.append("content", caption);
  fd.append("timestamp", new Date().toISOString());
  // 👇 Убрали status и edited (как в оригинале)

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

// ... (renderImageMessage и openFullImage остаются без изменений)

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
 * Рендерит превью фото в ленте (с поддержкой кеша).
 * 👇 ИСПОЛЬЗУЕТ КАТЕГОРИЮ 'photo' ДЛЯ КЕША
 */
async function renderImageMessage(msg) {
  const wrap = document.createElement("div");
  wrap.className = "photo-wrap";

  const originalUrl = msg.imageUrl || (msg.image ? fileUrl("messages", msg, msg.image) : "");
  
  if (!originalUrl) {
    wrap.textContent = "Ошибка загрузки фото";
    wrap.style.padding = "10px";
    wrap.style.color = "#fff";
    return wrap;
  }

  // 👇 ПРОПУСКАЕМ ЧЕРЕЗ КЕШ КАТЕГОРИИ 'photo'
  let url = originalUrl;
  if (typeof fetchWithCache === 'function') {
    url = await fetchWithCache(originalUrl, 'photo');
  }

  const img = document.createElement("img");
  img.className = "photo-img";
  img.src = url;
  img.alt = "photo";
  img.loading = "lazy";
  img.onerror = () => { 
    wrap.textContent = "Не удалось загрузить"; 
  };
  
  img.onclick = (e) => {
    e.stopPropagation();
    openFullImage(url);
  };

  wrap.appendChild(img);
  return wrap;
}