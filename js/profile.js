// ==========================================
// js/profile.js
// ==========================================

const PROFILE_CACHE_KEY = "drunlite-profile-cache-v1";

function isEmptyName(name) {
  if (!name || typeof name !== "string") return true;
  const t = name.trim();
  return !t || /^(ID\s+[a-z0-9]{4,15}|Пользователь(\s+[a-z0-9]{4,15})?|Контакт(\s+[a-z0-9]{4,15})?|Собеседник)$/i.test(t);
}

function getProfileCache() {
  try { return JSON.parse(localStorage.getItem(PROFILE_CACHE_KEY) || "{}"); } catch { return {}; }
}

function saveProfileCache(cache) {
  try { localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(cache)); } catch {}
}

function mergeProfileToCache(user) {
  if (!user?.id) return;
  const cache = getProfileCache();
  const prev = cache[user.id] || {};
  cache[user.id] = {
    ...prev, ...user,
    name: !isEmptyName(user.name) ? user.name : (prev.name || user.username || ""),
    username: user.username || prev.username || "",
    emoji: user.emoji || prev.emoji || "",
    ProfileImg: user.ProfileImg || prev.ProfileImg || "",
    avatar: user.avatar || prev.avatar || "",
  };
  saveProfileCache(cache);
}

async function loadProfileName(userId) {
  if (pb.authStore.record?.id === userId) {
    const r = pb.authStore.record;
    if (!isEmptyName(r.name)) return r.name;
    if (r.username) return `@${r.username.replace(/^@+/, "")}`;
  }

  const cache = getProfileCache();
  const cached = cache[userId];
  if (cached) {
    if (!isEmptyName(cached.name)) return cached.name;
    if (cached.username) return `@${cached.username.replace(/^@+/, "")}`;
  }

  if (typeof byIdsAvailable === 'undefined' || byIdsAvailable) {
    try {
      const res = await pb.send("/api/drun/users/by-ids", {
        method: "POST", body: { ids: [userId] }, requestKey: null,
      });
      const u = res?.users?.[0] || (res?.users && Object.values(res.users)[0]);
      if (u) {
        mergeProfileToCache(u);
        if (!isEmptyName(u.name)) return u.name;
        if (u.username) return `@${u.username.replace(/^@+/, "")}`;
      }
    } catch (e) {
      if (e?.status !== 403 && e?.status !== 404) console.warn("[Profile] by-ids:", e);
    }
  }

  try {
    const rec = await pb.collection("kv_store").getFirstListItem(
      pb.filter("key = {:key}", { key: `profile:${userId}` }), { requestKey: null }
    );
    const p = typeof rec.value === "string" ? JSON.parse(rec.value) : rec.value;
    if (p) {
      mergeProfileToCache(p);
      if (!isEmptyName(p.name)) return p.name;
      if (p.username) return `@${p.username.replace(/^@+/, "")}`;
    }
  } catch (e) {}

  try {
    const u = await pb.collection("users").getOne(userId);
    if (u) {
      mergeProfileToCache(u);
      if (!isEmptyName(u.name)) return u.name;
      if (u.username) return `@${u.username.replace(/^@+/, "")}`;
    }
  } catch (e) {}

  return userId === window.AppState.currentUserId ? "Вы" : "Собеседник";
}

async function saveProfileToKv(user) {
  if (!user?.id || isEmptyName(user.name)) return;
  const key = `profile:${user.id}`;
  const value = {
    id: user.id, name: user.name || "",
    username: String(user.username || "").replace(/^@+/, ""),
    emoji: user.emoji || "", ProfileImg: user.ProfileImg || "",
    avatar: user.avatar || "", updatedAt: new Date().toISOString(),
  };
  try {
    const rec = await pb.collection("kv_store").getFirstListItem(
      pb.filter("key = {:key}", { key }), { requestKey: null }
    ).catch(() => null);
    if (rec) await pb.collection("kv_store").update(rec.id, { key, value }, { requestKey: null });
    else await pb.collection("kv_store").create({ key, value }, { requestKey: null });
  } catch (e) {
    if (e?.status !== 403) console.warn("[Profile] kv_store error:", e);
  }
}