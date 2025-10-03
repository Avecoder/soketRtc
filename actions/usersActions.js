import { handleException } from "../logger/sendError.js"
import { sendBroadcast } from "../logger/telegramLogs.js";
import { sendCancelMessage, sendMessage } from "../socket/send.js";
import { users, getFromWaitingList, removeFromWaitingList, waitingList, setPair } from "../users/index.js"
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
                console.log(`[RECONNECT CHECK] User ${userId}: status=${userData.status}, candidate=${userData.candidate}`);
                if (userData.status !== 'idle' || userData.candidate) {
                    existingUserData = userData;
                    isReconnect = true;
                    console.log(`[RECONNECT DETECTED] User ${userId} reconnecting with status: ${userData.status}, candidate: ${userData.candidate}`);
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

        // Если это переподключение во время активного звонка, восстанавливаем связи и уведомляем собеседника
        console.log(`[RECONNECT LOGIC] isReconnect=${isReconnect}, candidate=${userData.candidate}, status=${userData.status}`);
        if (isReconnect && userData.candidate && (userData.status === 'in_call' || userData.status === 'ringing' || userData.status === 'calling')) {
            const candidateId = userData.candidate;
            const candidateUser = users[candidateId];
            
            console.log(`[PAIR RESTORE] Starting restoration for ${userId} -> ${candidateId}`);
            console.log(`[PAIR RESTORE] Candidate user exists:`, !!candidateUser);
            
            if (candidateUser) {
                // Восстанавливаем глобальную пару в pairOfPeers
                console.log(`[PAIR RESTORE] Restoring global pair: ${userId} <-> ${candidateId}`);
                setPair({ userId, candidateId, ws });

                // Восстанавливаем обратную связь у партнера
                for (const [_, partnerData] of candidateUser) {
                    console.log(`[PAIR RESTORE] Checking partner: status=${partnerData.status}, candidate=${partnerData.candidate}`);
                    if (partnerData.candidate === userId) {
                        // Связь уже есть, все ок
                        console.log(`[LINK OK] Link from ${candidateId} to ${userId} already exists`);
                        break;
                    } else if (!partnerData.candidate || partnerData.status !== 'idle') {
                        // Восстанавливаем связь
                        partnerData.candidate = userId;
                        console.log(`[LINK RESTORED] Restored link from ${candidateId} to ${userId}`);
                        break;
                    }
                }

                sendMessage('/peerReconnected', candidateUser, { 
                    userId, 
                    name: userData.name,
                    status: userData.status 
                });
                console.log(`[PEER NOTIFIED] Notified ${candidateId} about ${userId} reconnection`);
            } else {
                console.warn(`[PAIR RESTORE WARNING] Candidate user ${candidateId} not found for ${userId}`);
            }
        } else {
            console.log(`[RECONNECT LOGIC] Skipping restoration: isReconnect=${isReconnect}, candidate=${userData.candidate}, status=${userData.status}`);
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

