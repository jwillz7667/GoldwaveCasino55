const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            minlength: 3,
            maxlength: 30,
        },
        password: {
            type: String,
            required: true,
            select: false, // Don't return password in queries by default
        },
        status: {
            type: String,
            enum: ['active', 'suspended', 'banned'],
            default: 'active',
        },
        balance: {
            type: Number,
            default: 0,
            min: 0,
        },
        totalDeposited: {
            type: Number,
            default: 0,
        },
        totalWithdrawn: {
            type: Number,
            default: 0,
        },
        lastLogin: {
            timestamp: Date,
            ip: String,
            userAgent: String,
        },
        profile: {
            firstName: String,
            lastName: String,
            dateOfBirth: Date,
            phone: String,
            email: String,
            address: {
                street: String,
                city: String,
                state: String,
                country: String,
                postalCode: String,
            },
            verificationStatus: {
                email: {
                    type: Boolean,
                    default: false,
                },
                phone: {
                    type: Boolean,
                    default: false,
                },
                identity: {
                    type: Boolean,
                    default: false,
                },
                address: {
                    type: Boolean,
                    default: false,
                },
            },
        },
        preferences: {
            currency: {
                type: String,
                default: 'USD',
            },
            language: {
                type: String,
                default: 'en',
            },
            notifications: {
                email: {
                    type: Boolean,
                    default: true,
                },
                sms: {
                    type: Boolean,
                    default: false,
                },
                marketing: {
                    type: Boolean,
                    default: false,
                },
            },
            gameSettings: {
                soundEnabled: {
                    type: Boolean,
                    default: true,
                },
                turboMode: {
                    type: Boolean,
                    default: false,
                },
                autoPlayEnabled: {
                    type: Boolean,
                    default: false,
                },
            },
        },
        limits: {
            daily: {
                deposit: {
                    type: Number,
                    default: 1000,
                },
                loss: {
                    type: Number,
                    default: 500,
                },
            },
            weekly: {
                deposit: {
                    type: Number,
                    default: 5000,
                },
                loss: {
                    type: Number,
                    default: 2500,
                },
            },
            monthly: {
                deposit: {
                    type: Number,
                    default: 20000,
                },
                loss: {
                    type: Number,
                    default: 10000,
                },
            },
        },
        statistics: {
            gamesPlayed: {
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
            biggestWin: {
                amount: {
                    type: Number,
                    default: 0,
                },
                gameId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Game',
                },
                date: Date,
            },
            favoriteGames: [
                {
                    gameId: {
                        type: mongoose.Schema.Types.ObjectId,
                        ref: 'Game',
                    },
                    playCount: Number,
                    lastPlayed: Date,
                },
            ],
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin',
            required: true,
        },
        notes: [
            {
                content: String,
                addedBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Admin',
                },
                addedAt: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],
    },
    {
        timestamps: true,
    }
);

// Indexes for better query performance
userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ status: 1 });
userSchema.index({ 'profile.email': 1 });
userSchema.index({ 'profile.phone': 1 });
userSchema.index({ createdAt: -1 });

// Virtual for full name
userSchema.virtual('fullName').get(function () {
    if (!this.profile.firstName && !this.profile.lastName) return null;
    return `${this.profile.firstName || ''} ${this.profile.lastName || ''}`.trim();
});

// Virtual for net profit/loss
userSchema.virtual('netProfitLoss').get(function () {
    return this.statistics.totalWon - this.statistics.totalWagered;
});

// Method to validate password
userSchema.methods.validatePassword = async function (password) {
    return bcrypt.compare(password, this.password);
};

// Method to update login info
userSchema.methods.updateLoginInfo = async function (ip, userAgent) {
    this.lastLogin = {
        timestamp: new Date(),
        ip,
        userAgent,
    };
    await this.save();
};

// Method to update game statistics
userSchema.methods.updateGameStats = async function (gameId, wager, win) {
    // Update general statistics
    this.statistics.gamesPlayed += 1;
    this.statistics.totalWagered += wager;
    this.statistics.totalWon += win;

    // Update biggest win if applicable
    if (win > this.statistics.biggestWin.amount) {
        this.statistics.biggestWin = {
            amount: win,
            gameId,
            date: new Date(),
        };
    }

    // Update favorite games
    const favoriteGame = this.statistics.favoriteGames.find(
        (game) => game.gameId.toString() === gameId.toString()
    );

    if (favoriteGame) {
        favoriteGame.playCount += 1;
        favoriteGame.lastPlayed = new Date();
    } else {
        this.statistics.favoriteGames.push({
            gameId,
            playCount: 1,
            lastPlayed: new Date(),
        });
    }

    // Sort favorite games by play count
    this.statistics.favoriteGames.sort((a, b) => b.playCount - a.playCount);

    // Keep only top 10 favorite games
    if (this.statistics.favoriteGames.length > 10) {
        this.statistics.favoriteGames = this.statistics.favoriteGames.slice(0, 10);
    }

    await this.save();
};

// Pre-save middleware to hash password
userSchema.pre('save', async function (next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

const User = mongoose.model('User', userSchema);

module.exports = User;
