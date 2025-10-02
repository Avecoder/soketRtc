import './socket/index.js'
import './debug-state.js' // Добавляем отладочные функции
import dotenv from 'dotenv'
dotenv.config()




export const PORT = process.env.WS_PORT || 5555;

console.log('Run server on port:', PORT)
console.log('Debug: call debugState() in console to see current state')