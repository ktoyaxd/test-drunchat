const pb = new PocketBase("https://api.drun.dev");
pb.autoCancellation(false);

// Глобальное состояние
window.AppState = {
  currentUserId: null,
  allChats: [],
  currentChatId: null,
  unsubscribeRealtime: null,
  unsubscribeMessages: null,
  lastMessageCreated: null,
  usersCache: {} // <-- добавлено
};