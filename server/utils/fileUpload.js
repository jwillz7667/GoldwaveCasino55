const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const logger = require('./logger');

// Constants
const UPLOAD_DIR = path.join(__dirname, '../../public/uploads');
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Ensure upload directories exist
const ensureDirectories = () => {
    const directories = ['games', 'avatars', 'thumbnails'];
    directories.forEach((dir) => {
        const dirPath = path.join(UPLOAD_DIR, dir);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    });
};

// Generate unique filename
const generateFilename = (originalname) => {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(originalname);
    return `${timestamp}-${random}${ext}`;
};

// Validate file
const validateFile = (file) => {
    if (!file) {
        throw new Error('No file provided');
    }

    if (!ALLOWED_TYPES.includes(file.mimetype)) {
        throw new Error('Invalid file type');
    }

    if (file.size > MAX_FILE_SIZE) {
        throw new Error('File too large');
    }
};

// Process image
const processImage = async (file, options = {}) => {
    const { width, height, quality = 80, format = 'webp' } = options;

    let image = sharp(file.data);

    // Resize if dimensions provided
    if (width || height) {
        image = image.resize(width, height, {
            fit: 'cover',
            position: 'center',
        });
    }

    // Convert to specified format
    switch (format) {
        case 'jpeg':
            image = image.jpeg({ quality });
            break;
        case 'png':
            image = image.png({ quality });
            break;
        case 'webp':
            image = image.webp({ quality });
            break;
        default:
            throw new Error('Unsupported format');
    }

    return image;
};

// Upload image
const uploadImage = async (file, category, options = {}) => {
    try {
        // Ensure directories exist
        ensureDirectories();

        // Validate file
        validateFile(file);

        // Generate filename
        const filename = generateFilename(file.name);
        const uploadPath = path.join(UPLOAD_DIR, category, filename);

        // Process image
        const processedImage = await processImage(file, options);

        // Save image
        await processedImage.toFile(uploadPath);

        // Return relative path
        return `/uploads/${category}/${filename}`;
    } catch (error) {
        logger.error('Error uploading file:', error);
        throw error;
    }
};

// Upload multiple images
const uploadMultipleImages = async (files, category, options = {}) => {
    if (!Array.isArray(files)) {
        throw new Error('Files must be an array');
    }

    const uploadPromises = files.map((file) => uploadImage(file, category, options));
    return Promise.all(uploadPromises);
};

// Delete file
const deleteFile = async (filepath) => {
    try {
        const fullPath = path.join(UPLOAD_DIR, filepath.replace('/uploads/', ''));
        if (fs.existsSync(fullPath)) {
            await fs.promises.unlink(fullPath);
            return true;
        }
        return false;
    } catch (error) {
        logger.error('Error deleting file:', error);
        throw error;
    }
};

// Clean up old files
const cleanupOldFiles = async (category, maxAge = 24 * 60 * 60 * 1000) => {
    try {
        const directory = path.join(UPLOAD_DIR, category);
        const files = await fs.promises.readdir(directory);
        const now = Date.now();

        for (const file of files) {
            const filepath = path.join(directory, file);
            const stats = await fs.promises.stat(filepath);

            if (now - stats.mtimeMs > maxAge) {
                await fs.promises.unlink(filepath);
            }
        }
    } catch (error) {
        logger.error('Error cleaning up files:', error);
        throw error;
    }
};

module.exports = {
    uploadImage,
    uploadMultipleImages,
    deleteFile,
    cleanupOldFiles,
    ALLOWED_TYPES,
    MAX_FILE_SIZE,
};
