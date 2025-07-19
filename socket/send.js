
/**
 * Отправка сообщений на клиент
 * Экспортируемые функции:
 * - sendMessage
 */

import { isSendingOnePeers } from "../users/index.js"


export const formData = (route = '/', data = {}) => JSON.stringify({type: route.split('/')[1], ...data})

/**
 * Отправляет сообщение по заданному маршруту через указанного отправителя.
 *
 * @param {string} route - Маршрут, по которому будет определён тип сообщения. По умолчанию '/'.
 * @param {Object} sender - Объект с методом `.send`, например WebSocket или любой другой транспорт.
 * @param {Object} [data={}] - Дополнительные данные, которые будут включены в сообщение.
 *
 * @example
 * sendMessage('/call', ws, { id: 123 });
 * // Отправит: { type: 'call', id: 123 }
 */
export const sendMessage = (route = '/', sender, data = {}) => {
    try {
        const sendedData = formData(route, data)
        const user = isSendingOnePeers(sender, route)
    

        if(user) {
            user.ws.send(sendedData)
        } else {
            for (const [_, value] of sender) {
                value.ws.send(sendedData)
            }
        }
        
    } catch(err) {
        console.log(`send error [${route}]: `, err)
    }
} 