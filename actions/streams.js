import { users } from "../users/index.js"
import { handleException } from "../logger/sendError.js"

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
    users[userId].get(ws).streamIds[kind] = streamId

  } catch (err) {
    // В случае ошибки логируем исключение и отправляем информацию о ней
    // Если у пользователя есть веб-сокет (ws), передаем его для контекста
    handleException(users[userId]?.ws ?? null, 'SET_REMOTE_STREAM_ID', err, {})
  }
}
