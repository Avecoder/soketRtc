import { 
    handleAddIce, 
    handleAnswer, 
    handleDecline, 
    handleOffer, 
    handleSwap, 
    handleSetRemoteStreamId, 
    handleAddUser,
    handleUpdateAnswer,
    handleUpdateOffer
} from "./actions/index.js";







export const routes = {
    'ADD_USER': handleAddUser, // ++ 
    'OFFER': handleOffer, // ++
    'ANSWER': handleAnswer, // ++
    'SWAP_ICE': handleSwap, // ++
    'ADD_ICE': handleAddIce, // ++
    'DECLINE': handleDecline, // ++
    'SET_REMOTE_STREAM_ID': handleSetRemoteStreamId,
    'UPDATE_OFFER': handleUpdateOffer,
    'UPDATE_ANSWER': handleUpdateAnswer,
    // 'GET_LIST': handleGetUser, // -
    // 'SWITCH_AUDIO': handleSwitchAudio, // -
    // 'SWITCH_VIDEO': handleSwitchVideo,
    // 'UPDATE_ANSWER': handleUpdateAnswerInRoom,
    // 'MUTE_VOICE': handleMuteVoice,
    // 'RELOAD': handleReloadUser,
    // 'END_CALL': handleEndCall,
    // 'GET_ROOMS': handleGetRooms
};