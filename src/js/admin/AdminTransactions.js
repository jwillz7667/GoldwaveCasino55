export class AdminTransactions {
    async loadTransactions() {
        try {
            const response = await fetch('/api/admin/transactions');
            if (!response.ok) {
                throw new Error('Failed to load transactions');
            }
            return await response.json();
        } catch (error) {
            console.error('Error loading transactions:', error);
            return [];
        }
    }

    async getTransactionDetails(transactionId) {
        try {
            const response = await fetch(`/api/admin/transactions/${transactionId}`);
            if (!response.ok) {
                throw new Error('Failed to load transaction details');
            }
            return await response.json();
        } catch (error) {
            console.error('Error loading transaction details:', error);
            throw error;
        }
    }

    async updateTransactionStatus(transactionId, status) {
        try {
            const response = await fetch(`/api/admin/transactions/${transactionId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status })
            });
            
            if (!response.ok) {
                throw new Error('Failed to update transaction status');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error updating transaction status:', error);
            throw error;
        }
    }
} 