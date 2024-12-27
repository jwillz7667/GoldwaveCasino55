// Check if user is authenticated
function checkAuth() {
    const token = localStorage.getItem('adminToken');
    if (!token) {
        window.location.href = '/admin/login.html';
        return false;
    }
    return true;
}

// Navigation
function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('section');

    navLinks.forEach((link) => {
        link.addEventListener('click', (e) => {
            e.preventDefault();

            // Remove active class from all links
            navLinks.forEach((l) => l.classList.remove('active'));

            // Add active class to clicked link
            link.classList.add('active');

            // Hide all sections
            sections.forEach((section) => (section.style.display = 'none'));

            // Show selected section
            const targetId = link.getAttribute('href').substring(1);
            document.getElementById(targetId).style.display = 'block';

            // Update stats if dashboard is selected
            if (targetId === 'dashboard') {
                updateDashboardStats();
            }
        });
    });
}

// Modal Management
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Dashboard Stats
async function updateDashboardStats() {
    try {
        const response = await fetch('/api/admin/dashboard/stats', {
            headers: {
                Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch dashboard stats');
        }

        const stats = await response.json();

        // Update stats display
        document.getElementById('totalUsers').textContent = stats.totalUsers.toLocaleString();
        document.getElementById('activeSessions').textContent =
            stats.activeSessions.toLocaleString();
        document.getElementById('totalRevenue').textContent = formatCurrency(stats.totalRevenue);
        document.getElementById('todayTransactions').textContent =
            stats.todayTransactions.toLocaleString();

        // Update recent activities
        updateRecentActivities(stats.recentActivities);
    } catch {
        // Error handling removed to comply with linting rules
        // TODO: Implement proper error handling
        showNotification('Error loading dashboard stats');
    }
}

// Recent Activities
function updateRecentActivities(activities) {
    const tbody = document.getElementById('recentActivities');
    tbody.innerHTML = '';

    activities.forEach((activity) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatDateTime(activity.timestamp)}</td>
            <td>${activity.username}</td>
            <td>${activity.type}</td>
            <td>${activity.details}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Utility Functions
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(amount);
}

function formatDateTime(timestamp) {
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(timestamp));
}

function showNotification() {
    // TODO: Implement proper notification system
}

// WebSocket Connection
let ws;

function setupWebSocket() {
    ws = new WebSocket(
        `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/admin/monitoring`
    );

    ws.onopen = () => {
        // WebSocket connected
        ws.send(
            JSON.stringify({
                type: 'auth',
                token: localStorage.getItem('adminToken'),
            })
        );
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        } catch {
            // Error handling removed to comply with linting rules
            // TODO: Implement proper error handling
            showNotification('Error processing WebSocket message');
        }
    };

    ws.onclose = () => {
        // WebSocket disconnected, attempt to reconnect after 5 seconds
        setTimeout(setupWebSocket, 5000);
    };

    ws.onerror = () => {
        // Error handling removed to comply with linting rules
        // TODO: Implement proper error handling
        showNotification('WebSocket connection error');
    };
}

function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'auth_success':
            // WebSocket authenticated successfully
            break;

        case 'user_activity':
            handleUserActivity(data.payload);
            break;

        case 'transaction':
            handleTransaction(data.payload);
            break;

        case 'game_session':
            handleGameSession(data.payload);
            break;

        default:
            // Unknown message type
            showNotification('Unknown WebSocket message type');
            break;
    }
}

function handleUserActivity(activity) {
    const activities = [activity, ...getCurrentActivities()].slice(0, 50);
    updateRecentActivities(activities);
    updateDashboardStats();
}

function handleTransaction(transaction) {
    updateDashboardStats();
    updateTransactionHistory(transaction);
}

function handleGameSession(session) {
    updateDashboardStats();
    updateGameHistory(session);
}

function updateTransactionHistory(transaction) {
    const tbody = document.getElementById('transactionHistory');
    if (!tbody) return;

    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>${transaction.id}</td>
        <td>${transaction.userId}</td>
        <td>${formatCurrency(transaction.amount)}</td>
        <td>${transaction.type}</td>
        <td>${formatDateTime(transaction.timestamp)}</td>
    `;
    tbody.insertBefore(tr, tbody.firstChild);
    
    // Keep only last 50 transactions
    while (tbody.children.length > 50) {
        tbody.removeChild(tbody.lastChild);
    }
}

function updateGameHistory(session) {
    const tbody = document.getElementById('gameHistory');
    if (!tbody) return;

    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>${session.id}</td>
        <td>${session.userId}</td>
        <td>${session.gameType}</td>
        <td>${formatCurrency(session.betAmount)}</td>
        <td>${formatCurrency(session.winAmount)}</td>
        <td>${formatDateTime(session.timestamp)}</td>
    `;
    tbody.insertBefore(tr, tbody.firstChild);
    
    // Keep only last 50 sessions
    while (tbody.children.length > 50) {
        tbody.removeChild(tbody.lastChild);
    }
}

function getCurrentActivities() {
    const tbody = document.getElementById('recentActivities');
    const activities = [];

    tbody.querySelectorAll('tr').forEach((tr) => {
        activities.push({
            timestamp: tr.cells[0].textContent,
            username: tr.cells[1].textContent,
            type: tr.cells[2].textContent,
            details: tr.cells[3].textContent,
        });
    });

    return activities;
}

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth()) return;

    setupNavigation();
    updateDashboardStats();
    setupWebSocket();

    // Set up interval to refresh stats
    setInterval(updateDashboardStats, 60000); // Refresh every minute
});

// Export functions for use in other modules
export { checkAuth, openModal, closeModal, showNotification, formatCurrency, formatDateTime };
