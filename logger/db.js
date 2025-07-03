

import fs from 'fs'

const DB_FILE = './chats.json'

export const saveChatId = (chatId) => {
  let chatIds = []

  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, '[]')
  }

  if (fs.existsSync(DB_FILE)) {
    chatIds = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'))
  }

  if (!chatIds.includes(chatId)) {
    chatIds.push(chatId)
    fs.writeFileSync(DB_FILE, JSON.stringify(chatIds, null, 2))
    console.log(`✅ Новый chatId сохранён: ${chatId}`)
  }
}

export const getAllChatIds = () => {
  if (!fs.existsSync(DB_FILE)) return []
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'))
}
