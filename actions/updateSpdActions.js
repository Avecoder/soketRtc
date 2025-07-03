import {handleOffer, handleAnswer} from './offerAndAnswerActions.js'

export const handleUpdateOffer = (data) => handleOffer({...data, isUpdate: true})
export const handleUpdateAnswer = (data) => handleAnswer({...data, isUpdate: true})