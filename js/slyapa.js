// ==========================================
// js/slyapa.js
// ==========================================

window.slyapaBalanceUnsubscribe = null;
let slyapaAnimationId = null;

function initSlyapaScreen() {
  const slyapa = document.getElementById("slyapa3d");
  const container = slyapa?.parentElement;
  
  if (!slyapa || !container) return;

  // Очищаем старые копии, если они были
  container.querySelectorAll('.slyapa-clone').forEach(el => el.remove());

  // 1. Создаем "копии" шляпы
  const clones = [];
  for (let i = 0; i < 15; i++) {
    const clone = document.createElement("img");
    clone.src = "assets/icons/gold_slyapa.png";
    clone.className = "slyapa-clone";
    container.appendChild(clone);
    clones.push({
      el: clone,
      angle: Math.random() * Math.PI * 2,
      radius: 60 + Math.random() * 40,
      speed: 0.01 + Math.random() * 0.02,
      size: 15 + Math.random() * 15
    });
  }

  // 2. Переменные для управления скоростью
  let isInteracting = false;
  let speedMultiplier = 1;
  let lastTime = performance.now();

  // 3. Логика взаимодействия
  const startInteraction = () => { isInteracting = true; };
  const stopInteraction = () => { isInteracting = false; };

  slyapa.addEventListener("touchstart", startInteraction, { passive: true });
  slyapa.addEventListener("touchend", stopInteraction);
  slyapa.addEventListener("mousedown", startInteraction);
  slyapa.addEventListener("mouseup", stopInteraction);
  slyapa.addEventListener("mouseleave", stopInteraction);

  // Вращение самой шляпы
  slyapa.addEventListener("touchmove", (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = slyapa.getBoundingClientRect();
    const x = touch.clientX - rect.left - rect.width / 2;
    const y = touch.clientY - rect.top - rect.height / 2;
    slyapa.style.transform = `rotateY(${x / 4}deg) rotateX(${-y / 4}deg)`;
  }, { passive: false });

  slyapa.addEventListener("mousemove", (e) => {
    if (e.buttons > 0) {
      const rect = slyapa.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      slyapa.style.transform = `rotateY(${x / 4}deg) rotateX(${-y / 4}deg)`;
    }
  });

  // 4. Анимация полета копий
  function animate(time) {
    const delta = (time - lastTime) / 16.6;
    lastTime = time;

    const targetMultiplier = isInteracting ? 5 : 1;
    speedMultiplier += (targetMultiplier - speedMultiplier) * 0.1;

    const width = container.clientWidth;
    const height = container.clientHeight;
    const centerX = width / 2;
    const centerY = height / 2;

    clones.forEach(c => {
      c.angle += c.speed * speedMultiplier * delta;
      const x = centerX + Math.cos(c.angle) * c.radius;
      const y = centerY + Math.sin(c.angle) * c.radius;

      c.el.style.left = `${x}px`;
      c.el.style.top = `${y}px`;
      c.el.style.width = `${c.size}px`;
      c.el.style.height = `${c.size}px`;
      c.el.style.transform = `translate(-50%, -50%) rotate(${c.angle * 50}deg)`;
      c.el.style.opacity = Math.min(1, 0.2 + (speedMultiplier - 1) * 0.2);
    });

    slyapaAnimationId = requestAnimationFrame(animate);
  }

  if (slyapaAnimationId) cancelAnimationFrame(slyapaAnimationId);
  lastTime = performance.now();
  slyapaAnimationId = requestAnimationFrame(animate);

  // 5. Загружаем баланс (НОВАЯ ВЕРСИЯ)
  loadSlyapaBalance();
}

// ==========================================
// Остановка анимации при выходе
// ==========================================
function stopSlyapaAnimation() {
  if (slyapaAnimationId) {
    cancelAnimationFrame(slyapaAnimationId);
    slyapaAnimationId = null;
  }
}

// ==========================================
// Загрузка баланса (НОВАЯ ВЕРСИЯ с authRefresh и kv_store)
// ==========================================
async function loadSlyapaBalance() {
  const balanceEl = document.getElementById("slyapaBalanceValue");
  if (!balanceEl) return;

  if (window.slyapaBalanceUnsubscribe) {
    await window.slyapaBalanceUnsubscribe();
    window.slyapaBalanceUnsubscribe = null;
  }

  const userId = pb.authStore.record?.id || pb.authStore.model?.id;
  if (!userId) {
    balanceEl.textContent = "—";
    return;
  }

  // 1. Кеш из authStore.record
  const cachedCoins = pb.authStore.record?.coins;
  if (typeof cachedCoins === "number") {
    balanceEl.textContent = cachedCoins;
  } else {
    balanceEl.textContent = "...";
  }

  // 2. authRefresh
  let coins = null;
  try {
    const res = await pb.collection("users").authRefresh();
    if (res?.record?.id === userId && typeof res.record.coins === "number") {
      coins = res.record.coins;
      pb.authStore.save(res.token, res.record);
    }
  } catch (e) {
    if (e?.status !== 403 && e?.status !== 404) {
      console.warn("[Balance] authRefresh error:", e);
    }
  }

  // 3. getOne
  if (coins === null) {
    try {
      const user = await pb.collection("users").getOne(userId);
      if (typeof user?.coins === "number") {
        coins = user.coins;
      }
    } catch (e) {
      if (e?.status !== 403 && e?.status !== 404) {
        console.warn("[Balance] getOne error:", e);
      }
    }
  }

  // 4. kv_store (экономика)
  if (coins === null) {
    try {
      const rec = await pb.collection("kv_store").getFirstListItem(
        'key="drun-dev-economy:v1"'
      );
      const state = typeof rec.value === "string" ? JSON.parse(rec.value) : rec.value;
      const hats = state?.accounts?.[userId]?.hats;
      if (typeof hats === "number") {
        coins = hats;
      }
    } catch (e) {
      // kv_store тоже может быть защищён
    }
  }

  // 5. Отображаем
  if (coins !== null) {
    balanceEl.textContent = coins;
  } else {
    balanceEl.textContent = "—";
  }

  // 6. Realtime-подписка
  try {
    window.slyapaBalanceUnsubscribe = await pb.collection("users").subscribe(userId, (e) => {
      if (e.action === "update" && typeof e.record.coins === "number") {
        balanceEl.textContent = e.record.coins;
        pb.authStore.save(pb.authStore.token, e.record);
      }
    });
  } catch (e) {
    console.warn("[Balance] Realtime subscribe error:", e);
  }
}