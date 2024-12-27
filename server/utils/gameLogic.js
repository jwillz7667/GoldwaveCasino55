const crypto = require('crypto');

// Constants for slot game
const SLOT_SYMBOLS = {
    WILD: { id: 'wild', multiplier: 2 },
    SEVEN: { id: '7', multiplier: 1.5 },
    BAR3: { id: 'bar3', multiplier: 1.2 },
    BAR2: { id: 'bar2', multiplier: 1 },
    BAR1: { id: 'bar1', multiplier: 0.8 },
    CHERRY: { id: 'cherry', multiplier: 0.5 },
    LEMON: { id: 'lemon', multiplier: 0.3 },
};

const PAYLINES = [
    // Horizontal lines
    [0, 1, 2], // Top row
    [3, 4, 5], // Middle row
    [6, 7, 8], // Bottom row
    // Diagonal lines
    [0, 4, 8], // Top left to bottom right
    [6, 4, 2], // Bottom left to top right
    // V-shaped lines
    [0, 3, 6], // Left column
    [1, 4, 7], // Middle column
    [2, 5, 8], // Right column
];

// Validate bet parameters
const validateBet = (bet) => {
    if (!bet || typeof bet !== 'object') {
        return 'Invalid bet format';
    }

    if (!bet.amount || typeof bet.amount !== 'number' || bet.amount <= 0) {
        return 'Invalid bet amount';
    }

    if (
        bet.lines &&
        (typeof bet.lines !== 'number' || bet.lines < 1 || bet.lines > PAYLINES.length)
    ) {
        return 'Invalid number of lines';
    }

    if (bet.multiplier && (typeof bet.multiplier !== 'number' || bet.multiplier < 1)) {
        return 'Invalid multiplier';
    }

    return null;
};

// Generate random symbols for slot game
const generateSlotSymbols = () => {
    const symbols = Object.keys(SLOT_SYMBOLS);
    const reels = [];

    // Generate 9 random symbols (3x3 grid)
    for (let i = 0; i < 9; i++) {
        const randomIndex = crypto.randomInt(0, symbols.length);
        reels.push(SLOT_SYMBOLS[symbols[randomIndex]]);
    }

    return reels;
};

// Calculate win for slot game
const calculateSlotWin = (reels, bet) => {
    let totalWin = 0;
    const winningLines = [];
    const numLines = bet.lines || PAYLINES.length;

    // Check each payline
    for (let i = 0; i < numLines; i++) {
        const line = PAYLINES[i];
        const symbols = line.map((pos) => reels[pos]);

        // Check for winning combination
        if (isWinningCombination(symbols)) {
            const lineWin = calculateLineWin(symbols, bet.amount / numLines);
            if (lineWin > 0) {
                winningLines.push({
                    line: i + 1,
                    positions: line,
                    symbols: symbols.map((s) => s.id),
                    win: lineWin,
                });
                totalWin += lineWin;
            }
        }
    }

    // Apply bet multiplier if any
    if (bet.multiplier && bet.multiplier > 1) {
        totalWin *= bet.multiplier;
    }

    return {
        reels: reels.map((s) => s.id),
        totalWin,
        winningLines,
        multiplier: bet.multiplier || 1,
    };
};

// Check if symbol combination is a win
const isWinningCombination = (symbols) => {
    // Check for three matching symbols or wilds
    const firstSymbol = symbols[0].id;
    return symbols.every(
        (symbol) => symbol.id === firstSymbol || symbol.id === SLOT_SYMBOLS.WILD.id
    );
};

// Calculate win amount for a single line
const calculateLineWin = (symbols, baseWager) => {
    const firstSymbol = symbols[0];
    let multiplier = firstSymbol.multiplier;
    let wildCount = 0;

    // Count wilds and adjust multiplier
    symbols.forEach((symbol) => {
        if (symbol.id === SLOT_SYMBOLS.WILD.id) {
            wildCount++;
            multiplier *= SLOT_SYMBOLS.WILD.multiplier;
        }
    });

    // Bonus multiplier for multiple wilds
    if (wildCount > 1) {
        multiplier *= Math.pow(2, wildCount - 1);
    }

    return baseWager * multiplier;
};

// Main function to calculate win for any game type
const calculateWin = async (bet, session) => {
    const game = await session.populate('gameId');
    let reels;

    switch (game.gameId.type) {
        case 'slot':
            reels = generateSlotSymbols();
            return calculateSlotWin(reels, bet);

        // Add other game types here
        default:
            throw new Error('Unsupported game type');
    }
};

// Verify game result integrity
const verifyGameResult = (result, serverSeed, clientSeed) => {
    const hash = crypto.createHmac('sha256', serverSeed).update(clientSeed).digest('hex');

    // Verify that the result matches the hash
    const expectedHash = crypto
        .createHmac('sha256', serverSeed)
        .update(JSON.stringify(result))
        .update(clientSeed)
        .digest('hex');

    return hash === expectedHash;
};

// Generate new server seed
const generateServerSeed = () => {
    return crypto.randomBytes(32).toString('hex');
};

// Hash server seed for client
const hashServerSeed = (serverSeed) => {
    return crypto.createHash('sha256').update(serverSeed).digest('hex');
};

module.exports = {
    validateBet,
    calculateWin,
    verifyGameResult,
    generateServerSeed,
    hashServerSeed,
    SLOT_SYMBOLS,
    PAYLINES,
};
