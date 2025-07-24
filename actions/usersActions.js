import { handleException } from "../logger/sendError.js"
import { sendMessage } from "../socket/send.js";
import { users, getFromWaitingList, removeFromWaitingList, waitingList } from "../users/index.js"



const checkExistUserInWaitingList = (userId) => {
    try {
        console.log('[userId]: ',userId)
        console.log('[list waiting]:', JSON.stringify(Object.keys(waitingList)))
        console.log('[list users]:', JSON.stringify(Object.keys(users)))

        const userWaitData = getFromWaitingList({userId});
        console.log('[userWaitData]: ', userWaitData)
        

        if(!userWaitData) return;

        const peer2 = users[userId] // Отвечающий пир
        console.log('[peer2]: ', peer2)

        for(const [_, p] of peer2) {
            p.candidate = userWaitData.candidateId;
        }

        
        sendMessage('/call', peer2, {
            ...userWaitData
        });

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
            // idle - Пользователь не в звонке
            // calling - Исходящий вызов (ожидает ответа)
            // ringing - Входящий вызов (ожидает ответа)
            // in_call - Пользователь в активном звонке
            // ended - Звонок завершился, но еще не сброшено состояние
            streamIds: {},
        };

        users[userId].set(ws, userData);
        ws.userId = userId;
        // console.log(JSON.stringify(users[userId]))


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
}, 5000)

