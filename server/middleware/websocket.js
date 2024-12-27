const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const { APIError } = require('./errorHandler');
const logger = require('../utils/logger');
const { MonitoringService } = require('../services/MonitoringService');

/**
 * Configure WebSocket server
 */
const configureWebSocketServer = (server) => {
    const wss = new WebSocket.Server({
        server,
        clientTracking: true,
        perMessageDeflate: {
            zlibDeflateOptions: {
                level: 6, // Default compression level
            },
        },
    });

    // Track active connections
    let activeConnections = 0;

    // Handle new connections
    wss.on('connection', async (ws, req) => {
        try {
            // Authenticate connection
            const client = await authenticateConnection(req);

            // Set client info
            ws.clientId = client.id;
            ws.clientType = client.type;
            ws.isAlive = true;

            // Increment active connections
            activeConnections++;
            MonitoringService.updateMetric('ws_active_connections', activeConnections);

            logger.info('WebSocket connection established:', {
                clientId: client.id,
                clientType: client.type,
                ip: req.socket.remoteAddress,
            });

            // Handle ping/pong for connection health check
            ws.on('pong', () => {
                ws.isAlive = true;
            });

            // Handle messages
            ws.on('message', async (data) => {
                try {
                    const message = JSON.parse(data);

                    // Validate message format
                    if (!message.type || !message.data) {
                        throw new APIError('Invalid message format', 'INVALID_MESSAGE_FORMAT', 400);
                    }

                    // Handle message based on type
                    await handleMessage(ws, message);

                    // Update metrics
                    MonitoringService.updateMetric('ws_messages_received', 1);
                } catch (error) {
                    handleError(ws, error);
                }
            });

            // Handle connection close
            ws.on('close', () => {
                // Decrement active connections
                activeConnections--;
                MonitoringService.updateMetric('ws_active_connections', activeConnections);

                logger.info('WebSocket connection closed:', {
                    clientId: client.id,
                    clientType: client.type,
                });
            });

            // Handle errors
            ws.on('error', (error) => {
                handleError(ws, error);
            });
        } catch (error) {
            // Handle authentication errors
            ws.close(4001, error.message);
            logger.error('WebSocket authentication error:', {
                error: error.message,
                ip: req.socket.remoteAddress,
            });
        }
    });

    // Implement connection health check
    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (!ws.isAlive) {
                logger.warn('Terminating inactive WebSocket connection:', {
                    clientId: ws.clientId,
                    clientType: ws.clientType,
                });
                return ws.terminate();
            }

            ws.isAlive = false;
            ws.ping();
        });
    }, 30000); // Check every 30 seconds

    // Clean up interval on server close
    wss.on('close', () => {
        clearInterval(interval);
    });

    return wss;
};

/**
 * Authenticate WebSocket connection
 */
const authenticateConnection = async (req) => {
    const token = req.headers['sec-websocket-protocol'];

    if (!token) {
        throw new APIError('No authentication token provided', 'AUTHENTICATION_REQUIRED', 401);
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Return client info
        return {
            id: decoded.id,
            type: decoded.type,
        };
    } catch (error) {
        throw new APIError('Invalid authentication token', 'INVALID_TOKEN', 401);
    }
};

/**
 * Handle WebSocket messages
 */
const handleMessage = async (ws, message) => {
    const startTime = process.hrtime();

    try {
        // Handle different message types
        switch (message.type) {
            case 'subscribe':
                await handleSubscribe(ws, message.data);
                break;
            case 'unsubscribe':
                await handleUnsubscribe(ws, message.data);
                break;
            case 'action':
                await handleAction(ws, message.data);
                break;
            default:
                throw new APIError('Unknown message type', 'UNKNOWN_MESSAGE_TYPE', 400);
        }

        // Log message handling time
        const diff = process.hrtime(startTime);
        const duration = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);

        logger.debug('WebSocket message handled:', {
            type: message.type,
            duration: `${duration}ms`,
            clientId: ws.clientId,
        });
    } catch (error) {
        handleError(ws, error);
    }
};

/**
 * Handle subscription requests
 */
const handleSubscribe = async (ws, data) => {
    // Validate subscription data
    if (!data.channel) {
        throw new APIError('No channel specified', 'INVALID_SUBSCRIPTION', 400);
    }

    // Add client to channel subscribers
    ws.subscriptions = ws.subscriptions || new Set();
    ws.subscriptions.add(data.channel);

    logger.info('Client subscribed to channel:', {
        clientId: ws.clientId,
        channel: data.channel,
    });

    // Send confirmation
    ws.send(
        JSON.stringify({
            type: 'subscribed',
            data: {
                channel: data.channel,
            },
        })
    );
};

/**
 * Handle unsubscribe requests
 */
const handleUnsubscribe = async (ws, data) => {
    // Validate unsubscribe data
    if (!data.channel) {
        throw new APIError('No channel specified', 'INVALID_UNSUBSCRIBE', 400);
    }

    // Remove client from channel subscribers
    if (ws.subscriptions) {
        ws.subscriptions.delete(data.channel);
    }

    logger.info('Client unsubscribed from channel:', {
        clientId: ws.clientId,
        channel: data.channel,
    });

    // Send confirmation
    ws.send(
        JSON.stringify({
            type: 'unsubscribed',
            data: {
                channel: data.channel,
            },
        })
    );
};

/**
 * Handle action requests
 */
const handleAction = async (ws, data) => {
    // Validate action data
    if (!data.action) {
        throw new APIError('No action specified', 'INVALID_ACTION', 400);
    }

    // Handle different actions
    switch (data.action) {
        case 'ping':
            ws.send(
                JSON.stringify({
                    type: 'pong',
                    data: {
                        timestamp: Date.now(),
                    },
                })
            );
            break;
        default:
            throw new APIError('Unknown action', 'UNKNOWN_ACTION', 400);
    }
};

/**
 * Handle WebSocket errors
 */
const handleError = (ws, error) => {
    logger.error('WebSocket error:', {
        error: error.message,
        code: error.code,
        clientId: ws.clientId,
    });

    // Send error to client
    ws.send(
        JSON.stringify({
            type: 'error',
            data: {
                message: error.message,
                code: error.code || 'INTERNAL_ERROR',
            },
        })
    );

    // Update error metrics
    MonitoringService.updateMetric('ws_errors', 1);
};

module.exports = {
    configureWebSocketServer,
};
