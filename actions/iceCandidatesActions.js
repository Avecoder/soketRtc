import { handleException } from "../logger/sendError.js";
import { sendMessage } from "../socket/send.js";
import { users } from "../users/index.js"




/**
 * Обрабатывает ICE-кандидаты от пользователя и сохраняет их в объекте пользователя.
 *
 * @param {Object} params
 * @param {WebSocket & { userId?: string }} params.ws - WebSocket текущего пользователя с привязанным `userId`.
 * @param {Object} params.iceParams - Параметры ICE (например, ICE-кандидаты).
 */
export const handleAddIce = ({ ws, iceParams = [] }) => {
    try {
        if (!ws?.userId) throw new Error('ws.userId is missing');

        // Сохраняем ICE параметры в объект пользователя
        users[ws.userId].iceParams = iceParams;
    } catch (err) {
        handleException(ws, 'ADD_ICE', err, { iceParams });
    }
};


/**
 * Обменивается ICE-кандидатами между двумя пользователями, которые состоят в паре.
 *
 * @param {Object} params
 * @param {string} params.userId - ID пользователя, инициирующего обмен ICE.
 * @param {WebSocket} params.ws - WebSocket текущего пользователя (для обработки ошибок).
 */
export const handleSwap = ({ userId, ws }) => {
    try {
        // Проверяем, что userId передан
        if (!userId) throw new Error('<b>userId</b> is required');

        // Получаем объект первого пользователя из списка пользователей по userId
        const iceFirstUser = users[userId];

        // Получаем ID второго пользователя, с которым первый состоит в паре
        const iceSecondUserId = iceFirstUser.candidate;

        // Проверяем, что ID второго пользователя существует
        if (!iceSecondUserId) throw new Error('<b>userId</b> of the second user not found');

        // Получаем объект второго пользователя
        const iceSecondUser = users[iceSecondUserId];

        // Проверяем, что объекты пользователей существуют
        if (!iceFirstUser) throw new Error('First user was not found');
        if (!iceSecondUser) throw new Error('Second user was not found');

        // Обмениваемся ICE-кандидатами: у первого берем iceParams второго и наоборот
        iceFirstUser.candidateIce = iceSecondUser?.iceParams || null;
        iceSecondUser.candidateIce = iceFirstUser?.iceParams || null;

        // Отправляем каждому пользователю его новый набор ICE-кандидатов
        sendMessage('/swapIce', iceFirstUser, { iceCandidates: iceFirstUser.candidateIce });
        sendMessage('/swapIce', iceSecondUser, { iceCandidates: iceSecondUser.candidateIce });
    } catch (err) {
        // В случае ошибки вызываем обработчик исключений, передавая контекст и ошибку
        handleException(ws, 'SWAP_ICE', err, { id: userId, candidateId: iceFirstUser?.candidate });
    }
};
