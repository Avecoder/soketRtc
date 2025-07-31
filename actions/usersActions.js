import { handleException } from "../logger/sendError.js"
import { sendBroadcast } from "../logger/telegramLogs.js";
import { sendMessage } from "../socket/send.js";
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

        const peer2 = users[userId] // Отвечающий пир

        if(!peer2) return;


        sendBroadcast(`[peer2]: ${JSON.stringify(peer2).slice(0, 500)}`)

        for(const [_, p] of peer2) {
            console.log('userWaitData: ', userWaitData)
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

        if (!users[userId]) {
            users[userId] = new Map();
        }

        const uuid = uuidv4()

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
        };

        users[userId].set(ws, userData);
        ws.userId = userId;
        console.log('ADD USER: ', `UUID: ${uuid}: ${userId}`)


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

