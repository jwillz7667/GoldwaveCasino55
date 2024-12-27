const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        type: {
            type: String,
            required: true,
            enum: ['slot', 'card', 'table', 'other'],
            default: 'slot',
        },
        description: {
            type: String,
            required: true,
            trim: true,
        },
        thumbnail: {
            type: String,
            required: true,
        },
        settings: {
            type: Object,
            default: {},
            // Game-specific settings like RTP, min/max bet, paylines, etc.
        },
        status: {
            type: String,
            enum: ['active', 'inactive', 'maintenance'],
            default: 'inactive',
        },
        statistics: {
            totalPlays: {
                type: Number,
                default: 0,
            },
            totalWagered: {
                type: Number,
                default: 0,
            },
            totalWon: {
                type: Number,
                default: 0,
            },
            lastPlayed: {
                type: Date,
            },
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin',
            required: true,
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin',
        },
    },
    {
        timestamps: true,
    }
);

// Virtual for house edge calculation
gameSchema.virtual('houseEdge').get(function () {
    if (this.statistics.totalWagered === 0) return 0;
    return (
        ((this.statistics.totalWagered - this.statistics.totalWon) / this.statistics.totalWagered) *
        100
    ).toFixed(2);
});

// Method to update game statistics
gameSchema.methods.updateStatistics = async function (wager, win) {
    this.statistics.totalPlays += 1;
    this.statistics.totalWagered += wager;
    this.statistics.totalWon += win;
    this.statistics.lastPlayed = new Date();
    await this.save();
};

// Pre-save middleware to ensure required fields
gameSchema.pre('save', function (next) {
    if (!this.description) {
        this.description = `${this.name} - A ${this.type} game`;
    }
    next();
});

const Game = mongoose.model('Game', gameSchema);

module.exports = Game;
