import { handleException } from "../logger/sendError.js";
import { sendMessage } from "../socket/send.js";
import { isSendingOnePeers, updateStatus, users } from "../users/index.js"




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
        const user = users[ws.userId].get(ws)
        // Сохраняем ICE параметры в объект пользователя
        user.iceParams = iceParams;
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
        const iceFirstUser = users[userId]

        const iceFirstUserData = iceFirstUser.get(ws)



        // Получаем ID второго пользователя, с которым первый состоит в паре
        const iceSecondUserId = iceFirstUserData.candidate;

        // Проверяем, что ID второго пользователя существует
        if (!iceSecondUserId) throw new Error('<b>userId</b> of the second user not found');

        // Получаем объект второго пользователя
        const iceSecondUser = users[iceSecondUserId];
        const iceSecondUserData = isSendingOnePeers(iceSecondUser)

        // Проверяем, что объекты пользователей существуют
        if (!iceFirstUserData) throw new Error('First user was not found');
        if (!iceSecondUserData) throw new Error('Second user was not found');


        // Обмениваемся ICE-кандидатами: у первого берем iceParams второго и наоборот
        iceFirstUser.get(ws).candidateIce = iceSecondUserData?.iceParams || null;
        iceSecondUserData.candidateIce = iceFirstUser.get(ws)?.iceParams || null;
        updateStatus(ws, 'in_call')

        // Отправляем каждому пользователю его новый набор ICE-кандидатов
        sendMessage('/swapIce', iceFirstUser, { iceCandidates: iceFirstUserData.candidateIce });
        sendMessage('/swapIce', iceSecondUser, { iceCandidates: iceSecondUserData.candidateIce });
    } catch (err) {
        console.log(`USER_ID: [${userId}]: `, userId, err)
        // В случае ошибки вызываем обработчик исключений, передавая контекст и ошибку
        handleException(ws, 'SWAP_ICE', err, { id: userId, candidateId: iceFirstUser?.candidate });
    }
};
