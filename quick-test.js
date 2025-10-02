// Быстрый тест для проверки исправлений
console.log('🧪 Quick reconnection test starting...');

// Имитируем состояние после переподключения
import { users, pairOfPeers, getPair, setPair, getUserByWs } from './users/index.js';

// Создаем тестовых пользователей
const mockWs1 = { readyState: 1, userId: 'user1' };
const mockWs2 = { readyState: 1, userId: 'user2' };

// Инициализируем пользователей
users['user1'] = new Map();
users['user2'] = new Map();

users['user1'].set(mockWs1, {
    ws: mockWs1,
    userId: 'user1',
    name: 'User 1',
    status: 'in_call',
    candidate: 'user2', // Связь есть в userData
    candidateIce: [],
    iceParams: [],
    streamIds: {}
});

users['user2'].set(mockWs2, {
    ws: mockWs2,
    userId: 'user2', 
    name: 'User 2',
    status: 'in_call',
    candidate: 'user1', // Связь есть в userData
    candidateIce: [],
    iceParams: [],
    streamIds: {}
});

// НО глобальные пары пусты (имитация после переподключения)
console.log('📊 Initial state:');
console.log('pairOfPeers:', pairOfPeers);
console.log('user1 candidate:', users['user1'].get(mockWs1).candidate);
console.log('user2 candidate:', users['user2'].get(mockWs2).candidate);

// Тестируем getPair с fallback
console.log('\n🔍 Testing getPair fallback:');
const pair1 = getPair({ userId: 'user1', ws: mockWs1 });
const pair2 = getPair({ userId: 'user2', ws: mockWs2 });

console.log('getPair(user1):', pair1);
console.log('getPair(user2):', pair2);

// Тестируем getUserByWs
console.log('\n👤 Testing getUserByWs:');
const userData1 = getUserByWs('user1', mockWs1);
const userData2 = getUserByWs('user2', mockWs2);

console.log('getUserByWs(user1) candidate:', userData1?.candidate);
console.log('getUserByWs(user2) candidate:', userData2?.candidate);

// Проверяем что все функции работают
if (pair1 === 'user2' && pair2 === 'user1' && userData1?.candidate === 'user2' && userData2?.candidate === 'user1') {
    console.log('\n✅ SUCCESS: All functions work correctly with fallback!');
} else {
    console.log('\n❌ FAILED: Functions not working correctly');
    console.log('Expected: pair1=user2, pair2=user1');
    console.log('Got: pair1=' + pair1 + ', pair2=' + pair2);
}

console.log('\n🎯 Test completed!');
