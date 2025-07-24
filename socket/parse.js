import { routes } from "../routes.js";


/**
 * @param {Buffer | string} data 
 * @returns {Object} 
 */



export const parseMessage = (data) => {
    try {

      const { route, ...somethingData } = JSON.parse(data.toString());

      // console.log(`[DATA]: ${JSON.stringify(somethingData)}`)
      
      return { currAction: routes[route], ...somethingData };
    } catch (err) {
      console.error('Parse error - ', err);
      return () => {};
    } 
};