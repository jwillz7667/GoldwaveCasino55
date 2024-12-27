const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Admin = require('../models/Admin');
const { generateTOTP, verifyTOTP } = require('../utils/totp');
const logger = require('../utils/logger');

class AdminAuthController {
    async login(req, res) {
        try {
            const { username, password, twoFactorCode } = req.body;

            // Find admin by username
            const admin = await Admin.findOne({ username });
            if (!admin) {
                return res.status(401).json({ message: 'Invalid credentials' });
            }

            // Verify password
            const isValidPassword = await bcrypt.compare(password, admin.password);
            if (!isValidPassword) {
                return res.status(401).json({ message: 'Invalid credentials' });
            }

            // Verify 2FA code
            const isValidTOTP = verifyTOTP(twoFactorCode, admin.totpSecret);
            if (!isValidTOTP) {
                return res.status(401).json({ message: 'Invalid 2FA code' });
            }

            // Generate JWT token
            const token = jwt.sign({ id: admin._id, role: 'admin' }, process.env.JWT_SECRET, {
                expiresIn: '8h',
            });

            // Update last login timestamp
            await Admin.findByIdAndUpdate(admin._id, {
                lastLoginAt: new Date(),
                lastLoginIp: req.ip,
            });

            res.json({
                token,
                admin: {
                    id: admin._id,
                    username: admin.username,
                    role: admin.role,
                    permissions: admin.permissions,
                },
            });
        } catch (error) {
            logger.error('Error in admin login:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async verifyToken(req, res) {
        try {
            const token = req.headers.authorization?.split(' ')[1];
            if (!token) {
                return res.status(401).json({ message: 'No token provided' });
            }

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Check if admin still exists and is active
            const admin = await Admin.findById(decoded.id);
            if (!admin || admin.status !== 'active') {
                return res.status(401).json({ message: 'Invalid token' });
            }

            res.json({
                valid: true,
                admin: {
                    id: admin._id,
                    username: admin.username,
                    role: admin.role,
                    permissions: admin.permissions,
                },
            });
        } catch (error) {
            if (error instanceof jwt.JsonWebTokenError) {
                return res.status(401).json({ message: 'Invalid token' });
            }
            logger.error('Token verification error:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async setup2FA(req, res) {
        try {
            const { adminId } = req.params;

            // Generate new TOTP secret
            const totpSecret = generateTOTP();

            // Update admin with new TOTP secret
            await Admin.findByIdAndUpdate(adminId, { totpSecret });

            res.json({
                secret: totpSecret,
                qrCode: `otpauth://totp/Casino:${req.admin.username}?secret=${totpSecret}&issuer=Casino`,
            });
        } catch (error) {
            logger.error('2FA setup error:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async verify2FA(req, res) {
        try {
            const { adminId } = req.params;
            const { code } = req.body;

            // Get admin's TOTP secret
            const admin = await Admin.findById(adminId);
            if (!admin) {
                return res.status(404).json({ message: 'Admin not found' });
            }

            // Verify TOTP code
            const isValid = verifyTOTP(code, admin.totpSecret);

            res.json({ valid: isValid });
        } catch (error) {
            logger.error('2FA verification error:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async resetPassword(req, res) {
        try {
            const { adminId } = req.params;
            const { currentPassword, newPassword } = req.body;

            // Get admin
            const admin = await Admin.findById(adminId);
            if (!admin) {
                return res.status(404).json({ message: 'Admin not found' });
            }

            // Verify current password
            const isValidPassword = await bcrypt.compare(currentPassword, admin.password);
            if (!isValidPassword) {
                return res.status(401).json({ message: 'Invalid current password' });
            }

            // Hash new password
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            // Update password
            await Admin.findByIdAndUpdate(adminId, { password: hashedPassword });

            res.json({ message: 'Password updated successfully' });
        } catch (error) {
            logger.error('Password reset error:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async logout(req, res) {
        try {
            // In a more complex system, you might want to invalidate the token
            // by adding it to a blacklist or implementing token revocation

            res.json({ message: 'Logged out successfully' });
        } catch (error) {
            logger.error('Logout error:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }
}

module.exports = new AdminAuthController();
