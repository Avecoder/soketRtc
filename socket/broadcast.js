import { isSendingOnePeers, users } from "../users/index.js";
import { handleException } from "../logger/sendError.js";
import { formData } from "../socket/send.js";


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
        if(!userId) throw new Error('userId is required');

        
        const me = isSendingOnePeers(users[userId])
        if (!me) throw new Error('Me not found');

        const candidate = users[me.candidate];
        const candidateActive = isSendingOnePeers(candidate)

        if (!candidate) throw new Error('Candidate not found');

        me.ws.send(formData(type, data))
        candidateActive.ws.send(formData(type, data))

    } catch (err) {
        handleException(users[userId]?.ws, 'broadcast', err, data);
    }
};
