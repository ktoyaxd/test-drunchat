// ==========================================
// js/stickers.js
// ==========================================

window.stickerNames = {};

async function loadStickersCache() {
  try {
    const stickers = await pb.collection("mellstickers").getFullList({ sort: "-created" });
    for (const s of stickers) {
      try {
        const meta = typeof s.data === "string" ? JSON.parse(s.data) : (s.data || {});
        window.stickerNames[s.id] = String(meta.name || "").trim();
      } catch (e) {
        window.stickerNames[s.id] = "";
      }
    }
    console.log("[Stickers] Загружено стикеров:", Object.keys(window.stickerNames).length);
  } catch (e) {
    console.warn("[Stickers] Не удалось загрузить кеш стикеров:", e);
  }
}

async function loadSticker(stickerId) {
  try {
    const record = await pb.collection("mellstickers").getOne(stickerId);
    const url = fileUrl("mellstickers", record, record.content);;
    console.log("[Stickers] Загружен стикер:", record.id, "URL:", url);
    
    let meta = {};
    try {
      meta = typeof record.data === "string" ? JSON.parse(record.data) : (record.data || {});
    } catch (e) {}

    return {
      id: record.id,
      url,
      name: String(meta.name || ""),
      keywords: Array.isArray(meta.keywords) ? meta.keywords : []
    };
  } catch (e) {
    console.warn("[Stickers] Стикер не найден:", stickerId, e);
    return null;
  }
}

function renderSticker(stickerId) {
  const wrap = document.createElement("div");
  wrap.className = "sticker-wrap";
  wrap.textContent = "🎞️"; // placeholder

  loadSticker(stickerId).then(sticker => {
    if (!sticker || !sticker.url) {
      console.warn("[Stickers] Нет URL для стикера:", stickerId);
      return;
    }
    wrap.innerHTML = "";
    
    const ext = sticker.url.split('.').pop().toLowerCase();
    if (ext === "webm" || ext === "mp4") {
      const video = document.createElement("video");
      video.src = sticker.url;
      video.muted = true;
      video.loop = true;
      video.autoplay = true;
      video.playsInline = true;
      video.className = "sticker-img";
      wrap.appendChild(video);
    } else {
      const img = document.createElement("img");
      img.src = sticker.url;
      img.alt = sticker.name || "sticker";
      img.className = "sticker-img";
      wrap.appendChild(img);
    }
  });

  return wrap;
}

async function sendSticker(chatId, stickerId) {
  return pb.collection("messages").create({
    content: `mell:${stickerId}`,
    senderId: window.AppState.currentUserId,
    channelId: chatId,
    type: "sticker",
    timestamp: new Date().toISOString(),
    status: "sent"
  });
}