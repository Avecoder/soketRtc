import { users } from "../users/index.js";
import { handleException } from "../logger/sendError.js";
import { sendMessage } from "../socket/send.js";


/**
 * Рассылает сообщение пользователю и его кандидату (собеседнику).
 *
 * @param {Object} params
 * @param {string} params.userId - ID пользователя, от имени которого инициируется рассылка.
 * @param {string} params.type - Тип события (например: 'connect', 'update').
 * @param {Object} [params.data={}] - Дополнительные данные, передаваемые в сообщении.
 * @param {WebSocket} [params.ws] - WebSocket для логирования ошибок (необязателен).
 */
export const broadcast = ({ userId, type, data = {} }) => {
    try {
        if (!userId) throw new Error('UserId is required');

        const me = users[userId];
        if (!me) throw new Error('Me not found');

        const candidate = users[me.candidate];
        if (!candidate) throw new Error('Candidate not found');

        sendMessage(type, me, data);
        sendMessage(type, candidate, data);
    } catch (err) {
        handleException(users[userId]?.ws, 'broadcast', err, data);
    }
};
