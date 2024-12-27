const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema(
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
        role: {
            type: String,
            enum: ['super_admin', 'admin', 'manager', 'support'],
            required: true,
        },
        status: {
            type: String,
            enum: ['active', 'inactive', 'suspended'],
            default: 'active',
        },
        profile: {
            firstName: {
                type: String,
                required: true,
            },
            lastName: {
                type: String,
                required: true,
            },
            email: {
                type: String,
                required: true,
                unique: true,
                trim: true,
                lowercase: true,
            },
            phone: String,
            avatar: String,
        },
        permissions: {
            users: {
                view: {
                    type: Boolean,
                    default: true,
                },
                create: Boolean,
                edit: Boolean,
                delete: Boolean,
                manage_balance: Boolean,
            },
            games: {
                view: {
                    type: Boolean,
                    default: true,
                },
                create: Boolean,
                edit: Boolean,
                delete: Boolean,
                manage_settings: Boolean,
            },
            transactions: {
                view: {
                    type: Boolean,
                    default: true,
                },
                process: Boolean,
                reverse: Boolean,
                manage_limits: Boolean,
            },
            reports: {
                view: {
                    type: Boolean,
                    default: true,
                },
                export: Boolean,
                manage_settings: Boolean,
            },
            system: {
                view: Boolean,
                manage_settings: Boolean,
                manage_admins: Boolean,
                view_logs: Boolean,
            },
        },
        lastLogin: {
            timestamp: Date,
            ip: String,
            userAgent: String,
        },
        activityLog: [
            {
                action: String,
                details: mongoose.Schema.Types.Mixed,
                ip: String,
                userAgent: String,
                timestamp: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],
        settings: {
            timezone: {
                type: String,
                default: 'UTC',
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
                browser: {
                    type: Boolean,
                    default: true,
                },
            },
            twoFactorAuth: {
                enabled: {
                    type: Boolean,
                    default: false,
                },
                secret: String,
                backupCodes: [String],
            },
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin',
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
adminSchema.index({ username: 1 }, { unique: true });
adminSchema.index({ 'profile.email': 1 }, { unique: true });
adminSchema.index({ role: 1 });
adminSchema.index({ status: 1 });
adminSchema.index({ createdAt: -1 });

// Virtual for full name
adminSchema.virtual('fullName').get(function () {
    return `${this.profile.firstName} ${this.profile.lastName}`;
});

// Method to validate password
adminSchema.methods.validatePassword = async function (password) {
    return bcrypt.compare(password, this.password);
};

// Method to update login info
adminSchema.methods.updateLoginInfo = async function (ip, userAgent) {
    this.lastLogin = {
        timestamp: new Date(),
        ip,
        userAgent,
    };
    await this.save();
};

// Method to log activity
adminSchema.methods.logActivity = async function (action, details, ip, userAgent) {
    this.activityLog.push({
        action,
        details,
        ip,
        userAgent,
    });
    await this.save();
};

// Method to check permission
adminSchema.methods.hasPermission = function (category, action) {
    if (this.role === 'super_admin') return true;
    return this.permissions[category]?.[action] === true;
};

// Pre-save middleware to hash password
adminSchema.pre('save', async function (next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }

    // Set default permissions based on role
    if (this.isModified('role')) {
        switch (this.role) {
            case 'super_admin':
                // Super admin has all permissions
                Object.keys(this.permissions).forEach((category) => {
                    Object.keys(this.permissions[category]).forEach((action) => {
                        this.permissions[category][action] = true;
                    });
                });
                break;

            case 'admin':
                // Admin has most permissions except system management
                Object.keys(this.permissions).forEach((category) => {
                    if (category !== 'system') {
                        Object.keys(this.permissions[category]).forEach((action) => {
                            this.permissions[category][action] = true;
                        });
                    }
                });
                break;

            case 'manager':
                // Manager has view and edit permissions
                Object.keys(this.permissions).forEach((category) => {
                    Object.keys(this.permissions[category]).forEach((action) => {
                        this.permissions[category][action] = ['view', 'edit'].includes(action);
                    });
                });
                break;

            case 'support':
                // Support has only view permissions
                Object.keys(this.permissions).forEach((category) => {
                    Object.keys(this.permissions[category]).forEach((action) => {
                        this.permissions[category][action] = action === 'view';
                    });
                });
                break;
        }
    }

    next();
});

const Admin = mongoose.model('Admin', adminSchema);

module.exports = Admin;
