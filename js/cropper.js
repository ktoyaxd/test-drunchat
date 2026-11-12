// ==========================================
// js/cropper.js
// ==========================================

let cropImage = null;
let cropRect = { x: 0, y: 0, w: 0, h: 0 };
let isDragging = false;
let isResizing = false;
let resizeHandle = null;
let startX = 0, startY = 0;
let initialRect = null;
let canvas, ctx;
let currentRotation = 0;
let isUploading = false;

document.addEventListener('DOMContentLoaded', () => {
  const attachBtn = document.getElementById("attachBtn");
  const fileInput = document.getElementById("fileInput");
  const cropModal = document.getElementById("cropModal");
  const cropCancel = document.getElementById("cropCancel");
  const cropConfirm = document.getElementById("cropConfirm");
  const cropSkip = document.getElementById("cropSkip");
  const cropReset = document.getElementById("cropReset");
  const rotateSlider = document.getElementById("rotateSlider");
  const rotateValue = document.getElementById("rotateValue");
  
  canvas = document.getElementById("cropCanvas");
  ctx = canvas ? canvas.getContext("2d") : null;

  if (!attachBtn || !fileInput || !cropModal) return;

  attachBtn.onclick = () => fileInput.click();

  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        cropImage = img;
        currentRotation = 0;
        rotateSlider.value = 0;
        rotateValue.textContent = "0°";
        setupCanvas(img);
        cropModal.classList.add("active");
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    fileInput.value = "";
  };

  function setupCanvas(img) {
    const maxWidth = window.innerWidth;
    const maxHeight = window.innerHeight * 0.6;
    let width = img.width;
    let height = img.height;

    if (width > maxWidth) {
      height = height * (maxWidth / width);
      width = maxWidth;
    }
    if (height > maxHeight) {
      width = width * (maxHeight / height);
      height = maxHeight;
    }

    canvas.width = width;
    canvas.height = height;
    
    resetCropRect();
    drawCropOverlay();
  }

  function resetCropRect() {
    cropRect = { x: 0, y: 0, w: canvas.width, h: canvas.height };
  }

  // 👇 ИСПРАВЛЕНО: перерисовываем фото внутри рамки, а не очищаем
  function drawCropOverlay() {
    if (!cropImage) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 1. Рисуем повернутое изображение (фон)
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((currentRotation * Math.PI) / 180);
    ctx.drawImage(cropImage, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
    ctx.restore();

    // 2. Затемнение
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 3. Область обрезки — перерисовываем фото (без очистки!)
    ctx.save();
    ctx.beginPath();
    ctx.rect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
    ctx.clip();
    
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((currentRotation * Math.PI) / 180);
    ctx.drawImage(cropImage, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
    ctx.restore();

    // 4. Рамка
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);

    // 5. Уголки
    ctx.fillStyle = "#fff";
    const s = 12;
    ctx.fillRect(cropRect.x - s/2, cropRect.y - s/2, s, s);
    ctx.fillRect(cropRect.x + cropRect.w - s/2, cropRect.y - s/2, s, s);
    ctx.fillRect(cropRect.x - s/2, cropRect.y + cropRect.h - s/2, s, s);
    ctx.fillRect(cropRect.x + cropRect.w - s/2, cropRect.y + cropRect.h - s/2, s, s);
  }

  rotateSlider.oninput = (e) => {
    currentRotation = parseInt(e.target.value);
    rotateValue.textContent = currentRotation + "°";
    drawCropOverlay();
  };

  cropReset.onclick = () => {
    currentRotation = 0;
    rotateSlider.value = 0;
    rotateValue.textContent = "0°";
    resetCropRect();
    drawCropOverlay();
  };

  function getHit(x, y) {
    const edge = 20;
    const { x: rx, y: ry, w, h } = cropRect;

    if (Math.hypot(x - rx, y - ry) < edge) return 'tl';
    if (Math.hypot(x - (rx + w), y - ry) < edge) return 'tr';
    if (Math.hypot(x - rx, y - (ry + h)) < edge) return 'bl';
    if (Math.hypot(x - (rx + w), y - (ry + h)) < edge) return 'br';
    if (x > rx && x < rx + w && y > ry && y < ry + h) return 'move';
    return null;
  }

  canvas.onmousedown = (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    startX = x;
    startY = y;
    initialRect = { ...cropRect };

    const hit = getHit(x, y);
    if (hit === 'move') isDragging = true;
    else if (hit) { isResizing = true; resizeHandle = hit; }
  };

  canvas.onmousemove = (e) => {
    if (!isDragging && !isResizing) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const dx = x - startX;
    const dy = y - startY;

    if (isDragging) {
      cropRect.x = Math.max(0, Math.min(initialRect.x + dx, canvas.width - cropRect.w));
      cropRect.y = Math.max(0, Math.min(initialRect.y + dy, canvas.height - cropRect.h));
    } else if (isResizing) {
      if (resizeHandle === 'tl') {
        const newW = initialRect.w - dx;
        const newH = initialRect.h - dy;
        if (newW > 10 && newH > 10 && initialRect.x + dx >= 0 && initialRect.y + dy >= 0) {
          cropRect.w = newW; cropRect.h = newH; cropRect.x = initialRect.x + dx; cropRect.y = initialRect.y + dy;
        }
      } else if (resizeHandle === 'tr') {
        const newW = initialRect.w + dx;
        const newH = initialRect.h - dy;
        if (newW > 10 && newH > 10 && initialRect.y + dy >= 0) {
          cropRect.w = newW; cropRect.h = newH; cropRect.y = initialRect.y + dy;
        }
      } else if (resizeHandle === 'bl') {
        const newW = initialRect.w - dx;
        const newH = initialRect.h + dy;
        if (newW > 10 && newH > 10 && initialRect.x + dx >= 0) {
          cropRect.w = newW; cropRect.h = newH; cropRect.x = initialRect.x + dx;
        }
      } else if (resizeHandle === 'br') {
        const newW = initialRect.w + dx;
        const newH = initialRect.h + dy;
        if (newW > 10 && newH > 10) {
          cropRect.w = newW; cropRect.h = newH;
        }
      }
    }
    drawCropOverlay();
  };

  canvas.onmouseup = () => { isDragging = false; isResizing = false; };

  canvas.ontouchstart = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    startX = x; startY = y;
    initialRect = { ...cropRect };

    const hit = getHit(x, y);
    if (hit === 'move') isDragging = true;
    else if (hit) { isResizing = true; resizeHandle = hit; }
  };

  canvas.ontouchmove = (e) => {
    e.preventDefault();
    if (!isDragging && !isResizing) return;
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    const dx = x - startX;
    const dy = y - startY;

    if (isDragging) {
      cropRect.x = Math.max(0, Math.min(initialRect.x + dx, canvas.width - cropRect.w));
      cropRect.y = Math.max(0, Math.min(initialRect.y + dy, canvas.height - cropRect.h));
    } else if (isResizing) {
      if (resizeHandle === 'tl') {
        const newW = initialRect.w - dx;
        const newH = initialRect.h - dy;
        if (newW > 10 && newH > 10 && initialRect.x + dx >= 0 && initialRect.y + dy >= 0) {
          cropRect.w = newW; cropRect.h = newH; cropRect.x = initialRect.x + dx; cropRect.y = initialRect.y + dy;
        }
      } else if (resizeHandle === 'tr') {
        const newW = initialRect.w + dx;
        const newH = initialRect.h - dy;
        if (newW > 10 && newH > 10 && initialRect.y + dy >= 0) {
          cropRect.w = newW; cropRect.h = newH; cropRect.y = initialRect.y + dy;
        }
      } else if (resizeHandle === 'bl') {
        const newW = initialRect.w - dx;
        const newH = initialRect.h + dy;
        if (newW > 10 && newH > 10 && initialRect.x + dx >= 0) {
          cropRect.w = newW; cropRect.h = newH; cropRect.x = initialRect.x + dx;
        }
      } else if (resizeHandle === 'br') {
        const newW = initialRect.w + dx;
        const newH = initialRect.h + dy;
        if (newW > 10 && newH > 10) {
          cropRect.w = newW; cropRect.h = newH;
        }
      }
    }
    drawCropOverlay();
  };

  canvas.ontouchend = (e) => { e.preventDefault(); isDragging = false; isResizing = false; };

  cropCancel.onclick = () => {
    cropModal.classList.remove("active");
    cropImage = null;
    isUploading = false;
  };

  cropSkip.onclick = async () => {
    if (!cropImage || isUploading) return;
    isUploading = true;
    try { await uploadImage(cropImage); } finally {
      cropModal.classList.remove("active");
      cropImage = null;
      isUploading = false;
    }
  };

  cropConfirm.onclick = async () => {
    if (!cropImage || isUploading) return;
    if (cropRect.w < 10 || cropRect.h < 10) { alert("Выделите область"); return; }
    isUploading = true;
    try {
      const cropCanvas = document.createElement("canvas");
      cropCanvas.width = (cropRect.w / canvas.width) * cropImage.width;
      cropCanvas.height = (cropRect.h / canvas.height) * cropImage.height;
      const cropCtx = cropCanvas.getContext("2d");
      cropCtx.drawImage(
        cropImage,
        (cropRect.x / canvas.width) * cropImage.width,
        (cropRect.y / canvas.height) * cropImage.height,
        (cropRect.w / canvas.width) * cropImage.width,
        (cropRect.h / canvas.height) * cropImage.height,
        0, 0, cropCanvas.width, cropCanvas.height
      );
      cropCanvas.toBlob(async (blob) => {
        const file = new File([blob], "cropped.jpg", { type: "image/jpeg" });
        await uploadImage(file);
        cropModal.classList.remove("active");
        cropImage = null;
        isUploading = false;
      }, "image/jpeg", 0.9);
    } catch (e) { isUploading = false; }
  };

  async function uploadImage(fileOrImg) {
    let file;
    if (fileOrImg instanceof HTMLImageElement) {
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = fileOrImg.width;
      tempCanvas.height = fileOrImg.height;
      tempCanvas.getContext("2d").drawImage(fileOrImg, 0, 0);
      file = await new Promise(resolve => {
        tempCanvas.toBlob(blob => {
          resolve(new File([blob], "photo.jpg", { type: "image/jpeg" }));
        }, "image/jpeg", 0.9);
      });
    } else { file = fileOrImg; }

    const chatId = window.AppState.currentChatId;
    if (!chatId) return;
    try { await sendImage(chatId, file); } catch (err) { alert("Ошибка: " + err.message); }
  }
});