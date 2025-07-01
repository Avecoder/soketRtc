import WebSocket, {WebSocketServer} from "ws";
import dotenv from 'dotenv'
import {parseMessage, removeUser, users} from './actions.js'
dotenv.config()




export const PORT = process.env.WS_PORT || 5555;


export const webSocket = new WebSocketServer({port: PORT})

webSocket.on('connection', (ws) => {
    ws.send(JSON.stringify({type: 'userConnect'})) 
    
    ws.on('message', (message) => {
      try {
        const {currAction, userId, ...data} = parseMessage(message, ws)
        console.log({...data, userId})
        currAction?.({ws, ...data, userId})
      } catch(err) {
        console.log('ERROR ws message - ', err)
      }
    });

    ws.on('close', () => {

      // handleEndCall({ws})
      removeUser({ws})
      console.log('Leave user', ws.userId)
    });
  });

  console.log('Run server on port:', PORT)