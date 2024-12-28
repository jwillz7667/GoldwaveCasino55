const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const logger = require('../utils/logger');
const crypto = require('crypto');

class MonitoringServer {
    constructor(server) {
        this.wss = new WebSocket.Server({
            server,
            clientTracking: true,
            path: '/ws',
            verifyClient: (info, cb) => {
                if (process.env.NODE_ENV === 'production' && !info.secure) {
                    cb(false, 4000, 'SSL Required');
                    return;
                }
                cb(true);
            },
        });

        this.clients = new Map();
        this.rateLimiter = new Map();
        this.initialize();

        setInterval(() => this.cleanupRateLimits(), 60000);
    }

    initialize() {
        this.wss.on('connection', async (ws, req) => {
            try {
                const remoteIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

                if (this.isRateLimited(remoteIp)) {
                    ws.close(4029, 'Too Many Requests');
                    return;
                }

                // Skip authentication in development
                let authResult = { admin: { _id: 'dev' } };
                if (process.env.NODE_ENV === 'production') {
                    authResult = await this.authenticateConnection(req);
                    if (!authResult) {
                        ws.close(4001, 'Authentication failed');
                        return;
                    }
                }

                const { admin } = authResult;
                const sessionId = crypto.randomBytes(32).toString('hex');

                this.clients.set(ws, {
                    adminId: admin._id,
                    sessionId,
                    subscriptions: new Set(),
                    connectedAt: new Date(),
                    ip: remoteIp,
                    lastActivity: Date.now(),
                });

                ws.isAlive = true;
                ws.on('pong', () => {
                    ws.isAlive = true;
                    const client = this.clients.get(ws);
                    if (client) {
                        client.lastActivity = Date.now();
                    }
                });

                ws.on('error', (error) => {
                    logger.error('WebSocket error:', {
                        error: error.message,
                        adminId: admin._id,
                        sessionId,
                    });
                    // Don't close the connection, let the client retry
                });

                ws.on('message', async (message) => {
                    try {
                        if (this.isRateLimited(remoteIp)) {
                            this.sendError(ws, 'Rate limit exceeded');
                            return;
                        }

                        const data = JSON.parse(message);
                        await this.handleMessage(ws, data);

                        this.updateRateLimit(remoteIp);
                    } catch (error) {
                        logger.error('Error handling message:', {
                            error: error.message,
                            adminId: admin._id,
                            sessionId,
                        });
                        this.sendError(ws, error.message);
                    }
                });

                ws.on('close', () => {
                    const client = this.clients.get(ws);
                    if (client) {
                        logger.info('Client disconnected', {
                            adminId: client.adminId,
                            sessionId: client.sessionId,
                            duration: Date.now() - client.connectedAt.getTime(),
                        });
                    }
                    this.clients.delete(ws);
                });

                this.send(ws, {
                    type: 'connection',
                    status: 'success',
                    adminId: admin._id,
                    sessionId,
                    serverTime: new Date().toISOString(),
                });

                logger.info('New client connected', {
                    adminId: admin._id,
                    sessionId,
                    ip: remoteIp,
                });
            } catch (error) {
                logger.error('Error handling connection:', {
                    error: error.message,
                    ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                });
                ws.close(4000, 'Internal server error');
            }
        });

        // Handle server errors
        this.wss.on('error', (error) => {
            logger.error('WebSocket server error:', error);
        });

        setInterval(() => {
            this.wss.clients.forEach((ws) => {
                if (ws.isAlive === false) {
                    const client = this.clients.get(ws);
                    if (client) {
                        logger.warn('Client heartbeat timeout', {
                            adminId: client.adminId,
                            sessionId: client.sessionId,
                        });
                    }
                    return ws.terminate();
                }

                ws.isAlive = false;
                ws.ping(() => {});
            });
        }, 30000);
    }

    async authenticateConnection(req) {
        try {
            const authHeader = req.headers['authorization'];
            const token = authHeader ? authHeader.split(' ')[1] : null;

            if (!token) {
                logger.warn('Authentication failed - no token');
                return null;
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const admin = await Admin.findById(decoded.id);

            if (!admin || admin.status !== 'active') {
                logger.warn('Authentication failed - invalid admin', { adminId: decoded.id });
                return null;
            }

            return { admin };
        } catch (error) {
            logger.error('Authentication error:', { error: error.message });
            return null;
        }
    }

    isRateLimited(clientIp) {
        const limit = this.rateLimiter.get(clientIp);
        if (!limit) return false;

        const now = Date.now();
        return limit.count > 100 && now - limit.timestamp < 60000;
    }

    updateRateLimit(clientIp) {
        const now = Date.now();
        const limit = this.rateLimiter.get(clientIp) || { count: 0, timestamp: now };

        if (now - limit.timestamp >= 60000) {
            limit.count = 1;
            limit.timestamp = now;
        } else {
            limit.count++;
        }

        this.rateLimiter.set(clientIp, limit);
    }

    cleanupRateLimits() {
        const now = Date.now();
        for (const [ip, limit] of this.rateLimiter.entries()) {
            if (now - limit.timestamp >= 60000) {
                this.rateLimiter.delete(ip);
            }
        }
    }

    async handleMessage(ws, data) {
        const { type, payload } = data;
        const client = this.clients.get(ws);

        switch (type) {
            case 'subscribe':
                await this.handleSubscribe(ws, client, payload);
                break;

            case 'unsubscribe':
                await this.handleUnsubscribe(ws, client, payload);
                break;

            default:
                throw new Error('Unknown message type');
        }
    }

    async handleSubscribe(ws, client, { channels }) {
        if (!Array.isArray(channels)) {
            throw new Error('Channels must be an array');
        }

        channels.forEach((channel) => {
            client.subscriptions.add(channel);
        });

        this.send(ws, {
            type: 'subscribe',
            status: 'success',
            channels,
        });
    }

    async handleUnsubscribe(ws, client, { channels }) {
        if (!Array.isArray(channels)) {
            throw new Error('Channels must be an array');
        }

        channels.forEach((channel) => {
            client.subscriptions.delete(channel);
        });

        this.send(ws, {
            type: 'unsubscribe',
            status: 'success',
            channels,
        });
    }

    broadcast(channel, data) {
        this.wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                const clientInfo = this.clients.get(client);
                if (clientInfo && clientInfo.subscriptions.has(channel)) {
                    this.send(client, {
                        type: 'broadcast',
                        channel,
                        data,
                    });
                }
            }
        });
    }

    broadcastToAdmin(adminId, data) {
        this.wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                const clientInfo = this.clients.get(client);
                if (clientInfo && clientInfo.adminId.toString() === adminId.toString()) {
                    this.send(client, data);
                }
            }
        });
    }

    send(ws, data) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(data));
        }
    }

    sendError(ws, message) {
        this.send(ws, {
            type: 'error',
            message,
        });
    }

    // Event broadcasting methods
    broadcastUserActivity(data) {
        this.broadcast('user_activity', data);
    }

    broadcastGameActivity(data) {
        this.broadcast('game_activity', data);
    }

    broadcastTransaction(data) {
        this.broadcast('transactions', data);
    }

    broadcastSystemAlert(data) {
        this.broadcast('system_alerts', data);
    }

    // Monitoring methods
    getActiveConnections() {
        return this.wss.clients.size;
    }

    getSubscriptionStats() {
        const stats = new Map();

        this.clients.forEach((client) => {
            client.subscriptions.forEach((channel) => {
                stats.set(channel, (stats.get(channel) || 0) + 1);
            });
        });

        return Object.fromEntries(stats);
    }

    disconnectAdmin(adminId) {
        this.wss.clients.forEach((client) => {
            const clientInfo = this.clients.get(client);
            if (clientInfo && clientInfo.adminId.toString() === adminId.toString()) {
                client.close(4003, 'Admin session terminated');
            }
        });
    }
}

module.exports = MonitoringServer;
