let gameData = {
    round: 0,
    winners: [],
    playersOnline: 0,
    balances: {},
    bets: {},
    totalBetsPerType: {
        crab: 0,
        fish: 0,
        gourd: 0,
        rooster: 0,
        tiger: 0,
        prawn: 0
    },
    totalWon: {},
    stats: {
        crab: 0,
        fish: 0,
        gourd: 0,
        rooster: 0,
        tiger: 0,
        prawn: 0
    },
    totalRolls: 0,
    lastUpdated: Date.now(),
    timer: 15,
    lockedUsers: [],
    activeConnections: new Set()
};

exports.handler = async (event) => {
    const body = JSON.parse(event.body || '{}');
    const { action, userId, amount, animal, round, timer } = body;
    const clientIP = event.headers['client-ip'] || 'unknown';

    // Update active connections based on IP or userId
    if (action !== 'getGameData' && userId) {
        gameData.activeConnections.add(`${userId}-${clientIP}`);
        gameData.playersOnline = gameData.activeConnections.size;
        gameData.balances[userId] = gameData.balances[userId] || 10000;
    }

    // Remove inactive users (simplified logic, can be enhanced with timeout)
    gameData.activeConnections.forEach(conn => {
        if (!Object.keys(gameData.bets).some(uid => uid.startsWith(conn.split('-')[0]))) {
            gameData.activeConnections.delete(conn);
            gameData.playersOnline = gameData.activeConnections.size;
        }
    });

    if (Date.now() - gameData.lastUpdated >= 15000) {
        gameData.round++;
        gameData.winners = [];
        gameData.timer = 15;
        gameData.lastUpdated = Date.now();
        gameData.bets = {};
        gameData.totalBetsPerType = {
            crab: 0,
            fish: 0,
            gourd: 0,
            rooster: 0,
            tiger: 0,
            prawn: 0
        };
    }

    switch (action) {
        case 'getGameData':
            return { statusCode: 200, body: JSON.stringify(gameData) };
        case 'updateRound':
            gameData.round = round;
            return { statusCode: 200, body: JSON.stringify({ success: true }) };
        case 'placeBet':
            if (gameData.lockedUsers.includes(userId)) return { statusCode: 403, body: JSON.stringify({ error: 'Account locked' }) };
            gameData.bets[userId] = gameData.bets[userId] || {};
            gameData.bets[userId][round] = gameData.bets[userId][round] || {};
            gameData.bets[userId][round][animal] = (gameData.bets[userId][round][animal] || 0) + amount;
            gameData.balances[userId] = (gameData.balances[userId] || 10000) - amount;
            gameData.totalBetsPerType[animal] = (gameData.totalBetsPerType[animal] || 0) + amount;
            return { statusCode: 200, body: JSON.stringify({ success: true }) };
        case 'clearBets':
            gameData.bets[userId] = {};
            gameData.totalBetsPerType = {
                crab: 0,
                fish: 0,
                gourd: 0,
                rooster: 0,
                tiger: 0,
                prawn: 0
            };
            return { statusCode: 200, body: JSON.stringify({ success: true }) };
        case 'updatePlayerBets':
            gameData.totalBetsPerType = {
                crab: 0,
                fish: 0,
                gourd: 0,
                rooster: 0,
                tiger: 0,
                prawn: 0
            };
            for (const uid in gameData.bets) {
                for (const r in gameData.bets[uid]) {
                    for (const type in gameData.bets[uid][r]) {
                        gameData.totalBetsPerType[type] += gameData.bets[uid][r][type];
                    }
                }
            }
            return { statusCode: 200, body: JSON.stringify({ totalBetsPerType: gameData.totalBetsPerType }) };
        case 'updateBalance':
            gameData.balances[userId] = (gameData.balances[userId] || 10000) + amount;
            gameData.totalWon[userId] = (gameData.totalWon[userId] || 0) + amount;
            return { statusCode: 200, body: JSON.stringify({ success: true }) };
        case 'updateStats':
            gameData.stats = body.stats;
            gameData.totalRolls = body.totalRolls;
            gameData.winners = body.winners || [];
            return { statusCode: 200, body: JSON.stringify({ success: true }) };
        case 'updateTimer':
            gameData.timer = timer;
            return { statusCode: 200, body: JSON.stringify({ success: true }) };
        case 'deposit':
            gameData.balances[userId] = (gameData.balances[userId] || 10000) + amount;
            await fetch('https://thai-fish-prawn-crab.netlify.app/.netlify/functions/data', {
                method: 'POST',
                body: JSON.stringify({ action: 'updateTransactionHistory', userId, text: `📥 ငွေသွင်းအတည်ပြု: ${amount} MMK` })
            });
            return { statusCode: 200, body: JSON.stringify({ success: true }) };
        case 'withdraw':
            gameData.balances[userId] = (gameData.balances[userId] || 10000) - amount;
            if (gameData.balances[userId] < 0) {
                gameData.balances[userId] = 0;
                return { statusCode: 400, body: JSON.stringify({ error: 'Insufficient balance' }) };
            }
            gameData.lockedUsers.push(userId);
            await fetch('https://thai-fish-prawn-crab.netlify.app/.netlify/functions/data', {
                method: 'POST',
                body: JSON.stringify({ action: 'updateTransactionHistory', userId, text: `📤 ငွေထုတ်အတည်ပြု: ${amount} MMK` })
            });
            return { statusCode: 200, body: JSON.stringify({ success: true }) };
        case 'unlockUser':
            if (gameData.lockedUsers.includes(userId)) {
                gameData.lockedUsers = gameData.lockedUsers.filter(u => u !== userId);
                return { statusCode: 200, body: JSON.stringify({ success: true }) };
            }
            return { statusCode: 400, body: JSON.stringify({ error: 'User not locked' }) };
        case 'updateTransactionHistory':
            const transactionHistory = JSON.parse(localStorage.getItem(`transactionHistory_${userId}`)) || [];
            transactionHistory.unshift(body.text);
            if (transactionHistory.length > 10) transactionHistory.pop();
            localStorage.setItem(`transactionHistory_${userId}`, JSON.stringify(transactionHistory));
            return { statusCode: 200, body: JSON.stringify({ success: true }) };
        default:
            return { statusCode: 400, body: JSON.stringify({ error: 'Invalid action' }) };
    }
};
