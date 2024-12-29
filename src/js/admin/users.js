import { showNotification, formatDateTime } from './dashboard.js';

class UserManagement {
    constructor() {
        this.users = [];
        this.currentPage = 1;
        this.totalPages = 1;
        this.searchTerm = '';
        this.statusFilter = 'all';

        this.initializeEventListeners();
        this.initializeModals();
    }

    initializeEventListeners() {
        // Create user form
        document.getElementById('createUserForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createUser();
        });

        // Search input
        const searchInput = document.querySelector('.search-box input');
        searchInput.addEventListener(
            'input',
            this.debounce(() => {
                this.searchTerm = searchInput.value;
                this.loadUsers();
            }, 500)
        );

        // Status filter
        document.getElementById('statusFilter')?.addEventListener('change', (e) => {
            this.statusFilter = e.target.value;
            this.loadUsers();
        });
    }

    initializeModals() {
        // Add modal close handlers
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            const closeButtons = modal.querySelectorAll('.close-modal, .cancel-btn');
            closeButtons.forEach(button => {
                button.addEventListener('click', () => this.hideModal(modal.id));
            });

            // Close modal when clicking outside
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideModal(modal.id);
                }
            });
        });
    }

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            // Reset form if it exists
            const form = modal.querySelector('form');
            if (form) {
                form.reset();
            }
        }
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'block';
        }
    }

    async loadUsers() {
        try {
            const response = await fetch(
                `/api/admin/users?page=${this.currentPage}&search=${this.searchTerm}&status=${this.statusFilter}`,
                {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
                    },
                }
            );

            if (!response.ok) {
                throw new Error('Failed to load users');
            }

            const data = await response.json();
            this.users = data.users;
            this.totalPages = data.totalPages;

            this.renderUsers();
            this.updatePagination();
        } catch (error) {
            showNotification('Error loading users', 'error');
        }
    }

    renderUsers() {
        const tbody = document.getElementById('usersList');
        tbody.innerHTML = '';

        this.users.forEach((user) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${user.username}</td>
                <td>
                    <span class="status-badge ${user.status}">
                        ${user.status}
                    </span>
                </td>
                <td>${user.balance}</td>
                <td>${formatDateTime(user.lastLogin)}</td>
                <td>
                    <button class="btn btn-icon" onclick="viewUser('${user._id}')">
                        <i class="material-icons">visibility</i>
                    </button>
                    <button class="btn btn-icon" onclick="editUser('${user._id}')">
                        <i class="material-icons">edit</i>
                    </button>
                    <button class="btn btn-icon" onclick="toggleUserStatus('${user._id}')">
                        <i class="material-icons">${
                            user.status === 'active' ? 'block' : 'check_circle'
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

    async createUser() {
        try {
            const username = document.getElementById('newUsername').value;
            const initialBalance = parseFloat(document.getElementById('initialBalance').value);
            const notes = document.getElementById('userNotes').value;

            const response = await fetch('/api/admin/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                },
                body: JSON.stringify({
                    username,
                    initialBalance,
                    notes,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message);
            }

            showNotification('User created successfully');
            document.getElementById('createUserForm').reset();
            this.hideModal('createUserModal');

            // Reload users list
            this.loadUsers();
        } catch (error) {
            showNotification('Error creating user: ' + error.message, 'error');
        }
    }

    async viewUser(userId) {
        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to load user details');
            }

            const user = await response.json();
            this.showUserDetailsModal(user);
        } catch (error) {
            showNotification('Error loading user details', 'error');
        }
    }

    async editUser(userId) {
        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to load user details');
            }

            const user = await response.json();
            this.showEditUserModal(user);
        } catch (error) {
            showNotification('Error loading user details', 'error');
        }
    }

    async toggleUserStatus(userId) {
        try {
            const user = this.users.find((u) => u._id === userId);
            const newStatus = user.status === 'active' ? 'inactive' : 'active';

            const response = await fetch(`/api/admin/users/${userId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
                },
                body: JSON.stringify({ status: newStatus }),
            });

            if (!response.ok) {
                throw new Error('Failed to update user status');
            }

            showNotification(
                `User ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`
            );
            this.loadUsers();
        } catch (error) {
            showNotification('Error updating user status', 'error');
        }
    }

    showUserDetailsModal() {
        // TODO: Implement user details modal
    }

    showEditUserModal() {
        // TODO: Implement edit user modal
    }

    changePage(page) {
        if (page < 1 || page > this.totalPages) return;
        this.currentPage = page;
        this.loadUsers();
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

// Initialize user management when the users section is shown
document.querySelector('a[href="#users"]').addEventListener('click', () => {
    if (!window.userManagement) {
        window.userManagement = new UserManagement();
    }
    window.userManagement.loadUsers();
});

// Export modal functions to global scope for inline button handlers
window.hideModal = (modalId) => {
    if (window.userManagement) {
        window.userManagement.hideModal(modalId);
    }
};

window.showModal = (modalId) => {
    if (window.userManagement) {
        window.userManagement.showModal(modalId);
    }
};
