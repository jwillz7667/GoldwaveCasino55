const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { APIError } = require('./errorHandler');
const logger = require('../utils/logger');

// Configure multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Set upload directory based on file type
        let uploadDir = 'uploads/';

        switch (file.mimetype.split('/')[0]) {
            case 'image':
                uploadDir += 'images/';
                break;
            case 'video':
                uploadDir += 'videos/';
                break;
            case 'audio':
                uploadDir += 'audio/';
                break;
            case 'application':
                uploadDir += 'documents/';
                break;
            default:
                uploadDir += 'other/';
        }

        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Generate unique filename
        const uniqueSuffix = crypto.randomBytes(16).toString('hex');
        const ext = path.extname(file.originalname);
        const filename = `${path.basename(file.originalname, ext)}-${uniqueSuffix}${ext}`;

        cb(null, filename);
    },
});

// Configure file filter
const fileFilter = (req, file, cb) => {
    // Check file type
    const allowedMimeTypes = [
        // Images
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        // Documents
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        // Audio
        'audio/mpeg',
        'audio/wav',
        // Video
        'video/mp4',
        'video/webm',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
        return cb(
            new APIError('Invalid file type', 'INVALID_FILE_TYPE', 400, {
                allowedTypes: allowedMimeTypes,
                receivedType: file.mimetype,
            })
        );
    }

    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024;
    if (parseInt(req.headers['content-length']) > maxSize) {
        return cb(
            new APIError('File too large', 'FILE_TOO_LARGE', 400, {
                maxSize,
                receivedSize: req.headers['content-length'],
            })
        );
    }

    cb(null, true);
};

// Configure multer upload
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 5, // Maximum 5 files per request
    },
});

/**
 * File upload middleware
 */
const fileUpload = (fieldName, options = {}) => {
    const { multiple = false, maxCount = 1 } = options;

    return (req, res, next) => {
        const uploadHandler = multiple
            ? upload.array(fieldName, maxCount)
            : upload.single(fieldName);

        uploadHandler(req, res, (error) => {
            if (error instanceof multer.MulterError) {
                // Handle multer errors
                logger.error('File upload error:', {
                    error: error.message,
                    code: error.code,
                    field: error.field,
                });

                return next(
                    new APIError('File upload error', 'FILE_UPLOAD_ERROR', 400, {
                        message: error.message,
                        field: error.field,
                    })
                );
            }

            if (error) {
                return next(error);
            }

            // Log successful upload
            const files = req.files || [req.file];
            logger.info('Files uploaded:', {
                count: files.length,
                files: files.map((file) => ({
                    filename: file.filename,
                    size: file.size,
                    mimetype: file.mimetype,
                })),
            });

            next();
        });
    };
};

/**
 * File validation middleware
 */
const validateFile = (options = {}) => {
    const {
        maxSize = 10 * 1024 * 1024, // 10MB
        allowedTypes = [],
        allowedExtensions = [],
    } = options;

    return (req, res, next) => {
        const files = req.files || [req.file];

        for (const file of files) {
            // Check file size
            if (file.size > maxSize) {
                return next(
                    new APIError('File too large', 'FILE_TOO_LARGE', 400, {
                        maxSize,
                        receivedSize: file.size,
                        filename: file.originalname,
                    })
                );
            }

            // Check file type
            if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
                return next(
                    new APIError('Invalid file type', 'INVALID_FILE_TYPE', 400, {
                        allowedTypes,
                        receivedType: file.mimetype,
                        filename: file.originalname,
                    })
                );
            }

            // Check file extension
            const ext = path.extname(file.originalname).toLowerCase();
            if (allowedExtensions.length > 0 && !allowedExtensions.includes(ext)) {
                return next(
                    new APIError('Invalid file extension', 'INVALID_FILE_EXTENSION', 400, {
                        allowedExtensions,
                        receivedExtension: ext,
                        filename: file.originalname,
                    })
                );
            }
        }

        next();
    };
};

module.exports = {
    fileUpload,
    validateFile,
};
