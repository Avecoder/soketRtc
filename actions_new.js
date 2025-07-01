


/////

import { v4 as uuidv4 } from 'uuid';
import {handleException} from './sendError.js'

export const users = {}
const pairOfPeers = {

}

const sendMessage = (route = '/', sender, data = {}) => {
    const sendedData = JSON.stringify({type: route.split('/')[1], ...data})
    sender.send(sendedData)
}

const broadcast = ({userId, type, data = {}, ws}) => {
    try {
        
        if(!userId) throw new Error('UserId is required');

        const me = users[userId];
        const candidate = users[me.candidate];

        if(!me) throw new Error('Me not found');
        if(!candidate) throw new Error('Candidate not found');

        me.send(JSON.stringify({type, ...data}))
        candidate.send(JSON.stringify({type, ...data}))
    } catch (err) {
        handleException(ws, 'broadcast', err, data)
    }
}


function getKeyByValue(object, value) {
    // console.log(Object.keys(object))
}

const handleSetUserId = () => {

}

const findUserInpairOfPeers = ({userId}) => {
    try {
        if(!userId) throw new Error('userId is required');
        const currentUserId = userId;
        let userpairId = null;
        for (const pairId in pairOfPeers) {
            if (pairOfPeers.hasOwnProperty(pairId)) {
                
                if (pairOfPeers[pairId][currentUserId]) {
                    userpairId = pairId;
                    break;
                }
            }
    }
        return {userpairId}
    }
    catch (err) {
        handleException(ws, 'findUserInpairOfPeers', err, {})
    }
}

const handleOffer = ({candidateId, userId, reconnect = false, ws, ...userData}) => {
    try {
        if(!candidateId) throw new Error('candidateId is required');
        if(!userId) throw new Error('userId is required');
        const candidateUser = users[candidateId]
        const offerUser = users[userId] 



        if(!userId || !offerUser)  throw new Error('User not found');
        if(!candidateId || !candidateUser)  throw new Error('Candidate not found');


        offerUser.candidate = candidateId
        candidateUser.candidate = userId
        candidateUser.send(JSON.stringify({type: 'call', userId, candidateId: userId, isRecconect: reconnect, ...userData})) 

    } catch(err) {
        handleException(ws, 'handleOffer', err, {})
    }
}

const handleDecline = ({ws, userId}) => {
    try {
        if(!userId) throw new Error('userId is required');

        const offerUser = users[userId]
        if(!offerUser) throw new Error('answer user not found');
        
        const me = users[offerUser.candidate];
        if(!me) throw new Error('offer user not found');

        me.send(JSON.stringify({type: 'decline', name: offerUser.name}))
    } catch(err) {
        handleException(ws, 'handleDecline', err, {})
    }
}



const handleAnswer = ({answer, userId}) => {
    try {
        
        const me = users[userId]
        const offerUser = users[me.candidate]

        if(!offerUser) throw new Error('Offer user not found');
        if(!me) throw new Error('Answer user not found');

        
        const pairId = uuidv4()
        pairOfPeers[pairId] = {
            [offerUser.userId]: offerUser,
            [me.userId]: me
        }

        offerUser.send(JSON.stringify({type: 'acceptCall', answer}))
        broadcast({userId, type: 'connect'})
    } catch(err) {
        handleException(ws, 'handleAnswer', err, {})
    }
}

const handleSwap = ({userId}) => {
    try {

        const peer1 = users[userId]
        const candidateId = peer1.candidate;
        const peer2 = users[candidateId]
        if(!peer1 || !peer2) throw new Error("peers not found")


        peer1.candidateIce = peer2?.iceCandidates || null// me
        peer2.candidateIce = peer1?.iceCandidates || null // another user
        // console.log('SWAP _ ', JSON.stringify({iceParams1: peer1.candidateIce, iceParams2: peer2.candidateIce}))

        sendMessage('/remoteIce', peer1, {iceCandidates: peer1.candidateIce})
        sendMessage('/remoteIce', peer2, {iceCandidates: peer2.candidateIce})
    } catch(err) {
        console.error('handleSwap err: ', err)
    }
}

const handleAddUser = ({ws, userId, name}) => {
    try {
        console.log('Adds users -', userId)
        if(userId) {
            if(users[userId] && users[userId]?.statusConnect == 'reload') {
                const {userpairId} = findUserInpairOfPeers({userId})
                if(userpairId) {
                    const candidate = Object.values(pairOfPeers[userpairId]).filter(u => u.userId !== userId)[0]
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

const handleAddIce = ({iceCandidates, userId}) => {
    try {
        users[userId].iceCandidates = iceCandidates
    } catch (err) {
        console.error('handleAddIce err: ', err)
    }
}

export const removeUser = ({ws}) => {
    // console.log(ws)
    getKeyByValue(users, ws)
    // console.log(data)
}

const handleGetUser = ({ws, pairId}) => {
    try {
        // console.log(pairId, pairOfPeers)
        const currRoom = pairOfPeers[pairId]
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

const handleSwitchVideo = ({pairId, offerSDP, ws}) => {
    try {
        const currRoom = pairOfPeers[pairId]
        if(!pairOfPeers[pairId]) throw new Error('Not found room - ', pairId);

        const candidates = Object.values(currRoom).filter(user => user.userId !== ws.userId);
        for(const candidate of candidates) {
            candidate.send(JSON.stringify({type: 'updateOffer', offerSDP, userId: ws.userId}))
        }
    } catch(err) {
        console.error('handleSwitchAudio err: ', err)
    }
}

const handleUpdateAnswerInRoom = ({pairId, answerSDP, ws}) => {
    try {
        const currRoom = pairOfPeers[pairId]
        if(!pairOfPeers[pairId]) throw new Error('Not found room - ', pairId);
        const candidates = Object.values(currRoom).filter(user => user.userId !== ws.userId);
        for(const candidate of candidates) {
            candidate.send(JSON.stringify({type: 'updateAnswer', answerSDP}))
        }
    } catch(err) {
        console.error('handleUpdateAnswerInRoom err: ', err)
    }
}

const handleMuteVoice = ({ws, mute, pairId}) => {
    try {
        const currRoom = pairOfPeers[pairId]
        if(!currRoom) throw new Error('Not found room - ', pairId);
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
        const {userpairId} = findUserInpairOfPeers({userId})
        if(userpairId) {
            const candidate = Object.values(pairOfPeers[userpairId]).filter(u => u.userId !== userId)[0]
            delete pairOfPeers[userpairId]

            console.log("pairOfPeers - ", Object.keys(pairOfPeers))
            users[candidate?.userId].send(JSON.stringify({type: 'endCall'}))
        }

    } catch (err) {
        console.log('handleEndCall err: ', err)
    }
}

const handleGetpairOfPeers = ({ws}) => {
    try {
        
        const data = {}
        for(let item in pairOfPeers) {
            data[item] = Object.keys(pairOfPeers[item])
        }
        ws.send(JSON.stringify({type: 'pairOfPeersList', data}))
    } catch (err) {
        console.log('handleGetpairOfPeers err: ', err)
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
    'GET_pairOfPeers': handleGetpairOfPeers
  };


export const parseMessage = (message) => {
    try {
      
      const { route: action, ...data } = JSON.parse(message.toString());
      return { currAction: actions[action], data };
    } catch (err) {
      console.error('Parse error - ', err);
      return () => {};
    }
};