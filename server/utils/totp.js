const crypto = require('crypto');
const base32 = require('hi-base32');
const { authenticator } = require('otplib');
const logger = require('./logger');

// Configure TOTP settings
authenticator.options = {
    window: 1, // Allow 1 step before/after for time drift
    step: 30, // 30-second step
    digits: 6, // 6-digit codes
};

/**
 * Generate a new TOTP secret
 * @returns {string} Base32 encoded secret
 */
function generateTOTP() {
    const buffer = crypto.randomBytes(20);
    const secret = base32.encode(buffer).replace(/=/g, '');
    return secret;
}

/**
 * Verify a TOTP code
 * @param {string} token - The code to verify
 * @param {string} secret - The TOTP secret
 * @returns {boolean} Whether the code is valid
 */
function verifyTOTP(token, secret) {
    try {
        return authenticator.verify({
            token,
            secret,
        });
    } catch (error) {
        logger.error('TOTP verification error:', error);
        return false;
    }
}

/**
 * Generate a TOTP code (for testing purposes)
 * @param {string} secret - The TOTP secret
 * @returns {string} The generated code
 */
function generateTOTPToken(secret) {
    try {
        return authenticator.generate(secret);
    } catch (error) {
        logger.error('TOTP generation error:', error);
        return null;
    }
}

/**
 * Get the remaining seconds until the current TOTP code expires
 * @returns {number} Seconds until expiration
 */
function getRemainingSeconds() {
    const step = authenticator.options.step;
    const epoch = Math.floor(Date.now() / 1000);
    return step - (epoch % step);
}

module.exports = {
    generateTOTP,
    verifyTOTP,
    generateTOTPToken,
    getRemainingSeconds,
};
