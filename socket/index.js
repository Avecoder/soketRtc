

import {WebSocketServer} from "ws";
import dotenv from 'dotenv'
import { parseMessage } from "./parse.js";
import { removePair, removeUser } from "../users/index.js";
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
      // removeUser({ws})
      removePair({ ws, userId: ws.userId })
      removeUser(ws)
      sendBroadcast(`[LEAVE USER]: ${ws.userId}`)
      console.log('Leave user', ws.userId)
    });
  });

