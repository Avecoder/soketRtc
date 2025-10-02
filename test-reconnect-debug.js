import WebSocket from 'ws';

const WS_URL = 'ws://localhost:5555';

class DebugTestClient {
    constructor(userId, name) {
        this.userId = userId;
        this.name = name;
        this.ws = null;
        this.reconnectCount = 0;
        this.messageLog = [];
    }

    connect() {
        console.log(`\n🔌 [${this.userId}] Connecting (attempt #${this.reconnectCount + 1})...`);
        this.ws = new WebSocket(WS_URL);

        this.ws.on('open', () => {
            console.log(`✅ [${this.userId}] Connected`);
            
            // Регистрируемся как пользователь
            this.send('ADD_USER', {
                userId: this.userId,
                name: this.name,
                device: 'debug-test'
            });
        });

        this.ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                this.messageLog.push({timestamp: Date.now(), message});
                
                console.log(`📨 [${this.userId}] Received:`, message.type || 'unknown', message);

                switch (message.type) {
                    case 'userConnect':
                        console.log(`✅ [${this.userId}] Successfully registered`);
                        break;
                    case '/call':
                        console.log(`📞 [${this.userId}] Incoming call from ${message.name}`);
                        // Автоматически принимаем звонок через 1 сек
                        setTimeout(() => {
                            console.log(`📞 [${this.userId}] Accepting call...`);
                            this.send('ANSWER', {
                                userId: this.userId,
                                answer: { type: 'answer', sdp: 'debug-answer-sdp' }
                            });
                        }, 1000);
                        break;
                    case '/acceptCall':
                        console.log(`🎉 [${this.userId}] Call accepted!`);
                        break;
                    case '/peerReconnected':
                        console.log(`🔄 [${this.userId}] Peer ${message.userId} reconnected`);
                        break;
                    case 'error':
                        console.error(`❌ [${this.userId}] Error: ${message.message} (handler: ${message.handler})`);
                        break;
                }
            } catch (err) {
                console.log(`📨 [${this.userId}] Raw message:`, data.toString());
            }
        });

        this.ws.on('close', () => {
            console.log(`🔌 [${this.userId}] Connection closed`);
        });

        this.ws.on('error', (err) => {
            console.error(`❌ [${this.userId}] WebSocket error:`, err.message);
        });
    }

    send(route, data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const payload = { route, ...data };
            console.log(`📤 [${this.userId}] Sending:`, route, data);
            this.ws.send(JSON.stringify(payload));
        } else {
            console.error(`❌ [${this.userId}] Cannot send - WebSocket not ready`);
        }
    }

    makeCall(targetUserId) {
        console.log(`📞 [${this.userId}] Making call to ${targetUserId}`);
        this.send('OFFER', {
            userId: this.userId,
            candidates: targetUserId,
            offer: { type: 'offer', sdp: 'debug-offer-sdp' }
        });
    }

    updateMedia(enabled) {
        console.log(`🎥 [${this.userId}] Updating media (video: ${enabled})`);
        this.send('MEDIA_UPDATE', {
            userId: this.userId,
            video: enabled,
            audio: true
        });
    }

    updateOffer() {
        console.log(`🔄 [${this.userId}] Updating offer...`);
        this.send('UPDATE_OFFER', {
            userId: this.userId,
            offer: { type: 'offer', sdp: 'updated-debug-offer-sdp' },
            isUpdate: true
        });
    }

    simulateReconnect() {
        console.log(`\n🔄 [${this.userId}] Simulating reconnect...`);
        this.reconnectCount++;
        
        if (this.ws) {
            this.ws.close();
        }
        
        setTimeout(() => {
            this.connect();
        }, 1500);
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
    }

    printMessageLog() {
        console.log(`\n📋 [${this.userId}] Message log:`);
        this.messageLog.forEach((entry, i) => {
            console.log(`  ${i + 1}. ${entry.message.type || 'unknown'}: ${JSON.stringify(entry.message).slice(0, 100)}`);
        });
    }
}

// Детальный тест переподключения с отладкой
async function detailedReconnectTest() {
    console.log('🧪 Starting detailed reconnect debug test...\n');

    const alice = new DebugTestClient('alice', 'Alice');
    const bob = new DebugTestClient('bob', 'Bob');

    // Подключаем Alice
    alice.connect();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Подключаем Bob
    bob.connect();
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Alice звонит Bob
    console.log('\n📞 === MAKING CALL ===');
    alice.makeCall('bob');
    await new Promise(resolve => setTimeout(resolve, 4000));

    // Тестируем media update до переподключения
    console.log('\n🎥 === TESTING MEDIA UPDATE (before reconnect) ===');
    alice.updateMedia(true);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Alice переподключается
    console.log('\n🔄 === ALICE RECONNECTING ===');
    alice.simulateReconnect();
    await new Promise(resolve => setTimeout(resolve, 4000));

    // Тестируем media update после переподключения Alice
    console.log('\n🎥 === TESTING MEDIA UPDATE (after Alice reconnect) ===');
    alice.updateMedia(false);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Тестируем update offer после переподключения Alice
    console.log('\n🔄 === TESTING UPDATE OFFER (after Alice reconnect) ===');
    alice.updateOffer();
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Bob переподключается
    console.log('\n🔄 === BOB RECONNECTING ===');
    bob.simulateReconnect();
    await new Promise(resolve => setTimeout(resolve, 4000));

    // Тестируем media update после переподключения Bob
    console.log('\n🎥 === TESTING MEDIA UPDATE (after Bob reconnect) ===');
    bob.updateMedia(true);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Показываем логи сообщений
    alice.printMessageLog();
    bob.printMessageLog();

    console.log('\n✅ Test completed! Check for errors above.');
    
    // Отключаемся
    setTimeout(() => {
        alice.disconnect();
        bob.disconnect();
        process.exit(0);
    }, 2000);
}

// Запускаем тест
detailedReconnectTest().catch(console.error);
