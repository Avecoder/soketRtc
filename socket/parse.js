import { routes } from "../routes.js";


/**
 * @param {Buffer | string} data 
 * @returns {Object} 
 */



export const parseMessage = (data, ws) => {
    try {
      const messageStr = data.toString();
      
      // Проверяем, является ли сообщение простой строкой PING
      if (messageStr === 'PING') {
        ws.lastPingTime = Date.now(); // Обновляем время последнего ping
        return { currAction: routes['PING'], ws };
      }

      const { route, ...somethingData } = JSON.parse(messageStr);

      // console.log(`[DATA]: ${JSON.stringify(somethingData)}`)
      
      return { currAction: routes[route], ...somethingData };
    } catch (err) {
      console.error('Parse error - ', err);
      return () => {};
    } 
};