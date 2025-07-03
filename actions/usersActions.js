import { handleException } from "../logger/sendError.js"
import { users } from "../users/index.js"



export const handleAddUser = ({ws, userId, name, photo = ""}) => {
    try {

        if(!userId) throw new Error("<b>userId</b> is required")

        if(userId) {
            users[userId] = ws;
            users[userId].name = name;
            users[userId].candidateIce = null;
            users[userId].muted = false;
            users[userId].statusConnect = 'active'
            users[userId].photo = photo
            users[userId].streamIds = {};
            ws.userId = userId
        }
    } catch(err) {
       handleException(ws, 'ADD_USER', err, {userId, name})
    }
}