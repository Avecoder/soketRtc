import { v4 as uuidv4 } from 'uuid';

export const users = {}
const rooms = {

}


function getKeyByValue(object, value) {
    // console.log(Object.keys(object))
}


const findUserInRooms = ({userId}) => {
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
}

const handleOffer = ({data}) => {
    try {
        
        const candidateId = data.candidateId
        const userId = data.id
        const candidateUser = users[candidateId]
        const offerUser = users[userId]
        if(!userId || !offerUser)  throw new Error('User not found');
        if(!candidateId || !candidateUser)  throw new Error('Candidate not found');
        offerUser.candidate = candidateId
        candidateUser.candidate = userId
        candidateUser.send(JSON.stringify({type: 'call', offer: {...data, userId, name: offerUser.name, candidateId: userId, isRecconect: data?.reconnect ?? false}})) // for another user our id is candidate, mb gde-to obosralsya, no da ladno, vse workaet 
        // console.log(`User ${userId} is calling user ${candidateId}`);

    } catch(err) {
        console.error('handleOffer err: ', err)
    }
}

const handleDecline = ({ws, offerId}) => {
    try {
        const offerUser = users[offerId]
        const me = users[offerUser.candidate]

        me.send(JSON.stringify({type: 'decline', name: offerUser.name}))
        // console.log(`User ${me.candidate} is decline user ${offerId}`);
    } catch(err) {
        console.error('handleDecline err: ', err)
    }
}



const handleAnswer = ({answer, currentRoom}) => {
    try {
        const {candidateId, id} = answer
        // console.log('candidateId - ', candidateId)
        const offerUser = users[candidateId];
        const me = users[id]

        if(!offerUser) throw new Error('Offer user not found');
        if(!me) throw new Error('Answer user not found');
        const roomId = currentRoom ?? uuidv4()
        rooms[roomId] = {
            [offerUser.userId]: offerUser,
            [me.userId]: me
        }
        offerUser.send(JSON.stringify({type: 'acceptCall', answer, roomId}))
        me.send(JSON.stringify({type: 'roomConnect', roomId}))
        offerUser.send(JSON.stringify({type: 'roomConnect', roomId}))
        
    } catch(err) {
        console.error('handleAnswer err: ', err)
    }
}

const handleSwap = ({id, candidateId}) => {
    try {

        const peer1 = users[id]
        const peer2 = users[candidateId]
        if(!peer1 || !peer2) throw new Error("peers not found")


        peer1.candidateIce = peer2?.iceParams || null// me
        peer2.candidateIce = peer1?.iceParams || null // another user
        // console.log('SWAP _ ', JSON.stringify({iceParams1: peer1.candidateIce, iceParams2: peer2.candidateIce}))
        peer1.send(JSON.stringify({type: 'swapIce', data: {iceParams1: peer1.candidateIce, iceParams2: peer2.candidateIce}})) // me and another
        peer2.send(JSON.stringify({type: 'swapIce', data: {iceParams1: peer2.candidateIce, iceParams2: peer1.candidateIce}})) // me and another
    } catch(err) {
        console.error('handleSwap err: ', err)
    }
}

const handleAddUser = ({ws, userId, name}) => {
    try {
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
        console.error('handleAddUser err: ', err)
    }
}

const handleAddIce = ({ws, iceParams}) => {
    try {
        users[ws.userId].iceParams= iceParams
    } catch (err) {
        console.error('handleAddIce err: ', err)
    }
}

export const removeUser = ({ws}) => {
    // console.log(ws)
    getKeyByValue(users, ws)
    // console.log(data)
}

const handleGetUser = ({ws, roomId}) => {
    try {
        // console.log(roomId, rooms)
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
        const currRoom = rooms[roomId]
        if(!rooms[roomId]) throw new Error('Not found room - ', roomId);
        const candidates = Object.values(currRoom).filter(user => user.userId !== ws.userId);
        for(const candidate of candidates) {
            candidate.send(JSON.stringify({type: 'updateAnswer', answerSDP}))
        }
    } catch(err) {
        console.error('handleUpdateAnswerInRoom err: ', err)
    }
}

const handleMuteVoice = ({ws, mute, roomId}) => {
    try {
        const currRoom = rooms[roomId]
        if(!currRoom) throw new Error('Not found room - ', roomId);
        const {userId} = ws
        currRoom[userId].muted = mute
        const candidates = Object.values(currRoom)        
        for(const candidate of candidates) {
            candidate.send(JSON.stringify({type: 'updateRoom', users: candidates}))
        }
    } catch(err) {
        console.error('handleMuteVoice err: ', err)
    }
}


const handleReloadUser = ({ws}) => {
    try {
        console.log('RELOAD PAGE - ', ws.userId)
        users[ws.userId].statusConnect = 'reload';
    } catch (err) {
        console.error('handleReloadUser err: ', err)
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
        console.log('handleEndCall err: ', err)
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
    'END_CALL': handleEndCall
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