import { handleException } from "../logger/sendError.js"
import { sendBroadcast } from "../logger/telegramLogs.js";
import { sendCancelMessage, sendMessage } from "../socket/send.js";
import { users, getFromWaitingList, removeFromWaitingList, waitingList, setPair, preservedUserData, pairOfPeers } from "../users/index.js"
import { v4 as uuidv4 } from 'uuid';



const checkExistUserInWaitingList = (userId) => {
    try {

        sendBroadcast(`[userId]: ${userId}`)


        sendBroadcast(`[list waiting]: ${JSON.stringify(Object.keys(waitingList))}`)


        sendBroadcast(`[list users]: ${JSON.stringify(Object.keys(users))}`)

        const userWaitData = getFromWaitingList({userId});


        if(!userWaitData) return;

        sendBroadcast(`[userWaitData]: ${JSON.stringify(userWaitData).slice(0, 500)}`)

        const peer2 = users[userId] 

        if(!peer2) return;

        if(userWaitData?.action == 'cancel') {
            sendCancelMessage(peer2);
            removeFromWaitingList({userId})
            return;
        }

        


        sendBroadcast(`[peer2]: ${JSON.stringify(peer2).slice(0, 500)}`)

        for(const [_, p] of peer2) {

            p.candidate = userWaitData.candidates;

   
        }

        
        sendMessage('/call', peer2, {
            ...userWaitData
        });

        sendBroadcast(`SENDED CALL ...`)

        removeFromWaitingList({userId})
    } catch (err) {
    }
}


/**
 * Обработчик реконнекта пользователя
 * Вызывается когда ping-pong не работает и нужно восстановить сессию
 */
export const handleReconnect = ({ ws, userId, name, photo = "", device = 'mobile' }) => {
    try {
        console.log('[RECONNECT]: ', userId);
        
        if (!userId) throw new Error("<b>userId</b> is required");

        // Проверяем, есть ли существующая сессия пользователя
        const existingUserMap = users[userId];
        if (!existingUserMap || existingUserMap.size === 0) {
            throw new Error(`No existing session found for user ${userId}`);
        }

        // Очищаем мертвые соединения
        let activeUserData = null;
        for (const [oldWs, userData] of existingUserMap) {
            if (oldWs.readyState === 1) {
                // Находим активную сессию (не idle или с кандидатом)
                if (userData.status !== 'idle' || userData.candidate) {
                    activeUserData = userData;
                    break;
                }
            } else {
                // Удаляем мертвые соединения
                existingUserMap.delete(oldWs);
            }
        }

        if (!activeUserData) {
            throw new Error(`No active session found for user ${userId}`);
        }

        // Создаем новую сессию на основе существующей
        const uuid = uuidv4();
        const userData = {
            ...activeUserData,
            ws, // Новый WebSocket
            uuid, // Новый UUID
            name: name || activeUserData.name,
            photo: photo || activeUserData.photo,
            device: device || activeUserData.device,
        };

        // Добавляем новое соединение
        existingUserMap.set(ws, userData);
        ws.userId = userId;

        console.log(`[RECONNECT SUCCESS] User ${userId} reconnected with status: ${userData.status}`);

        // Отправляем подтверждение реконнекта
        ws.send(JSON.stringify({
            type: 'reconnectSuccess',
            status: userData.status,
            candidate: userData.candidate,
            message: 'Session restored successfully'
        }));

        // Если есть кандидат, уведомляем его о реконнекте
        if (userData.candidate) {
            const candidateMap = users[userData.candidate];
            if (candidateMap) {
                sendMessage('/peerReconnected', candidateMap, {
                    userId: userId,
                    name: userData.name,
                    status: userData.status
                });
            }
        }

    } catch (err) {
        console.log(`[RECONNECT ERROR] User ${userId}:`, err.message);
        
        // Если реконнект не удался, отправляем ошибку
        ws.send(JSON.stringify({
            type: 'reconnectError',
            error: err.message,
            suggestion: 'Try ADD_USER instead'
        }));
        
        handleException(ws, 'RECONNECT', err, { userId, name, photo, device });
    }
};

export const handleAddUser = ({ ws, userId, name, photo = "", device = 'mobile' }) => {
    try {
        if (!userId) throw new Error("<b>userId</b> is required");

        // Проверяем, есть ли уже активная сессия этого пользователя
        const existingUserMap = users[userId];
        if (existingUserMap && existingUserMap.size > 0) {
            // Очищаем мертвые соединения
            let activeCount = 0;
            for (const [oldWs, userData] of existingUserMap) {
                if (oldWs.readyState === 1) {
                    activeCount++;
                } else {
                    existingUserMap.delete(oldWs);
                }
            }
            
            // Если есть активные соединения, отклоняем новое подключение
            if (activeCount > 0) {
                sendBroadcast(`⚠️ [DUPLICATE] User ${userId} already has ${activeCount} active connections`);
                ws.send(JSON.stringify({
                    type: 'userExists',
                    message: `User ${userId} already connected. Use RECONNECT instead.`,
                    activeConnections: activeCount
                }));
                return;
            }
        }

        // Если нет существующего пользователя, создаем новый Map
        if (!users[userId]) {
            users[userId] = new Map();
        }

        const uuid = uuidv4();

        // Создаем новую сессию
        const userData = {
            ws,
            userId,
            name,
            photo,
            device,
            candidateIce: [],
            iceParams: [],
            muted: false,
            status: 'idle', 
            uuid, 
            // idle - Пользователь не в звонке
            // calling - Исходящий вызов (ожидает ответа)
            // ringing - Входящий вызов (ожидает ответа)
            // in_call - Пользователь в активном звонке
            // ended - Звонок завершился, но еще не сброшено состояние
            streamIds: {},
            isReady: false, // Новая сессия - нужна задержка
        };

        users[userId].set(ws, userData);
        ws.userId = userId;
        
        // Добавляем задержку перед готовностью для новых пользователей
        setTimeout(() => {
            const currentUserData = users[userId]?.get(ws);
            if (currentUserData) {
                currentUserData.isReady = true;
                sendBroadcast(`✅ [USER READY] User ${userId} is ready to receive messages`);
            }
        }, 1000); // 1 секунда задержки для новых пользователей

        // Отправляем подтверждение подключения
        ws.send(JSON.stringify({
            type: 'userAdded',
            userId: userId,
            status: userData.status,
            message: 'New user added successfully'
        }));

        sendBroadcast(`✅ [USER ADDED] User ${userId} added with status: ${userData.status}`);

        checkExistUserInWaitingList(userId);

    } catch (err) {
        handleException(ws, 'ADD_USER', err, { userId, name, photo, device });
    }
};

function getCurrentTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

// setInterval(() => {
// }, 5000)


