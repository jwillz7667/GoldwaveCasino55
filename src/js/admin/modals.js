import { showNotification } from './dashboard.js';

class ModalManager {
    constructor() {
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Close modal when clicking outside
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target.id);
            }
        });

        // Close modal when clicking close button
        document.querySelectorAll('.close-modal').forEach((button) => {
            button.addEventListener('click', () => {
                const modalId = button.closest('.modal').id;
                this.closeModal(modalId);
            });
        });
    }

    // User Details Modal
    showUserDetailsModal(user) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'userDetailsModal';

        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>User Details</h2>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="user-details">
                        <div class="detail-row">
                            <label>Username</label>
                            <div>${user.username}</div>
                        </div>
                        <div class="detail-row">
                            <label>Status</label>
                            <div>
                                <span class="status-badge ${user.status}">${user.status}</span>
                            </div>
                        </div>
                        <div class="detail-row">
                            <label>Current Balance</label>
                            <div>${user.balance}</div>
                        </div>
                        <div class="detail-row">
                            <label>Created At</label>
                            <div>${new Date(user.createdAt).toLocaleString()}</div>
                        </div>
                        <div class="detail-row">
                            <label>Last Login</label>
                            <div>${
                                user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'
                            }</div>
                        </div>
                    </div>
                    
                    <div class="user-stats">
                        <h3>Statistics</h3>
                        <div class="stats-grid">
                            <div class="stat-card">
                                <h4>Total Games Played</h4>
                                <div class="value">${user.stats.totalGames}</div>
                            </div>
                            <div class="stat-card">
                                <h4>Total Wagered</h4>
                                <div class="value">${user.stats.totalWagered}</div>
                            </div>
                            <div class="stat-card">
                                <h4>Total Won</h4>
                                <div class="value">${user.stats.totalWon}</div>
                            </div>
                            <div class="stat-card">
                                <h4>Win Rate</h4>
                                <div class="value">${user.stats.winRate}%</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="user-actions">
                        <h3>Quick Actions</h3>
                        <div class="actions-grid">
                            <button class="btn btn-primary" onclick="adjustBalance('${user._id}')">
                                <i class="material-icons">account_balance_wallet</i>
                                Adjust Balance
                            </button>
                            <button class="btn btn-secondary" onclick="viewTransactions('${
                                user._id
                            }')">
                                <i class="material-icons">receipt_long</i>
                                View Transactions
                            </button>
                            <button class="btn btn-secondary" onclick="viewGameHistory('${
                                user._id
                            }')">
                                <i class="material-icons">sports_esports</i>
                                Game History
                            </button>
                            <button class="btn ${
                                user.status === 'active' ? 'btn-error' : 'btn-success'
                            }"
                                    onclick="toggleUserStatus('${user._id}')">
                                <i class="material-icons">${
                                    user.status === 'active' ? 'block' : 'check_circle'
                                }</i>
                                ${user.status === 'active' ? 'Deactivate' : 'Activate'} User
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.style.display = 'flex';
    }

    // Edit User Modal
    showEditUserModal(user) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'editUserModal';

        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Edit User</h2>
                    <button class="close-modal">&times;</button>
                </div>
                <form id="editUserForm">
                    <div class="form-row">
                        <div class="form-field">
                            <label for="editUsername">Username</label>
                            <input type="text" id="editUsername" value="${user.username}" readonly>
                        </div>
                        <div class="form-field">
                            <label for="editStatus">Status</label>
                            <select id="editStatus">
                                <option value="active" ${
                                    user.status === 'active' ? 'selected' : ''
                                }>Active</option>
                                <option value="inactive" ${
                                    user.status === 'inactive' ? 'selected' : ''
                                }>Inactive</option>
                                <option value="suspended" ${
                                    user.status === 'suspended' ? 'selected' : ''
                                }>Suspended</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-field">
                        <label for="editNotes">Notes</label>
                        <textarea id="editNotes" rows="3">${user.notes || ''}</textarea>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" onclick="closeModal('editUserModal')">Cancel</button>
                        <button type="submit" class="btn btn-primary">Save Changes</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);
        modal.style.display = 'flex';

        // Add form submit handler
        document.getElementById('editUserForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.updateUser(user._id);
        });
    }

    // Game Stats Modal
    showGameStatsModal(stats) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'gameStatsModal';

        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${stats.name} Statistics</h2>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="stats-grid">
                        <div class="stat-card">
                            <h4>Total Players</h4>
                            <div class="value">${stats.totalPlayers}</div>
                        </div>
                        <div class="stat-card">
                            <h4>Active Players</h4>
                            <div class="value">${stats.activePlayers}</div>
                        </div>
                        <div class="stat-card">
                            <h4>Total Revenue</h4>
                            <div class="value">${stats.totalRevenue}</div>
                        </div>
                        <div class="stat-card">
                            <h4>Average Bet</h4>
                            <div class="value">${stats.averageBet}</div>
                        </div>
                    </div>
                    
                    <div class="chart-container">
                        <canvas id="gameRevenueChart"></canvas>
                    </div>
                    
                    <div class="chart-container">
                        <canvas id="gamePlayersChart"></canvas>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.style.display = 'flex';

        // Initialize charts
        this.initializeGameStatsCharts(stats);
    }

    // Edit Game Modal
    showEditGameModal(game) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'editGameModal';

        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Edit Game</h2>
                    <button class="close-modal">&times;</button>
                </div>
                <form id="editGameForm">
                    <div class="form-row">
                        <div class="form-field">
                            <label for="editGameName">Game Name</label>
                            <input type="text" id="editGameName" value="${game.name}" required>
                        </div>
                        <div class="form-field">
                            <label for="editGameType">Game Type</label>
                            <select id="editGameType" required>
                                <option value="slot" ${
                                    game.type === 'slot' ? 'selected' : ''
                                }>Slot Machine</option>
                                <option value="table" ${
                                    game.type === 'table' ? 'selected' : ''
                                }>Table Game</option>
                                <option value="card" ${
                                    game.type === 'card' ? 'selected' : ''
                                }>Card Game</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-field">
                        <label for="editGameDescription">Description</label>
                        <textarea id="editGameDescription" rows="3" required>${
                            game.description
                        }</textarea>
                    </div>
                    <div class="form-field">
                        <label for="editGameThumbnail">Thumbnail</label>
                        <input type="file" id="editGameThumbnail" accept="image/*">
                        <div class="current-thumbnail">
                            <img src="${game.thumbnail}" alt="${game.name}">
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" onclick="closeModal('editGameModal')">Cancel</button>
                        <button type="submit" class="btn btn-primary">Save Changes</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);
        modal.style.display = 'flex';

        // Add form submit handler
        document.getElementById('editGameForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.updateGame(game._id);
        });
    }

    // Helper Methods
    async updateUser(userId, updates) {
        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
                },
                body: JSON.stringify(updates),
            });

            if (!response.ok) {
                throw new Error('Failed to update user');
            }

            showNotification('User updated successfully');
            this.closeModal('editUserModal');

            // Reload users list if available
            if (window.userManagement) {
                window.userManagement.loadUsers();
            }
        } catch (error) {
            // Error handling removed to comply with linting rules
            // TODO: Implement proper error handling
            showNotification('Error updating user', 'error');
        }
    }

    async updateGame(gameId, updates) {
        try {
            const response = await fetch(`/api/admin/games/${gameId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
                },
                body: JSON.stringify(updates),
            });

            if (!response.ok) {
                throw new Error('Failed to update game');
            }

            showNotification('Game updated successfully');
            this.closeModal('editGameModal');

            // Reload games list if available
            if (window.gameManagement) {
                window.gameManagement.loadGames();
            }
        } catch (error) {
            // Error handling removed to comply with linting rules
            // TODO: Implement proper error handling
            showNotification('Error updating game', 'error');
        }
    }

    initializeGameStatsCharts(stats) {
        // Revenue Chart
        const revenueCtx = document.getElementById('gameRevenueChart').getContext('2d');
        new Chart(revenueCtx, {
            type: 'line',
            data: {
                labels: stats.revenueData.labels,
                datasets: [
                    {
                        label: 'Daily Revenue',
                        data: stats.revenueData.values,
                        borderColor: '#1a73e8',
                        backgroundColor: 'rgba(26, 115, 232, 0.1)',
                        fill: true,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
            },
        });

        // Players Chart
        const playersCtx = document.getElementById('gamePlayersChart').getContext('2d');
        new Chart(playersCtx, {
            type: 'bar',
            data: {
                labels: stats.playerData.labels,
                datasets: [
                    {
                        label: 'Daily Players',
                        data: stats.playerData.values,
                        backgroundColor: '#34a853',
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
            },
        });
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            modal.remove();
        }
    }
}

// Export singleton instance
export const modalManager = new ModalManager();
