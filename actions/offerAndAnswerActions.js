import { handleException } from "../logger/sendError.js"
import { broadcast } from "../socket/broadcast.js";
import { sendMessage } from "../socket/send.js";
import { setPair, users, getPair, pairOfPeers, removePair } from "../users/index.js";




/**
 * Обрабатывает поступившее предложение (offer) для установления P2P-соединения между двумя пользователями.
 *
 * @param {Object} params
 * @param {WebSocket} params.ws - WebSocket отправителя (того, кто инициирует вызов).
 * @param {string} params.candidateId - ID пользователя, которому отправляется вызов.
 * @param {string} params.userId - ID пользователя, инициирующего вызов.
 * @param {Object} params.data - Дополнительные данные offer'а (SDP, флаги и т.д.).
 * @param {Boolean} params.isUpdate - Для обновления offer sdp
 */
export const handleOffer = ({ ws, candidateId, userId, isUpdate = false, ...data }) => {
    try {
        // Проверяем наличие обязательных параметров
        
        if (!userId) throw new Error("<b>userId</b> is required");
        let peer1 = users[userId]
        if (!peer1) throw new Error('User not found');

        let peer2 = null

        const checkPair = getPair({ws, userId})
        
        if(!isUpdate) {
            if (!candidateId) throw new Error("<b>candidateId</b> is required");
            // Получаем объекты пользователей        // вызывающий
              // принимающий вызов
            peer2 = users[candidateId]; 


            

            // Дополнительно проверяем, что оба пользователя найдены в системе
            
            if (!peer2) {
                // Если второй пользователь не найден — уведомляем первого, что кандидат недоступен
                sendMessage('/unavailable', ws, {})
                return;
            }
        } else {
            peer2 = users[checkPair];
            if(!peer2) throw new Error('Peer2 not found');
        }

        if(checkPair && !isUpdate) {
            sendMessage('/busy', ws)
            return;
        }

        if(isUpdate) {
            sendMessage('/updateOffer', peer2, {
                ...data
            })
            
        } else {
            peer1.candidate = candidateId;
            peer2.candidate = userId;

            sendMessage('/call', peer2, {
                ...data, // например, SDP offer, reconnect-флаг и т.п.
                userId,
                name: peer1.name, // имя вызывающего (раньше было offerUser — возможно, ошибка)
                photo: peer1.photo, // имя вызывающего (раньше было offerUser — возможно, ошибка)
                candidateId: userId
            });
        }
        // Устанавливаем ссылки на кандидатов друг у друга
        

        sendMessage('/remoteStreamsId', peer2, {streamIds: peer1.streamIds})

    } catch (err) {
        // Обрабатываем ошибку через централизованную функцию логирования
        handleException(ws, 'OFFER', err, data);
    }
};



/**
 * Обрабатывает отклонение вызова пользователем.
 * Отправляет сообщение инициатору вызова о том, что другой пользователь отказался.
 *
 * @param {Object} params
 * @param {WebSocket} params.ws - WebSocket текущего пользователя (для логирования ошибок).
 * @param {string} params.userId - ID пользователя, который отклоняет вызов.
 */
export const handleDecline = ({ ws, userId }) => {
    try {
        if (!userId) throw new Error('userId is required');

        const peer2 = users[userId];
        if (!peer2) throw new Error('Peer2 user not found');

        const peer1 = users[peer2.candidate];
        if (!peer1) throw new Error('Offer user not found');

        const checkPair = getPair({ws, userId})
        // Отправляем инициатору вызова сообщение об отклонении
        if(checkPair) {
            sendMessage('/decline', peer1, { name: peer2.name });
        }
        removePair({ ws, userId })
    } catch (err) {
        handleException(ws ?? users[userId]?.ws ?? null, 'DECLINE', err, {});
    }
};



/**
 * Обрабатывает ответ (answer) на offer от пользователя и завершает установку P2P-соединения.
 *
 * @param {Object} params
 * @param {RTCSessionDescriptionInit} params.answer - SDP answer от пользователя.
 * @param {string} params.userId - ID пользователя, отправившего answer.
 * @param {Boolean} params.isUpdate - Для обновления answer sdp
 */
export const handleAnswer = ({ answer, userId, ws, isUpdate }) => {
    try {
        // Получаем пользователя, который отправил answer
        if(!userId) throw new Error('userId not found')
        const peer2 = users[userId];

        const candidateId = peer2?.candidate
        if(!candidateId) throw new Error('candidateId not found')

        // Получаем пользователя, который изначально отправил offer (то есть кандидат)
        const peer1 = users[candidateId];

        // Проверяем, что оба пользователя существуют
        if (!peer2) throw new Error('Peer2 not found');
        if (!peer1) throw new Error('Peer1 not found');

        sendMessage('/remoteStreamsId', peer1, {streamIds: peer2.streamIds})
        

        if(isUpdate) {
            sendMessage('/updateAnswer', peer1, {answer})
            broadcast({ userId, type: '/updateIce' });
        } else {
            setPair({userId, candidateId, ws})
            sendMessage('/acceptCall', peer1, {answer})
            // Рассылаем другим участникам (если нужно), что соединение установлено
            broadcast({ userId, type: '/connect' });
        }
        
        
    } catch (err) {
        // Обрабатываем ошибку централизованно
        handleException(users[userId]?.ws ?? null, 'ANSWER', err, {});
    }
};


