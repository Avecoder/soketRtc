
/**
 * Отправка сообщений на клиент
 * Экспортируемые функции:
 * - sendMessage
 */


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
    const sendedData = JSON.stringify({type: route.split('/')[1], ...data})
    console.log(sendedData)
    sender.send(sendedData)
}