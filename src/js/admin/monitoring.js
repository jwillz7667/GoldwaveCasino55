import { showNotification, formatDateTime } from './dashboard.js';

class MonitoringSystem {
    constructor() {
        this.ws = null;
        this.charts = {};
        this.activeUsers = new Map();
        this.liveGames = new Map();
        this.systemMetrics = {};
        this.messageHandlers = {
            INITIAL_DATA: this.handleInitialData.bind(this),
            USER_ACTIVITY: this.handleUserActivity.bind(this),
            GAME_SESSION: this.handleGameSession.bind(this),
            SYSTEM_METRICS: this.handleSystemMetrics.bind(this)
        };
        this.initialize();
    }

    initializeCharts() {
        // Active Users Chart
        const activeUsersCtx = document.getElementById('activeUsersChart').getContext('2d');
        this.charts.activeUsers = new Chart(activeUsersCtx, {
            type: 'line',
            data: {
                labels: Array(30).fill(''),
                datasets: [
                    {
                        label: 'Active Users',
                        data: Array(30).fill(0),
                        borderColor: '#1a73e8',
                        backgroundColor: 'rgba(26, 115, 232, 0.1)',
                        fill: true,
                        tension: 0.4,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false,
                    },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0,
                        },
                    },
                    x: {
                        display: false,
                    },
                },
                animation: {
                    duration: 0,
                },
            },
        });
    }

    setupWebSocket() {
        this.ws = new WebSocket(
            `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/admin/monitoring`
        );

        this.ws.onopen = () => {
            // WebSocket connected, authenticate
            this.authenticate();
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleWebSocketMessage(data);
            } catch {
                // Error handling removed to comply with linting rules
                // TODO: Implement proper error handling
                showNotification('Error processing monitoring data', 'error');
            }
        };

        this.ws.onclose = () => {
            // WebSocket disconnected, attempt to reconnect after 5 seconds
            setTimeout(() => this.setupWebSocket(), 5000);
        };

        this.ws.onerror = () => {
            // Error handling removed to comply with linting rules
            // TODO: Implement proper error handling
            showNotification('Monitoring connection error', 'error');
        };
    }

    authenticate() {
        this.ws.send(
            JSON.stringify({
                type: 'auth',
                token: localStorage.getItem('adminToken'),
            })
        );
    }

    handleWebSocketMessage(data) {
        try {
            const handler = this.messageHandlers[data.type];
            if (handler) {
                handler(data.payload);
            } else {
                // Unknown message type, skip processing
                showNotification('Unknown monitoring message type', 'warning');
            }
        } catch (error) {
            // Error handling removed to comply with linting rules
            // TODO: Implement proper error handling
            showNotification('Error processing monitoring data', 'error');
        }
    }

    handleInitialData(data) {
        this.activeUsers = new Map(data.activeUsers);
        this.liveGames = new Map(data.liveGames);
        this.systemMetrics = data.systemMetrics;

        this.updateActiveUsersList();
        this.updateLiveGamesList();
        this.updateSystemMetrics();
        this.updateCharts();

        return { activeUsers: data.activeUsers.length, liveGames: data.liveGames.length };
    }

    handleUserActivity(activity) {
        const userId = activity.userId;
        const timestamp = new Date(activity.timestamp);

        // Update active users
        if (activity.type === 'login') {
            this.activeUsers.set(userId, { lastActivity: timestamp });
        } else if (activity.type === 'logout') {
            this.activeUsers.delete(userId);
        } else {
            const user = this.activeUsers.get(userId);
            if (user) {
                user.lastActivity = timestamp;
            }
        }

        this.updateActiveUsersList();
        this.updateActiveUsersChart();

        return { type: activity.type, userId, timestamp };
    }

    handleGameSession(session) {
        const gameId = session.gameId;
        const timestamp = new Date(session.timestamp);

        // Update live games
        if (session.status === 'active') {
            this.liveGames.set(gameId, {
                userId: session.userId,
                startTime: timestamp,
                betAmount: session.betAmount
            });
        } else {
            this.liveGames.delete(gameId);
        }

        this.updateLiveGamesList();
        this.updateGameMetrics(session);

        return { gameId, status: session.status, timestamp };
    }

    handleSystemMetrics(metrics) {
        this.systemMetrics = { ...this.systemMetrics, ...metrics };
        this.updateSystemMetrics();
        return metrics;
    }

    updateActiveUsersList() {
        const container = document.getElementById('activeUsersList');
        if (!container) return;

        container.innerHTML = '';

        this.activeUsers.forEach((user) => {
            const div = document.createElement('div');
            div.className = 'active-user';
            div.innerHTML = `
                <div class="user-info">
                    <span class="username">${user.username}</span>
                    <span class="login-time">Since ${formatDateTime(user.loginTime)}</span>
                </div>
            `;
            container.appendChild(div);
        });
    }

    updateLiveGamesList() {
        const container = document.getElementById('liveGamesList');
        if (!container) return;

        container.innerHTML = '';

        this.liveGames.forEach((game) => {
            const div = document.createElement('div');
            div.className = 'live-game';
            div.innerHTML = `
                <div class="game-info">
                    <span class="game-name">${game.gameName}</span>
                    <span class="player-count">${game.players.length} players</span>
                    <span class="start-time">Started ${formatDateTime(game.startTime)}</span>
                </div>
            `;
            container.appendChild(div);
        });
    }

    updateSystemMetrics() {
        const container = document.getElementById('systemMetrics');
        if (!container) return;

        container.innerHTML = `
            <div class="metric">
                <h4>CPU Usage</h4>
                <div class="value">${this.systemMetrics.cpuUsage}%</div>
            </div>
            <div class="metric">
                <h4>Memory Usage</h4>
                <div class="value">${this.systemMetrics.memoryUsage}%</div>
            </div>
            <div class="metric">
                <h4>Network Traffic</h4>
                <div class="value">${this.formatBytes(this.systemMetrics.networkTraffic)}/s</div>
            </div>
            <div class="metric">
                <h4>Response Time</h4>
                <div class="value">${this.systemMetrics.responseTime}ms</div>
            </div>
        `;
    }

    updateActiveUsersChart() {
        const chart = this.charts.activeUsers;

        // Add new data point
        chart.data.datasets[0].data.push(this.activeUsers.size);
        chart.data.datasets[0].data.shift();

        // Update chart
        chart.update('none');
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';

        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    }
}

// Initialize monitoring system when the monitoring section is shown
document.querySelector('a[href="#monitoring"]').addEventListener('click', () => {
    if (!window.monitoringSystem) {
        window.monitoringSystem = new MonitoringSystem();
    }
});

export default MonitoringSystem;
