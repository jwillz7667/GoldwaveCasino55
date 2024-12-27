const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        type: {
            type: String,
            enum: ['deposit', 'withdrawal', 'bet', 'win', 'bonus', 'adjustment'],
            required: true,
        },
        amount: {
            type: Number,
            required: true,
        },
        currency: {
            type: String,
            required: true,
            default: 'USD',
        },
        status: {
            type: String,
            enum: ['pending', 'completed', 'failed', 'cancelled', 'reversed'],
            default: 'pending',
        },
        gameId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Game',
        },
        gameSessionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'GameSession',
        },
        roundId: String,
        reference: {
            type: String,
            unique: true,
            required: true,
        },
        description: String,
        metadata: {
            paymentMethod: String,
            paymentProvider: String,
            providerTransactionId: String,
            processingFee: Number,
            exchangeRate: Number,
            originalAmount: Number,
            originalCurrency: String,
        },
        balanceAfter: {
            type: Number,
            required: true,
        },
        balanceBefore: {
            type: Number,
            required: true,
        },
        processedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin',
        },
        processedAt: Date,
        clientInfo: {
            ip: String,
            userAgent: String,
            location: {
                country: String,
                region: String,
                city: String,
            },
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
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ type: 1, status: 1 });
transactionSchema.index({ reference: 1 }, { unique: true });
transactionSchema.index({ gameId: 1, type: 1 });
transactionSchema.index({ gameSessionId: 1 });

// Virtual for transaction direction
transactionSchema.virtual('direction').get(function () {
    return ['deposit', 'win', 'bonus'].includes(this.type) ? 'credit' : 'debit';
});

// Method to process transaction
transactionSchema.methods.process = async function (adminId) {
    if (this.status !== 'pending') {
        throw new Error('Transaction cannot be processed: Invalid status');
    }

    this.status = 'completed';
    this.processedBy = adminId;
    this.processedAt = new Date();

    await this.save();

    // Update user balance
    await mongoose.model('User').findByIdAndUpdate(this.userId, { $inc: { balance: this.amount } });

    return this;
};

// Method to reverse transaction
transactionSchema.methods.reverse = async function (adminId, reason) {
    if (this.status !== 'completed') {
        throw new Error('Transaction cannot be reversed: Invalid status');
    }

    // Create reversal transaction
    const reversal = new this.constructor({
        userId: this.userId,
        type: this.type,
        amount: -this.amount,
        currency: this.currency,
        reference: `${this.reference}-reversal`,
        description: `Reversal of transaction ${this.reference}: ${reason}`,
        balanceBefore: this.balanceAfter,
        balanceAfter: this.balanceBefore,
        metadata: {
            originalTransactionId: this._id,
            reversalReason: reason,
        },
        processedBy: adminId,
    });

    // Update original transaction
    this.status = 'reversed';
    this.notes.push({
        content: `Transaction reversed: ${reason}`,
        addedBy: adminId,
    });

    await Promise.all([
        reversal.save(),
        this.save(),
        mongoose.model('User').findByIdAndUpdate(this.userId, { $inc: { balance: -this.amount } }),
    ]);

    return reversal;
};

// Pre-save middleware
transactionSchema.pre('save', function (next) {
    // Generate reference if not provided
    if (!this.reference) {
        this.reference = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Validate amount based on transaction type
    if (this.isModified('amount')) {
        if (['withdrawal', 'bet'].includes(this.type) && this.amount > 0) {
            this.amount = -Math.abs(this.amount);
        } else if (['deposit', 'win', 'bonus'].includes(this.type) && this.amount < 0) {
            this.amount = Math.abs(this.amount);
        }
    }

    next();
});

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
