import { showNotification, formatCurrency } from './dashboard.js';

class GameManagement {
    constructor() {
        this.games = [];
        this.currentPage = 1;
        this.totalPages = 1;
        this.searchTerm = '';
        this.typeFilter = 'all';

        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Add game form
        document.getElementById('addGameForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addGame();
        });

        // Search input
        const searchInput = document.querySelector('.search-box input');
        searchInput.addEventListener(
            'input',
            this.debounce(() => {
                this.searchTerm = searchInput.value;
                this.loadGames();
            }, 500)
        );

        // Type filter
        document.getElementById('gameTypeFilter')?.addEventListener('change', (e) => {
            this.typeFilter = e.target.value;
            this.loadGames();
        });
    }

    async loadGames() {
        try {
            const response = await fetch(
                `/api/admin/games?page=${this.currentPage}&search=${this.searchTerm}&type=${this.typeFilter}`,
                {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
                    },
                }
            );

            if (!response.ok) {
                throw new Error('Failed to load games');
            }

            const data = await response.json();
            this.games = data.games;
            this.totalPages = data.totalPages;

            this.renderGames();
            this.updatePagination();
        } catch (error) {
            showNotification('Error loading games', 'error');
        }
    }

    renderGames() {
        const tbody = document.getElementById('gamesList');
        tbody.innerHTML = '';

        this.games.forEach((game) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div class="game-info">
                        <img src="${game.thumbnail}" alt="${game.name}" class="game-thumbnail">
                        <div>
                            <div class="game-name">${game.name}</div>
                            <div class="game-type">${game.type}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="status-badge ${game.status}">
                        ${game.status}
                    </span>
                </td>
                <td>${game.activePlayers}</td>
                <td>${formatCurrency(game.revenue)}</td>
                <td>
                    <button class="btn btn-icon" onclick="viewGameStats('${game._id}')">
                        <i class="material-icons">bar_chart</i>
                    </button>
                    <button class="btn btn-icon" onclick="editGame('${game._id}')">
                        <i class="material-icons">edit</i>
                    </button>
                    <button class="btn btn-icon" onclick="toggleGameStatus('${game._id}')">
                        <i class="material-icons">${
                            game.status === 'active' ? 'pause' : 'play_arrow'
                        }</i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    updatePagination() {
        const pagination = document.querySelector('.pagination');
        if (!pagination) return;

        let html = '';

        // Previous button
        html += `
            <button class="btn btn-icon" 
                    ${this.currentPage === 1 ? 'disabled' : ''}
                    onclick="changePage(${this.currentPage - 1})">
                <i class="material-icons">chevron_left</i>
            </button>
        `;

        // Page numbers
        for (let i = 1; i <= this.totalPages; i++) {
            html += `
                <button class="btn ${i === this.currentPage ? 'btn-primary' : 'btn-secondary'}"
                        onclick="changePage(${i})">
                    ${i}
                </button>
            `;
        }

        // Next button
        html += `
            <button class="btn btn-icon"
                    ${this.currentPage === this.totalPages ? 'disabled' : ''}
                    onclick="changePage(${this.currentPage + 1})">
                <i class="material-icons">chevron_right</i>
            </button>
        `;

        pagination.innerHTML = html;
    }

    async addGame() {
        try {
            const formData = new FormData();
            formData.append('name', document.getElementById('gameName').value);
            formData.append('type', document.getElementById('gameType').value);
            formData.append('description', document.getElementById('gameDescription').value);
            formData.append('thumbnail', document.getElementById('gameThumbnail').files[0]);

            const response = await fetch('/api/admin/games', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
                },
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Failed to add game');
            }

            showNotification('Game added successfully');
            document.getElementById('addGameForm').reset();
            document.getElementById('addGameModal').style.display = 'none';

            // Reload games list
            this.loadGames();
        } catch (error) {
            showNotification('Error adding game', 'error');
        }
    }

    async viewGameStats(gameId) {
        try {
            const response = await fetch(`/api/admin/games/${gameId}/stats`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to load game stats');
            }

            const stats = await response.json();
            this.showGameStatsModal(stats);
        } catch (error) {
            showNotification('Error loading game stats', 'error');
        }
    }

    async editGame(gameId) {
        try {
            const response = await fetch(`/api/admin/games/${gameId}`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to load game details');
            }

            const game = await response.json();
            this.showEditGameModal(game);
        } catch (error) {
            showNotification('Error loading game details', 'error');
        }
    }

    async toggleGameStatus(gameId) {
        try {
            const game = this.games.find((g) => g._id === gameId);
            const newStatus = game.status === 'active' ? 'inactive' : 'active';

            const response = await fetch(`/api/admin/games/${gameId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
                },
                body: JSON.stringify({ status: newStatus }),
            });

            if (!response.ok) {
                throw new Error('Failed to update game status');
            }

            showNotification(
                `Game ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`
            );
            this.loadGames();
        } catch (error) {
            showNotification('Error updating game status', 'error');
        }
    }

    showGameStatsModal() {
        // TODO: Implement game stats modal
    }

    showEditGameModal() {
        // TODO: Implement edit game modal
    }

    changePage(page) {
        if (page < 1 || page > this.totalPages) return;
        this.currentPage = page;
        this.loadGames();
    }

    debounce(func, wait) {
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
}

// Initialize game management when the games section is shown
document.querySelector('a[href="#games"]').addEventListener('click', () => {
    if (!window.gameManagement) {
        window.gameManagement = new GameManagement();
    }
    window.gameManagement.loadGames();
});
