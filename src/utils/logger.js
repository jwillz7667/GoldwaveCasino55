// Environment-aware logger for frontend
const isDevelopment = process.env.NODE_ENV === 'development';

class Logger {
    error(message, ...args) {
        if (isDevelopment) {
            console.error(message, ...args);
        }
        // In production, you might want to send errors to a monitoring service
        // this.sendToMonitoringService('error', message, args);
    }

    warn(message, ...args) {
        if (isDevelopment) {
            console.warn(message, ...args);
        }
    }

    info(message, ...args) {
        if (isDevelopment) {
            console.info(message, ...args);
        }
    }

    debug(message, ...args) {
        if (isDevelopment) {
            console.debug(message, ...args);
        }
    }

    // Method to send errors to a monitoring service in production
    // sendToMonitoringService(level, message, args) {
    //     // Implementation for production error monitoring
    // }
}

export default new Logger(); 