require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../server/models/Admin');

async function createDefaultAdmin() {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('Connected to MongoDB');

        // Check if admin already exists
        const existingAdmin = await Admin.findOne({ 'profile.email': 'admin@goldwave.casino' });
        if (existingAdmin) {
            console.log('Admin account already exists');
            process.exit(0);
        }

        // Create default admin
        const admin = new Admin({
            username: 'admin',
            password: 'admin123!@#',
            role: 'super_admin',
            status: 'active',
            profile: {
                firstName: 'Admin',
                lastName: 'User',
                email: 'admin@goldwave.casino',
                phone: '',
            },
            settings: {
                timezone: 'UTC',
                language: 'en',
                notifications: {
                    email: true,
                    browser: true,
                },
                twoFactorAuth: {
                    enabled: false
                }
            }
        });

        await admin.save();
        console.log('Default admin account created successfully');
        console.log('Username: admin');
        console.log('Password: admin123!@#');
        console.log('Email: admin@goldwave.casino');
        
        process.exit(0);
    } catch (error) {
        console.error('Error creating admin account:', error);
        process.exit(1);
    }
}

createDefaultAdmin(); 