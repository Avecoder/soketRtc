

import {WebSocketServer} from "ws";
import dotenv from 'dotenv'
import { parseMessage } from "./parse.js";
import { removePair, removeUser, users, preservedUserData } from "../users/index.js";
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
      
      // НЕ удаляем данные пользователя при закрытии WebSocket
      // Это позволяет восстановить сессию при переподключении
      console.log(`[WS CLOSE] Preserving user data for potential reconnection: ${ws.userId}`);
      
      // Просто удаляем WebSocket соединение, но сохраняем данные пользователя
      const userMap = users[ws.userId];
      if (userMap) {
        userMap.delete(ws);
        console.log(`[WS CLOSE] Removed WebSocket connection for ${ws.userId}, user data preserved`);
        
        // Если это был последний WebSocket соединение, сохраняем данные пользователя
        if (userMap.size === 0) {
          console.log(`[WS CLOSE] All connections closed for ${ws.userId}, preserving user data for reconnection`);
          
          // Сохраняем данные пользователя для возможного восстановления
          const lastUserData = Array.from(userMap.values())[0];
          if (lastUserData && (lastUserData.status !== 'idle' || lastUserData.candidate)) {
            preservedUserData[ws.userId] = {
              ...lastUserData,
              preservedAt: Date.now()
            };
            console.log(`[WS CLOSE] Preserved user data for ${ws.userId}: status=${lastUserData.status}, candidate=${lastUserData.candidate}`);
          }
        }
      }
      
      console.log('Leave user', ws.userId)
    });
  });

