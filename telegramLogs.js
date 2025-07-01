import TelegramBot from 'node-telegram-bot-api'
import dotenv from 'dotenv'
import { saveChatId, getAllChatIds } from './db.js'

dotenv.config()

const bot = new TelegramBot(process.env.TG_API_KEY, { polling: true })

// Обработка всех сообщений — сохраняем chat.id
bot.on('message', (msg) => {
  const chatId = msg.chat.id
  saveChatId(chatId)

  // Ответим пользователю
  bot.sendMessage(chatId, '👋 <b>Привет!</b> Ты подписан на уведомления.',  { parse_mode: 'html' })
})

// Рассылка по всем chat.id
export const sendBroadcast = async (text) => {
  const chats = getAllChatIds()

  for (const [i, chatId] of chats.entries()) {
    try {
      await bot.sendMessage(chatId, text, { parse_mode: 'html' })
      if (i % 20 === 0) await new Promise(r => setTimeout(r, 1000)) 
    } catch (err) {
      console.error(`❌ Ошибка отправки в ${chatId}: ${err.message}`)
    }
  }

  console.log('✅ Рассылка завершена')
}

