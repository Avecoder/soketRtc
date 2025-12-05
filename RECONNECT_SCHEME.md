# Схема реконнекта в P2P системе

## Обзор

Реконнект используется для восстановления сессии пользователя при потере WebSocket соединения. Система сохраняет состояние пользователя (статус звонка, кандидата, ICE параметры) и восстанавливает его при переподключении.

---

## Триггеры реконнекта

### 1. **Потеря соединения (Heartbeat timeout)**
- Сервер проверяет все соединения каждые **30 секунд**
- Если клиент не отправлял PING более **5 минут** (300 секунд), соединение закрывается
- Клиент обнаруживает разрыв и инициирует переподключение

### 2. **Ручной реконнект**
- Клиент может отправить `RECONNECT` в любой момент для восстановления сессии

---

## Процесс реконнекта

### Шаг 1: Клиент отправляет RECONNECT
```json
{
  "route": "RECONNECT",
  "userId": "123",
  "name": "Иван",
  "photo": "url",
  "device": "mobile"
}
```

### Шаг 2: Сервер обрабатывает запрос (`handleReconnect`)

#### 2.1. Проверка существующей сессии
```javascript
const existingUserMap = users[userId];
if (!existingUserMap || existingUserMap.size === 0) {
    throw new Error(`No existing session found for user ${userId}`);
}
```

**Структура данных:**
- `users[userId]` = `Map<WebSocket, UserData>`
- Один пользователь может иметь несколько WebSocket соединений (разные вкладки, реконнекты)

#### 2.2. Очистка мертвых соединений
```javascript
for (const [oldWs, userData] of existingUserMap) {
    if (oldWs.readyState === 1) {
        // Активное соединение
        if (userData.status !== 'idle' || userData.candidate) {
            activeUserData = userData; // Нашли активную сессию
            break;
        }
    } else {
        // Мертвое соединение - удаляем
        existingUserMap.delete(oldWs);
    }
}
```

**Логика поиска активной сессии:**
- Ищется сессия с `status !== 'idle'` (calling, ringing, in_call)
- Или сессия с установленным `candidate` (есть собеседник)
- Мертвые соединения (`readyState !== 1`) удаляются

#### 2.3. Создание новой сессии
```javascript
const uuid = uuidv4();
const userData = {
    ...activeUserData,  // Копируем все данные из активной сессии
    ws,                 // Новый WebSocket
    uuid,               // Новый UUID
    name: name || activeUserData.name,
    photo: photo || activeUserData.photo,
    device: device || activeUserData.device,
};

existingUserMap.set(ws, userData);
ws.userId = userId;
```

**Восстанавливаемые данные:**
- ✅ `status` - статус звонка (calling, ringing, in_call)
- ✅ `candidate` - ID собеседника
- ✅ `candidateIce` - ICE кандидаты собеседника
- ✅ `iceParams` - собственные ICE параметры
- ✅ `streamIds` - ID медиа-стримов
- ✅ `name`, `photo`, `device` - профиль пользователя

#### 2.4. Отправка подтверждения клиенту
```javascript
ws.send(JSON.stringify({
    type: 'reconnectSuccess',
    status: userData.status,
    candidate: userData.candidate,
    message: 'Session restored successfully'
}));
```

#### 2.5. Уведомление собеседника
```javascript
if (userData.candidate) {
    const candidateMap = users[userData.candidate];
    if (candidateMap) {
        sendMessage('/peerReconnected', candidateMap, {
            userId: userId,
            name: userData.name,
            status: userData.status
        });
    }
}
```

**Собеседник получает:**
- Уведомление о реконнекте пира
- Может обновить свой UI
- Может переотправить ICE кандидаты при необходимости

---

## Обработка ошибок

### Ошибка: Нет существующей сессии
```javascript
if (!existingUserMap || existingUserMap.size === 0) {
    throw new Error(`No existing session found for user ${userId}`);
}
```

**Ответ клиенту:**
```json
{
  "type": "reconnectError",
  "error": "No existing session found for user 123",
  "suggestion": "Try ADD_USER instead"
}
```

**Решение:** Клиент должен использовать `ADD_USER` для создания новой сессии

### Ошибка: Нет активной сессии
```javascript
if (!activeUserData) {
    throw new Error(`No active session found for user ${userId}`);
}
```

**Причины:**
- Все сессии в статусе `idle` и без `candidate`
- Все соединения были закрыты

**Решение:** Клиент должен использовать `ADD_USER`

---

## Восстановление входящих звонков (WaitingList)

### Механизм WaitingList

Если пользователь получал звонок **до** подключения, данные сохраняются в `waitingList`:

```javascript
waitingList[candidateId] = {
    sdp: "...",
    userId: "123",
    name: "Иван",
    candidates: "456",
    addedAt: Date.now()
}
```

### Проверка при ADD_USER

При добавлении нового пользователя (`handleAddUser`) автоматически вызывается:

```javascript
checkExistUserInWaitingList(userId);
```

**Логика:**
1. Проверяет наличие записи в `waitingList[userId]`
2. Если найдено и `action !== 'cancel'`:
   - Восстанавливает `candidate` связи
   - Отправляет `/call` с данными звонка
   - Удаляет из `waitingList`
3. Если `action === 'cancel'`:
   - Отправляет `/cancel`
   - Удаляет из `waitingList`

---

## Диаграмма процесса

```
┌─────────┐
│ Клиент  │
└────┬────┘
     │ 1. Потеря соединения (timeout/network error)
     ▼
┌─────────────────┐
│ Обнаружение     │
│ разрыва         │
└────┬────────────┘
     │ 2. RECONNECT {userId, name, photo, device}
     ▼
┌─────────────────┐
│ handleReconnect │
└────┬────────────┘
     │
     ├─► 3. Проверка users[userId]
     │   ├─► Нет сессии → reconnectError → ADD_USER
     │   └─► Есть сессия → Продолжаем
     │
     ├─► 4. Очистка мертвых соединений
     │   └─► Удаление oldWs (readyState !== 1)
     │
     ├─► 5. Поиск активной сессии
     │   ├─► status !== 'idle' ИЛИ есть candidate
     │   └─► Нет активной → reconnectError → ADD_USER
     │
     ├─► 6. Создание новой сессии
     │   ├─► Копирование данных из activeUserData
     │   ├─► Новый WebSocket и UUID
     │   └─► Сохранение в users[userId].set(ws, userData)
     │
     ├─► 7. Отправка reconnectSuccess
     │   └─► {status, candidate, message}
     │
     └─► 8. Уведомление candidate (если есть)
         └─► /peerReconnected {userId, name, status}
```

---

## Статусы пользователя

| Статус | Описание | Восстанавливается при реконнекте |
|--------|----------|----------------------------------|
| `idle` | Пользователь не в звонке | ✅ (если нет candidate) |
| `calling` | Исходящий вызов (ожидает ответа) | ✅ |
| `ringing` | Входящий вызов (ожидает ответа) | ✅ |
| `in_call` | Активный звонок | ✅ |
| `ended` | Звонок завершен | ✅ |

---

## Важные моменты

### 1. Множественные соединения
- Один `userId` может иметь несколько WebSocket соединений
- Все соединения хранятся в `Map<WebSocket, UserData>`
- При реконнекте добавляется новое соединение, старые очищаются

### 2. Сохранение состояния
- **Не сохраняется:** WebSocket соединение (создается новое)
- **Сохраняется:** Все данные сессии (status, candidate, ICE, streams)

### 3. Синхронизация с собеседником
- Собеседник получает `/peerReconnected`
- Может потребоваться переотправка ICE кандидатов
- Статус звонка сохраняется у обоих пользователей

### 4. Очистка WaitingList
- Автоматическая очистка через **1 минуту**
- При истечении отправляется `/decline` инициатору

---

## Примеры использования

### Успешный реконнект во время звонка
```
1. Пользователь A в звонке с пользователем B (status: 'in_call')
2. Соединение A разрывается
3. A отправляет RECONNECT
4. Сервер восстанавливает сессию A:
   - status: 'in_call'
   - candidate: 'B'
   - candidateIce: [...]
   - iceParams: [...]
5. A получает reconnectSuccess
6. B получает /peerReconnected
7. Звонок продолжается
```

### Реконнект без активной сессии
```
1. Пользователь A в статусе 'idle', нет candidate
2. Все соединения закрыты
3. A отправляет RECONNECT
4. Сервер не находит активной сессии
5. A получает reconnectError
6. A должен использовать ADD_USER
```

### Восстановление входящего звонка
```
1. Пользователь B отправляет OFFER пользователю A
2. A еще не подключен → данные в waitingList[A]
3. A подключается через ADD_USER
4. checkExistUserInWaitingList(A) находит звонок
5. A получает /call с данными звонка
6. Звонок восстанавливается
```

---

## Настройки таймаутов

| Параметр | Значение | Описание |
|----------|----------|----------|
| Heartbeat проверка | 30 секунд | Интервал проверки соединений |
| Максимальное время без PING | 5 минут | Таймаут для закрытия соединения |
| Очистка WaitingList | 1 минута | Время жизни записи в waitingList |
| Интервал очистки | 10 секунд | Как часто проверяется waitingList |

---

## Файлы, связанные с реконнектом

- `actions/usersActions.js` - `handleReconnect`, `checkExistUserInWaitingList`
- `actions/pingActions.js` - Heartbeat механизм
- `socket/index.js` - Обработка закрытия соединений
- `users/index.js` - Управление users, waitingList, pairs
- `routes.js` - Маршрут 'RECONNECT'

