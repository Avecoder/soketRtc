import { v4 as uuidv4 } from 'uuid';
import {handleException} from './sendError.js' 

export const users = {}
const rooms = {

}


function getKeyByValue(object, value) {

}


const findUserInRooms = ({userId, ws}) => {
    try {
        if(!userId) throw new Error("userId is required")

        const currentUserId = userId;
        let userRoomId = null;
        for (const roomId in rooms) {
            if (rooms.hasOwnProperty(roomId)) {
                
                if (rooms[roomId][currentUserId]) {
                    userRoomId = roomId;
                    break;
                }
            }
        }
        return {userRoomId}
    } catch (err) {

        handleException(ws, 'broadcast', err, {userId})
    }
}

const handleOffer = ({ws, data}) => {
    try {
        const candidateId = data.candidateId
        if(!candidateId) throw new Error("candidateId is required")

        const userId = data.id
        if(!userId) throw new Error("userId is required")

        const candidateUser = users[candidateId]
        const offerUser = users[userId]

        if(!userId || !offerUser)  throw new Error('User not found');
        if(!candidateId || !candidateUser)  throw new Error('Candidate not found');

        offerUser.candidate = candidateId
        candidateUser.candidate = userId
        candidateUser.send(JSON.stringify({type: 'call', offer: {...data, userId, name: offerUser.name, candidateId: userId, isRecconect: data?.reconnect ?? false}}))  


    } catch(err) {

        handleException(ws, 'handleOffer', err, data)
    }
}

const handleDecline = ({ws, offerId}) => {
    try {

        if(!offerId) throw new Error("offerId is required")

        const offerUser = users[offerId]
        if(!offerUser) throw new Error("peer2 not found")

        const me = users[offerUser.candidate]
        if(!me) throw new Error("peer1 not found")

        me.send(JSON.stringify({type: 'decline', name: offerUser.name}))

    } catch(err) {

        handleException(ws, 'handleDecline', err, {offerId})
    }
}



const handleAnswer = ({answer, currentRoom, ws}) => {
    try {
        if(!answer) throw new Error("answer is required and must include the following fields: candidateId, id and answer spd")
        const {candidateId, id} = answer
        
        if(!candidateId) throw new Error("candidateId is required in answer")
        if(!id) throw new Error("id is required in answer")
        
        const offerUser = users[candidateId];
        if(!offerUser) throw new Error("peer1 not found")

        const me = users[id]
        if(!me) throw new Error("peer2 not found")


        const roomId = currentRoom ?? uuidv4()
        rooms[roomId] = {
            [offerUser.userId]: offerUser,
            [me.userId]: me
        }

        offerUser.send(JSON.stringify({type: 'acceptCall', answer, roomId}))
        me.send(JSON.stringify({type: 'roomConnect', roomId}))
        offerUser.send(JSON.stringify({type: 'roomConnect', roomId}))
        
    } catch(err) {

        handleException(ws, 'handleAnswer', err, {answer})
    }
}

const handleSwap = ({id, candidateId, ws}) => {
    try {
  
        if(!id) throw new Error("id is required")
        if(!candidateId) throw new Error("candidateId is required")

        const peer1 = users[id]
        const peer2 = users[candidateId]
        if(!peer1) throw new Error("our peer was not found")
        if(!peer1) throw new Error("another peer was not found")


        peer1.candidateIce = peer2?.iceParams || null
        peer2.candidateIce = peer1?.iceParams || null
        peer1.send(JSON.stringify({type: 'swapIce', data: {iceParams1: peer1.candidateIce, iceParams2: peer2.candidateIce}}))
        peer2.send(JSON.stringify({type: 'swapIce', data: {iceParams1: peer2.candidateIce, iceParams2: peer1.candidateIce}})) 
    } catch(err) {
        handleException(ws, 'handleSwap', err, {id, candidateId})
    }
}

const handleAddUser = ({ws, userId, name}) => {
    try {
        if(!userId) throw new Error("userId is required")


        if(userId) {
            if(users[userId] && users[userId]?.statusConnect == 'reload') {
                const {userRoomId} = findUserInRooms({userId})
                if(userRoomId) {
                    const candidate = Object.values(rooms[userRoomId]).filter(u => u.userId !== userId)[0]
                    users[candidate?.userId].send(JSON.stringify({type: 'reconnect', candidate: userId}))
                }
            }
            users[userId] = ws;
            users[userId].name = name;
            users[userId].candidateIce = null;
            users[userId].muted = false;
            users[userId].statusConnect = 'active'
            ws.userId = userId
        }
    } catch(err) {
    
       handleException(ws, 'handleAddUser', err, {userId, name})
    }
}

const handleAddIce = ({ws, iceParams}) => {
    try {
        if(!iceParams) throw new Error("iceParams is required")
        users[ws.userId].iceParams= iceParams
    } catch (err) {
        handleException(ws, 'handleAddIce', err, {iceParams})
    }
}

export const removeUser = ({ws}) => {

    getKeyByValue(users, ws)

}

const handleGetUser = ({ws, roomId}) => {
    try {
        const currRoom = rooms[roomId]
        if(!currRoom) throw new Error('Not found room')
        const users = Object.values(currRoom)
        ws.send(JSON.stringify({type: 'updateRoom', users: users}))
    } catch(err) {
        console.error('handleGetUser err: ', err)
    }
}

// off/on audio
const handleSwitchAudio = () => {
    try {
        
    } catch(err) {
        console.error('handleSwitchAudio err: ', err)
    }
}

//off/on video

const handleSwitchVideo = ({roomId, offerSDP, ws}) => {
    try {
        const currRoom = rooms[roomId]
        if(!rooms[roomId]) throw new Error('Not found room - ', roomId);

        const candidates = Object.values(currRoom).filter(user => user.userId !== ws.userId);
        for(const candidate of candidates) {
            candidate.send(JSON.stringify({type: 'updateOffer', offerSDP, userId: ws.userId}))
        }
    } catch(err) {

        console.error('handleSwitchAudio err: ', err)
    }
}

const handleUpdateAnswerInRoom = ({roomId, answerSDP, ws}) => {
    try {
        if(!answerSDP) throw new Error("answerSDP is required")
        if(!roomId) throw new Error("roomId is required")

        const currRoom = rooms[roomId]
        if(!rooms[roomId]) throw new Error('Room with id: ', roomId, ' not found');

        const candidates = Object.values(currRoom).filter(user => user.userId !== ws.userId);
        for(const candidate of candidates) {
            candidate.send(JSON.stringify({type: 'updateAnswer', answerSDP}))
        }
    } catch(err) {
   
        handleException(ws, 'handleUpdateAnswerInRoom', err, {roomId, answerSDP})
    }
}

const handleMuteVoice = ({ws, mute, roomId}) => {
    try {
        if(!mute) throw new Error("mute is required")
        if(!mute) throw new Error("roomId is required")

        const currRoom = rooms[roomId]
        if(!rooms[roomId]) throw new Error('Room with id: ', roomId, ' not found');   

        const {userId} = ws

        currRoom[userId].muted = mute
        const candidates = Object.values(currRoom)        
        for(const candidate of candidates) {
            candidate.send(JSON.stringify({type: 'updateRoom', users: candidates}))
        }
    } catch(err) {

        handleException(ws, 'handleUpdateAnswerInRoom', err, {mute, roomId})
    }
}


const handleReloadUser = ({ws}) => {
    try {

        users[ws.userId].statusConnect = 'reload';
    } catch (err) {

        handleException(ws, 'handleReloadUser', err, {})
    }
}

export const handleEndCall = ({ws}) => {
    try {
        
        const {userId} = ws 
        if(!userId) throw new Error('Not found user - ', userId);
        const {userRoomId} = findUserInRooms({userId})
        if(userRoomId) {
            const candidate = Object.values(rooms[userRoomId]).filter(u => u.userId !== userId)[0]
            delete rooms[userRoomId]

        
            users[candidate?.userId].send(JSON.stringify({type: 'endCall'}))
        }

    } catch (err) {
       
        handleException(ws, 'handleEndCall', err, {})
    }
}

const handleGetRooms = ({ws}) => {
    try {
        
        const data = {}
        for(let item in rooms) {
            data[item] = Object.keys(rooms[item])
        }
        ws.send(JSON.stringify({type: 'roomsList', data}))
    } catch (err) {
 
        handleException(ws, 'handleGetRooms', err, {})
    }
}


const actions = {
    'ADD_USER': handleAddUser,
    'OFFER': handleOffer, 
    'ANSWER': handleAnswer, 
    'SWAP_ICE': handleSwap,
    'ADD_ICE': handleAddIce,
    'DECLINE': handleDecline,
    'GET_LIST': handleGetUser,
    'SWITCH_AUDIO': handleSwitchAudio,
    'SWITCH_VIDEO': handleSwitchVideo,
    'UPDATE_ANSWER': handleUpdateAnswerInRoom,
    'MUTE_VOICE': handleMuteVoice,
    'RELOAD': handleReloadUser,
    'END_CALL': handleEndCall,
    'GET_ROOMS': handleGetRooms
  };


export const parseMessage = (data) => {
    try {
      
      const { action, ...somethingData } = JSON.parse(data.toString());

      return { currAction: actions[action], ...somethingData };
    } catch (err) {
      console.error('Parse error - ', err);
      return () => {};
    }
};
