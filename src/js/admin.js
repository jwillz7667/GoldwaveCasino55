// Import styles
import '../css/admin.css';

// Admin Dashboard JavaScript

// Check if user is logged in
document.addEventListener('DOMContentLoaded', () => {
    const currentPath = window.location.pathname;
    if (currentPath !== '/admin/login.html') {
        checkAuth();
    }
    initializeLoginForm();
    initializeAdminDashboard();
});

// Authentication Functions
async function checkAuth() {
    try {
        const response = await fetch('/api/admin/check-auth');
        if (!response.ok) {
            window.location.href = '/admin/login.html';
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/admin/login.html';
    }
}

// Initialize Login Form
function initializeLoginForm() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const errorMessage = document.getElementById('errorMessage');

            try {
                const response = await fetch('/api/admin/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ username, password }),
                });

                if (response.ok) {
                    const data = await response.json();
                    localStorage.setItem('userRole', data.role);
                    window.location.href = '/admin/index.html';
                } else {
                    const error = await response.json();
                    errorMessage.textContent = error.message || 'Login failed';
                    errorMessage.style.display = 'block';
                }
            } catch (error) {
                console.error('Login error:', error);
                errorMessage.textContent = 'Login failed. Please try again.';
                errorMessage.style.display = 'block';
            }
        });
    }
}

// Role-based Access Control
const ROLES = {
    SUPERADMIN: 'superadmin',
    VENDOR: 'vendor'
};

const PERMISSIONS = {
    [ROLES.SUPERADMIN]: {
        canManageAdmins: true,
        canManageVendors: true,
        canManageUsers: true,
        canManageGames: true,
        canManageSettings: true,
        canViewReports: true,
        canManageTokens: true,
        canExportData: true
    },
    [ROLES.VENDOR]: {
        canManageAdmins: false,
        canManageVendors: false,
        canManageUsers: true,
        canManageGames: false,
        canManageSettings: false,
        canViewReports: true,
        canManageTokens: true,
        canExportData: true
    }
};

// Store user role after login
let currentUserRole = null;

// Check permissions before performing actions
function hasPermission(permission) {
    const userRole = localStorage.getItem('userRole');
    return PERMISSIONS[userRole]?.[permission] || false;
}

// Dashboard Initialization
function initializeAdminDashboard() {
    if (window.location.pathname === '/admin/index.html') {
        // Initialize all UI components
        initializeEventListeners();
        initializeGameForm();
        initializeReports();
        initializeSettings();
        initializeSearchAndExport();
        initializeSidebar();
        
        // Initialize game management
        initializeGameManagement();
        
        // Initialize reporting
        initializeTransactionReporting();
        initializeRevenueReporting();
        
        // Load initial data
        loadDashboardData();
        loadUsersList();
        loadVendorsList();
        loadGamesList();
        initializeCharts();
        
        // Initialize transaction type filter
        document.getElementById('transactionType')?.addEventListener('change', () => {
            const searchInput = document.getElementById('transactionSearch');
            if (searchInput) {
                filterTransactions({ target: searchInput });
            }
        });

        // Initialize role-based UI elements
        const userRole = localStorage.getItem('userRole');
        if (userRole) {
            document.getElementById('adminName').textContent = 
                `${userRole.charAt(0).toUpperCase() + userRole.slice(1)} Dashboard`;
            
            // Hide unauthorized sections
            if (!hasPermission('canManageAdmins')) {
                document.querySelector('[href="#admin-management"]')?.parentElement?.remove();
            }
            if (!hasPermission('canManageSettings')) {
                document.querySelector('[href="#settings"]')?.parentElement?.remove();
            }
            if (!hasPermission('canManageVendors')) {
                document.querySelector('[href="#vendor-management"]')?.parentElement?.remove();
            }
        }
    }
}

// Sidebar Navigation
function initializeSidebar() {
    const sidebarLinks = document.querySelectorAll('.sidebar-nav a');
    const sections = document.querySelectorAll('.dashboard-section');
    
    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            
            // Update active states
            sidebarLinks.forEach(l => l.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            
            link.classList.add('active');
            document.getElementById(targetId).classList.add('active');
        });
    });

    // Mobile menu toggle
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.querySelector('.sidebar');
    
    menuToggle?.addEventListener('click', () => {
        sidebar.classList.toggle('active');
    });
}

// Dashboard Data Loading
async function loadDashboardData() {
    await Promise.all([
        loadOverviewStats(),
        loadUsersList(),
        loadTransactionsList(),
        loadGamesList()
    ]);
}

// Overview Statistics
async function loadOverviewStats() {
    try {
        const response = await fetch('/api/admin/stats/overview');
        const data = await response.json();
        
        document.getElementById('activeUsers').textContent = data.activeUsers;
        document.getElementById('todayRevenue').textContent = formatCurrency(data.todayRevenue);
        document.getElementById('activeGames').textContent = data.activeGames;
        document.getElementById('pendingTransactions').textContent = data.pendingTransactions;
    } catch (error) {
        console.error('Failed to load overview stats:', error);
    }
}

// Users Management
async function loadUsersList() {
    try {
        const response = await fetch('/api/admin/users');
        const users = await response.json();
        const tbody = document.querySelector('#usersTable tbody');
        if (!tbody) return;

        tbody.innerHTML = '';
        users.forEach(user => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${user.id}</td>
                <td>${user.username}</td>
                <td>${user.email || 'N/A'}</td>
                <td>${formatCurrency(user.balance)}</td>
                <td><span class="status-badge ${user.status.toLowerCase()}">${user.status}</span></td>
                <td>
                    <button class="btn-primary btn-small manage-tokens" data-userid="${user.id}">Manage Tokens</button>
                    <button class="btn-secondary btn-small edit-user" data-userid="${user.id}">Edit</button>
                </td>
            `;
            
            // Add event listeners to the buttons
            const manageTokensBtn = tr.querySelector('.manage-tokens');
            const editUserBtn = tr.querySelector('.edit-user');
            
            manageTokensBtn.addEventListener('click', () => showTokenModal(user.id));
            editUserBtn.addEventListener('click', () => editUser(user.id));
            
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Failed to load users:', error);
        showNotification('Failed to load users', 'error');
    }
}

// Transactions Management
async function loadTransactionsList() {
    try {
        const response = await fetch('/api/admin/transactions');
        const transactions = await response.json();
        const tbody = document.querySelector('#transactionsTable tbody');
        tbody.innerHTML = '';

        transactions.forEach(transaction => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${transaction.id}</td>
                <td>${transaction.username}</td>
                <td>${transaction.type}</td>
                <td>${formatCurrency(transaction.amount)}</td>
                <td><span class="status-badge ${transaction.status.toLowerCase()}">${transaction.status}</span></td>
                <td>${formatDate(transaction.date)}</td>
                <td>
                    <button class="btn-secondary btn-small" onclick="viewTransactionDetails(${transaction.id})">Details</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Failed to load transactions:', error);
    }
}

// Games Management
async function loadGamesList() {
    try {
        const response = await fetch('/api/admin/games');
        const games = await response.json();
        const gamesGrid = document.querySelector('.games-grid');
        gamesGrid.innerHTML = '';

        games.forEach(game => {
            const gameCard = document.createElement('div');
            gameCard.className = 'game-card';
            gameCard.innerHTML = `
                <img src="${game.thumbnail}" alt="${game.name}">
                <h3>${game.name}</h3>
                <p>Players: ${game.activePlayers}</p>
                <p>Revenue: ${formatCurrency(game.revenue)}</p>
                <div class="game-actions">
                    <button class="btn-secondary" onclick="editGame(${game.id})">Edit</button>
                    <button class="btn-secondary" onclick="toggleGameStatus(${game.id})">
                        ${game.active ? 'Disable' : 'Enable'}
                    </button>
                </div>
            `;
            gamesGrid.appendChild(gameCard);
        });
    } catch (error) {
        console.error('Failed to load games:', error);
    }
}

// Charts Initialization
function initializeCharts() {
    initializeRevenueChart();
}

async function initializeRevenueChart() {
    try {
        const response = await fetch('/api/admin/stats/revenue-history');
        const data = await response.json();
        
        const ctx = document.getElementById('revenueChart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Revenue',
                    data: data.values,
                    borderColor: '#e94560',
                    tension: 0.4,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#ffffff'
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#ffffff'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#ffffff'
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Failed to initialize revenue chart:', error);
    }
}

// Event Listeners Setup
function setupEventListeners() {
    // Search functionality
    document.getElementById('userSearch')?.addEventListener('input', debounce(filterUsers, 300));
    document.getElementById('transactionSearch')?.addEventListener('input', debounce(filterTransactions, 300));
    
    // Role-based listeners
    if (hasPermission('canExportData')) {
        document.getElementById('exportUsers')?.addEventListener('click', exportUsers);
        document.getElementById('exportTransactions')?.addEventListener('click', exportTransactions);
    }
    
    if (hasPermission('canManageSettings')) {
        document.getElementById('generalSettingsForm')?.addEventListener('submit', saveGeneralSettings);
        document.getElementById('securitySettingsForm')?.addEventListener('submit', saveSecuritySettings);
    }

    // Superadmin-specific listeners
    if (hasPermission('canManageVendors')) {
        document.getElementById('createVendorForm')?.addEventListener('submit', handleCreateVendor);
    }
}

// Utility Functions
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Modal Functions
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

// Export Functions
async function exportUsers() {
    try {
        const response = await fetch('/api/admin/export/users');
        if (!response.ok) throw new Error('Failed to export users');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showNotification('Users exported successfully', 'success');
    } catch (error) {
        showNotification('Failed to export users', 'error');
    }
}

async function exportTransactions() {
    try {
        const type = document.getElementById('transactionType').value;
        const response = await fetch(`/api/admin/export/transactions?type=${type}`);
        if (!response.ok) throw new Error('Failed to export transactions');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transactions-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showNotification('Transactions exported successfully', 'success');
    } catch (error) {
        showNotification('Failed to export transactions', 'error');
    }
}

// Settings Management Functions
async function loadSettings() {
    try {
        // Load general settings
        const generalResponse = await fetch('/api/admin/settings/general');
        const generalSettings = await generalResponse.json();
        
        document.getElementById('maintenanceMode').checked = generalSettings.maintenanceMode;
        document.getElementById('maxUsers').value = generalSettings.maxUsers;
        
        // Load security settings
        const securityResponse = await fetch('/api/admin/settings/security');
        const securitySettings = await securityResponse.json();
        
        document.getElementById('require2FA').checked = securitySettings.require2FA;
        document.getElementById('sessionTimeout').value = securitySettings.sessionTimeout;
    } catch (error) {
        showNotification('Failed to load settings', 'error');
    }
}

async function saveGeneralSettings(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const settings = {
        maintenanceMode: formData.get('maintenanceMode') === 'on',
        maxUsers: parseInt(formData.get('maxUsers'))
    };
    
    try {
        const response = await fetch('/api/admin/settings/general', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(settings),
        });

        if (!response.ok) {
            throw new Error('Failed to save general settings');
        }

        showNotification('General settings saved successfully', 'success');
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function saveSecuritySettings(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const settings = {
        require2FA: formData.get('require2FA') === 'on',
        sessionTimeout: parseInt(formData.get('sessionTimeout'))
    };
    
    try {
        const response = await fetch('/api/admin/settings/security', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(settings),
        });

        if (!response.ok) {
            throw new Error('Failed to save security settings');
        }

        showNotification('Security settings saved successfully', 'success');
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// Initialize Settings
function initializeSettings() {
    const generalSettingsForm = document.getElementById('generalSettingsForm');
    const securitySettingsForm = document.getElementById('securitySettingsForm');
    
    if (generalSettingsForm) {
        generalSettingsForm.addEventListener('submit', saveGeneralSettings);
    }
    
    if (securitySettingsForm) {
        securitySettingsForm.addEventListener('submit', saveSecuritySettings);
    }
    
    // Load current settings
    loadSettings();
}

// Add token management functions for vendors
async function manageUserTokens(userId, action, amount) {
    try {
        const response = await fetch('/api/admin/users/tokens', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId, action, amount }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message);
        }

        await loadUsersList(); // Refresh the users list
        showNotification(`Tokens ${action}ed successfully`, 'success');
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// Add superadmin-specific functions
async function createVendorAccount(vendorData) {
    if (!hasPermission('canManageVendors')) {
        alert('You do not have permission to create vendor accounts');
        return;
    }

    try {
        const response = await fetch('/api/admin/vendors', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(vendorData),
        });

        if (response.ok) {
            alert('Vendor account created successfully');
            loadVendorsList();
        } else {
            const error = await response.json();
            alert(error.message || 'Failed to create vendor account');
        }
    } catch (error) {
        console.error('Vendor creation error:', error);
        alert('Failed to create vendor account');
    }
}

// Add vendor management UI for superadmins
async function loadVendorsList() {
    if (!hasPermission('canManageVendors')) return;

    try {
        const response = await fetch('/api/admin/vendors');
        const vendors = await response.json();
        const tbody = document.querySelector('#vendorsTable tbody');
        tbody.innerHTML = '';

        vendors.forEach(vendor => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${vendor.id}</td>
                <td>${vendor.username}</td>
                <td>${vendor.email}</td>
                <td>${vendor.createdAt}</td>
                <td><span class="status-badge ${vendor.status.toLowerCase()}">${vendor.status}</span></td>
                <td>
                    <button class="btn-secondary btn-small" onclick="editVendor(${vendor.id})">Edit</button>
                    <button class="btn-secondary btn-small" onclick="toggleVendorStatus(${vendor.id})">
                        ${vendor.status === 'Active' ? 'Disable' : 'Enable'}
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Failed to load vendors:', error);
    }
}

// User Management Functions
async function createUser(userData) {
    try {
        // Remove email if it's empty
        if (!userData.email) {
            delete userData.email;
        }

        const response = await fetch('/api/admin/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(userData),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message);
        }

        await loadUsersList(); // Refresh the users list
        hideModal('userModal');
        showNotification('User created successfully', 'success');
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// Vendor Management Functions
async function createVendor(vendorData) {
    try {
        const response = await fetch('/api/admin/vendors', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(vendorData),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message);
        }

        await loadVendorsList(); // Refresh the vendors list
        hideModal('vendorModal');
        showNotification('Vendor created successfully', 'success');
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// Initialize Event Listeners
function initializeEventListeners() {
    // User Form
    const userForm = document.getElementById('editUserForm');
    if (userForm) {
        userForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(userForm);
            const userData = {
                username: formData.get('username'),
                email: formData.get('email'),
                password: formData.get('password'),
                initialBalance: parseFloat(formData.get('initialBalance') || 0)
            };
            await createUser(userData);
        });
    }

    // Vendor Form
    const vendorForm = document.getElementById('vendorForm');
    if (vendorForm) {
        vendorForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(vendorForm);
            const vendorData = {
                username: formData.get('username'),
                email: formData.get('email'),
                password: formData.get('password'),
                status: formData.get('status')
            };
            await createVendor(vendorData);
        });
    }

    // Add User Button
    const addUserBtn = document.getElementById('addUser');
    if (addUserBtn) {
        addUserBtn.addEventListener('click', () => showModal('userModal'));
    }

    // Add Vendor Button
    const addVendorBtn = document.getElementById('addVendor');
    if (addVendorBtn) {
        addVendorBtn.addEventListener('click', () => showModal('vendorModal'));
    }
}

// Notification Function
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Token Management Functions
async function handleTokenAction(action) {
    const userId = document.getElementById('tokenUserId').value;
    const amount = document.getElementById('tokenAmount').value;

    if (!userId || !amount) {
        showNotification('Please enter an amount', 'error');
        return;
    }

    try {
        const response = await fetch('/api/admin/users/tokens', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId, action, amount }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message);
        }

        await loadUsersList(); // Refresh the users list
        hideModal('tokenModal');
        showNotification(`Tokens ${action}ed successfully`, 'success');
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// Make showTokenModal globally accessible
window.showTokenModal = function(userId) {
    document.getElementById('tokenUserId').value = userId;
    document.getElementById('tokenAmount').value = '';
    showModal('tokenModal');
};

// Game Management Functions
async function editGame(gameId) {
    try {
        const response = await fetch(`/api/admin/games/${gameId}`);
        const game = await response.json();
        
        const form = document.getElementById('editGameForm');
        form.innerHTML = `
            <input type="hidden" name="gameId" value="${game.id}">
            <div class="form-group">
                <label for="gameName">Game Name</label>
                <input type="text" id="gameName" name="name" value="${game.name}" required>
            </div>
            <div class="form-group">
                <label for="gameType">Game Type</label>
                <select id="gameType" name="type" required>
                    <option value="slots" ${game.type === 'slots' ? 'selected' : ''}>Slots</option>
                    <option value="poker" ${game.type === 'poker' ? 'selected' : ''}>Poker</option>
                    <option value="blackjack" ${game.type === 'blackjack' ? 'selected' : ''}>Blackjack</option>
                    <option value="roulette" ${game.type === 'roulette' ? 'selected' : ''}>Roulette</option>
                </select>
            </div>
            <div class="form-group">
                <label for="minBet">Minimum Bet</label>
                <input type="number" id="minBet" name="minBet" value="${game.min_bet}" min="0" step="0.01" required>
            </div>
            <div class="form-group">
                <label for="maxBet">Maximum Bet</label>
                <input type="number" id="maxBet" name="maxBet" value="${game.max_bet}" min="0" step="0.01" required>
            </div>
            <div class="form-group">
                <label for="thumbnail">Thumbnail URL</label>
                <input type="url" id="thumbnail" name="thumbnail" value="${game.thumbnail}" required>
            </div>
            <div class="form-actions">
                <button type="submit" class="btn-primary">Save Changes</button>
                <button type="button" class="btn-secondary" onclick="hideModal('gameModal')">Cancel</button>
            </div>
        `;
        
        showModal('gameModal');
    } catch (error) {
        showNotification('Failed to load game details', 'error');
    }
}

async function toggleGameStatus(gameId) {
    try {
        const response = await fetch(`/api/admin/games/${gameId}/toggle`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error('Failed to toggle game status');
        }

        await loadGamesList();
        showNotification('Game status updated successfully', 'success');
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function saveGame(formData) {
    try {
        const gameId = formData.get('gameId');
        const method = gameId ? 'PUT' : 'POST';
        const url = gameId ? `/api/admin/games/${gameId}` : '/api/admin/games';

        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(Object.fromEntries(formData)),
        });

        if (!response.ok) {
            throw new Error('Failed to save game');
        }

        hideModal('gameModal');
        await loadGamesList();
        showNotification('Game saved successfully', 'success');
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// Add game form initialization
function initializeGameForm() {
    const addGameBtn = document.getElementById('addGame');
    if (addGameBtn) {
        addGameBtn.addEventListener('click', () => {
            const form = document.getElementById('editGameForm');
            form.innerHTML = `
                <div class="form-group">
                    <label for="gameName">Game Name</label>
                    <input type="text" id="gameName" name="name" required>
                </div>
                <div class="form-group">
                    <label for="gameType">Game Type</label>
                    <select id="gameType" name="type" required>
                        <option value="slots">Slots</option>
                        <option value="poker">Poker</option>
                        <option value="blackjack">Blackjack</option>
                        <option value="roulette">Roulette</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="minBet">Minimum Bet</label>
                    <input type="number" id="minBet" name="minBet" min="0" step="0.01" required>
                </div>
                <div class="form-group">
                    <label for="maxBet">Maximum Bet</label>
                    <input type="number" id="maxBet" name="maxBet" min="0" step="0.01" required>
                </div>
                <div class="form-group">
                    <label for="thumbnail">Thumbnail URL</label>
                    <input type="url" id="thumbnail" name="thumbnail" required>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn-primary">Create Game</button>
                    <button type="button" class="btn-secondary" onclick="hideModal('gameModal')">Cancel</button>
                </div>
            `;
            showModal('gameModal');
        });
    }

    const gameForm = document.getElementById('editGameForm');
    if (gameForm) {
        gameForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveGame(new FormData(e.target));
        });
    }
}

// Transaction Management Functions
async function viewTransactionDetails(transactionId) {
    try {
        const response = await fetch(`/api/admin/transactions/${transactionId}`);
        const transaction = await response.json();
        
        const detailsHtml = `
            <div class="transaction-details">
                <h3>Transaction Details</h3>
                <div class="details-grid">
                    <div class="detail-item">
                        <label>Transaction ID:</label>
                        <span>${transaction.id}</span>
                    </div>
                    <div class="detail-item">
                        <label>User:</label>
                        <span>${transaction.username}</span>
                    </div>
                    <div class="detail-item">
                        <label>Type:</label>
                        <span>${transaction.type}</span>
                    </div>
                    <div class="detail-item">
                        <label>Amount:</label>
                        <span>${formatCurrency(transaction.amount)}</span>
                    </div>
                    <div class="detail-item">
                        <label>Status:</label>
                        <span class="status-badge ${transaction.status.toLowerCase()}">${transaction.status}</span>
                    </div>
                    <div class="detail-item">
                        <label>Date:</label>
                        <span>${formatDate(transaction.created_at)}</span>
                    </div>
                    <div class="detail-item">
                        <label>Game:</label>
                        <span>${transaction.game_name || 'N/A'}</span>
                    </div>
                    <div class="detail-item">
                        <label>Processed By:</label>
                        <span>${transaction.admin_username || 'System'}</span>
                    </div>
                </div>
            </div>
        `;
        
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content">
                ${detailsHtml}
                <div class="form-actions">
                    <button class="btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    } catch (error) {
        showNotification('Failed to load transaction details', 'error');
    }
}

async function filterTransactions(e) {
    const searchTerm = e.target.value.toLowerCase();
    const type = document.getElementById('transactionType').value;
    
    try {
        const response = await fetch(`/api/admin/transactions?search=${searchTerm}&type=${type}`);
        const transactions = await response.json();
        
        const tbody = document.querySelector('#transactionsTable tbody');
        tbody.innerHTML = '';
        
        transactions.forEach(transaction => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${transaction.id}</td>
                <td>${transaction.username}</td>
                <td>${transaction.type}</td>
                <td>${formatCurrency(transaction.amount)}</td>
                <td><span class="status-badge ${transaction.status.toLowerCase()}">${transaction.status}</span></td>
                <td>${formatDate(transaction.created_at)}</td>
                <td>
                    <button class="btn-secondary btn-small" onclick="viewTransactionDetails(${transaction.id})">Details</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Failed to filter transactions:', error);
    }
}

// Reports Functions
async function generateReport(reportType) {
    const startDate = document.getElementById(`${reportType}StartDate`)?.value;
    const endDate = document.getElementById(`${reportType}EndDate`)?.value;
    
    try {
        const response = await fetch(`/api/admin/reports/${reportType}?startDate=${startDate}&endDate=${endDate}`);
        const data = await response.json();
        
        switch (reportType) {
            case 'revenue':
                displayRevenueReport(data);
                break;
            case 'userActivity':
                displayUserActivityReport(data);
                break;
            case 'gamePerformance':
                displayGamePerformanceReport(data);
                break;
            case 'financial':
                displayFinancialReport(data);
                break;
        }
        
        showNotification('Report generated successfully', 'success');
    } catch (error) {
        showNotification('Failed to generate report', 'error');
    }
}

function displayRevenueReport(data) {
    const ctx = document.getElementById('revenueChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(item => item.date),
            datasets: [
                {
                    label: 'Revenue',
                    data: data.map(item => item.revenue),
                    borderColor: '#4caf50',
                    tension: 0.1
                },
                {
                    label: 'Payouts',
                    data: data.map(item => item.payouts),
                    borderColor: '#f44336',
                    tension: 0.1
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Revenue Overview'
                }
            }
        }
    });
}

function displayUserActivityReport(data) {
    const ctx = document.getElementById('userActivityChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(item => item.date),
            datasets: [
                {
                    label: 'Active Users',
                    data: data.map(item => item.activeUsers),
                    backgroundColor: '#2196f3'
                },
                {
                    label: 'New Users',
                    data: data.map(item => item.newUsers),
                    backgroundColor: '#4caf50'
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'User Activity'
                }
            }
        }
    });
}

// Initialize Reports
function initializeReports() {
    const reportButtons = document.querySelectorAll('.report-card button');
    reportButtons.forEach(button => {
        button.addEventListener('click', () => {
            const reportType = button.closest('.report-card').getAttribute('data-report');
            generateReport(reportType);
        });
    });
}

// Search Functions
async function filterUsers(e) {
    const searchTerm = e.target.value.toLowerCase();
    
    try {
        const response = await fetch(`/api/admin/users?search=${searchTerm}`);
        const users = await response.json();
        
        const tbody = document.querySelector('#usersTable tbody');
        tbody.innerHTML = '';
        
        users.forEach(user => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${user.id}</td>
                <td>${user.username}</td>
                <td>${user.email || 'N/A'}</td>
                <td>${formatCurrency(user.balance)}</td>
                <td><span class="status-badge ${user.status.toLowerCase()}">${user.status}</span></td>
                <td>
                    <button class="btn-primary btn-small" onclick="showTokenModal(${user.id})">Manage Tokens</button>
                    <button class="btn-secondary btn-small" onclick="editUser(${user.id})">Edit</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Failed to filter users:', error);
    }
}

// Initialize Search and Export
function initializeSearchAndExport() {
    // Search initialization
    const userSearch = document.getElementById('userSearch');
    const transactionSearch = document.getElementById('transactionSearch');
    
    if (userSearch) {
        userSearch.addEventListener('input', debounce(filterUsers, 300));
    }
    
    if (transactionSearch) {
        transactionSearch.addEventListener('input', debounce(filterTransactions, 300));
    }
    
    // Export initialization
    const exportUsersBtn = document.getElementById('exportUsers');
    const exportTransactionsBtn = document.getElementById('exportTransactions');
    
    if (exportUsersBtn) {
        exportUsersBtn.addEventListener('click', exportUsers);
    }
    
    if (exportTransactionsBtn) {
        exportTransactionsBtn.addEventListener('click', exportTransactions);
    }
}

// Game Management Functions
async function initializeGameManagement() {
    const gameForm = document.getElementById('gameForm');
    const gamesList = document.getElementById('gamesList');
    
    if (gameForm) {
        gameForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(gameForm);
            const gameData = {
                name: formData.get('name'),
                type: formData.get('type'),
                minBet: parseFloat(formData.get('minBet')),
                maxBet: parseFloat(formData.get('maxBet')),
                thumbnail: formData.get('thumbnail'),
                active: true
            };
            
            try {
                const response = await fetch('/api/admin/games', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(gameData)
                });
                
                if (!response.ok) throw new Error('Failed to create game');
                
                showNotification('Game created successfully', 'success');
                gameForm.reset();
                hideModal('gameModal');
                await loadGamesList();
            } catch (error) {
                showNotification(error.message, 'error');
            }
        });
    }
    
    // Initialize game list
    await loadGamesList();
}

// Transaction Reporting Functions
async function initializeTransactionReporting() {
    const reportForm = document.getElementById('reportForm');
    const reportResults = document.getElementById('reportResults');
    
    if (reportForm) {
        reportForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(reportForm);
            const filters = {
                startDate: formData.get('startDate'),
                endDate: formData.get('endDate'),
                type: formData.get('type'),
                status: formData.get('status')
            };
            
            try {
                const queryParams = new URLSearchParams(filters);
                const response = await fetch(`/api/admin/reports/transactions?${queryParams}`);
                const data = await response.json();
                
                if (!response.ok) throw new Error('Failed to generate report');
                
                displayTransactionReport(data, reportResults);
            } catch (error) {
                showNotification(error.message, 'error');
            }
        });
    }
}

function displayTransactionReport(data, container) {
    if (!container) return;
    
    const summary = calculateTransactionSummary(data);
    
    container.innerHTML = `
        <div class="report-summary">
            <div class="summary-card">
                <h3>Total Transactions</h3>
                <p>${summary.total}</p>
            </div>
            <div class="summary-card">
                <h3>Total Volume</h3>
                <p>${formatCurrency(summary.volume)}</p>
            </div>
            <div class="summary-card">
                <h3>Average Transaction</h3>
                <p>${formatCurrency(summary.average)}</p>
            </div>
        </div>
        <div class="report-chart">
            <canvas id="transactionChart"></canvas>
        </div>
        <div class="report-table">
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>User</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map(t => `
                        <tr>
                            <td>${formatDate(t.created_at)}</td>
                            <td>${t.type}</td>
                            <td>${formatCurrency(t.amount)}</td>
                            <td><span class="status-badge ${t.status.toLowerCase()}">${t.status}</span></td>
                            <td>${t.username}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    // Initialize chart
    const ctx = document.getElementById('transactionChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(t => formatDate(t.created_at)),
            datasets: [{
                label: 'Transaction Amount',
                data: data.map(t => t.amount),
                borderColor: '#4CAF50',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Transaction History'
                }
            }
        }
    });
}

function calculateTransactionSummary(transactions) {
    const total = transactions.length;
    const volume = transactions.reduce((sum, t) => sum + t.amount, 0);
    const average = total > 0 ? volume / total : 0;
    
    return { total, volume, average };
}

// Revenue Reporting Functions
async function initializeRevenueReporting() {
    const revenueChart = document.getElementById('revenueChart');
    
    if (revenueChart) {
        try {
            const response = await fetch('/api/admin/reports/revenue');
            const data = await response.json();
            
            const ctx = revenueChart.getContext('2d');
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: data.map(d => formatDate(d.date)),
                    datasets: [
                        {
                            label: 'Revenue',
                            data: data.map(d => d.revenue),
                            backgroundColor: '#4CAF50'
                        },
                        {
                            label: 'Payouts',
                            data: data.map(d => d.payouts),
                            backgroundColor: '#F44336'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Revenue vs Payouts'
                        }
                    }
                }
            });
        } catch (error) {
            showNotification('Failed to load revenue data', 'error');
        }
    }
} 