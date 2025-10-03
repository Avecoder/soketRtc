import { handleException } from "../logger/sendError.js"
import { sendBroadcast } from "../logger/telegramLogs.js";
import { sendMessage } from "../socket/send.js";



export const users = {}
export const pairOfPeers = {}
export const waitingList = {}
export const preservedUserData = {} // Хранилище для сохранения данных пользователей при разрыве соединения





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
  
      // Сначала ищем в глобальном объекте пар
      const pair = pairOfPeers[userId];
      if (pair) return pair;

      // Если не найдено - ищем в данных пользователя (fallback для переподключений)
      const userMap = users[userId];
      if (userMap && userMap.size > 0) {
        console.log(`[PAIR FALLBACK] Searching in userMap for ${userId}, size: ${userMap.size}`);
        
        // Сначала пытаемся найти по конкретному WebSocket
        const userByWs = userMap.get(ws);
        console.log(`[PAIR FALLBACK] User by ws:`, userByWs ? {status: userByWs.status, candidate: userByWs.candidate} : 'not found');
        if (userByWs && userByWs.candidate) {
          console.log(`[PAIR FALLBACK] Using candidate from userData (by ws): ${userId} -> ${userByWs.candidate}`);
          return userByWs.candidate;
        }
        
        // Если не найден по ws, ищем любого активного пользователя
        for (const [_, userData] of userMap) {
          console.log(`[PAIR FALLBACK] Checking user: status=${userData.status}, candidate=${userData.candidate}`);
          if (userData.status !== 'idle' && userData.candidate) {
            console.log(`[PAIR FALLBACK] Using candidate from active user: ${userId} -> ${userData.candidate}`);
            return userData.candidate;
          }
        }
      }
  
      return null;
  
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

        console.log('[SIZE]: ', users[userId].size)
        if(users[userId].size <= 1) {
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
    sendBroadcast(`[WIATING USER ID]: ${candidateId}`)
    waitingList[candidateId] = {...data, addedAt: Date.now()}
    sendBroadcast(`[PUSHING USER]: ${JSON.stringify(waitingList[candidateId])}`)
    sendBroadcast(`[WAITING LIST LENGTH]: ${Object.keys(waitingList).length}`)

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
    // console.log('LIST: ', Array.from(sender).filter(([_, user]) => user.status !== 'idle'))
    if(user && user.length) return user[1]
    else return false
  } catch (err) {
    console.log(err)
    return false
  }
}

/**
 * Получает активного пользователя по userId, независимо от WebSocket
 * Приоритет: не idle статус > любой доступный пользователь
 * 
 * @param {string} userId - ID пользователя
 * @returns {Object|null} - данные активного пользователя или null
 */
export const getActiveUser = (userId) => {
  try {
    const userMap = users[userId];
    if (!userMap || userMap.size === 0) return null;

    // Сначала ищем пользователя с активным статусом (не idle)
    for (const [ws, userData] of userMap) {
      if (userData.status !== 'idle') {
        return userData;
      }
    }

    // Если нет активных, возвращаем любого доступного
    const firstUser = Array.from(userMap.values())[0];
    return firstUser || null;
  } catch (err) {
    console.log('getActiveUser error:', err);
    return null;
  }
}

/**
 * Получает пользователя по userId и WebSocket (с fallback на активного пользователя)
 * 
 * @param {string} userId - ID пользователя  
 * @param {WebSocket} ws - WebSocket соединение
 * @returns {Object|null} - данные пользователя или null
 */
export const getUserByWs = (userId, ws) => {
  try {
    const userMap = users[userId];
    if (!userMap || userMap.size === 0) {
      console.log(`[getUserByWs] No userMap for ${userId}`);
      return null;
    }

    // Сначала пытаемся найти по конкретному WebSocket
    const userByWs = userMap.get(ws);
    if (userByWs) {
      console.log(`[getUserByWs] Found user by ws: ${userId}, status=${userByWs.status}, candidate=${userByWs.candidate}`);
      
      // FALLBACK: Если candidate undefined, но есть пара в pairOfPeers - восстанавливаем
      if (!userByWs.candidate && pairOfPeers[userId]) {
        console.log(`[getUserByWs] Restoring candidate from pairOfPeers: ${userId} -> ${pairOfPeers[userId]}`);
        userByWs.candidate = pairOfPeers[userId];
      }
      
      return userByWs;
    }

    // Если не найден по ws, возвращаем активного пользователя
    console.log(`[getUserByWs] User not found by ws, trying getActiveUser for ${userId}`);
    const activeUser = getActiveUser(userId);
    console.log(`[getUserByWs] Active user:`, activeUser ? {status: activeUser.status, candidate: activeUser.candidate} : 'not found');
    return activeUser;
  } catch (err) {
    console.log('getUserByWs error:', err);
    return null;
  }
}

export const updateStatus = (ws, status = 'idle', userId = '0') => {
  try {
    // Используем новую функцию для получения пользователя
    const user = getUserByWs(ws.userId ?? userId, ws);
    if (user) {
      user.status = status;
    } else {
      throw new Error('User not found for status update');
    }
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