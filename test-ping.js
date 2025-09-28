#!/usr/bin/env node

/**
 * Тестовый скрипт для проверки ping/pong функциональности WebSocket сервера
 */

import WebSocket from 'ws';

const SERVER_URL = 'ws://localhost:5555';
let pingCount = 0;
let pongCount = 0;
let lastPongTime = Date.now();

console.log('🚀 Starting WebSocket ping/pong test...');

const ws = new WebSocket(SERVER_URL);

ws.on('open', () => {
  console.log('✅ Connected to WebSocket server');
  
  // Отправляем ping каждые 10 секунд
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send('PING');
      pingCount++;
      console.log(`📤 Ping #${pingCount} sent`);
    } else {
      clearInterval(pingInterval);
    }
  }, 10000);
  
  // Проверяем соединение каждые 30 секунд
  const heartbeatInterval = setInterval(() => {
    const timeSinceLastPong = Date.now() - lastPongTime;
    console.log(`💓 Heartbeat check: ${Math.round(timeSinceLastPong / 1000)}s since last pong`);
    
    if (timeSinceLastPong > 30000) {
      console.warn('⚠️  No pong received for 30+ seconds!');
    }
  }, 30000);
  
  // Очищаем интервалы при закрытии соединения
  ws.on('close', () => {
    clearInterval(pingInterval);
    clearInterval(heartbeatInterval);
    console.log('🔌 Connection closed');
  });
});

ws.on('message', (data) => {
  const message = data.toString();
  
  if (message === 'PONG') {
    pongCount++;
    lastPongTime = Date.now();
    console.log(`📥 Pong #${pongCount} received`);
  } else {
    try {
      const parsed = JSON.parse(message);
      console.log('📨 Other message:', parsed);
    } catch (e) {
      console.log('📨 Raw message:', message);
    }
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error);
});

ws.on('close', (code, reason) => {
  console.log(`🔌 Connection closed: ${code} - ${reason}`);
  console.log(`📊 Final stats: ${pingCount} pings sent, ${pongCount} pongs received`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down test client...');
  ws.close();
  process.exit(0);
});
