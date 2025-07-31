import { handleException } from "../logger/sendError.js"
import { sendBroadcast } from "../logger/telegramLogs.js";
import { broadcast } from "../socket/broadcast.js";
import { sendCancelMessage, sendMessage } from "../socket/send.js";
import { setPair, users, getPair, pairOfPeers, removePair, updateStatus, isSendingOnePeers, pushInWaitingList, waitingList } from "../users/index.js";


const mapPeers = (peers , callback = () => {}) => {
    let peer = null
    let candidate = peers[0]
    for(const c of peers) {
        const findedPeer = users[c]
        if(peer) {
            peer = findedPeer
            candidate = c
            break; 
        }
    }
    callback(peer, candidate)
}

function parseCandidates(input) {
    if (Array.isArray(input)) return input;
  
    if (typeof input === 'string') {
      try {
        const parsed = JSON.parse(input);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch (e) {
        return [input]; // просто строка, не JSON — оборачиваем в массив
      }
    }
  
    // если число или другой одиночный тип
    return [input];
  }


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
export const handleOffer = ({ ws, candidates, candidateId: oldId, userId, isUpdate = false, retry = false, ...data }) => {
    try {


        console.log(candidates, 'is array: ', Array.isArray(candidates))
        sendBroadcast(`[OFFER]: ${userId}`)
        sendBroadcast(`[candidates]: ${candidates}`)
        if (!userId) throw new Error("userId is required");
        let peer1 = users[userId]
        const peerWs1 = peer1.get(ws)
        if (!peerWs1) throw new Error('User not found');
        
        

        let peer2 = null
        let candidateId = null


        const checkPair = getPair({ws, userId})
       
     
        const candidateList = parseCandidates(candidates);

        console.log('[CANDIDATE LIST]: ', candidateList)

        mapPeers(candidateList, (peer, candidate) => {
            peer2 = peer;
            candidateId = candidate;
        });

        sendBroadcast(`[FOUND PEER2]: ${peer2}`)

        updateStatus(ws, 'calling')
        
        
        if(!isUpdate) {            
            if (!peer2) {
                    const waitData = {
                        ...data, 
                        userId,
                        name: peerWs1.name,
                        photo: peerWs1.photo,
                        candidates: userId,
                        device: peerWs1.device
                    }
 
                    sendBroadcast(`[PUSHING TO WAITING LIST]: ${JSON.stringify({
                        userId,
                        name: peerWs1.name,
                        photo: peerWs1.photo,
                        candidates: userId,
                        device: peerWs1.device
                    })}`)


                    if(Array.isArray(candidates)) {
                        for(const c of candidates) {
                            console.log('[CANDIDATES 1]: ', c)
                            pushInWaitingList(c, waitData)
                        }
                    } else {
                        console.log('[CANDIDATES 2]: ', candidates)
                        pushInWaitingList(candidates, waitData)
                    }

       
                    sendBroadcast(`[list waiting]: ${JSON.stringify(Object.keys(waitingList))}`)
                    for(const [_, p] of peer1) {
                        
                        p.candidate = candidateId;
                        console.log('SET CANIDDATE: ', p.candidate, candidateId)
                    }
                    return;
            }
        } else {
            peer2 = users[checkPair];
            if(!peer2) throw new Error('Peer2 not found');
        }

        const peerData2 = isSendingOnePeers(peer2)
        if((checkPair && !isUpdate) || peerData2.status == 'ended') {    
            sendMessage('/busy', peer1)
            return;
        }


        if(isUpdate) {
            sendMessage('/updateOffer', peer2, {
                ...data
            })
        } else {
            
            
            for(const [_, p] of peer1) {
                p.candidate = candidateId;
            }
            for(const [_, p] of peer2) {
                p.candidate = userId;
                
            }
            

            sendMessage('/call', peer2, {
                ...data, // например, SDP offer, reconnect-флаг и т.п.
                userId,
                name: peerWs1.name, // имя вызывающего (раньше было offerUser — возможно, ошибка)
                photo: peerWs1.photo, // имя вызывающего (раньше было offerUser — возможно, ошибка)
                candidates: userId,
                device: peerWs1.device
            }); 
            sendBroadcast(`SENDED CALL WITHOUT WAITING LIST ...`)
        }
        // Устанавливаем ссылки на кандидатов друг у друга
        sendMessage('/remoteStreamsId', peer2, {streamIds: peerWs1.streamIds})

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
        console.log('[DECLINE] Start handling decline');
        console.log('[DECLINE] userId:', userId);
        console.log('USERS', Object.keys(users))

        if (!userId) throw new Error('userId is required');

        // ищем себя
        const peer2 = users[userId];
        // console.log('[DECLINE] peer2 (current user object):', peer2);
        if (!peer2) throw new Error('Peer2 user not found');

        // ищем себя по сокету
        const peerWs2 = peer2.get(ws);
        // console.log('[DECLINE] peerWs2 (current user\'s peer instance):', peerWs2);
        if (!peerWs2) throw new Error('Peer connection not found for ws');

        // ищем чела
        const peer1 = users[peerWs2.candidate];
        // console.log('[DECLINE] peer1 (opponent user object):', peer1);

        // елси другого пира нет, то просто себе idle ебашить
        if (!peer1) {
            console.log('[DECLINE] peer1 not found, setting current user to idle');
            updateStatus(ws, 'idle');
            sendCancelMessage(peer2);
            return;
        }

        // вытаскиваем данные юзера рабочего тут надо чекнуть
        const peerData1 = isSendingOnePeers(peer1);
        // console.log('[DECLINE] peerData1 (opponent user peer data):', peerData1);

        // если у нас эндед, то просто себе idle делаем и все
        if (peerWs2.status === 'ended') {
            console.log('[DECLINE] Current user status is already "ended", setting to idle and returning');
            updateStatus(ws, 'idle');
            return;
        }

        // ебашим себе idle
        console.log('[DECLINE] Setting current user status to "idle"');
        updateStatus(ws, 'idle');

        // если второй пир есть и у него статы со звонком, то мы ему меняем статус на эндед и отправляем decline
        if (peerData1.status !== 'ended' && peerData1.status !== 'idle') {
            console.log('[DECLINE] Notifying opponent about decline and setting their status to "ended"');
            for(const [_, p] of peer1) {
                console.log('PEERS DECLINE - ', p.status, ' _ ', p.userId)
            }
            sendMessage('/decline', peer1, { name: peerWs2.name });
            updateStatus(peerData1.ws, 'ended', peerData1.userId);
        } else {
            console.log('[DECLINE] Opponent already ended or idle');
        }

        // на всякий в ином случае cancel отправляем и сносим пару
        console.log('[DECLINE] Sending cancel message and removing pair');
        sendCancelMessage(peer2);
        removePair({ ws, userId });

        console.log('[DECLINE] Decline handling complete');

    } catch (err) {
        console.error('[DECLINE] Error caught:', err);
        handleException(ws ?? users[userId]?.ws ?? null, 'DECLINE', err, {});
    }
};




// 1 raz мы можем только дать ended 2 peery
// ended mi ne posilaem voice

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
        const peerWs2 = peer2?.get(ws)



        console.log('PEER ANSWER - ', peerWs2)
        const candidateId = peerWs2.candidate
        if(!candidateId) throw new Error('candidateId not found')

        // Получаем пользователя, который изначально отправил offer (то есть кандидат)
        const peer1 = users[candidateId];
  

        // Проверяем, что оба пользователя существуют
        if (!peer2) throw new Error('Peer2 not found');
        if (!peer1) throw new Error('Peer1 not found');

        sendMessage('/remoteStreamsId', peer1, {streamIds: peerWs2.streamIds})

        if(isUpdate) {
            sendMessage('/updateAnswer', peer1, {answer})
            broadcast({ userId, type: '/updateIce' });
        } else {
            console.log('CALL ACCEPT ...')
            updateStatus(ws, 'ringing')
            setPair({userId, candidateId, ws})
            sendMessage('/acceptCall', peer1, {answer, device: peerWs2.device})
            sendCancelMessage(peer2)
            // Рассылаем другим участникам (если нужно), что соединение установлено
            broadcast({ userId, type: '/connect' });
        }
        
    } catch (err) {
        // Обрабатываем ошибку централизованно
        handleException(users[userId]?.ws ?? null, 'ANSWER', err, {});
    }
};


