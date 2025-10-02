import { handleException } from "../logger/sendError.js"
import { sendBroadcast } from "../logger/telegramLogs.js";
import { sendCancelMessage, sendMessage } from "../socket/send.js";
import { users, getFromWaitingList, removeFromWaitingList, waitingList } from "../users/index.js"
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

        console.log('[ACTION]: ', userWaitData?.action)
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
        console.log('[checkExistUserInWaitingList]: ', err)
    }
}


export const handleAddUser = ({ ws, userId, name, photo = "", device = 'mobile' }) => {
    try {
        console.log('[ADD_USER]: ', userId) 
        if (!userId) throw new Error("<b>userId</b> is required");

        // Проверяем, есть ли уже активная сессия этого пользователя
        const existingUserMap = users[userId];
        let isReconnect = false;
        let existingUserData = null;

        if (existingUserMap && existingUserMap.size > 0) {
            // Находим активную сессию (не idle или с активным звонком)
            for (const [oldWs, userData] of existingUserMap) {
                if (userData.status !== 'idle' || userData.candidate) {
                    existingUserData = userData;
                    isReconnect = true;
                    console.log(`[RECONNECT DETECTED] User ${userId} reconnecting with status: ${userData.status}`);
                    sendBroadcast(`🔄 [RECONNECT] User ${userId} reconnecting during ${userData.status} status`);
                    
                    // Удаляем старое соединение
                    existingUserMap.delete(oldWs);
                    break;
                }
            }
        }

        if (!users[userId]) {
            users[userId] = new Map();
        }

        const uuid = uuidv4()

        let userData;
        
        if (isReconnect && existingUserData) {
            // Восстанавливаем сессию - сохраняем все данные, только меняем ws
            userData = {
                ...existingUserData,
                ws, // Новый WebSocket
                uuid, // Новый UUID для отслеживания
                name: name || existingUserData.name, // Обновляем имя если передано
                photo: photo || existingUserData.photo, // Обновляем фото если передано
                device: device || existingUserData.device, // Обновляем устройство если передано
            };
            
            console.log(`[SESSION RESTORED] User ${userId}: status=${userData.status}, candidate=${userData.candidate}`);
            sendBroadcast(`✅ [SESSION RESTORED] User ${userId} session restored with status: ${userData.status}`);
        } else {
            // Новая сессия
            userData = {
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
            };
        }

        users[userId].set(ws, userData);
        ws.userId = userId;
        console.log('ADD USER: ', `UUID: ${uuid}: ${userId} (reconnect: ${isReconnect})`)

        // Если это переподключение во время активного звонка, уведомляем собеседника
        if (isReconnect && userData.candidate && (userData.status === 'in_call' || userData.status === 'ringing')) {
            const candidateUser = users[userData.candidate];
            if (candidateUser) {
                sendMessage('/peerReconnected', candidateUser, { 
                    userId, 
                    name: userData.name,
                    status: userData.status 
                });
                console.log(`[PEER NOTIFIED] Notified ${userData.candidate} about ${userId} reconnection`);
            }
        }

        checkExistUserInWaitingList(userId)

    } catch (err) {
        handleException(ws, 'ADD_USER', err, { userId, name });
    }
};

function getCurrentTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

setInterval(() => {
    console.log(`[ALL USERS] ${getCurrentTime()} :`, JSON.stringify(Object.keys(users)))
    console.log(`[WAITING USERS] ${getCurrentTime()} :`, JSON.stringify(Object.keys(waitingList)))
}, 5000)

