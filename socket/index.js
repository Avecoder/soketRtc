

import {WebSocketServer} from "ws";
import dotenv from 'dotenv'
import { parseMessage } from "./parse.js";
import { removePair, removeUser, users } from "../users/index.js";
import { sendBroadcast } from "../logger/telegramLogs.js";
import { startHeartbeat } from "../actions/pingActions.js";
dotenv.config()




export const PORT = process.env.WS_PORT || 5555;


export const webSocket = new WebSocketServer({port: PORT})

// Запускаем heartbeat проверку
const heartbeatInterval = startHeartbeat(webSocket);

webSocket.on('connection', (ws) => {
    console.log('[USER CONNECT]')
    sendBroadcast('[USER CONNECT]')
    ws.send(JSON.stringify({type: 'userConnect'})) 
    
    // Инициализируем время последнего ping
    ws.lastPingTime = Date.now();
    
    ws.on('message', (message) => {
      try {
        const {currAction, userId, ...data} = parseMessage(message, ws)
        currAction?.({ws, ...data, userId})
      } catch(err) {
        console.log('ERROR ws message - ', err)
      }
    });

    ws.on('close', () => {
      console.log(`[WS CLOSE] User ${ws.userId} disconnected`);
      
      // Проверяем, есть ли активная сессия этого пользователя
      const userMap = users[ws.userId];
      let hasActiveSession = false;
      
      if (userMap && userMap.size > 0) {
        // Проверяем, есть ли другие активные соединения этого пользователя
        for (const [otherWs, userData] of userMap) {
          if (otherWs !== ws && userData.status !== 'idle') {
            hasActiveSession = true;
            console.log(`[WS CLOSE] User ${ws.userId} has active session, not removing`);
            break;
          }
        }
      }
      
      if (!hasActiveSession) {
        // Удаляем только если нет других активных сессий
        console.log(`[WS CLOSE] Removing user ${ws.userId} - no active sessions`);
        removePair({ ws, userId: ws.userId })
        removeUser(ws)
        sendBroadcast(`[LEAVE USER]: ${ws.userId}`)
      } else {
        // Просто удаляем это соединение, но сохраняем данные пользователя
        console.log(`[WS CLOSE] Removing only WebSocket connection for ${ws.userId}`);
        if (userMap) {
          userMap.delete(ws);
        }
      }
      
      console.log('Leave user', ws.userId)
    });
  });

