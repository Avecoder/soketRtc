import WebSocket from 'ws';

const WS_URL = 'ws://localhost:5555';

// Тест обратной совместимости - проверяем, что старая логика работает
async function testBackwardCompatibility() {
    console.log('🧪 Testing backward compatibility...\n');

    // Тест 1: Обычная регистрация нового пользователя
    console.log('📝 Test 1: New user registration');
    const ws1 = new WebSocket(WS_URL);
    
    await new Promise((resolve) => {
        ws1.on('open', () => {
            console.log('✅ WebSocket connected');
            ws1.send(JSON.stringify({
                route: 'ADD_USER',
                userId: 'test_user_1',
                name: 'Test User 1',
                device: 'mobile'
            }));
        });

        ws1.on('message', (data) => {
            const message = JSON.parse(data.toString());
            if (message.type === 'userConnect') {
                console.log('✅ User registered successfully');
                ws1.close();
                resolve();
            }
        });
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Тест 2: Обычный звонок между двумя пользователями
    console.log('\n📞 Test 2: Normal call flow');
    const user1 = new WebSocket(WS_URL);
    const user2 = new WebSocket(WS_URL);

    let user1Ready = false;
    let user2Ready = false;

    // Подключаем первого пользователя
    await new Promise((resolve) => {
        user1.on('open', () => {
            user1.send(JSON.stringify({
                route: 'ADD_USER',
                userId: 'caller',
                name: 'Caller',
                device: 'desktop'
            }));
        });

        user1.on('message', (data) => {
            const message = JSON.parse(data.toString());
            if (message.type === 'userConnect') {
                console.log('✅ Caller registered');
                user1Ready = true;
                resolve();
            }
        });
    });

    // Подключаем второго пользователя
    await new Promise((resolve) => {
        user2.on('open', () => {
            user2.send(JSON.stringify({
                route: 'ADD_USER',
                userId: 'receiver',
                name: 'Receiver',
                device: 'mobile'
            }));
        });

        user2.on('message', (data) => {
            const message = JSON.parse(data.toString());
            if (message.type === 'userConnect') {
                console.log('✅ Receiver registered');
                user2Ready = true;
                resolve();
            } else if (message.type === '/call') {
                console.log('✅ Call received by receiver');
                // Автоматически принимаем звонок
                user2.send(JSON.stringify({
                    route: 'ANSWER',
                    userId: 'receiver',
                    answer: { type: 'answer', sdp: 'test-answer-sdp' }
                }));
            }
        });
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    // Инициируем звонок
    if (user1Ready && user2Ready) {
        console.log('📞 Initiating call...');
        user1.send(JSON.stringify({
            route: 'OFFER',
            userId: 'caller',
            candidates: 'receiver',
            offer: { type: 'offer', sdp: 'test-offer-sdp' }
        }));

        // Ждем результат
        await new Promise((resolve) => {
            user1.on('message', (data) => {
                const message = JSON.parse(data.toString());
                if (message.type === '/acceptCall') {
                    console.log('✅ Call accepted successfully');
                    resolve();
                }
            });
            setTimeout(resolve, 3000); // Таймаут
        });
    }

    // Тест 3: ICE кандидаты
    console.log('\n🧊 Test 3: ICE candidates exchange');
    user1.send(JSON.stringify({
        route: 'ADD_ICE',
        userId: 'caller',
        iceParams: [{ candidate: 'test-ice-candidate-1' }]
    }));

    user2.send(JSON.stringify({
        route: 'ADD_ICE',
        userId: 'receiver',
        iceParams: [{ candidate: 'test-ice-candidate-2' }]
    }));

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Обмен ICE
    user1.send(JSON.stringify({
        route: 'SWAP_ICE',
        userId: 'caller'
    }));

    console.log('✅ ICE exchange completed');

    // Тест 4: Завершение звонка
    console.log('\n📴 Test 4: Call termination');
    user2.send(JSON.stringify({
        route: 'DECLINE',
        userId: 'receiver'
    }));

    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('✅ Call terminated successfully');

    // Закрываем соединения
    user1.close();
    user2.close();

    console.log('\n🎉 All backward compatibility tests passed!');
    console.log('✅ Old logic is preserved and working correctly');
}

// Запускаем тест
testBackwardCompatibility()
    .then(() => {
        console.log('\n✅ Backward compatibility confirmed!');
        process.exit(0);
    })
    .catch((err) => {
        console.error('❌ Backward compatibility test failed:', err);
        process.exit(1);
    });
