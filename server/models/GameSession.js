const mongoose = require('mongoose');

const gameSessionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        gameId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Game',
            required: true,
        },
        status: {
            type: String,
            enum: ['active', 'ended', 'suspended'],
            default: 'active',
        },
        startedAt: {
            type: Date,
            default: Date.now,
        },
        endedAt: {
            type: Date,
        },
        endedBy: {
            type: String,
            enum: ['user', 'admin', 'system', 'timeout'],
            default: 'user',
        },
        duration: {
            type: Number,
            default: 0, // Duration in seconds
        },
        totalWagered: {
            type: Number,
            default: 0,
        },
        totalWon: {
            type: Number,
            default: 0,
        },
        rounds: [
            {
                roundNumber: Number,
                timestamp: {
                    type: Date,
                    default: Date.now,
                },
                bet: {
                    amount: Number,
                    lines: Number,
                    multiplier: Number,
                },
                result: {
                    outcome: String, // JSON string of game-specific outcome
                    winAmount: Number,
                    multiplier: Number,
                },
            },
        ],
        clientInfo: {
            ip: String,
            userAgent: String,
            device: String,
            location: {
                country: String,
                region: String,
                city: String,
            },
        },
        settings: {
            autoPlay: {
                enabled: {
                    type: Boolean,
                    default: false,
                },
                stopConditions: {
                    onWin: Number,
                    onLoss: Number,
                    afterSpins: Number,
                },
            },
            soundEnabled: {
                type: Boolean,
                default: true,
            },
            turboMode: {
                type: Boolean,
                default: false,
            },
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for better query performance
gameSessionSchema.index({ userId: 1, status: 1 });
gameSessionSchema.index({ gameId: 1, status: 1 });
gameSessionSchema.index({ startedAt: -1 });
gameSessionSchema.index({ endedAt: -1 });

// Virtual for net profit/loss
gameSessionSchema.virtual('netResult').get(function () {
    return this.totalWon - this.totalWagered;
});

// Virtual for RTP
gameSessionSchema.virtual('rtp').get(function () {
    if (this.totalWagered === 0) return 0;
    return ((this.totalWon / this.totalWagered) * 100).toFixed(2);
});

// Method to add a new round
gameSessionSchema.methods.addRound = async function (bet, result) {
    const roundNumber = (this.rounds.length || 0) + 1;

    this.rounds.push({
        roundNumber,
        bet,
        result,
    });

    this.totalWagered += bet.amount;
    this.totalWon += result.winAmount;

    if (this.status === 'active') {
        await this.save();
    }

    return roundNumber;
};

// Method to end session
gameSessionSchema.methods.endSession = async function (endedBy = 'user') {
    if (this.status !== 'ended') {
        this.status = 'ended';
        this.endedAt = new Date();
        this.endedBy = endedBy;
        this.duration = Math.floor((this.endedAt - this.startedAt) / 1000);
        await this.save();
    }
};

// Pre-save middleware to update duration
gameSessionSchema.pre('save', function (next) {
    if (this.endedAt && this.startedAt) {
        this.duration = Math.floor((this.endedAt - this.startedAt) / 1000);
    }
    next();
});

const GameSession = mongoose.model('GameSession', gameSessionSchema);

module.exports = GameSession;
