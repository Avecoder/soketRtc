
import fs from 'fs';
import path from 'path';

const logFilePath = path.resolve('logs', 'server.log');


if (!fs.existsSync(path.dirname(logFilePath))) {
    fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
}

export const logError = (message, err = null) => {
    console.log(message, err)
    const time = new Date().toISOString();
    const errorMessage = `[${time}] ${message}${err ? `: ${err.stack || err.message}` : ''}\n`;
    fs.appendFile(logFilePath, errorMessage, (fsErr) => {
        if (fsErr) console.error('Ошибка при записи лога:', fsErr);
    });
};
