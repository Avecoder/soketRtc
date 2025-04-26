import { v4 as uuidv4 } from 'uuid';

const users = {}
const rooms = {

}


function getKeyByValue(object, value) {
    console.log(Object.keys(object))
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
        candidateUser.send(JSON.stringify({type: 'call', offer: {...data, userId, name: offerUser.name, candidateId}}))
        console.log(`User ${userId} is calling user ${candidateId}`);

    } catch(err) {
        console.error('handleOffer err: ', err)
    }
}

const handleDecline = ({ws, offerId}) => {
    try {
        const offerUser = users[offerId]
        const me = users[offerUser.candidate]

        me.send(JSON.stringify({type: 'decline', name: offerUser.name}))
        console.log(`User ${me.candidate} is decline user ${offerId}`);
    } catch(err) {
        console.error('handleDecline err: ', err)
    }
}



const handleAnswer = ({answer}) => {
    try {
        const {candidateId, id} = answer
        console.log('candidateId - ', candidateId)
        const offerUser = users[candidateId];
        const me = users[id]

        if(!offerUser) throw new Error('Offer user not found');
        if(!me) throw new Error('Answer user not found');
        const roomId = uuidv4()
        rooms[roomId] = {
            peer1: offerUser,
            peer2: me
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
        console.log('SWAP _ ', JSON.stringify({iceParams1: peer1.candidateIce, iceParams2: peer2.candidateIce}))
        peer1.send(JSON.stringify({type: 'swapIce', data: {iceParams1: peer1.candidateIce, iceParams2: peer2.candidateIce}})) // me and another
        peer2.send(JSON.stringify({type: 'swapIce', data: {iceParams1: peer2.candidateIce, iceParams2: peer1.candidateIce}})) // me and another
    } catch(err) {
        console.error('handleSwap err: ', err)
    }
}

const handleAddUser = ({ws, userId, name}) => {
    try {
        if(userId) {
            users[userId] = ws;
            users[userId].name = name;
            users[userId].candidateIce = null;
            ws.userId = userId
        }
    } catch(err) {
        console.error('handleGetList err: ', err)
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
        console.log(roomId, rooms)
        if(!rooms[roomId]) throw new Error('Not found room')
        ws.send(JSON.stringify({type: 'updateRoom', users: rooms[roomId]}))
    } catch(err) {
        console.error('handleGetUser err: ', err)
    }
}

const actions = {
    'ADD_USER': handleAddUser,
    'OFFER': handleOffer, 
    'ANSWER': handleAnswer, 
    'SWAP_ICE': handleSwap,
    'ADD_ICE': handleAddIce,
    'DECLINE': handleDecline,
    'GET_LIST': handleGetUser
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