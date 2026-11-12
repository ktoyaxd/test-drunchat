// ==========================================
// js/data.js
// ==========================================
async function renderDataScreen() {
  const container = document.getElementById("dataScreen").querySelector(".settings-content");
  container.innerHTML = `<div class="loader">Подсчет кеша...</div>`;

  await getCacheSize();

  let totalSize = 0;
  for (const key in window.CacheCategories) {
    totalSize += window.CacheCategories[key].size;
  }

  if (totalSize === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: var(--tg-text-secondary);">
        <div style="font-size: 64px; margin-bottom: 16px;">📊</div>
        <div style="font-size: 18px; color: var(--tg-text); margin-bottom: 8px;">Кеш пуст</div>
        <div style="font-size: 14px;">Загрузите стикеры или фото, чтобы они появились здесь</div>
      </div>
    `;
    return;
  }

  const pSticker = (window.CacheCategories.sticker.size / totalSize) * 100 || 0;
  const pImage = (window.CacheCategories.image.size / totalSize) * 100 || 0;
  const pPhoto = (window.CacheCategories.photo.size / totalSize) * 100 || 0;
  const pVideo = (window.CacheCategories.video.size / totalSize) * 100 || 0;
  const pDoc = (window.CacheCategories.doc.size / totalSize) * 100 || 0;

  let currentAngle = 0;
  let gradientParts = [];
  
  if (pSticker > 0) { gradientParts.push(`#f59e0b ${currentAngle}% ${currentAngle + pSticker}%`); currentAngle += pSticker; }
  if (pImage > 0) { gradientParts.push(`#3b82f6 ${currentAngle}% ${currentAngle + pImage}%`); currentAngle += pImage; }
  if (pPhoto > 0) { gradientParts.push(`#ec4899 ${currentAngle}% ${currentAngle + pPhoto}%`); currentAngle += pPhoto; }
  if (pVideo > 0) { gradientParts.push(`#10b981 ${currentAngle}% ${currentAngle + pVideo}%`); currentAngle += pVideo; }
  if (pDoc > 0) { gradientParts.push(`#8b5cf6 ${currentAngle}% ${currentAngle + pDoc}%`); currentAngle += pDoc; }
  
  const gradient = `conic-gradient(${gradientParts.join(', ')})`;

  let html = `
    <div class="cache-chart-container">
      <div class="cache-circle" style="background: ${gradient};">
        <div class="cache-circle-inner">
          <div class="cache-total">${formatBytes(totalSize).split(' ')[0]}</div>
          <div class="cache-unit">${formatBytes(totalSize).split(' ')[1] || 'MB'}</div>
        </div>
      </div>
      <div class="cache-title">Использование памяти</div>
      <div class="cache-subtitle">DrunLite занимает ${formatBytes(totalSize)}</div>
    </div>

    <div class="settings-list" style="margin-top: 24px;">
  `;

  for (const key in window.CacheCategories) {
    const cat = window.CacheCategories[key];
    if (cat.size === 0) continue;

    html += `
      <div class="settings-item" style="justify-content: space-between;">
        <div style="display: flex; align-items: center;">
          <div class="settings-icon" style="background: ${cat.color}; font-size: 12px;">✓</div>
          <div class="settings-text">
            <div class="settings-title">${cat.name}</div>
          </div>
        </div>
        <div style="color: var(--tg-text-secondary); font-size: 14px;">${formatBytes(cat.size)}</div>
      </div>
    `;
  }

  html += `</div>`;

  html += `
    <button class="btn-primary" id="clearCacheBtn" style="width: 100%; margin-top: 24px; padding: 16px; border-radius: 12px; background: var(--tg-btn-bg); color: #fff; border: none; font-size: 16px; font-weight: 500;">
      Очистить кеш (${formatBytes(totalSize)})
    </button>
  `;

  container.innerHTML = html;

  document.getElementById("clearCacheBtn").onclick = async () => {
    const allCategories = Object.keys(window.CacheCategories);
    await clearCacheByCategories(allCategories);
    await renderDataScreen();
  };
}