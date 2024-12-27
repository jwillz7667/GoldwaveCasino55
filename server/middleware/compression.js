const compression = require('compression');
const logger = require('../utils/logger');

/**
 * Configure compression middleware
 */
const configureCompressionMiddleware = (app) => {
    // Enable compression for responses
    app.use(
        compression({
            // Filter function to determine which responses to compress
            filter: (req, res) => {
                // Don't compress responses with no content-type
                if (!res.getHeader('content-type')) {
                    return false;
                }

                // Don't compress if client doesn't accept it
                if (!req.headers['accept-encoding']) {
                    return false;
                }

                // Don't compress for IE6
                if (req.headers['user-agent']?.includes('MSIE 6')) {
                    return false;
                }

                // Don't compress if response is too small (less than 1KB)
                if (res.getHeader('content-length') < 1024) {
                    return false;
                }

                // Use compression filter defaults
                return compression.filter(req, res);
            },

            // Only compress responses that are larger than 1KB
            threshold: 1024,

            // Compression level (1-9, where 9 is maximum compression)
            level: 6,

            // Minimum size reduction to be achieved for compression to be used
            // (0.8 = 20% reduction minimum)
            minRatio: 0.8,

            // Function to log compression results
            onCompression: (level, size, originalSize) => {
                const ratio = (1 - size / originalSize) * 100;
                logger.debug('Compression applied:', {
                    level,
                    originalSize: `${(originalSize / 1024).toFixed(2)}KB`,
                    compressedSize: `${(size / 1024).toFixed(2)}KB`,
                    ratio: `${ratio.toFixed(1)}%`,
                });
            },
        })
    );

    // Add compression info to response headers
    app.use((req, res, next) => {
        const originalSend = res.send;

        res.send = function (body) {
            // Add Vary header to help caching servers
            res.vary('Accept-Encoding');

            // Add compression info headers if compression was applied
            const compressed = res.getHeader('content-encoding') === 'gzip';
            if (compressed) {
                const originalSize = body?.length || 0;
                const compressedSize = res.getHeader('content-length') || 0;
                const ratio = originalSize ? (1 - compressedSize / originalSize) * 100 : 0;

                res.setHeader('X-Compression-Ratio', `${ratio.toFixed(1)}%`);
                res.setHeader('X-Original-Size', originalSize);
                res.setHeader('X-Compressed-Size', compressedSize);
            }

            return originalSend.call(this, body);
        };

        next();
    });
};

module.exports = {
    configureCompressionMiddleware,
};
