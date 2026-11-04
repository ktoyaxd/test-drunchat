// ==========================================
// js/cache.js
// ==========================================

// Проверяем, запущено ли приложение через Capacitor
const isCapacitor = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNative;
const CapacitorFS = isCapacitor ? window.Capacitor.Plugins.Filesystem : null;

// Категории кеша
window.CacheCategories = {
  sticker: { name: 'Drun Sticker', color: '#f59e0b', size: 0, folder: 'Drun/Stickers' },
  image:   { name: 'Drun Image',   color: '#3b82f6', size: 0, folder: 'Drun/Images' },
  video:   { name: 'Drun Video',   color: '#10b981', size: 0, folder: 'Drun/Videos' },
  doc:     { name: 'Drun Documents', color: '#8b5cf6', size: 0, folder: 'Drun/Documents' },
  musor:   { name: 'Drun Musor',   color: '#6b7280', size: 0, folder: 'Drun/Other' }
};

// ==========================================
// 1. Подсчет размера
// ==========================================
async function getCacheSize() {
  for (const key in window.CacheCategories) {
    window.CacheCategories[key].size = 0;
  }

  if (isCapacitor && CapacitorFS) {
    // В APK: читаем папки на диске
    try {
      for (const key in window.CacheCategories) {
        const cat = window.CacheCategories[key];
        
        await CapacitorFS.mkdir({
          path: cat.folder,
          directory: 'EXTERNAL_STORAGE',
          recursive: true
        }).catch(() => {});

        const result = await CapacitorFS.readdir({
          path: cat.folder,
          directory: 'EXTERNAL_STORAGE'
        }).catch(() => ({ files: [] }));

        let totalSize = 0;
        for (const file of result.files) {
          if (file.type === 'file') {
            const stat = await CapacitorFS.stat({
              path: `${cat.folder}/${file.name}`,
              directory: 'EXTERNAL_STORAGE'
            }).catch(() => null);
            if (stat) totalSize += stat.size;
          }
        }
        cat.size = totalSize;
      }
    } catch (e) {
      console.error("Ошибка чтения кеша (Capacitor):", e);
    }
  } else {
    // В браузере: Cache API
    if (!('caches' in window)) return;
    const cache = await caches.open('drunlite-media-v1');
    const keys = await cache.keys();

    for (const request of keys) {
      const response = await cache.match(request);
      if (!response) continue;
      
      const blob = await response.blob();
      const size = blob.size;
      const url = request.url;

      if (url.includes('mellstickers') || url.endsWith('.webm')) {
        window.CacheCategories.sticker.size += size;
      } else if (url.includes('messages') && /\.(jpg|jpeg|png|gif)$/i.test(url)) {
        window.CacheCategories.image.size += size;
      } else if (/\.(mp4|mov)$/i.test(url)) {
        window.CacheCategories.video.size += size;
      } else if (/\.(pdf|doc|docx|txt)$/i.test(url)) {
        window.CacheCategories.doc.size += size;
      } else {
        window.CacheCategories.musor.size += size;
      }
    }
  }
}

// ==========================================
// 2. Загрузка с кешированием
// ==========================================
async function fetchWithCache(url, category = 'musor') {
  const cat = window.CacheCategories[category] || window.CacheCategories.musor;

  if (isCapacitor && CapacitorFS) {
    const filename = url.split('/').pop().split('?')[0];
    const filePath = `${cat.folder}/${filename}`;
    
    try {
      await CapacitorFS.stat({ path: filePath, directory: 'EXTERNAL_STORAGE' });
      const fileUri = await CapacitorFS.getUri({ path: filePath, directory: 'EXTERNAL_STORAGE' });
      return fileUri.uri;
    } catch (e) {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const base64 = await blobToBase64(blob);
        
        await CapacitorFS.writeFile({
          path: filePath,
          data: base64,
          directory: 'EXTERNAL_STORAGE',
          recursive: true
        });
        
        const fileUri = await CapacitorFS.getUri({ path: filePath, directory: 'EXTERNAL_STORAGE' });
        return fileUri.uri;
      } catch (err) {
        console.error("Ошибка сохранения:", err);
        return url;
      }
    }
  } else {
    // В браузере
    if (!('caches' in window)) return url;
    const cache = await caches.open('drunlite-media-v1');
    const cached = await cache.match(url);
    if (cached) return url;

    try {
      const response = await fetch(url);
      if (response.ok) cache.put(url, response.clone());
    } catch (e) {}
    return url;
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ==========================================
// 3. Очистка
// ==========================================
async function clearCacheByCategories(categoriesToClear) {
  if (isCapacitor && CapacitorFS) {
    for (const key of categoriesToClear) {
      const cat = window.CacheCategories[key];
      if (!cat) continue;
      try {
        await CapacitorFS.rmdir({
          path: cat.folder,
          directory: 'EXTERNAL_STORAGE',
          recursive: true
        }).catch(() => {});
        cat.size = 0;
      } catch (e) {}
    }
  } else {
    if (!('caches' in window)) return;
    const cache = await caches.open('drunlite-media-v1');
    const keys = await cache.keys();
    for (const request of keys) {
      const url = request.url;
      let category = 'musor';
      if (url.includes('mellstickers') || url.endsWith('.webm')) category = 'sticker';
      else if (url.includes('messages') && /\.(jpg|jpeg|png|gif)$/i.test(url)) category = 'image';
      else if (/\.(mp4|mov)$/i.test(url)) category = 'video';
      else if (/\.(pdf|doc|docx|txt)$/i.test(url)) category = 'doc';

      if (categoriesToClear.includes(category)) {
        await cache.delete(request);
      }
    }
  }
}

// ==========================================
// 4. Форматирование
// ==========================================
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}