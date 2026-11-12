// ==========================================
// js/notifications.js
// ==========================================

const isCapacitorNative = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNative;

async function requestNotificationPermission() {
  if (isCapacitorNative) {
    const { LocalNotifications } = window.Capacitor.Plugins;
    const perm = await LocalNotifications.requestPermissions();
    return perm.display === 'granted';
  } else {
    if (!('Notification' in window)) return false;
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
}

async function showTestNotification() {
  const granted = await requestNotificationPermission();
  if (!granted) {
    alert('Разрешение на уведомления не выдано');
    return;
  }

  if (isCapacitorNative) {
    const { LocalNotifications } = window.Capacitor.Plugins;
    
    // Создаем канал (важно для Android 8+)
    try {
      await LocalNotifications.createChannel({
        id: 'drun_channel',
        name: 'DrunLite',
        description: 'Уведомления DrunLite',
        sound: 'test', // Имя файла из res/raw (test.ogg)
        importance: 5,
        visibility: 1,
      });
    } catch (e) {
      console.warn('Канал уже создан или ошибка:', e);
    }

    // Отправляем уведомление
    await LocalNotifications.schedule({
      notifications: [
        {
          title: 'DrunLite',
          body: 'Test',
          id: 1,
          channelId: 'drun_channel',
          smallIcon: 'dl48x', // 👈 Иконка из res/drawable (DL48x.png)
          iconColor: '#229AF0',
        }
      ]
    });
    console.log('Уведомление отправлено (Capacitor)');
  } else {
    new Notification('DrunLite', {
      body: 'Это тестовое уведомление (браузер)',
      icon: 'assets/icons/icon_DLwhite.png'
    });
    console.log('Уведомление отправлено (Web)');
  }
}