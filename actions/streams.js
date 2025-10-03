import { isSendingOnePeers, users, getUserByWs } from "../users/index.js"
import { handleException } from "../logger/sendError.js"
import { formData } from "../socket/send.js"

/**
 * Обработчик события установки ID удалённого трека для конкретного пользователя.
 * 
 * @param {Object} params
 * @param {string} params.userId - Идентификатор пользователя, для которого устанавливаем trackId.
 * @param {string} params.kind - Тип трека ('audio' или 'video').
 * @param {string} params.trackId - ID трека, который нужно сохранить.
 */
export const handleSetRemoteStreamId = ({ws,  userId, kind, streamId }) => {
  try {
    // Проверяем наличие обязательных параметров
    if (!userId) throw new Error('userId is required')
    if (!kind) throw new Error('kind is required')
    if (!streamId) throw new Error('streamId is required')

    // Проверяем, что пользователь существует в текущем списке пользователей
    if (!users[userId]) throw new Error('peer1 not found')

    // Сохраняем ID трека по типу ('audio' или 'video') в объекте пользователя
    const user = getUserByWs(userId, ws);
    if (!user) throw new Error('User not found');
    user.streamIds[kind] = streamId

  } catch (err) {
    // В случае ошибки логируем исключение и отправляем информацию о ней
    // Если у пользователя есть веб-сокет (ws), передаем его для контекста
    handleException(users[userId]?.ws ?? null, 'SET_REMOTE_STREAM_ID', err, {})
  }
}


export const handleUpdateMedia = ({ws,userId, ...data}) => {
  try {
    if(!ws.userId) throw new Error('userId is required');

    console.log(`[DEBUG MEDIA] User: ${ws.userId}, Status check starting...`);

    // Получаем текущего пользователя с новой логикой
    const me = getUserByWs(ws.userId, ws);
    if (!me) {
      console.log(`[DEBUG MEDIA] Current user not found for ${ws.userId}`);
      throw new Error('Current user not found');
    }

    console.log(`[DEBUG MEDIA] User found: status=${me.status}, candidate=${me.candidate}`);
    
    const candidateId = me.candidate;
    if (!candidateId) {
      console.log(`[DEBUG MEDIA] No candidate found for user ${ws.userId}`);
      console.log(`[DEBUG MEDIA] User data:`, {
        status: me.status,
        candidate: me.candidate,
        userId: me.userId
      });
      throw new Error('Candidate ID not found');
    }

    console.log(`[DEBUG MEDIA] Looking for candidate: ${candidateId}`);
    const candidate = users[candidateId];
    if (!candidate) {
      console.log(`[DEBUG MEDIA] Candidate user ${candidateId} not found in users`);
      console.log(`[DEBUG MEDIA] Available users:`, Object.keys(users));
      throw new Error('Candidate not found');
    }
    
    const candidateActive = isSendingOnePeers(candidate)
    console.log(`[DEBUG MEDIA] Candidate active:`, candidateActive ? 'yes' : 'no');

    console.log('[ENABLED STREAMS]: ', data)

    if(!candidateActive) {
      console.log(`[DEBUG MEDIA] Sending to all candidate connections`);
      for(const [_, p] of candidate) {
        p.ws.send(formData('/updateMedia', data))
      }
      return;
    } 
    console.log(`[DEBUG MEDIA] Sending to active candidate`);
    candidateActive.ws.send(formData('/updateMedia', data))
  } catch(err) {
    console.log(`[DEBUG MEDIA ERROR] ${err.message}`);
    handleException(ws ?? null, 'handleUpdateMedia', err, {...data})
  }
}
