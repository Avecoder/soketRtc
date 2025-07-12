

import {WebSocketServer} from "ws";
import dotenv from 'dotenv'
import { parseMessage } from "./parse.js";
import { removePair, removeUser } from "../users/index.js";
dotenv.config()




export const PORT = process.env.WS_PORT || 5555;


export const webSocket = new WebSocketServer({port: PORT})

webSocket.on('connection', (ws) => {
    ws.send(JSON.stringify({type: 'userConnect'})) 
    
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
      console.log('Leave user', ws.userId)
    });
  });

