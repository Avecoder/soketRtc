import { handleException } from "../logger/sendError.js"



export const users = {}
export const pairOfPeers = {}


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

        delete users[userId];

        return true
      } catch (err) {
        handleException(ws, 'REMOVE_USER', `problem removing user: ${err.message}`, {});
        return false
      }
}