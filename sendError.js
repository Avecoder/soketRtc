
import { logError } from './logger.js';

export const handleException = (ws, handlerName, err, context = {}) => {
    logError(`[${handlerName}]`, err);

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
