/**
 * Обработка PING сообщений от клиента
 * @param {Object} params - параметры сообщения
 * @param {WebSocket} params.ws - WebSocket соединение
 */
export const handlePing = ({ ws }) => {
  try {
    // Отправляем PONG обратно клиенту
    if (ws.readyState === ws.OPEN) {
      ws.send('PONG');
    }
  } catch (error) {
    console.error('[PING] Error sending pong:', error);
  }
};

/**
 * Heartbeat проверка для всех активных соединений
 * @param {WebSocketServer} wss - WebSocket сервер
 */
export const startHeartbeat = (wss) => {
  const heartbeatInterval = setInterval(() => {
    const now = Date.now();
    
    wss.clients.forEach((ws) => {
      if (ws.readyState === ws.OPEN) {
        // Проверяем, когда последний раз получали ping от клиента
        const lastPingTime = ws.lastPingTime || now;
        const timeSinceLastPing = now - lastPingTime;
        
        // Если не получали ping более 5 минут, считаем соединение мертвым
        if (timeSinceLastPing > 300000) { // 5 минут
          console.warn(`[HEARTBEAT] Client ${ws.userId || 'unknown'} hasn't sent ping for ${Math.round(timeSinceLastPing / 1000)}s, closing connection`);
          ws.close(1000, 'No ping received');
        }
      }
    });
  }, 30000); // Проверяем каждые 30 секунд
  
  return heartbeatInterval;
};
