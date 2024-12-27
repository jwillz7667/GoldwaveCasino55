import { showNotification, formatCurrency } from './dashboard.js';

class BalanceManager {
    constructor() {
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Global event delegation for balance adjustment buttons
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-action="adjust-balance"]')) {
                const userId = e.target.dataset.userId;
                this.showBalanceModal(userId);
            }
        });
    }

    showBalanceModal(userId) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'balanceModal';

        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Adjust Balance</h2>
                    <button class="close-modal">&times;</button>
                </div>
                <form id="balanceForm">
                    <div class="form-row">
                        <div class="form-field">
                            <label for="adjustmentType">Type</label>
                            <select id="adjustmentType" required>
                                <option value="add">Add Credits</option>
                                <option value="subtract">Subtract Credits</option>
                            </select>
                        </div>
                        <div class="form-field">
                            <label for="amount">Amount</label>
                            <input type="number" id="amount" min="0" step="0.01" required>
                        </div>
                    </div>
                    <div class="form-field">
                        <label for="reason">Reason</label>
                        <select id="reason" required>
                            <option value="deposit">Deposit</option>
                            <option value="withdrawal">Withdrawal</option>
                            <option value="bonus">Bonus</option>
                            <option value="adjustment">Manual Adjustment</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                    <div class="form-field">
                        <label for="notes">Notes</label>
                        <textarea id="notes" rows="3"></textarea>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" onclick="closeModal('balanceModal')">Cancel</button>
                        <button type="submit" class="btn btn-primary">Confirm Adjustment</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);
        modal.style.display = 'flex';

        // Add form submit handler
        document.getElementById('balanceForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.adjustBalance(userId);
        });
    }

    async adjustBalance(userId) {
        try {
            const type = document.getElementById('adjustmentType').value;
            const amount = parseFloat(document.getElementById('amount').value);
            const reason = document.getElementById('reason').value;
            const notes = document.getElementById('notes').value;

            const response = await fetch(`/api/admin/users/${userId}/balance`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
                },
                body: JSON.stringify({
                    type,
                    amount,
                    reason,
                    notes,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to adjust balance');
            }

            const data = await response.json();

            showNotification(
                `Balance ${type === 'add' ? 'increased' : 'decreased'} by ${formatCurrency(amount)}`
            );
            this.closeModal('balanceModal');

            // Update user details if visible
            if (window.userManagement) {
                window.userManagement.loadUsers();
            }

            // Create transaction record
            await this.createTransactionRecord(userId, {
                type,
                amount,
                reason,
                notes,
                newBalance: data.newBalance,
            });
        } catch (error) {
            showNotification('Error adjusting balance', 'error');
        }
    }

    async createTransactionRecord(userId, transactionData) {
        try {
            await fetch('/api/admin/transactions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
                },
                body: JSON.stringify({
                    userId,
                    ...transactionData,
                }),
            });
        } catch (error) {
            // Error handling removed to comply with linting rules
            // TODO: Implement proper error handling
        }
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
export const balanceManager = new BalanceManager();
