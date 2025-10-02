import WebSocket from 'ws';

const WS_URL = 'ws://localhost:5555';

class TestClient {
    constructor(userId, name) {
        this.userId = userId;
        this.name = name;
        this.ws = null;
        this.errors = [];
        this.messages = [];
    }

    connect() {
        return new Promise((resolve) => {
            console.log(`🔌 [${this.userId}] Connecting...`);
            this.ws = new WebSocket(WS_URL);

            this.ws.on('open', () => {
                console.log(`✅ [${this.userId}] Connected`);
                this.send('ADD_USER', {
                    userId: this.userId,
                    name: this.name,
                    device: 'test'
                });
            });

            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.messages.push(message);
                    
                    if (message.type === 'error') {
                        this.errors.push(message);
                        console.error(`❌ [${this.userId}] ERROR: ${message.message} (${message.handler})`);
                    } else {
                        console.log(`📨 [${this.userId}] ${message.type || 'message'}`);
                    }

                    if (message.type === 'userConnect') {
                        resolve();
                    } else if (message.type === '/call') {
                        console.log(`📞 [${this.userId}] Incoming call, accepting...`);
                        setTimeout(() => {
                            this.send('ANSWER', {
                                userId: this.userId,
                                answer: { type: 'answer', sdp: 'test-answer' }
                            });
                        }, 500);
                    }
                } catch (err) {
                    console.log(`📨 [${this.userId}] Raw:`, data.toString());
                }
            });

            this.ws.on('error', (err) => {
                console.error(`❌ [${this.userId}] WS Error:`, err.message);
            });
        });
    }

    send(route, data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log(`📤 [${this.userId}] Sending ${route}`);
            this.ws.send(JSON.stringify({ route, ...data }));
        }
    }

    makeCall(targetId) {
        this.send('OFFER', {
            userId: this.userId,
            candidates: targetId,
            offer: { type: 'offer', sdp: 'test-offer' }
        });
    }

    updateOffer() {
        this.send('UPDATE_OFFER', {
            userId: this.userId,
            offer: { type: 'offer', sdp: 'updated-offer' },
            isUpdate: true
        });
    }

    updateMedia() {
        this.send('MEDIA_UPDATE', {
            userId: this.userId,
            video: true,
            audio: true
        });
    }

    reconnect() {
        return new Promise((resolve) => {
            console.log(`🔄 [${this.userId}] Reconnecting...`);
            this.ws.close();
            
            setTimeout(async () => {
                await this.connect();
                resolve();
            }, 1000);
        });
    }

    disconnect() {
        if (this.ws) this.ws.close();
    }

    getErrors() {
        return this.errors;
    }
}

async function testReconnectionFix() {
    console.log('🧪 Testing reconnection fix...\n');

    const alice = new TestClient('alice', 'Alice');
    const bob = new TestClient('bob', 'Bob');

    try {
        // 1. Подключение
        console.log('\n=== STEP 1: Initial connection ===');
        await alice.connect();
        await bob.connect();
        await new Promise(r => setTimeout(r, 1000));

        // 2. Звонок
        console.log('\n=== STEP 2: Making call ===');
        alice.makeCall('bob');
        await new Promise(r => setTimeout(r, 3000));

        // 3. Проверяем что звонок установлен
        console.log('\n=== STEP 3: Testing media update (before reconnect) ===');
        alice.updateMedia();
        await new Promise(r => setTimeout(r, 1000));

        // 4. Alice переподключается
        console.log('\n=== STEP 4: Alice reconnecting ===');
        await alice.reconnect();
        await new Promise(r => setTimeout(r, 2000));

        // 5. Тестируем функции после переподключения Alice
        console.log('\n=== STEP 5: Testing after Alice reconnect ===');
        alice.updateMedia();
        await new Promise(r => setTimeout(r, 1000));
        
        alice.updateOffer();
        await new Promise(r => setTimeout(r, 1000));

        // 6. Bob переподключается
        console.log('\n=== STEP 6: Bob reconnecting ===');
        await bob.reconnect();
        await new Promise(r => setTimeout(r, 2000));

        // 7. Тестируем функции после переподключения Bob
        console.log('\n=== STEP 7: Testing after Bob reconnect ===');
        bob.updateMedia();
        await new Promise(r => setTimeout(r, 1000));

        // 8. Результаты
        console.log('\n=== RESULTS ===');
        const aliceErrors = alice.getErrors();
        const bobErrors = bob.getErrors();

        console.log(`Alice errors: ${aliceErrors.length}`);
        aliceErrors.forEach(err => console.log(`  - ${err.message} (${err.handler})`));

        console.log(`Bob errors: ${bobErrors.length}`);
        bobErrors.forEach(err => console.log(`  - ${err.message} (${err.handler})`));

        if (aliceErrors.length === 0 && bobErrors.length === 0) {
            console.log('🎉 SUCCESS: No errors after reconnection!');
        } else {
            console.log('❌ FAILED: Errors still present after reconnection');
        }

    } catch (err) {
        console.error('Test failed:', err);
    } finally {
        alice.disconnect();
        bob.disconnect();
        setTimeout(() => process.exit(0), 1000);
    }
}

testReconnectionFix();
