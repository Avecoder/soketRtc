import { handleException } from "../logger/sendError.js"
import { sendBroadcast } from "../logger/telegramLogs.js";
import { sendMessage } from "../socket/send.js";



export const users = {}
export const pairOfPeers = {}
export const waitingList = {}





/**
 * Получить id пары для указанного пользователя
 * 
 * @template T
 * @param {Object} params
 * @param {T} params.userId - Идентификатор пользователя
 * @param {WebSocket} params.ws - Вебсокет для обработки ошибок
 * @returns {T|null} - id второго пользователя из пары или null, если пары нет
 */
export const getPair = ({ userId, ws }) => {
    try {
      if (!userId) throw new Error("userId is required");
  
      /** @type {T|undefined} */
      const pair = pairOfPeers[userId];
  
  
      return pair;
  
    } catch (err) {
      handleException(ws, 'GET_PAIR', `problem getting peer pair: ${err.message}`, {});
      return null;
    }
  }
  

/**
 * Создаёт двунаправленную пару между userId и candidateId
 * @param {Object} params
 * @param {string|number} params.userId - id первого пользователя
 * @param {string|number} params.candidateId - id второго пользователя
 * @param {WebSocket} params.ws - websocket для обработки ошибок
 * @returns {boolean} - true если пара успешно создана, false при ошибке
 */
export const setPair = ({ userId, candidateId, ws }) => {
    try {
      if (!userId || !candidateId) throw new Error("userId and candidateId are required");
  
      // Устанавливаем пару в обе стороны
      pairOfPeers[userId] = candidateId;
      pairOfPeers[candidateId] = userId;
  
      return true;    
  
    } catch (err) {
      handleException(ws, 'SET_PAIR', `problem creating peer pair: ${err.message}`, {});
      return false;
    }
  }
  
  /**
   * Удаляет пару, связанную с userId (и удаляет обратную связь)
   * @param {Object} params
   * @param {string|number} params.userId - id пользователя, по которому удаляем пару
   * @param {WebSocket} params.ws - websocket для обработки ошибок
   * @returns {boolean} - true если пара удалена, false если не найдена или ошибка
   */
  export const removePair = ({ userId, ws }) => {
    try {
      if (!userId) throw new Error("userId is required");
  
      const peerId = pairOfPeers[userId];
      if (!peerId) return false; // пары нет
  
      // Удаляем пару в обе стороны
      delete pairOfPeers[userId];
      delete pairOfPeers[peerId];
  
      return true;

      
  
    } catch (err) {
      handleException(ws, 'REMOVE_PAIR', `problem removing peer pair: ${err.message}`, {});
      return false;
    }
  }
  

export const removeUser = (ws) => {
    try {
        const userId = ws.userId;
        if (!userId) throw new Error("userId not found");

        removePair({userId, ws});

        if(users[userId].size == 1) {
          delete users[userId];
        } else {
          users[userId].delete(ws);
        }
        

        return true
      } catch (err) {
        handleException(ws, 'REMOVE_USER', `problem removing user: ${err.message}`, {});
        return false
      }
}

export const pushInWaitingList = (candidateId, {...data}) => {
  try {
    waitingList[candidateId] = {...data, addedAt: Date.now()}
    sendBroadcast(`[PUSHING USER]: ${JSON.stringify(waitingList[candidateId])}`)
    sendBroadcast(`[WAITING LIST LENGTH]: ${waitingList.size}`)

  } catch (err) {
    console.error('pushInWaitingList error: ', err)
  }
}

export const removeFromWaitingList = ({userId}) => {
  try {
    delete waitingList[userId]
  } catch (err) {
    console.error('removeFromWaitingList error: ', err)
  }
}

export const getFromWaitingList = ({userId}) => {
  try {
    return waitingList[userId];
  } catch (err) {
    console.error('getFromWaitingList error: ', err)
  }
}


export const isSendingOnePeers = (sender) => {
  try {
    
    const user = Array.from(sender).find(([_, user]) => user.status !== 'idle')
    if(user && user.length) return user[1]
    else return false
  } catch (err) {
    console.log(err)
    return false
  }
}

export const updateStatus = (ws, status = 'idle', userId = '0') => {
  try {
    const user = users[ws.userId ?? userId].get(ws);
    user.status = status
  } catch (err) {
    console.log(err)
    handleException(ws, 'updateStatus', `Problem checking peer status: ${err.message}`, {});
    return false
  }
}


// Очистка пиров
const EXPIRATION_TIME = 60 * 1000; // 1 минута
const CLEANUP_INTERVAL = 10 * 1000; // 10 секунд

setInterval(() => {
  const now = Date.now();
  for (const userId in waitingList) {
    const user = waitingList[userId];
    if (now - user.addedAt > EXPIRATION_TIME) {
      console.log(`User ${userId} removed from waitingList after timeout.`);
      
      // Уведомляем пира, который названивает
      const userWhoCallsId = waitingList[userId].candidateId;
      const userWhoCalls = users[userWhoCallsId]

      sendMessage('/decline', userWhoCalls);

      delete waitingList[userId];
    }
  }
}, CLEANUP_INTERVAL);