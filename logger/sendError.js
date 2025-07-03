
import { logError } from './logger.js';
import {sendBroadcast} from './telegramLogs.js'

const maxLength = 4096;

export const handleException = (ws, handlerName, err, context = {}) => {
    logError(`[${handlerName}]`, err);
    sendBroadcast(`⚠️  <b>[${handlerName}]</b> ⚠️ \n  ${err.message}} \n ${JSON.stringify(context)} `.slice(0, maxLength))

    try {
        ws?.send?.(JSON.stringify({
            type: 'error',
            message: err.message,
            handler: handlerName,
            context,
        }));
        return
    } catch (sendErr) {
        logError(`[${handlerName}] Failed to send error to client`, sendErr);
    }
};
