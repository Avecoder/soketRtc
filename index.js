import './socket/index.js'
import dotenv from 'dotenv'
dotenv.config()




export const PORT = process.env.WS_PORT || 5555;

console.log('Run server on port:', PORT)