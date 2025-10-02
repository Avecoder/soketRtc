import WebSocket from 'ws';

const WS_URL = 'ws://localhost:5555';

class ReconnectTestClient {
    constructor(userId, name) {
        this.userId = userId;
        this.name = name;
        this.ws = null;
        this.reconnectCount = 0;
        this.isInCall = false;
    }

    connect() {
        console.log(`[${this.userId}] Connecting...`);
        this.ws = new WebSocket(WS_URL);

        this.ws.on('open', () => {
            console.log(`[${this.userId}] Connected (reconnect #${this.reconnectCount})`);
            
            // Регистрируемся как пользователь
            this.send('ADD_USER', {
                userId: this.userId,
                name: this.name,
                device: 'test'
            });
        });

        this.ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                console.log(`[${this.userId}] Received:`, message);

                switch (message.type) {
                    case 'userConnect':
                        console.log(`[${this.userId}] Successfully registered`);
                        break;
                    case '/call':
                        console.log(`[${this.userId}] Incoming call from ${message.name}`);
                        this.isInCall = true;
                        // Автоматически принимаем звонок
                        setTimeout(() => {
                            this.send('ANSWER', {
                                userId: this.userId,
                                answer: { type: 'answer', sdp: 'fake-answer-sdp' }
                            });
                        }, 1000);
                        break;
                    case '/acceptCall':
                        console.log(`[${this.userId}] Call accepted!`);
                        this.isInCall = true;
                        break;
                    case '/peerReconnected':
                        console.log(`[${this.userId}] Peer ${message.userId} reconnected during call`);
                        break;
                    case 'error':
                        console.error(`[${this.userId}] Error:`, message.message);
                        break;
                }
            } catch (err) {
                console.log(`[${this.userId}] Raw message:`, data.toString());
            }
        });

        this.ws.on('close', () => {
            console.log(`[${this.userId}] Connection closed`);
        });

        this.ws.on('error', (err) => {
            console.error(`[${this.userId}] WebSocket error:`, err.message);
        });
    }

    send(route, data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ route, ...data }));
        }
    }

    makeCall(targetUserId) {
        console.log(`[${this.userId}] Making call to ${targetUserId}`);
        this.send('OFFER', {
            userId: this.userId,
            candidates: targetUserId,
            offer: { type: 'offer', sdp: 'fake-offer-sdp' }
        });
    }

    simulateReconnect() {
        console.log(`[${this.userId}] Simulating reconnect...`);
        this.reconnectCount++;
        
        if (this.ws) {
            this.ws.close();
        }
        
        setTimeout(() => {
            this.connect();
        }, 1000);
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

// Тест сценария переподключения во время звонка
async function testReconnectDuringCall() {
    console.log('🧪 Starting reconnect test...\n');

    const user1 = new ReconnectTestClient('user1', 'Alice');
    const user2 = new ReconnectTestClient('user2', 'Bob');

    // Подключаем обоих пользователей
    user1.connect();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    user2.connect();
    await new Promise(resolve => setTimeout(resolve, 1000));

    // User1 звонит User2
    console.log('\n📞 User1 calling User2...');
    user1.makeCall('user2');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Симулируем переподключение User1 во время звонка
    console.log('\n🔄 Simulating User1 VPN reconnect during call...');
    user1.simulateReconnect();
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Пытаемся обновить offer после переподключения
    console.log('\n🔄 User1 trying to update offer after reconnect...');
    user1.send('UPDATE_OFFER', {
        userId: 'user1',
        offer: { type: 'offer', sdp: 'updated-offer-sdp' },
        isUpdate: true
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Симулируем переподключение User2
    console.log('\n🔄 Simulating User2 reconnect...');
    user2.simulateReconnect();
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Пытаемся обновить answer после переподключения
    console.log('\n🔄 User2 trying to update answer after reconnect...');
    user2.send('UPDATE_ANSWER', {
        userId: 'user2',
        answer: { type: 'answer', sdp: 'updated-answer-sdp' },
        isUpdate: true
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\n✅ Test completed! Check server logs for session recovery.');
    
    // Отключаемся
    setTimeout(() => {
        user1.disconnect();
        user2.disconnect();
        process.exit(0);
    }, 2000);
}

// Запускаем тест
testReconnectDuringCall().catch(console.error);
