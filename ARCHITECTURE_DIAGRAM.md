# Архитектура P2P Backend

## Общая архитектура системы

```mermaid
graph TB
    subgraph "Клиент"
        C1[Client 1]
        C2[Client 2]
    end
    
    subgraph "WebSocket Server Layer"
        WS[WebSocketServer<br/>Port: 5555]
        CONN[Connection Handler]
        MSG[Message Handler]
    end
    
    subgraph "Message Processing"
        PARSE[parse.js<br/>Parse Message]
        ROUTES[routes.js<br/>Route Mapping]
    end
    
    subgraph "Actions Layer"
        A1[usersActions.js]
        A2[offerAndAnswerActions.js]
        A3[iceCandidatesActions.js]
        A4[streams.js]
        A5[updateSpdActions.js]
        A6[pingActions.js]
    end
    
    subgraph "Core Services"
        SEND[send.js<br/>Send Messages]
        BC[broadcast.js<br/>Broadcast]
        USERS[users/index.js<br/>User Management]
    end
    
    subgraph "Data Storage"
        USERS_MAP[users: Map]
        PAIRS[pairOfPeers: Object]
        WAITING[waitingList: Object]
    end
    
    subgraph "Logger"
        LOG[logger.js]
        ERR[sendError.js]
        TG[telegramLogs.js]
    end
    
    C1 -->|WebSocket| WS
    C2 -->|WebSocket| WS
    WS --> CONN
    CONN --> MSG
    MSG --> PARSE
    PARSE --> ROUTES
    ROUTES --> A1
    ROUTES --> A2
    ROUTES --> A3
    ROUTES --> A4
    ROUTES --> A5
    ROUTES --> A6
    
    A1 --> USERS
    A2 --> USERS
    A3 --> USERS
    A4 --> USERS
    
    A1 --> SEND
    A2 --> SEND
    A3 --> SEND
    A4 --> SEND
    A5 --> SEND
    
    A2 --> BC
    
    USERS --> USERS_MAP
    USERS --> PAIRS
    USERS --> WAITING
    
    A1 --> ERR
    A2 --> ERR
    A3 --> ERR
    A4 --> ERR
    ERR --> LOG
    ERR --> TG
    
    SEND -->|WebSocket| C1
    SEND -->|WebSocket| C2
    BC -->|WebSocket| C1
    BC -->|WebSocket| C2
```

## Поток установки звонка (Call Flow)

```mermaid
sequenceDiagram
    participant C1 as Client 1<br/>(Caller)
    participant WS as WebSocket Server
    participant C2 as Client 2<br/>(Receiver)
    
    Note over C1,C2: 1. Инициализация пользователей
    C1->>WS: ADD_USER {userId, name, photo, device}
    WS->>WS: Создать/обновить users[userId]
    WS->>C1: userConnect
    
    C2->>WS: ADD_USER {userId, name, photo, device}
    WS->>WS: Создать/обновить users[userId]
    WS->>C2: userConnect
    
    Note over C1,C2: 2. Инициация звонка
    C1->>WS: OFFER {userId, candidates, sdp, ...}
    WS->>WS: Проверить pairOfPeers
    WS->>WS: Найти peer2 в users
    WS->>WS: Обновить статус C1: 'calling'
    WS->>WS: Установить candidate связи
    WS->>WS: pushInWaitingList(candidateId)
    WS->>C2: /call {sdp, userId, name, photo}
    WS->>C2: /remoteStreamsId {streamIds}
    
    Note over C1,C2: 3. Принятие звонка
    C2->>WS: ANSWER {answer, userId}
    WS->>WS: Найти peer1 по candidateId
    WS->>WS: Обновить статус C2: 'ringing'
    WS->>WS: setPair(userId, candidateId)
    WS->>C1: /acceptCall {answer, device}
    WS->>C2: /remoteStreamsId {streamIds}
    WS->>WS: removeFromWaitingList(userId)
    WS->>C1: /connect
    WS->>C2: /connect
    
    Note over C1,C2: 4. Обмен ICE кандидатами
    C1->>WS: ADD_ICE {iceParams}
    WS->>WS: Сохранить iceParams в user
    C2->>WS: ADD_ICE {iceParams}
    WS->>WS: Сохранить iceParams в user
    
    C1->>WS: SWAP_ICE {userId}
    WS->>WS: Обменять ICE между peer1 и peer2
    WS->>WS: Обновить статус C1: 'in_call'
    WS->>C1: /swapIce {iceCandidates}
    WS->>C2: /swapIce {iceCandidates}
    
    Note over C1,C2: 5. Отклонение (опционально)
    alt Отклонение звонка
        C2->>WS: DECLINE {userId}
        WS->>WS: Обновить статус C2: 'idle'
        WS->>WS: Обновить статус C1: 'ended'
        WS->>C1: /decline {name}
        WS->>WS: removePair(userId)
    end
```

## Поток обработки сообщений

```mermaid
flowchart TD
    START[WebSocket Message Received]
    START --> PARSE{parse.js}
    
    PARSE -->|'PING'| PING[handlePing]
    PING --> UPDATE_PING[Update ws.lastPingTime]
    UPDATE_PING --> SEND_PONG[Send 'PONG']
    
    PARSE -->|JSON Message| EXTRACT[Extract route, userId, data]
    EXTRACT --> ROUTE{Find Route}
    
    ROUTE -->|ADD_USER| USER_ACTION[handleAddUser]
    ROUTE -->|RECONNECT| RECON_ACTION[handleReconnect]
    ROUTE -->|OFFER| OFFER_ACTION[handleOffer]
    ROUTE -->|ANSWER| ANSWER_ACTION[handleAnswer]
    ROUTE -->|DECLINE| DECLINE_ACTION[handleDecline]
    ROUTE -->|ADD_ICE| ICE_ACTION[handleAddIce]
    ROUTE -->|SWAP_ICE| SWAP_ACTION[handleSwap]
    ROUTE -->|SET_REMOTE_STREAM_ID| STREAM_ACTION[handleSetRemoteStreamId]
    ROUTE -->|UPDATE_OFFER| UPDATE_OFFER_ACTION[handleUpdateOffer]
    ROUTE -->|UPDATE_ANSWER| UPDATE_ANSWER_ACTION[handleUpdateAnswer]
    ROUTE -->|MEDIA_UPDATE| MEDIA_ACTION[handleUpdateMedia]
    
    USER_ACTION --> VALIDATE[Validate Input]
    RECON_ACTION --> VALIDATE
    OFFER_ACTION --> VALIDATE
    ANSWER_ACTION --> VALIDATE
    DECLINE_ACTION --> VALIDATE
    ICE_ACTION --> VALIDATE
    SWAP_ACTION --> VALIDATE
    STREAM_ACTION --> VALIDATE
    UPDATE_OFFER_ACTION --> VALIDATE
    UPDATE_ANSWER_ACTION --> VALIDATE
    MEDIA_ACTION --> VALIDATE
    
    VALIDATE --> PROCESS[Process Action]
    PROCESS --> UPDATE_STATE[Update State<br/>users/pairOfPeers/waitingList]
    UPDATE_STATE --> SEND_MSG[Send Message via send.js]
    
    SEND_MSG -->|Single| SEND_SINGLE[Send to specific user]
    SEND_MSG -->|Broadcast| SEND_BROADCAST[Broadcast to pair]
    
    SEND_PONG --> END[End]
    SEND_SINGLE --> END
    SEND_BROADCAST --> END
    
    PROCESS -->|Error| ERROR[handleException]
    ERROR --> LOG[Log Error]
    LOG --> TG[Send to Telegram]
    TG --> SEND_ERROR[Send error to client]
    SEND_ERROR --> END
```

## Структура данных

```mermaid
classDiagram
    class UserData {
        +string userId
        +WebSocket ws
        +string uuid
        +string name
        +string photo
        +string device
        +string status
        +string candidate
        +Array iceParams
        +Array candidateIce
        +Object streamIds
        +boolean muted
    }
    
    class UsersStorage {
        +Map~userId, Map~ws, UserData~~
        +addUser(userId, ws, data)
        +removeUser(ws)
        +getUser(userId)
    }
    
    class PairStorage {
        +Object pairOfPeers
        +setPair(userId, candidateId)
        +removePair(userId)
        +getPair(userId)
    }
    
    class WaitingList {
        +Object waitingList
        +pushInWaitingList(userId, data)
        +removeFromWaitingList(userId)
        +getFromWaitingList(userId)
    }
    
    UsersStorage "1" --> "*" UserData : contains
    UserData --> PairStorage : references via candidate
    WaitingList --> UserData : stores pending calls
```

## Heartbeat механизм

```mermaid
sequenceDiagram
    participant Client
    participant WS as WebSocket Server
    participant HB as Heartbeat Checker
    
    Note over Client,HB: Периодический ping (каждые 60 сек)
    loop Каждые 60 секунд
        Client->>WS: PING
        WS->>WS: Update ws.lastPingTime = Date.now()
        WS->>Client: PONG
    end
    
    Note over WS,HB: Проверка соединений (каждые 30 сек)
    loop Каждые 30 секунд
        HB->>WS: Проверить все соединения
        WS->>WS: timeSinceLastPing = now - ws.lastPingTime
        
        alt timeSinceLastPing > 5 минут
            WS->>WS: Закрыть соединение
            WS->>WS: removeUser(ws)
            WS->>WS: removePair(userId)
        else Соединение активно
            WS->>WS: Продолжить
        end
    end
```

## Процесс реконнекта

```mermaid
flowchart TD
    START[Connection Lost<br/>WebSocket Close/Error]
    START --> CLIENT_DETECT[Client Detects Disconnection]
    
    CLIENT_DETECT --> SAVE_STATE[Save Local State<br/>userId, candidateId, status]
    SAVE_STATE --> RECONNECT_ATTEMPT[Attempt Reconnect<br/>with exponential backoff]
    
    RECONNECT_ATTEMPT -->|Success| NEW_WS[New WebSocket Connection]
    NEW_WS --> SEND_RECONNECT[Send RECONNECT<br/>{userId, name, photo, device}]
    
    SEND_RECONNECT --> SERVER_CHECK[Server: Check existing session]
    SERVER_CHECK -->|Session exists| FIND_ACTIVE[Find active session data]
    SERVER_CHECK -->|No session| ERROR_STATE[Return reconnectError]
    
    FIND_ACTIVE --> CLEAN_DEAD[Clean dead WebSocket connections]
    CLEAN_DEAD --> RESTORE_STATE[Restore session state<br/>status, candidate, streamIds]
    RESTORE_STATE --> ATTACH_WS[Attach new WebSocket]
    ATTACH_WS --> SEND_SUCCESS[Send reconnectSuccess<br/>{status, candidate}]
    
    SEND_SUCCESS --> CHECK_CANDIDATE{Has candidate?}
    CHECK_CANDIDATE -->|Yes| NOTIFY_PEER[Send /peerReconnected<br/>to candidate]
    CHECK_CANDIDATE -->|No| END[Reconnect Complete]
    NOTIFY_PEER --> END
    
    ERROR_STATE --> END
    
    END -->|If was in call| WEBRTC_RECON[Reconnect WebRTC<br/>via UPDATE_OFFER/ANSWER]
```

## Основные компоненты и их функции

### WebSocket Layer (`socket/`)
- **index.js**: Инициализация WebSocket сервера, обработка connection/message/close событий
- **parse.js**: Парсинг входящих сообщений (PING или JSON)
- **send.js**: Отправка сообщений клиентам (sendMessage, sendCancelMessage)
- **broadcast.js**: Рассылка сообщений паре пользователей

### Actions (`actions/`)
- **usersActions.js**: Добавление пользователей, реконнект
- **offerAndAnswerActions.js**: Обработка WebRTC offer/answer, отклонение звонков
- **iceCandidatesActions.js**: Сбор и обмен ICE кандидатами
- **streams.js**: Управление медиа-стримами (audio/video track IDs)
- **updateSpdActions.js**: Обновление SDP для реконнекта
- **pingActions.js**: Heartbeat механизм (ping/pong)

### Core Services (`users/`)
- **index.js**: Управление пользователями, парами, waiting list

### Logger (`logger/`)
- **logger.js**: Логирование ошибок
- **sendError.js**: Централизованная обработка исключений
- **telegramLogs.js**: Отправка уведомлений в Telegram

## Статусы пользователя

```
idle      → Пользователь не в звонке
calling   → Исходящий вызов (ожидает ответа)
ringing   → Входящий вызов (ожидает ответа)
in_call   → Пользователь в активном звонке
ended     → Звонок завершился, но еще не сброшено состояние
```

## Ключевые потоки данных

1. **User Management Flow**: ADD_USER → users Map → Waiting List Check
2. **Call Flow**: OFFER → Waiting List → ANSWER → setPair → SWAP_ICE → in_call
3. **Heartbeat Flow**: PING → Update timestamp → Heartbeat Check → Close if timeout
4. **Reconnect Flow**: RECONNECT → Restore state → Notify peer → WebRTC renegotiation
5. **Error Flow**: Exception → handleException → Log → Telegram → Client notification

