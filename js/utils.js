const AVATAR_COLORS = ["#e17076", "#7bc862", "#e5ca77", "#65aadd", "#a695e7", "#ee7aae", "#6ec9cb", "#faa774"];

function formatTime(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { day: "numeric", month: "short" });
}

async function fetchUsersByIds(ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 80) {
    const filter = ids.slice(i, i + 80).map(id => `id="${id}"`).join(" || ");
    try { 
      out.push(...await pb.collection("users").getFullList({ filter, fields: "id,name,username" })); 
    } catch(e) {}
  }
  return out;
}
/**
 * Универсальная функция для получения URL файла.
 * Работает на любой версии PocketBase SDK (0.20, 0.21, 0.22+).
 */
function fileUrl(collection, record, filename, options = {}) {
  if (!record?.id || !filename) return "";

  // 1. Новый метод (v0.21+): pb.collection("...").getURL(...)
  try {
    const col = pb.collection(collection);
    if (col && typeof col.getURL === "function") {
      return col.getURL(record, filename, options);
    }
  } catch (e) {}

  // 2. Метод pb.files.getURL (v0.21+)
  if (pb.files && typeof pb.files.getURL === "function") {
    return pb.files.getURL(record, filename, options);
  }

  // 3. Старый метод pb.files.getUrl (v0.20-)
  if (pb.files && typeof pb.files.getUrl === "function") {
    return pb.files.getUrl(record, filename, options);
  }

  // 4. Ручная сборка (если ничего не сработало)
  const collectionId = record.collectionId || record.collectionName || collection;
  if (!collectionId || !pb.baseURL) return "";

  const path = [
    "api", "files",
    encodeURIComponent(collectionId),
    encodeURIComponent(record.id),
    encodeURIComponent(filename)
  ].join("/");
  
  let url = pb.baseURL.replace(/\/+$/, "") + "/" + path;
  if (options.thumb) {
    url += `?thumb=${encodeURIComponent(options.thumb)}`;
  }
  return url;
}