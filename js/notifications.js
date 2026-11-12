// ==========================================
// js/notifications.js
// ==========================================

const isCapacitorNative = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNative;

async function showTestNotification() {
  console.log("[Notifications] Старт");

  // 👇 1. Браузер (localhost)
  if (!isCapacitorNative) {
    if (!('Notification' in window)) {
      alert('Уведомления не поддерживаются');
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      alert('Разрешение не выдано');
      return;
    }
    new Notification('DrunLite', { body: 'Тестовое уведомление (браузер)' });
    return;
  }

  // 👇 2. APK (Capacitor)
  const { LocalNotifications } = window.Capacitor.Plugins;
  if (!LocalNotifications) {
    alert('Плагин LocalNotifications не найден');
    return;
  }

  // Запрос разрешения (runtime)
  try {
    console.log("[Notifications] Запрос разрешения...");
    const perm = await LocalNotifications.requestPermissions();
    console.log("[Notifications] Результат:", perm);
    if (perm.display !== 'granted') {
      alert('Разрешение на уведомления не выдано. Включите вручную в настройках телефона.');
      return;
    }
  } catch (e) {
    console.error("[Notifications] Ошибка запроса:", e);
    alert('Ошибка запроса разрешения: ' + e.message);
    return;
  }

  // Создание канала (без sound и smallIcon)
  try {
    console.log("[Notifications] Создание канала...");
    await LocalNotifications.createChannel({
      id: 'drun_channel',
      name: 'DrunLite',
      description: 'Уведомления DrunLite',
      importance: 5,
      visibility: 1,
      vibration: true,
    });
    console.log("[Notifications] Канал создан");
  } catch (e) {
    console.warn("[Notifications] Канал уже есть или ошибка:", e);
  }

  // Отправка уведомления (без sound и smallIcon)
  try {
    console.log("[Notifications] Отправка уведомления...");
    await LocalNotifications.schedule({
      notifications: [
        {
          title: 'DrunLite',
          body: 'Это тестовое уведомление!',
          id: Math.floor(Math.random() * 100000),
          channelId: 'drun_channel',
        }
      ]
    });
    console.log("[Notifications] Уведомление отправлено!");
    alert('Уведомление отправлено. Проверьте шторку.');
  } catch (e) {
    console.error("[Notifications] Ошибка отправки:", e);
    alert('Ошибка отправки: ' + e.message);
  }
}