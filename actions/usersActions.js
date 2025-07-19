import { handleException } from "../logger/sendError.js"
import { users } from "../users/index.js"



export const handleAddUser = ({ ws, userId, name, photo = "", device = 'mobile' }) => {
    try {
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
            candidateIce: null,
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

    } catch (err) {
        handleException(ws, 'ADD_USER', err, { userId, name });
    }
};



