const AVATAR_COLORS = ["#e17076", "#7bc862", "#e5ca77", "#65aadd", "#a695e7", "#ee7aae", "#6ec9cb", "#faa774"];

function formatTime(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { day: "numeric", month: "short" });
}

let byIdsAvailable = true;

async function fetchUsersByIds(ids) {
  const out = [];
  
  if (byIdsAvailable) {
    try {
      for (let i = 0; i < ids.length; i += 25) {
        const chunk = ids.slice(i, i + 25);
        const res = await pb.send("/api/drun/users/by-ids", {
          method: "POST",
          body: { ids: chunk },
          requestKey: null,
        });
        if (res && Array.isArray(res.users)) {
          for (const u of res.users) {
            if (u && u.id) { if (typeof mergeProfileToCache === 'function') mergeProfileToCache(u); out.push(u); }
          }
        } else if (res && res.users && typeof res.users === "object") {
          for (const u of Object.values(res.users)) {
            if (u && u.id) { if (typeof mergeProfileToCache === 'function') mergeProfileToCache(u); out.push(u); }
          }
        }
      }
      if (out.length > 0) return out;
    } catch (e) {
      if (e?.status === 404 || e?.status === 403) byIdsAvailable = false;
      else console.warn("[fetchUsersByIds] by-ids:", e);
    }
  }

  const missing = ids.filter(id => !out.find(u => u.id === id));
  if (missing.length > 0) {
    for (let i = 0; i < missing.length; i += 4) {
      const chunk = missing.slice(i, i + 4);
      const filter = chunk.map(id => `id="${id}"`).join(" || ");
      try {
        const page = await pb.collection("users").getList(1, chunk.length, { filter, skipTotal: true, requestKey: null });
        for (const u of page.items || []) {
          if (typeof mergeProfileToCache === 'function') mergeProfileToCache(u);
          out.push(u);
        }
      } catch (e) {
        if (e?.status !== 403 && e?.status !== 404) console.warn("[fetchUsersByIds] getList:", e);
      }
    }
  }

  if (typeof getProfileCache === 'function') {
    const cache = getProfileCache();
    for (const id of ids) {
      if (!out.find(u => u.id === id) && cache[id]) out.push(cache[id]);
    }
  }

  return out;
}

function fileUrl(collection, record, filename, options = {}) {
  if (!record?.id || !filename) return "";
  try {
    const col = pb.collection(collection);
    if (col && typeof col.getURL === "function") return col.getURL(record, filename, options);
  } catch (e) {}
  if (pb.files && typeof pb.files.getURL === "function") return pb.files.getURL(record, filename, options);
  if (pb.files && typeof pb.files.getUrl === "function") return pb.files.getUrl(record, filename, options);
  const collectionId = record.collectionId || record.collectionName || collection;
  if (!collectionId || !pb.baseURL) return "";
  const path = ["api", "files", encodeURIComponent(collectionId), encodeURIComponent(record.id), encodeURIComponent(filename)].join("/");
  let url = pb.baseURL.replace(/\/+$/, "") + "/" + path;
  if (options.thumb) url += `?thumb=${encodeURIComponent(options.thumb)}`;
  return url;
}