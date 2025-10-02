// Утилита для отладки состояния пользователей и пар
import { users, pairOfPeers, waitingList } from './users/index.js';

export const debugState = () => {
    console.log('\n=== DEBUG STATE ===');
    
    console.log('\n📊 USERS:');
    for (const [userId, userMap] of Object.entries(users)) {
        console.log(`  User ${userId}:`);
        for (const [ws, userData] of userMap) {
            console.log(`    - Status: ${userData.status}`);
            console.log(`    - Candidate: ${userData.candidate || 'none'}`);
            console.log(`    - UUID: ${userData.uuid}`);
            console.log(`    - WS ready: ${ws.readyState === 1 ? 'yes' : 'no'}`);
        }
    }
    
    console.log('\n🔗 PAIRS:');
    for (const [userId, partnerId] of Object.entries(pairOfPeers)) {
        console.log(`  ${userId} <-> ${partnerId}`);
    }
    
    console.log('\n⏳ WAITING LIST:');
    for (const [userId, data] of Object.entries(waitingList)) {
        console.log(`  ${userId}: ${data.candidates} (${data.action || 'call'})`);
    }
    
    console.log('\n=== END DEBUG ===\n');
};

// Добавляем глобальную функцию для вызова из консоли
global.debugState = debugState;
