// ==========================================
// js/slyapa.js
// ==========================================

window.slyapaBalanceUnsubscribe = null;

function initSlyapaScreen() {
  const slyapa = document.getElementById("slyapa3d");
  const particlesContainer = document.getElementById("particles");
  
  if (!slyapa || !particlesContainer) return;

  // 1. Создаем блёстки
  particlesContainer.innerHTML = "";
  for (let i = 0; i < 30; i++) {
    const particle = document.createElement("div");
    particle.className = "particle";
    particle.style.left = `${Math.random() * 100}%`;
    particle.style.top = `${Math.random() * 100}%`;
    particle.style.animationDelay = `${Math.random() * 2}s`;
    particle.style.animationDuration = `${1 + Math.random() * 1.5}s`;
    particlesContainer.appendChild(particle);
  }

  // 2. Логика взаимодействия (ускорение блёсток при вращении)
  let isInteracting = false;
  let timeout;

  const startInteraction = () => {
    isInteracting = true;
    particlesContainer.classList.add("fast");
    clearTimeout(timeout);
  };

  const stopInteraction = () => {
    isInteracting = false;
    timeout = setTimeout(() => {
      if (!isInteracting) particlesContainer.classList.remove("fast");
    }, 1000);
  };

  // Вращение на телефоне (тач)
  slyapa.addEventListener("touchmove", (e) => {
    e.preventDefault();
    startInteraction();
    const touch = e.touches[0];
    const rect = slyapa.getBoundingClientRect();
    const x = touch.clientX - rect.left - rect.width / 2;
    const y = touch.clientY - rect.top - rect.height / 2;
    slyapa.style.transform = `rotateY(${x / 5}deg) rotateX(${-y / 5}deg)`;
  }, { passive: false });

  slyapa.addEventListener("touchend", () => {
    stopInteraction();
    slyapa.style.transform = "rotateY(0deg) rotateX(0deg)";
  });

  // Вращение на ПК (мышь)
  slyapa.addEventListener("mousemove", (e) => {
    if (e.buttons > 0) {
      startInteraction();
      const rect = slyapa.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      slyapa.style.transform = `rotateY(${x / 5}deg) rotateX(${-y / 5}deg)`;
    }
  });
  
  slyapa.addEventListener("mousedown", startInteraction);
  slyapa.addEventListener("mouseup", () => {
    stopInteraction();
    slyapa.style.transform = "rotateY(0deg) rotateX(0deg)";
  });

  // 3. Загружаем реальный баланс
  loadSlyapaBalance();
}

// ==========================================
// Загрузка баланса и подписка на обновления
// ==========================================
async function loadSlyapaBalance() {
  const balanceEl = document.getElementById("slyapaBalanceValue");
  if (!balanceEl) return;

  // Отписываемся от старой подписки
  if (window.slyapaBalanceUnsubscribe) {
    await window.slyapaBalanceUnsubscribe();
    window.slyapaBalanceUnsubscribe = null;
  }

  const userId = pb.authStore.record?.id || pb.authStore.model?.id;
  if (!userId) return;

  try {
    const user = await pb.collection("users").getOne(userId);
    balanceEl.textContent = user.coins ?? 0;

    // Realtime-подписка
    window.slyapaBalanceUnsubscribe = await pb.collection("users").subscribe(userId, (e) => {
      if (e.action === "update" && typeof e.record.coins === "number") {
        balanceEl.textContent = e.record.coins;
      }
    });
  } catch (e) {
    console.error("Ошибка загрузки баланса:", e);
    balanceEl.textContent = "—";
  }
}