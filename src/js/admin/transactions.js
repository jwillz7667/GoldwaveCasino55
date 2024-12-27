import { showNotification, formatCurrency, formatDateTime } from './dashboard.js';

class TransactionManagement {
    constructor() {
        this.transactions = [];
        this.currentPage = 1;
        this.totalPages = 1;
        this.filters = {
            type: 'all',
            startDate: null,
            endDate: null,
        };

        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Transaction type filter
        document.getElementById('transactionType').addEventListener('change', (e) => {
            this.filters.type = e.target.value;
            this.loadTransactions();
        });

        // Date filters
        document.getElementById('startDate').addEventListener('change', (e) => {
            this.filters.startDate = e.target.value;
            this.loadTransactions();
        });

        document.getElementById('endDate').addEventListener('change', (e) => {
            this.filters.endDate = e.target.value;
            this.loadTransactions();
        });
    }

    async loadTransactions() {
        try {
            const queryParams = new URLSearchParams({
                page: this.currentPage,
                type: this.filters.type,
                startDate: this.filters.startDate || '',
                endDate: this.filters.endDate || '',
            });

            const response = await fetch(`/api/admin/transactions?${queryParams}`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to load transactions');
            }

            const data = await response.json();
            this.transactions = data.transactions;
            this.totalPages = data.totalPages;

            this.renderTransactions();
            this.updatePagination();
            this.updateSummary(data.summary);
        } catch (error) {
            showNotification('Error loading transactions', 'error');
        }
    }

    renderTransactions() {
        const tbody = document.getElementById('transactionsList');
        tbody.innerHTML = '';

        this.transactions.forEach((transaction) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formatDateTime(transaction.timestamp)}</td>
                <td>${transaction.username}</td>
                <td>
                    <span class="transaction-type ${transaction.type}">
                        ${transaction.type}
                    </span>
                </td>
                <td>${formatCurrency(transaction.amount)}</td>
                <td>
                    <span class="status-badge ${transaction.status}">
                        ${transaction.status}
                    </span>
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

    updateSummary(summary) {
        const summaryContainer = document.querySelector('.transactions-summary');
        if (!summaryContainer) return;

        summaryContainer.innerHTML = `
            <div class="summary-card">
                <h3>Total Transactions</h3>
                <div class="value">${summary.totalCount}</div>
            </div>
            <div class="summary-card">
                <h3>Total Volume</h3>
                <div class="value">${formatCurrency(summary.totalVolume)}</div>
            </div>
            <div class="summary-card">
                <h3>Deposits</h3>
                <div class="value">${formatCurrency(summary.totalDeposits)}</div>
            </div>
            <div class="summary-card">
                <h3>Withdrawals</h3>
                <div class="value">${formatCurrency(summary.totalWithdrawals)}</div>
            </div>
        `;
    }

    async exportTransactions() {
        try {
            const queryParams = new URLSearchParams({
                type: this.filters.type,
                startDate: this.filters.startDate || '',
                endDate: this.filters.endDate || '',
                format: 'csv',
            });

            const response = await fetch(`/api/admin/transactions/export?${queryParams}`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to export transactions');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            showNotification('Transactions exported successfully');
        } catch (error) {
            showNotification('Error exporting transactions', 'error');
        }
    }

    changePage(page) {
        if (page < 1 || page > this.totalPages) return;
        this.currentPage = page;
        this.loadTransactions();
    }
}

// Initialize transaction management when the transactions section is shown
document.querySelector('a[href="#transactions"]').addEventListener('click', () => {
    if (!window.transactionManagement) {
        window.transactionManagement = new TransactionManagement();
    }
    window.transactionManagement.loadTransactions();
});
